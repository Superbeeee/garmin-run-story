/**
 * 本機模擬後端：行為比照資料庫 function（名字不分大小寫不可重複、一個帳號一個角色）。
 * 登入直接產生假帳號，存在 sessionStorage：每個分頁是不同的人，方便開多個分頁測試遊戲。
 */
import { parseAvatarConfig, type AvatarConfig } from '../avatar'
import { ApiError, type Api, type Player } from './api'
import { nameError, normalizeName } from './name'
import { readJson, removeKey, writeJson } from './storage'

const DB_KEY = 'xmas-runner:mock-db'
const USER_KEY = 'xmas-runner:mock-user'
type Row = Player & { userId: string }
type MockUser = { id: string; email: string }

const session = () => sessionStorage
const load = () => readJson<Row[]>(DB_KEY) ?? []
const currentUser = () => readJson<MockUser>(USER_KEY, session)

/** 目前分頁登入者的角色（遊戲模擬用） */
export function mockMyPlayer(): Player | null {
  const u = currentUser()
  const r = u && load().find((x) => x.userId === u.id)
  return r ? toPlayer(r) : null
}

/** 所有角色（遊戲模擬用） */
export function mockPlayers(): Player[] {
  return load()
    .map(toPlayer)
    .filter((p): p is Player => p !== null)
}

/** 比照 Supabase 版：讀出時正規化造型（補上新欄位預設值），不合法的略過 */
function toPlayer(r: Row): Player | null {
  const avatar = parseAvatarConfig(r.avatar)
  return avatar ? { id: r.id, name: r.name, avatar, createdAt: r.createdAt } : null
}
const save = (rows: Row[]) => writeJson(DB_KEY, rows)
const delay = () => new Promise((r) => setTimeout(r, 300))

function requireUser(): MockUser {
  const u = currentUser()
  if (!u) throw new ApiError('not_signed_in')
  return u
}

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
    async getUser() {
      const u = currentUser()
      return u ? { email: u.email } : null
    },
    async signIn(path) {
      // 每次登入都是新的假帳號，登出再登入就能模擬另一個人
      const id = crypto.randomUUID()
      writeJson(USER_KEY, { id, email: `dev-${id.slice(0, 4)}@example.com` }, session)
      location.assign(import.meta.env.BASE_URL.replace(/\/$/, '') + path)
    },
    async signOut() {
      removeKey(USER_KEY, session)
    },
    async register(name, avatar) {
      await delay()
      const user = requireUser()
      const rows = load()
      const n = check(name, avatar, rows)
      if (rows.some((r) => r.userId === user.id)) throw new ApiError('already_registered')
      save([...rows, { id: crypto.randomUUID(), name: n, avatar, createdAt: new Date().toISOString(), userId: user.id }])
    },
    async getMine() {
      await delay()
      return mockMyPlayer()
    },
    async update(name, avatar) {
      await delay()
      const user = requireUser()
      const rows = load()
      const r = rows.find((x) => x.userId === user.id)
      if (!r) throw new ApiError('not_registered')
      r.name = check(name, avatar, rows, r.id)
      r.avatar = avatar
      save(rows)
    },
    async list() {
      await delay()
      return mockPlayers()
    },
  }
}
