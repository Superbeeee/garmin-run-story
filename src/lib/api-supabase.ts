import { createClient, type PostgrestError } from '@supabase/supabase-js'
import { parseAvatarConfig } from '../avatar'
import { ApiError, type Api, type ApiErrorCode, type Player } from './api'

const KNOWN: ApiErrorCode[] = ['name_taken', 'invalid_name', 'invalid_avatar', 'forbidden']

/** DB function 以錯誤訊息回傳錯誤代碼（見 migration），其餘視為連線問題 */
function toApiError(e: PostgrestError | Error): ApiError {
  const code = KNOWN.find((c) => e.message === c)
  if (!code) console.error('[api]', e)
  return new ApiError(code ?? 'network', e.message)
}

interface PlayerRow {
  id: string
  name: string
  avatar: unknown
  created_at: string
}

/** 造型不合法的資料（例如之後素材改版）直接略過，不讓整頁壞掉 */
function toPlayer(r: PlayerRow): Player | null {
  const avatar = parseAvatarConfig(r.avatar)
  return avatar ? { id: r.id, name: r.name, avatar, createdAt: r.created_at } : null
}

export function createSupabaseApi(): Api {
  const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    kind: 'supabase',
    async register(name, avatar) {
      const { data, error } = await sb.rpc('register_player', { p_name: name, p_avatar: avatar }).single<{ id: string; edit_token: string }>()
      if (error) throw toApiError(error)
      return { id: data.id, editToken: data.edit_token }
    },
    async getMine(id, editToken) {
      const { data, error } = await sb.rpc('get_my_player', { p_id: id, p_token: editToken }).maybeSingle<PlayerRow>()
      if (error) {
        // 本機存的 id/token 格式壞掉時 Postgres 會回 22P02，當成找不到
        if (error.code === '22P02') return null
        throw toApiError(error)
      }
      return data ? toPlayer(data) : null
    },
    async update(id, editToken, name, avatar) {
      const { error } = await sb.rpc('update_player', { p_id: id, p_token: editToken, p_name: name, p_avatar: avatar })
      if (error) throw toApiError(error)
    },
    async list() {
      const { data, error } = await sb.from('players').select('id, name, avatar, created_at').order('created_at').returns<PlayerRow[]>()
      if (error) throw toApiError(error)
      return data.map(toPlayer).filter((p): p is Player => p !== null)
    },
  }
}
