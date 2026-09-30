/**
 * 用 PGlite（WASM 版 Postgres）驗證 migration：以 Supabase 的 anon 角色測試權限與 function。
 * 執行：pnpm test:db
 */
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS = join(ROOT, 'supabase/migrations')

const avatar = {
  gender: 'male', build: 'male', head: 'male', skin: 'amber', eye: 'blue', face: 'happy', hair: 'bangsshort', hairColor: 'black',
  top: 'singlet', topColor: 'red', legs: 'shortshorts', legsColor: 'black', shoesColor: 'white', band: 'none', bandColor: 'white',
}

let failed = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `（${detail}）` : ''}`)
  if (!ok) failed++
}

async function expectError(db: PGlite, label: string, sql: string, params: unknown[], pattern: RegExp) {
  try {
    await db.query(sql, params)
    check(label, false, '沒有錯誤')
  } catch (e) {
    const msg = (e as Error).message
    check(label, pattern.test(msg), msg)
  }
}

const db = new PGlite()
// Supabase 內建的角色與 auth schema（auth.uid() 讀 JWT 的 sub）
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated;
  create publication supabase_realtime;
  -- 比照 Supabase：新建的資料表與 function 預設直接授權給 anon、authenticated（不是透過 PUBLIC）
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`)
for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
  console.log(`› 套用 ${f}`)
}

const [alice, bob, carol, dave, host] = ['a', 'b', 'c', 'd', 'e'].map((c) => `00000000-0000-0000-0000-00000000000${c}`)
const emailOf = (uid: string) => `${uid.slice(-1)}@example.com`
for (const u of [alice, bob, carol, dave, host]) await db.query('insert into auth.users (id, email) values ($1, $2)', [u, emailOf(u)])

/** 切換成某個已登入的使用者；null 表示未登入（anon） */
async function as(uid: string | null) {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, email: emailOf(uid).toUpperCase() }) : ''])
  await db.exec(uid ? 'set role authenticated' : 'set role anon')
}
const register = 'select public.register_player($1, $2) as id'

// 未登入
await as(null)
await expectError(db, '未登入不能報名', register, ['路人', avatar], /permission denied/)
await expectError(db, '未登入不能取回資料', 'select * from public.get_my_player()', [], /permission denied/)
await expectError(db, '未登入不能呼叫 is_admin', 'select public.is_admin()', [], /permission denied/)
await db.exec('reset role; set role authenticated')
await expectError(db, 'authenticated 但沒有 uid', register, ['路人', avatar], /not_signed_in/)
for (const fn of ['require_uid()', 'require_admin()', 'my_player_id()', 'draw_sync()']) {
  await expectError(db, `登入者不能直接呼叫 ${fn}`, `select public.${fn}`, [], /permission denied/)
}

// 報名
await as(alice)
const r1 = await db.query<{ id: string }>(register, ['  Eason   Chen ', avatar])
check('報名成功並回傳 id', !!r1.rows[0]?.id)
const names = await db.query<{ name: string }>('select name from public.players')
check('名字已正規化', names.rows[0]?.name === 'Eason Chen', names.rows[0]?.name)
await expectError(db, '同一個帳號不能報名兩次', register, ['第二隻', avatar], /already_registered/)

await as(bob)
await expectError(db, '重複名字（不分大小寫）', register, ['eason chen', avatar], /name_taken/)
await expectError(db, '空白名字', register, ['   ', avatar], /invalid_name/)
await expectError(db, '21 個字', register, ['一'.repeat(21), avatar], /invalid_name/)
await expectError(db, '造型缺欄位', register, ['缺欄位', { ...avatar, band: undefined }], /invalid_avatar/)
await expectError(db, '造型多欄位', register, ['多欄位', { ...avatar, x: 'y' }], /invalid_avatar/)
await expectError(db, '造型欄位非字串', register, ['非字串', { ...avatar, hair: 1 }], /invalid_avatar/)
await expectError(db, '造型 gender 不合法', register, ['性別', { ...avatar, gender: 'x' }], /invalid_avatar/)
const r20 = await db.query(register, ['二'.repeat(20), avatar])
check('20 個字可以', r20.rows.length === 1)

await as(carol)
const withAcc = { ...avatar, hat: 'christmas', hatColor: 'red', glasses: 'sunglasses', glassesColor: 'black' }
await expectError(db, '帽子欄位非字串', register, ['帽子錯', { ...withAcc, hat: 1 }], /invalid_avatar/)
const rAcc = await db.query(register, ['戴帽子', withAcc])
check('含帽子與眼鏡的造型可以報名', rAcc.rows.length === 1)

// 讀取
for (const uid of [null, alice]) {
  await as(uid)
  const who = uid ? 'authenticated' : 'anon'
  const pub = await db.query('select id, name, avatar, created_at from public.players')
  check(`${who} 可讀公開欄位`, pub.rows.length === 3)
  await expectError(db, `${who} 讀不到 user_id`, 'select user_id from public.players', [], /permission denied/)
  await expectError(db, `${who} 不能 select *`, 'select * from public.players', [], /permission denied/)
  await expectError(db, `${who} 不能直接 insert`, `insert into public.players (name, avatar) values ('x', $1)`, [avatar], /permission denied/)
  await expectError(db, `${who} 不能直接 update`, `update public.players set name = 'x'`, [], /permission denied/)
  await expectError(db, `${who} 不能直接 delete`, 'delete from public.players', [], /permission denied/)
}

// 取回自己的資料
await as(alice)
const mine = await db.query<{ name: string }>('select * from public.get_my_player()')
check('取回自己的資料', mine.rows.length === 1 && mine.rows[0]?.name === 'Eason Chen')
await as(dave)
const none = await db.query('select * from public.get_my_player()')
check('還沒報名的帳號取不到資料', none.rows.length === 0)
await expectError(db, '還沒報名的帳號不能修改', 'select public.update_player($1, $2)', ['壞人', avatar], /not_registered/)

// 修改
await as(alice)
await db.query('select public.update_player($1, $2)', ['小明', { ...avatar, hair: 'bob' }])
const after = await db.query<{ name: string; avatar: { hair: string } }>(`select name, avatar from public.players where name = '小明'`)
check('可修改自己的名字與造型', after.rows[0]?.avatar.hair === 'bob')
const bobs = await db.query<{ name: string }>(`select name from public.players where name = $1`, ['二'.repeat(20)])
check('不會改到別人的資料', bobs.rows.length === 1)
await expectError(db, '改成別人的名字', 'select public.update_player($1, $2)', ['二'.repeat(20), avatar], /name_taken/)
await db.query('select public.update_player($1, $2)', ['小明', avatar])
check('名字不變、只改造型可以', true)

// ================= 搶答跑位遊戲 =================
await db.exec('reset role')
await db.exec(`insert into public.admins (email) values ('${emailOf(host)}')`)
const q = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params)
const tf = ['是', '否']

// 題庫
await as(bob)
await expectError(db, '非主持人不能新增題目', `insert into public.quiz_questions (prompt, choices, answer) values ('x', $1, 0)`, [tf], /row-level security/)
check('非主持人讀不到題庫', (await q('select * from public.quiz_questions')).rows.length === 0)
await expectError(db, '非主持人不能建立場次', `select public.create_game('XMAS')`, [], /forbidden/)
check('非主持人 is_admin 為 false', (await q('select public.is_admin() as v')).rows[0].v === false)

await as(host)
check('主持人 is_admin 為 true（email 不分大小寫）', (await q('select public.is_admin() as v')).rows[0].v === true)
await expectError(db, '沒有題目不能建立場次', `select public.create_game('XMAS')`, [], /no_questions/)
await q(`insert into public.quiz_questions (position, prompt, choices, answer, seconds) values
  (1, '聖誕老人住在北極？', $1, 0, 10),
  (2, '麋鹿魯道夫的鼻子是什麼顏色？', $2, 2, 10)`, [tf, ['藍', '綠', '紅', '黃']])
check('主持人可讀題庫', (await q('select * from public.quiz_questions')).rows.length === 2)
await expectError(db, '答案超出選項', `insert into public.quiz_questions (prompt, choices, answer) values ('x', $1, 2)`, [tf], /answer_valid/)
await expectError(db, '只有一個選項', `insert into public.quiz_questions (prompt, choices, answer) values ('x', $1, 0)`, [['a']], /check constraint/)
await expectError(db, '空白選項', `insert into public.quiz_questions (prompt, choices, answer) values ('x', $1, 0)`, [['a', ' ']], /check constraint/)
await expectError(db, '代碼格式錯誤', `select public.create_game('聖誕')`, [], /invalid_code/)
const game = (await q(`select public.create_game(' xmas24 ') as id`)).rows[0].id as string
check('建立場次，代碼轉大寫', (await q('select code, status from public.games where id = $1', [game])).rows[0].code === 'XMAS24')
await expectError(db, '進行中的代碼不能重複', `select public.create_game('XMAS24')`, [], /code_taken/)

// 加入
await as(dave)
await expectError(db, '還沒報名不能加入', `select public.join_game('XMAS24')`, [], /not_registered/)
await as(bob)
await expectError(db, '代碼錯誤', `select public.join_game('NOPE')`, [], /game_not_found/)
check('用小寫代碼加入', (await q(`select public.join_game('xmas24') as id`)).rows[0].id === game)
check('重複加入不會出錯', (await q(`select public.join_game('XMAS24') as id`)).rows[0].id === game)
await expectError(db, '還沒開始不能作答', 'select public.set_answer($1, 0, 0::smallint)', [game], /too_late/)
await as(carol)
await q(`select public.join_game('XMAS24')`)
check('看得到 2 位參加者', (await q('select * from public.game_players where game_id = $1', [game])).rows.length === 2)
await expectError(db, '玩家不能開始題目', 'select public.next_question($1)', [game], /forbidden/)
await expectError(db, '玩家不能直接改場次', `update public.games set status = 'finished'`, [], /permission denied/)
await expectError(db, '玩家讀不到作答紀錄', 'select * from public.game_answers', [], /permission denied/)

// 第 1 題（是非）
await as(host)
await q('select public.next_question($1)', [game])
const g1 = (await q('select * from public.games where id = $1', [game])).rows[0]
check('第 1 題開始，公開題目但不公開答案', g1.status === 'question' && g1.q_index === 0 && g1.q_prompt === '聖誕老人住在北極？' && g1.q_answer === null)
await expectError(db, '作答中不能再按下一題', 'select public.next_question($1)', [game], /invalid_state/)
await as(bob)
await q('select public.set_answer($1, 0, 1::smallint)', [game])
await q('select public.set_answer($1, 0, 0::smallint)', [game])
check('換區以最後一次為準', (await q('select public.my_answer($1, 0) as c', [game])).rows[0].c === 0)
await expectError(db, '選項超出範圍', 'select public.set_answer($1, 0, 2::smallint)', [game], /invalid_choice/)
await expectError(db, '題號不對', 'select public.set_answer($1, 1, 0::smallint)', [game], /too_late/)
await as(carol)
await q('select public.set_answer($1, 0, 1::smallint)', [game])
await as(dave)
await expectError(db, '沒報名不能作答', 'select public.set_answer($1, 0, 0::smallint)', [game], /not_registered/)
await as(host)
await q('select public.reveal_question($1)', [game])
const r1g = (await q('select * from public.games where id = $1', [game])).rows[0]
check('公布答案', r1g.status === 'reveal' && r1g.q_answer === 0)
await as(bob)
await expectError(db, '公布後不能再改答案', 'select public.set_answer($1, 0, 1::smallint)', [game], /too_late/)
const lb1 = (await q('select name, score, rank from public.game_leaderboard($1)', [game])).rows
check('第 1 題後排名', lb1[0]?.score === 1 && lb1[0]?.rank === 1 && lb1[1]?.score === 0 && lb1[1]?.rank === 2, JSON.stringify(lb1))

// 第 2 題（四選一），時間到才作答
await as(host)
await q('select public.next_question($1)', [game])
await as(carol)
await q('select public.set_answer($1, 1, 2::smallint)', [game])
await db.exec('reset role')
await db.exec(`update public.games set q_ends_at = now() - interval '2 seconds' where id = '${game}'`)
await as(bob)
await expectError(db, '超過時間不能作答', 'select public.set_answer($1, 1, 2::smallint)', [game], /too_late/)
await as(host)
await q('select public.reveal_question($1)', [game])
const lb2 = (await q('select name, score, rank from public.game_leaderboard($1)', [game])).rows
check('同分同名次', lb2.every((r) => r.score === 1 && r.rank === 1), JSON.stringify(lb2))

// 結束
await q('select public.next_question($1)', [game])
check('最後一題之後自動結束', (await q('select status from public.games where id = $1', [game])).rows[0].status === 'finished')
await as(bob)
await expectError(db, '結束的場次不能加入', `select public.join_game('XMAS24')`, [], /game_not_found/)
await as(host)
const game2 = (await q(`select public.create_game('XMAS24') as id`)).rows[0].id
check('結束後代碼可以重用', !!game2 && game2 !== game)
await q('select public.finish_game($1)', [game2])
check('主持人可提早結束場次', (await q('select status from public.games where id = $1', [game2])).rows[0].status === 'finished')

// ================= 接力抽禮物 =================
await as(bob)
await expectError(db, '非主持人不能看籤池', 'select * from public.draw_pool()', [], /forbidden/)
await expectError(db, '非主持人不能抽', 'select * from public.draw_next()', [], /forbidden/)
await expectError(db, '玩家讀不到籤池資料表', 'select * from public.draw_entries', [], /permission denied/)
await as(host)
const pool0 = (await q('select * from public.draw_pool()')).rows
check('籤池自動包含所有報名角色', pool0.length === 3 && pool0.every((r) => r.player_id && r.avatar && r.draw_order === null), JSON.stringify(pool0.map((r) => r.name)))
const manual = (await q(`select public.draw_add_name('  沒報名的 人 ') as id`)).rows[0].id as string
await expectError(db, '空白名字不能加', `select public.draw_add_name('  ')`, [], /invalid_name/)
const pool1 = (await q('select * from public.draw_pool()')).rows
check('手動加入的名字（正規化、沒有造型）', pool1.length === 4 && pool1.some((r) => r.id === manual && r.name === '沒報名的 人' && r.avatar === null))
const excludedId = pool1.find((r) => r.name === '戴帽子')!.id
await q('select public.draw_set_excluded($1, true)', [excludedId])
await q('select public.draw_remove_name($1)', [pool1.find((r) => r.player_id)!.id])
check('報名的角色不能用刪除移除', (await q('select * from public.draw_pool()')).rows.length === 4)

const drawn: string[] = []
for (let i = 0; i < 3; i++) {
  const r = (await q('select * from public.draw_next(5000)')).rows[0]
  drawn.push(r.id as string)
  check(`第 ${i + 1} 次抽出第 ${i + 1} 位，不會抽到排除的人`, r.draw_order === i + 1 && r.id !== excludedId && new Date(r.reveal_at as string).getTime() > Date.now() + 3000)
}
check('三次抽到三個不同的人', new Set(drawn).size === 3)
await expectError(db, '抽完了', 'select * from public.draw_next()', [], /pool_empty/)
await as(bob)
const st = (await q('select * from public.draw_state')).rows[0]
check('玩家讀得到最新結果', st.entry_id === drawn[2] && st.draw_order === 3 && st.seq === 3)

await as(host)
await q('select public.draw_put_back($1)', [drawn[0]])
const orders = (await q('select id, draw_order from public.draw_pool()')).rows
const orderOf = (id: string) => orders.find((r) => r.id === id)?.draw_order
check('放回第 1 位，後面的順序往前補', orderOf(drawn[0]) === null && orderOf(drawn[1]) === 1 && orderOf(drawn[2]) === 2, JSON.stringify(orders))
const again = (await q('select * from public.draw_next()')).rows[0]
check('放回的人可以再抽到，順序接在最後', again.id === drawn[0] && again.draw_order === 3)
await q('select public.draw_remove_name($1)', [manual])
await q('select public.draw_reset()')
const afterReset = (await q('select * from public.draw_pool()')).rows
check('重設後全部回到籤池、手動名字已刪除、排除保留', afterReset.length === 3 && afterReset.every((r) => r.draw_order === null) && afterReset.find((r) => r.id === excludedId)?.excluded === true)
check('重設後最新結果清空', (await q('select entry_id from public.draw_state')).rows[0].entry_id === null)

// ================= 報名管理 =================
await as(bob)
await expectError(db, '非主持人不能看報名管理', 'select * from public.admin_players()', [], /forbidden/)
await expectError(db, '非主持人不能改名', 'select public.admin_rename_player(gen_random_uuid(), $1)', ['x'], /forbidden/)
await expectError(db, '非主持人不能刪除', 'select public.admin_delete_player(gen_random_uuid())', [], /forbidden/)
await as(host)
const regs = (await q('select * from public.admin_players()')).rows
check('主持人看得到所有報名與 email', regs.length === 3 && regs.every((r) => typeof r.email === 'string' && (r.email as string).endsWith('@example.com')), JSON.stringify(regs.map((r) => [r.name, r.email])))
const carolRow = regs.find((r) => r.email === emailOf(carol))!
await expectError(db, '改成別人的名字', 'select public.admin_rename_player($1, $2)', [carolRow.id, '二'.repeat(20)], /name_taken/)
await expectError(db, '改成空白', 'select public.admin_rename_player($1, $2)', [carolRow.id, '  '], /invalid_name/)
await q('select public.admin_rename_player($1, $2)', [carolRow.id, '  帽子 人 '])
check('主持人可以改名（正規化）', (await q('select name from public.players where id = $1', [carolRow.id])).rows[0]?.name === '帽子 人')
await q('select public.admin_delete_player($1)', [carolRow.id])
check('刪除角色後一併移出遊戲紀錄與籤池', (await q('select 1 from public.game_players where player_id = $1', [carolRow.id])).rows.length === 0 && (await q('select * from public.draw_pool()')).rows.every((r) => r.player_id !== carolRow.id))
await as(carol)
check('被刪除的人可以用同一個帳號重新報名', !!(await q(`select public.register_player('重新報名', $1) as id`, [avatar])).rows[0].id)

// 刪除帳號時連帶刪除角色
await db.exec('reset role')
await db.exec(`delete from auth.users where id = '${alice}'`)
const left = await db.query(`select 1 from public.players where name = '小明'`)
check('刪除帳號會一併刪除角色', left.rows.length === 0)

await db.close()

if (failed) {
  console.log(`\n${failed} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
