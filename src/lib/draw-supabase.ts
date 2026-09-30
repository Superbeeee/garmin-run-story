import type { PostgrestError } from '@supabase/supabase-js'
import { parseAvatarConfig } from '../avatar'
import type { ApiErrorCode } from './api'
import type { DrawApi, DrawResult } from './draw'
import { supabase, toApiError as toError } from './supabase'

const KNOWN: ApiErrorCode[] = ['not_signed_in', 'forbidden', 'invalid_name', 'pool_empty']
const toApiError = (e: PostgrestError | Error) => toError(e, KNOWN)

interface ResultRow {
  id: string
  player_id: string | null
  name: string
  avatar: unknown
  draw_order: number
  reveal_at: string
}
const toResult = (r: ResultRow): DrawResult => ({
  id: r.id,
  playerId: r.player_id,
  name: r.name,
  avatar: parseAvatarConfig(r.avatar),
  order: r.draw_order,
  revealAt: Date.parse(r.reveal_at),
})

interface StateRow {
  seq: number
  entry_id: string | null
  player_id: string | null
  name: string | null
  avatar: unknown
  draw_order: number | null
  reveal_at: string | null
}
function fromState(s: StateRow): DrawResult | null {
  if (!s.entry_id || !s.name || s.draw_order === null || !s.reveal_at) return null
  return toResult({ id: s.entry_id, player_id: s.player_id, name: s.name, avatar: s.avatar, draw_order: s.draw_order, reveal_at: s.reveal_at })
}

export function createSupabaseDrawApi(): DrawApi {
  const sb = supabase()
  const call = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw toApiError(error)
    return data as T
  }
  return {
    async pool() {
      const rows = await call<(Omit<ResultRow, 'reveal_at' | 'draw_order'> & { excluded: boolean; draw_order: number | null })[]>('draw_pool')
      return rows.map((r) => ({
        id: r.id,
        playerId: r.player_id,
        name: r.name,
        avatar: parseAvatarConfig(r.avatar),
        excluded: r.excluded,
        order: r.draw_order,
      }))
    },
    async next(spinMs) {
      const rows = await call<ResultRow[]>('draw_next', { p_spin_ms: Math.round(spinMs) })
      return toResult(rows[0])
    },
    setExcluded: (id, excluded) => call('draw_set_excluded', { p_entry: id, p_excluded: excluded }),
    addName: (name) => call('draw_add_name', { p_name: name }),
    removeName: (id) => call('draw_remove_name', { p_entry: id }),
    putBack: (id) => call('draw_put_back', { p_entry: id }),
    reset: () => call('draw_reset'),
    watchLatest(on) {
      const refresh = async () => {
        const { data } = await sb.from('draw_state').select('*').eq('id', 1).maybeSingle<StateRow>()
        if (data) on(data.seq, fromState(data))
      }
      const ch = sb
        .channel('draw-state')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'draw_state' }, (p) => {
          const s = p.new as StateRow
          on(s.seq, fromState(s))
        })
        .subscribe((status) => {
          // 連上或斷線重連後補抓一次
          if (status === 'SUBSCRIBED') refresh()
        })
      return () => void sb.removeChannel(ch)
    },
  }
}
