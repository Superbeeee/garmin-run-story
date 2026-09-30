/**
 * 活動專區遊戲的後端介面：搶答跑位。
 * 場次狀態存在資料庫、以 Realtime 推送；角色位置只走 broadcast（手機送、主持畫面收）。
 * 沒有設定 Supabase 時使用本機模擬（localStorage + BroadcastChannel，可以開多個分頁當不同玩家）。
 */
import type { AvatarConfig } from '../avatar'

export type GameStatus = 'waiting' | 'question' | 'reveal' | 'finished'

export interface GameState {
  id: string
  code: string
  status: GameStatus
  /** 目前第幾題（0 起算，還沒開始為 -1） */
  qIndex: number
  qTotal: number
  prompt: string | null
  choices: string[] | null
  /** 作答截止時間（伺服器時間，epoch ms） */
  endsAt: number | null
  /** 公布後才有 */
  answer: number | null
  createdAt: string
}

export interface Question {
  id: string
  position: number
  prompt: string
  choices: string[]
  answer: number
  seconds: number
}
export type QuestionInput = Omit<Question, 'id'> & { id?: string }

export interface GamePlayer {
  id: string
  name: string
  avatar: AvatarConfig
}

/** 玩家觸發的動作：跳躍，或第幾個表情（對應 EMOTES） */
export type GameAction = 'jump' | number

export const isGameAction = (a: unknown): a is GameAction => a === 'jump' || (Number.isInteger(a) && (a as number) >= 0 && (a as number) < 8)

export interface LeaderRow extends GamePlayer {
  score: number
  rank: number
}

export interface GameApi {
  isAdmin(): Promise<boolean>
  /** 伺服器時間 − 本機時間（ms），倒數用 */
  clockOffset(): Promise<number>

  // 玩家
  join(code: string): Promise<string>
  /** 這個角色已加入、還沒結束的場次（大廳的「繼續遊戲」） */
  activeGameOf(playerId: string): Promise<GameState | null>
  getGame(id: string): Promise<GameState | null>
  getPlayers(id: string): Promise<GamePlayer[]>
  leaderboard(id: string): Promise<LeaderRow[]>
  /** 站在第 choice 個答案區；截止後丟出 too_late */
  setAnswer(id: string, qIndex: number, choice: number): Promise<void>
  myAnswer(id: string, qIndex: number): Promise<number | null>
  /** 訂閱場次狀態（與新加入的參加者，有給 players 才訂閱）；連上（或重連）時也會各觸發一次。回傳取消訂閱 */
  watch(id: string, on: { state(s: GameState): void; players?(): void }): () => void
  /** 玩家送出自己的位置（x 為 0～1），呼叫端負責節流 */
  sendMove(id: string, playerId: string, x: number): void
  /** 玩家送出跳躍或表情，呼叫端負責節流 */
  sendAction(id: string, playerId: string, action: GameAction): void
  /** 主持畫面收所有人的位置與動作 */
  watchMoves(id: string, on: { move(playerId: string, x: number): void; action(playerId: string, a: GameAction): void }): () => void

  // 主持人
  listQuestions(): Promise<Question[]>
  saveQuestion(q: QuestionInput): Promise<void>
  deleteQuestion(id: string): Promise<void>
  listGames(): Promise<GameState[]>
  createGame(code: string): Promise<string>
  next(id: string): Promise<void>
  reveal(id: string): Promise<void>
  finish(id: string): Promise<void>
}

/** 答案區：把 0～1 的位置平均分成 n 區 */
export const zoneOf = (x: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor(x * n)))

let instance: Promise<GameApi> | null = null

export function getGameApi(): Promise<GameApi> {
  if (!instance) {
    const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    instance = hasSupabase ? import('./game-supabase').then((m) => m.createSupabaseGameApi()) : import('./game-mock').then((m) => m.createMockGameApi())
  }
  return instance
}
