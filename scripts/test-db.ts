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
// Supabase 內建的角色
await db.exec(`create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;`)
for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
  console.log(`› 套用 ${f}`)
}

await db.exec('set role anon')

// 報名
const r1 = await db.query<{ id: string; edit_token: string }>('select * from public.register_player($1, $2)', ['  Eason   Chen ', avatar])
const me = r1.rows[0]
check('報名成功並回傳 id 與 edit_token', !!me?.id && !!me?.edit_token)

const names = await db.query<{ name: string }>('select name from public.players')
check('名字已正規化', names.rows[0]?.name === 'Eason Chen', names.rows[0]?.name)

await expectError(db, '重複名字（不分大小寫）', 'select * from public.register_player($1, $2)', ['eason chen', avatar], /name_taken/)
await expectError(db, '空白名字', 'select * from public.register_player($1, $2)', ['   ', avatar], /invalid_name/)
await expectError(db, '21 個字', 'select * from public.register_player($1, $2)', ['一'.repeat(21), avatar], /invalid_name/)
const r20 = await db.query('select * from public.register_player($1, $2)', ['二'.repeat(20), avatar])
check('20 個字可以', r20.rows.length === 1)
await expectError(db, '造型缺欄位', 'select * from public.register_player($1, $2)', ['缺欄位', { ...avatar, band: undefined }], /invalid_avatar/)
await expectError(db, '造型多欄位', 'select * from public.register_player($1, $2)', ['多欄位', { ...avatar, x: 'y' }], /invalid_avatar/)
await expectError(db, '造型欄位非字串', 'select * from public.register_player($1, $2)', ['非字串', { ...avatar, hair: 1 }], /invalid_avatar/)
await expectError(db, '造型 gender 不合法', 'select * from public.register_player($1, $2)', ['性別', { ...avatar, gender: 'x' }], /invalid_avatar/)

// 讀取
const pub = await db.query('select id, name, avatar, created_at from public.players')
check('anon 可讀公開欄位', pub.rows.length === 2)
await expectError(db, 'anon 讀不到 edit_token', 'select edit_token from public.players', [], /permission denied/)
await expectError(db, 'anon 不能 select *', 'select * from public.players', [], /permission denied/)

// 直接寫入
await expectError(db, 'anon 不能直接 insert', `insert into public.players (name, avatar) values ('x', $1)`, [avatar], /permission denied/)
await expectError(db, 'anon 不能直接 update', `update public.players set name = 'x'`, [], /permission denied/)
await expectError(db, 'anon 不能直接 delete', 'delete from public.players', [], /permission denied/)

// 取回自己的資料
const mine = await db.query<{ name: string }>('select * from public.get_my_player($1, $2)', [me.id, me.edit_token])
check('正確 token 取回自己的資料', mine.rows[0]?.name === 'Eason Chen')
const wrong = await db.query('select * from public.get_my_player($1, gen_random_uuid())', [me.id])
check('錯誤 token 取不到資料', wrong.rows.length === 0)

// 修改
await db.query('select public.update_player($1, $2, $3, $4)', [me.id, me.edit_token, '小明', { ...avatar, hair: 'bob' }])
const after = await db.query<{ name: string; avatar: { hair: string } }>('select name, avatar from public.players where id = $1', [me.id])
check('正確 token 可修改名字與造型', after.rows[0]?.name === '小明' && after.rows[0]?.avatar.hair === 'bob')
await expectError(db, '錯誤 token 不能修改', 'select public.update_player($1, gen_random_uuid(), $2, $3)', [me.id, '壞人', avatar], /forbidden/)
await expectError(db, '改成別人的名字', 'select public.update_player($1, $2, $3, $4)', [me.id, me.edit_token, '二'.repeat(20), avatar], /name_taken/)
await db.query('select public.update_player($1, $2, $3, $4)', [me.id, me.edit_token, '小明', avatar])
check('名字不變、只改造型可以', true)

await db.exec('reset role')
await db.close()

if (failed) {
  console.log(`\n${failed} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')
