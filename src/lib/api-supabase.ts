import type { PostgrestError } from '@supabase/supabase-js'
import { parseAvatarConfig } from '../avatar'
import type { Api, ApiErrorCode, Player } from './api'
import { supabase, toApiError as toError } from './supabase'

const KNOWN: ApiErrorCode[] = ['name_taken', 'invalid_name', 'invalid_avatar', 'not_signed_in', 'already_registered', 'not_registered']
const toApiError = (e: PostgrestError | Error) => toError(e, KNOWN)

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
  const sb = supabase()

  return {
    kind: 'supabase',
    async getUser() {
      const { data } = await sb.auth.getSession()
      const user = data.session?.user
      return user ? { email: user.email ?? '' } : null
    },
    async signIn(path) {
      const redirectTo = new URL(import.meta.env.BASE_URL.replace(/\/$/, '') + path, location.origin).href
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        // 有多個 Google 帳號時讓使用者選
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      })
      if (error) throw toApiError(error)
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async register(name, avatar) {
      const { error } = await sb.rpc('register_player', { p_name: name, p_avatar: avatar })
      if (error) throw toApiError(error)
    },
    async getMine() {
      if (!(await this.getUser())) return null
      const { data, error } = await sb.rpc('get_my_player').maybeSingle<PlayerRow>()
      if (error) throw toApiError(error)
      return data ? toPlayer(data) : null
    },
    async update(name, avatar) {
      const { error } = await sb.rpc('update_player', { p_name: name, p_avatar: avatar })
      if (error) throw toApiError(error)
    },
    async list() {
      const { data, error } = await sb.from('players').select('id, name, avatar, created_at').order('created_at').returns<PlayerRow[]>()
      if (error) throw toApiError(error)
      return data.map(toPlayer).filter((p): p is Player => p !== null)
    },
  }
}
