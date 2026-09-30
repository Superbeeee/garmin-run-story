/**
 * 活動專區第二個遊戲：接力抽禮物。
 * 籤池與抽籤只有主持人能操作；最新一次的結果推給手機，被抽中的人會收到通知。
 */
import type { AvatarConfig } from '../avatar'

export interface DrawEntry {
  id: string
  /** 報名的角色；手動加入的名字為 null */
  playerId: string | null
  name: string
  /** 手動加入的名字沒有造型 */
  avatar: AvatarConfig | null
  excluded: boolean
  /** 第幾位被抽出；還沒抽為 null */
  order: number | null
}

export interface DrawResult {
  id: string
  playerId: string | null
  name: string
  avatar: AvatarConfig | null
  order: number
  /** 主持畫面動畫結束的時間（伺服器時間 epoch ms），手機在這之後才顯示 */
  revealAt: number
}

export interface DrawApi {
  pool(): Promise<DrawEntry[]>
  /** 抽出下一位；spinMs 為拉霸動畫長度 */
  next(spinMs: number): Promise<DrawResult>
  setExcluded(id: string, excluded: boolean): Promise<void>
  addName(name: string): Promise<void>
  removeName(id: string): Promise<void>
  putBack(id: string): Promise<void>
  reset(): Promise<void>
  /** 訂閱最新的抽籤結果（seq 每次抽或重設都會加一）；連上時也觸發一次。回傳取消訂閱 */
  watchLatest(on: (seq: number, r: DrawResult | null) => void): () => void
}

let instance: Promise<DrawApi> | null = null

export function getDrawApi(): Promise<DrawApi> {
  if (!instance) {
    const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    instance = hasSupabase ? import('./draw-supabase').then((m) => m.createSupabaseDrawApi()) : import('./draw-mock').then((m) => m.createMockDrawApi())
  }
  return instance
}
