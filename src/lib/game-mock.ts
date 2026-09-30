/**
 * 本機模擬遊戲後端：資料存在 localStorage，變動用 BroadcastChannel 通知其他分頁。
 * 規則比照 migration 裡的 function；模擬模式下每個登入者都是主持人。
 *
 * 多個分頁同時寫入：每個 key 只有一種寫入者，避免整包覆蓋掉別人的資料——
 *   題庫與場次只有主持分頁寫；加入紀錄與作答每個玩家各自一個 key。
 * 另外其他分頁的 localStorage 寫入可能比通知晚到，所以場次帶版本號，收到通知後等讀得到該版本再處理。
 */
import { ApiError } from './api'
import { mockMyPlayer, mockPlayers } from './api-mock'
import { isGameAction, type GameAction, type GameApi, type GameState, type Question } from './game'
import { readJson, writeJson } from './storage'

const PREFIX = 'xmas-runner:mock-game:'
const QUESTIONS = `${PREFIX}questions`
const GAMES = `${PREFIX}games`
const joinedKey = (gameId: string, playerId: string) => `${PREFIX}joined:${gameId}:${playerId}`
const answerKey = (gameId: string, playerId: string) => `${PREFIX}answer:${gameId}:${playerId}`
const CHANNEL = 'xmas-runner:mock-game'

interface GameRow extends Omit<GameState, 'qTotal'> {
  questionIds: string[]
  /** 已公布的答案與公布時間（依題號），計分用 */
  revealed: { answer: number; at: number }[]
}
/** 玩家各題的作答：題號 → 選項與時間 */
type Answers = Record<number, { choice: number; at: number }>
type Msg =
  | { type: 'state'; id: string; v: number }
  | { type: 'players'; id: string; key: string }
  | { type: 'move'; id: string; p: string; x: number; y: number }
  | { type: 'act'; id: string; p: string; a: GameAction }

const loadGames = () => readJson<{ v: number; list: GameRow[] }>(GAMES) ?? { v: 0, list: [] }
const loadQuestions = () => readJson<Question[]>(QUESTIONS) ?? []
const delay = () => new Promise((r) => setTimeout(r, 120))
const toState = ({ questionIds, revealed: _, ...g }: GameRow): GameState => ({ ...g, qTotal: questionIds.length })

function joinedIds(gameId: string): { playerId: string; joinedAt: string }[] {
  const pre = `${PREFIX}joined:${gameId}:`
  const out: { playerId: string; joinedAt: string }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(pre)) out.push({ playerId: k.slice(pre.length), joinedAt: readJson<string>(k) ?? '' })
    }
  } catch {
    /* 忽略 */
  }
  return out.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
}

const sender = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)
/** 通知所有分頁（包含自己這個分頁的其他訂閱者） */
function emit(msg: Msg) {
  sender?.postMessage(msg)
}
/** 等到本分頁讀得到其他分頁剛寫的資料（最多 1 秒） */
async function until(ready: () => boolean) {
  for (let i = 0; i < 50 && !ready(); i++) await new Promise((r) => setTimeout(r, 20))
}
function listen(cb: (m: Msg) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const ch = new BroadcastChannel(CHANNEL)
  ch.onmessage = async (e) => {
    const m = e.data as Msg
    if (m.type === 'state') await until(() => loadGames().v >= m.v)
    if (m.type === 'players') await until(() => readJson(m.key) !== null)
    cb(m)
  }
  return () => ch.close()
}

function me() {
  const p = mockMyPlayer()
  if (!p) throw new ApiError('not_registered')
  return p
}
/** 主持人修改場次：讀出、修改、寫回並通知 */
function updateGame(id: string, fn: (g: GameRow, questions: Question[]) => void) {
  const games = loadGames()
  const g = games.list.find((x) => x.id === id)
  if (!g) throw new ApiError('invalid_state')
  fn(g, loadQuestions())
  games.v++
  writeJson(GAMES, games)
  emit({ type: 'state', id, v: games.v })
}

export function createMockGameApi(): GameApi {
  const getGame = async (id: string) => {
    const g = loadGames().list.find((x) => x.id === id)
    return g ? toState(g) : null
  }
  return {
    isAdmin: async () => true,
    clockOffset: async () => 0,

    async join(code) {
      await delay()
      const player = me()
      const g = loadGames().list.find((x) => x.code === code.trim().toUpperCase() && x.status !== 'finished')
      if (!g) throw new ApiError('game_not_found')
      const key = joinedKey(g.id, player.id)
      if (readJson(key) === null) {
        writeJson(key, new Date().toISOString())
        emit({ type: 'players', id: g.id, key })
      }
      return g.id
    },
    async activeGameOf(playerId) {
      const g = loadGames()
        .list.filter((x) => x.status !== 'finished' && readJson(joinedKey(x.id, playerId)) !== null)
        .at(-1)
      return g ? toState(g) : null
    },
    getGame,
    async getPlayers(id) {
      const all = new Map(mockPlayers().map((p) => [p.id, p]))
      return joinedIds(id).flatMap(({ playerId }) => {
        const p = all.get(playerId)
        return p ? [{ id: p.id, name: p.name, avatar: p.avatar }] : []
      })
    },
    async leaderboard(id) {
      const g = loadGames().list.find((x) => x.id === id)
      const all = new Map(mockPlayers().map((p) => [p.id, p]))
      const rows = joinedIds(id)
        .filter(({ playerId }) => all.has(playerId))
        .map(({ playerId }) => {
          const p = all.get(playerId)!
          const answers = readJson<Answers>(answerKey(id, playerId)) ?? {}
          // 只算公布前送出的答案
          const score = (g?.revealed ?? []).filter((r, q) => r && answers[q] && answers[q].at <= r.at && answers[q].choice === r.answer).length
          return { id: p.id, name: p.name, avatar: p.avatar, score, rank: 0 }
        })
        .sort((a, b) => b.score - a.score)
      for (const r of rows) r.rank = rows.findIndex((x) => x.score === r.score) + 1
      return rows
    },
    async setAnswer(id, qIndex, choice) {
      const player = me()
      const g = loadGames().list.find((x) => x.id === id)
      if (!g || g.status !== 'question' || g.qIndex !== qIndex || Date.now() > (g.endsAt ?? 0) + 1000) throw new ApiError('too_late')
      if (choice < 0 || choice >= (g.choices?.length ?? 0)) throw new ApiError('invalid_choice')
      if (readJson(joinedKey(id, player.id)) === null) throw new ApiError('not_joined')
      const key = answerKey(id, player.id)
      writeJson(key, { ...readJson<Answers>(key), [qIndex]: { choice, at: Date.now() } })
    },
    async myAnswer(id, qIndex) {
      const player = mockMyPlayer()
      if (!player) return null
      return readJson<Answers>(answerKey(id, player.id))?.[qIndex]?.choice ?? null
    },
    watch(id, on) {
      const off = listen((m) => {
        if (m.id !== id) return
        if (m.type === 'state') getGame(id).then((g) => g && on.state(g))
        if (m.type === 'players') on.players?.()
      })
      getGame(id).then((g) => g && on.state(g))
      on.players?.()
      return off
    },
    sendMove(id, playerId, x, y) {
      emit({ type: 'move', id, p: playerId, x, y })
    },
    sendAction(id, playerId, a) {
      emit({ type: 'act', id, p: playerId, a })
    },
    watchMoves(id, on) {
      return listen((m) => {
        if (m.id !== id) return
        if (m.type === 'move') on.move(m.p, { x: m.x, y: m.y })
        if (m.type === 'act' && isGameAction(m.a)) on.action(m.p, m.a)
      })
    },

    async listQuestions() {
      return [...loadQuestions()].sort((a, b) => a.position - b.position)
    },
    async saveQuestion(q) {
      await delay()
      const list = loadQuestions()
      if (q.id) {
        const i = list.findIndex((x) => x.id === q.id)
        if (i >= 0) list[i] = { ...q, id: q.id }
      } else {
        list.push({ ...q, id: crypto.randomUUID() })
      }
      writeJson(QUESTIONS, list)
    },
    async deleteQuestion(id) {
      writeJson(
        QUESTIONS,
        loadQuestions().filter((x) => x.id !== id),
      )
    },
    async listGames() {
      return loadGames().list.map(toState).reverse()
    },
    async createGame(code) {
      await delay()
      const c = code.trim().toUpperCase()
      if (!/^[A-Z0-9]{2,12}$/.test(c)) throw new ApiError('invalid_code')
      const questions = loadQuestions()
      if (!questions.length) throw new ApiError('no_questions')
      const games = loadGames()
      if (games.list.some((g) => g.code === c && g.status !== 'finished')) throw new ApiError('code_taken')
      const g: GameRow = {
        id: crypto.randomUUID(),
        code: c,
        status: 'waiting',
        questionIds: [...questions].sort((a, b) => a.position - b.position).map((q) => q.id),
        revealed: [],
        qIndex: -1,
        prompt: null,
        choices: null,
        endsAt: null,
        answer: null,
        createdAt: new Date().toISOString(),
      }
      games.list.push(g)
      games.v++
      writeJson(GAMES, games)
      return g.id
    },
    async next(id) {
      updateGame(id, (g, questions) => {
        if (g.status !== 'waiting' && g.status !== 'reveal') throw new ApiError('invalid_state')
        if (g.qIndex + 1 >= g.questionIds.length) {
          g.status = 'finished'
          return
        }
        const q = questions.find((x) => x.id === g.questionIds[g.qIndex + 1])
        if (!q) throw new ApiError('question_missing')
        Object.assign(g, { status: 'question', qIndex: g.qIndex + 1, prompt: q.prompt, choices: q.choices, endsAt: Date.now() + q.seconds * 1000, answer: null })
      })
    },
    async reveal(id) {
      updateGame(id, (g, questions) => {
        if (g.status !== 'question') throw new ApiError('invalid_state')
        const q = questions.find((x) => x.id === g.questionIds[g.qIndex])
        if (!q) throw new ApiError('question_missing')
        const now = Date.now()
        g.revealed[g.qIndex] = { answer: q.answer, at: now }
        Object.assign(g, { status: 'reveal', answer: q.answer, endsAt: Math.min(g.endsAt ?? now, now) })
      })
    },
    async finish(id) {
      updateGame(id, (g) => {
        g.status = 'finished'
      })
    },
  }
}
