import type { PostgrestError, RealtimeChannel } from '@supabase/supabase-js'
import { parseAvatarConfig } from '../avatar'
import type { ApiErrorCode } from './api'
import { isGameAction, type GameApi, type GamePlayer, type GameState, type LeaderRow, type Question } from './game'
import { supabase, toApiError as toError } from './supabase'

const KNOWN: ApiErrorCode[] = [
  'not_signed_in',
  'not_registered',
  'forbidden',
  'game_not_found',
  'not_joined',
  'too_late',
  'invalid_choice',
  'invalid_code',
  'no_questions',
  'code_taken',
  'invalid_state',
  'question_missing',
]
const toApiError = (e: PostgrestError | Error) => toError(e, KNOWN)

interface GameRow {
  id: string
  code: string
  status: GameState['status']
  question_ids: string[]
  q_index: number
  q_prompt: string | null
  q_choices: string[] | null
  q_ends_at: string | null
  q_answer: number | null
  created_at: string
}
const GAME_COLS = 'id, code, status, question_ids, q_index, q_prompt, q_choices, q_ends_at, q_answer, created_at'

function toGame(r: GameRow): GameState {
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    qIndex: r.q_index,
    qTotal: r.question_ids.length,
    prompt: r.q_prompt,
    choices: r.q_choices,
    endsAt: r.q_ends_at ? Date.parse(r.q_ends_at) : null,
    answer: r.q_answer,
    createdAt: r.created_at,
  }
}

/** 造型不合法的角色略過 */
function withAvatar<T extends { avatar: unknown }>(rows: T[]) {
  return rows.flatMap((r) => {
    const avatar = parseAvatarConfig(r.avatar)
    return avatar ? [{ ...r, avatar }] : []
  })
}

export function createSupabaseGameApi(): GameApi {
  const sb = supabase()
  const call = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw toApiError(error)
    return data as T
  }
  const getGame = async (id: string) => {
    const { data, error } = await sb.from('games').select(GAME_COLS).eq('id', id).maybeSingle<GameRow>()
    if (error) throw toApiError(error)
    return data ? toGame(data) : null
  }
  // 玩家送位置與動作用 REST，不訂閱位置頻道，避免每支手機都收到所有人的位置
  const moveSenders = new Map<string, RealtimeChannel>()
  const sendOnMoves = (id: string, event: string, payload: object) => {
    let ch = moveSenders.get(id)
    if (!ch) moveSenders.set(id, (ch = sb.channel(`game-moves:${id}`)))
    ch.httpSend(event, payload).catch(() => {})
  }

  return {
    isAdmin: () => call<boolean>('is_admin'),
    async clockOffset() {
      const t0 = Date.now()
      const server = Date.parse(await call<string>('server_now'))
      return server - (t0 + Date.now()) / 2
    },

    join: (code) => call<string>('join_game', { p_code: code }),
    async activeGameOf(playerId) {
      const { data, error } = await sb
        .from('game_players')
        .select(`joined_at, games!inner(${GAME_COLS})`)
        .eq('player_id', playerId)
        .neq('games.status', 'finished')
        .order('joined_at', { ascending: false })
        .limit(1)
        .returns<{ games: GameRow }[]>()
      if (error) throw toApiError(error)
      return data[0] ? toGame(data[0].games) : null
    },
    getGame,
    async getPlayers(id) {
      const { data, error } = await sb
        .from('game_players')
        .select('joined_at, players(id, name, avatar)')
        .eq('game_id', id)
        .order('joined_at')
        .returns<{ players: GamePlayer | null }[]>()
      if (error) throw toApiError(error)
      return withAvatar(data.flatMap((r) => (r.players ? [r.players] : [])))
    },
    async leaderboard(id) {
      const rows = await call<{ player_id: string; name: string; avatar: unknown; score: number; rank: number }[]>('game_leaderboard', { p_game: id })
      return withAvatar(rows.map((r) => ({ id: r.player_id, name: r.name, avatar: r.avatar, score: r.score, rank: r.rank }))) as LeaderRow[]
    },
    setAnswer: (id, qIndex, choice) => call('set_answer', { p_game: id, p_index: qIndex, p_choice: choice }),
    myAnswer: (id, qIndex) => call<number | null>('my_answer', { p_game: id, p_index: qIndex }),

    watch(id, on) {
      const refresh = async () => {
        const g = await getGame(id).catch(() => null)
        if (g) on.state(g)
        on.players?.()
      }
      const ch = sb
        .channel(`game-state:${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, (p) => on.state(toGame(p.new as GameRow)))
      // 手機不需要參加者清單：不訂閱，避免每個人加入時都通知所有手機
      if (on.players) ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_players', filter: `game_id=eq.${id}` }, () => on.players?.())
      ch.subscribe((status) => {
        // 連上或斷線重連後補抓一次，避免漏掉期間的變動
        if (status === 'SUBSCRIBED') refresh()
      })
      return () => void sb.removeChannel(ch)
    },
    sendMove(id, playerId, x, y) {
      sendOnMoves(id, 'move', { p: playerId, x, y })
    },
    sendAction(id, playerId, a) {
      sendOnMoves(id, 'act', { p: playerId, a })
    },
    watchMoves(id, on) {
      const ch = sb
        .channel(`game-moves:${id}`)
        .on('broadcast', { event: 'move' }, ({ payload }) => {
          if (typeof payload?.p === 'string' && typeof payload?.x === 'number') {
            on.move(payload.p, { x: payload.x, y: typeof payload.y === 'number' ? payload.y : undefined })
          }
        })
        .on('broadcast', { event: 'act' }, ({ payload }) => {
          if (typeof payload?.p === 'string' && isGameAction(payload?.a)) on.action(payload.p, payload.a)
        })
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    async listQuestions() {
      const { data, error } = await sb.from('quiz_questions').select('id, position, prompt, choices, answer, seconds').order('position').order('created_at').returns<Question[]>()
      if (error) throw toApiError(error)
      return data
    },
    async saveQuestion(q) {
      const row = { position: q.position, prompt: q.prompt, choices: q.choices, answer: q.answer, seconds: q.seconds }
      const { error } = q.id ? await sb.from('quiz_questions').update(row).eq('id', q.id) : await sb.from('quiz_questions').insert(row)
      if (error) throw toApiError(error)
    },
    async deleteQuestion(id) {
      const { error } = await sb.from('quiz_questions').delete().eq('id', id)
      if (error) throw toApiError(error)
    },
    async listGames() {
      const { data, error } = await sb.from('games').select(GAME_COLS).order('created_at', { ascending: false }).limit(20).returns<GameRow[]>()
      if (error) throw toApiError(error)
      return data.map(toGame)
    },
    createGame: (code) => call<string>('create_game', { p_code: code }),
    next: (id) => call('next_question', { p_game: id }),
    reveal: (id) => call('reveal_question', { p_game: id }),
    finish: (id) => call('finish_game', { p_game: id }),
  }
}
