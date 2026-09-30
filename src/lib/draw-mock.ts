/**
 * 本機模擬抽籤：只有主持分頁寫入 localStorage，用 BroadcastChannel 通知其他分頁（帶版本號，等讀得到再處理）。
 */
import { ApiError } from './api'
import { mockPlayers } from './api-mock'
import type { DrawApi, DrawEntry, DrawResult } from './draw'
import { normalizeName } from './name'
import { readJson, writeJson } from './storage'

const KEY = 'xmas-runner:mock-draw'
const CHANNEL = 'xmas-runner:mock-draw'

interface Row {
  id: string
  playerId: string | null
  manualName: string | null
  excluded: boolean
  order: number | null
}
interface Db {
  v: number
  rows: Row[]
  seq: number
  latest: DrawResult | null
}

const load = (): Db => ({ v: 0, rows: [], seq: 0, latest: null, ...readJson<Partial<Db>>(KEY) })
const sender = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)

/** 讀出（並補上新報名的角色）、修改、寫回並通知 */
function update<T>(fn: (db: Db) => T): T {
  const db = load()
  for (const p of mockPlayers()) {
    if (!db.rows.some((r) => r.playerId === p.id)) db.rows.push({ id: crypto.randomUUID(), playerId: p.id, manualName: null, excluded: false, order: null })
  }
  const out = fn(db)
  db.v++
  writeJson(KEY, db)
  sender?.postMessage({ v: db.v })
  return out
}

function toEntry(r: Row): DrawEntry {
  const p = r.playerId ? mockPlayers().find((x) => x.id === r.playerId) : null
  return { id: r.id, playerId: r.playerId, name: p?.name ?? r.manualName ?? '？', avatar: p?.avatar ?? null, excluded: r.excluded, order: r.order }
}

export function createMockDrawApi(): DrawApi {
  return {
    async pool() {
      const rows = update((db) => db.rows).filter((r) => !r.playerId || mockPlayers().some((p) => p.id === r.playerId))
      return rows.map(toEntry).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
    },
    async next(spinMs) {
      return update((db) => {
        const pool = db.rows.filter((r) => !r.excluded && r.order === null)
        if (!pool.length) throw new ApiError('pool_empty')
        const r = pool[Math.floor(Math.random() * pool.length)]
        r.order = Math.max(0, ...db.rows.map((x) => x.order ?? 0)) + 1
        const e = toEntry(r)
        db.seq++
        db.latest = { id: r.id, playerId: r.playerId, name: e.name, avatar: e.avatar, order: r.order, revealAt: Date.now() + spinMs }
        return db.latest
      })
    },
    async setExcluded(id, excluded) {
      update((db) => {
        const r = db.rows.find((x) => x.id === id)
        if (r) r.excluded = excluded
      })
    },
    async addName(name) {
      const n = normalizeName(name)
      if (n.length < 1 || n.length > 20) throw new ApiError('invalid_name')
      update((db) => db.rows.push({ id: crypto.randomUUID(), playerId: null, manualName: n, excluded: false, order: null }))
    },
    async removeName(id) {
      update((db) => {
        db.rows = db.rows.filter((r) => r.id !== id || r.playerId)
      })
    },
    async putBack(id) {
      update((db) => {
        const r = db.rows.find((x) => x.id === id)
        if (!r || r.order === null) return
        const o = r.order
        r.order = null
        for (const x of db.rows) if (x.order !== null && x.order > o) x.order--
      })
    },
    async reset() {
      update((db) => {
        for (const r of db.rows) r.order = null
        db.seq++
        db.latest = null
      })
    },
    watchLatest(on) {
      const emit = () => {
        const db = load()
        on(db.seq, db.latest)
      }
      emit()
      if (typeof BroadcastChannel === 'undefined') return () => {}
      const ch = new BroadcastChannel(CHANNEL)
      ch.onmessage = async (e) => {
        const v = (e.data as { v: number }).v
        for (let i = 0; i < 50 && load().v < v; i++) await new Promise((r) => setTimeout(r, 20))
        emit()
      }
      return () => ch.close()
    },
  }
}
