/**
 * 正式環境負載測試：模擬 N 支手機同時玩搶答跑位，不寫入任何資料。
 *
 *   - 每支手機一條 WebSocket 連線（和真的手機一樣），另外用 REST 送位置訊息到「測試專用頻道」
 *   - 一個模擬主持畫面訂閱該頻道，計算收到幾則、延遲多少
 *   - 同時對資料庫送唯讀查詢（模擬作答時的資料庫請求），並測一次 N 人同時送出的尖峰
 *
 * 執行：pnpm load-test [人數=20] [送出間隔毫秒=400] [秒數=40]
 * 需要 .env.local 的 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY（公開 key）。
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => /^\w+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
const N = Number(process.argv[2] ?? 20)
const SEND_MS = Number(process.argv[3] ?? 400)
const SECONDS = Number(process.argv[4] ?? 40)
const TOPIC = `game-moves:loadtest-${Date.now()}`

const make = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((xs.length * p) / 100))] : NaN)
const stat = (xs: number[]) => `中位數 ${pct(xs, 50).toFixed(0)}ms、95% ${pct(xs, 95).toFixed(0)}ms、最慢 ${Math.max(...xs).toFixed(0)}ms`

function subscribe(ch: RealtimeChannel): Promise<void> {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('訂閱逾時')), 15000)
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        res()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        rej(err ?? new Error(status))
      }
    })
  })
}

async function main() {
  console.log(`模擬 ${N} 支手機，每 ${SEND_MS}ms 送一次位置，持續 ${SECONDS} 秒（頻道 ${TOPIC}）`)

  // 主持畫面
  const host = make()
  const received: number[] = []
  const systemNotes: string[] = []
  const hostCh = host
    .channel(TOPIC)
    .on('broadcast', { event: 'move' }, ({ payload }) => received.push(Date.now() - payload.ts))
    .on('system', {}, (p) => systemNotes.push(JSON.stringify(p).slice(0, 160)))
  await subscribe(hostCh)

  // 手機：各自一條 WebSocket（訂閱一個狀態頻道，模擬 game-state）＋ REST 送位置
  const phones: { sb: SupabaseClient; sender: RealtimeChannel }[] = []
  const t0 = Date.now()
  await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const sb = make()
      await subscribe(sb.channel(`loadtest-state-${t0}-${i}`))
      phones.push({ sb, sender: sb.channel(TOPIC) })
    }),
  )
  console.log(`✓ ${N + 1} 條 WebSocket 連線建立（${Date.now() - t0}ms）`)

  const sendLat: number[] = []
  const sendErr: string[] = []
  const dbLat: number[] = []
  const dbErr: string[] = []
  let sent = 0
  const end = Date.now() + SECONDS * 1000

  // 送位置
  const loops = phones.map(async ({ sender }, i) => {
    await sleep((SEND_MS / N) * i)
    let seq = 0
    while (Date.now() < end) {
      const t = Date.now()
      sent++
      sender
        .httpSend('move', { p: `phone-${i}`, x: Math.random(), y: Math.random(), ts: t, seq: seq++ })
        .then(() => sendLat.push(Date.now() - t))
        .catch((e: Error) => sendErr.push(e.message.slice(0, 80)))
      await sleep(SEND_MS)
    }
  })

  // 資料庫：每支手機每 2 秒一次唯讀查詢（模擬作答）
  const dbLoops = phones.map(async ({ sb }, i) => {
    await sleep(100 * i)
    while (Date.now() < end) {
      const t = Date.now()
      const { error } = await sb.from('players').select('id, name, avatar').limit(30)
      if (error) dbErr.push(error.message)
      else dbLat.push(Date.now() - t)
      await sleep(2000)
    }
  })

  // 尖峰：倒數結束時所有人同時作答
  await sleep((SECONDS * 1000) / 2)
  const burst: number[] = []
  const tb = Date.now()
  await Promise.all(
    phones.map(async ({ sb }) => {
      const t = Date.now()
      const { error } = await sb.from('players').select('id').limit(1)
      if (!error) burst.push(Date.now() - t)
      else dbErr.push(error.message)
    }),
  )
  const burstAll = Date.now() - tb

  await Promise.all([...loops, ...dbLoops])
  await sleep(3000)

  const lost = sent - received.length
  console.log('\n===== 結果 =====')
  console.log(`即時訊息：送出 ${sent} 則，主持畫面收到 ${received.length} 則，遺失 ${lost}（${((lost / sent) * 100).toFixed(1)}%）`)
  console.log(`  每秒約 ${(sent / SECONDS).toFixed(1)} 則送出 + ${(received.length / SECONDS).toFixed(1)} 則接收`)
  if (received.length) console.log(`  送達延遲：${stat(received)}`)
  if (sendLat.length) console.log(`  REST 送出耗時：${stat(sendLat)}`)
  console.log(`  送出失敗 ${sendErr.length} 次${sendErr.length ? '：' + [...new Set(sendErr)].slice(0, 3).join(' / ') : ''}`)
  if (systemNotes.length) console.log(`  系統訊息：${[...new Set(systemNotes)].slice(0, 3).join(' / ')}`)
  console.log(`資料庫查詢：${dbLat.length} 次成功、${dbErr.length} 次失敗；${dbLat.length ? stat(dbLat) : ''}`)
  console.log(`尖峰（${N} 人同時送出）：全部完成 ${burstAll}ms；${burst.length ? stat(burst) : ''}`)

  await Promise.all([host, ...phones.map((p) => p.sb)].map((c) => c.removeAllChannels()))
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
