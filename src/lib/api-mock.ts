/** 本機模擬後端：行為比照資料庫 function（名字不分大小寫不可重複、token 驗證） */
import { parseAvatarConfig, type AvatarConfig } from '../avatar'
import { ApiError, type Api, type Player } from './api'
import { nameError, normalizeName } from './name'
import { readJson, writeJson } from './storage'

const DB_KEY = 'xmas-runner:mock-db'
type Row = Player & { editToken: string }

const load = () => readJson<Row[]>(DB_KEY) ?? []

/** 比照 Supabase 版：讀出時正規化造型（補上新欄位預設值），不合法的略過 */
function toPlayer(r: Row): Player | null {
  const avatar = parseAvatarConfig(r.avatar)
  return avatar ? { id: r.id, name: r.name, avatar, createdAt: r.createdAt } : null
}
const save = (rows: Row[]) => writeJson(DB_KEY, rows)
const delay = () => new Promise((r) => setTimeout(r, 300))

function check(name: string, avatar: AvatarConfig, rows: Row[], selfId?: string): string {
  const n = normalizeName(name)
  if (nameError(n)) throw new ApiError('invalid_name')
  if (!parseAvatarConfig(avatar)) throw new ApiError('invalid_avatar')
  if (rows.some((r) => r.id !== selfId && r.name.toLowerCase() === n.toLowerCase())) throw new ApiError('name_taken')
  return n
}

export function createMockApi(): Api {
  console.info('[api] 未設定 Supabase，使用 localStorage 模擬後端')
  return {
    kind: 'mock',
    async register(name, avatar) {
      await delay()
      const rows = load()
      const n = check(name, avatar, rows)
      const row: Row = { id: crypto.randomUUID(), name: n, avatar, createdAt: new Date().toISOString(), editToken: crypto.randomUUID() }
      save([...rows, row])
      return { id: row.id, editToken: row.editToken }
    },
    async getMine(id, editToken) {
      await delay()
      const r = load().find((x) => x.id === id && x.editToken === editToken)
      return r ? toPlayer(r) : null
    },
    async update(id, editToken, name, avatar) {
      await delay()
      const rows = load()
      const r = rows.find((x) => x.id === id && x.editToken === editToken)
      if (!r) throw new ApiError('forbidden')
      r.name = check(name, avatar, rows, id)
      r.avatar = avatar
      save(rows)
    },
    async list() {
      await delay()
      return load()
        .map(toPlayer)
        .filter((p): p is Player => p !== null)
    },
  }
}
