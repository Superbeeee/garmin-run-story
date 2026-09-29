/**
 * 後端介面。沒有設定 Supabase 環境變數時使用本機模擬（資料存在 localStorage），方便開發。
 */
import type { AvatarConfig } from '../avatar'

export interface Player {
  id: string
  name: string
  avatar: AvatarConfig
  createdAt: string
}

export type ApiErrorCode = 'name_taken' | 'invalid_name' | 'invalid_avatar' | 'forbidden' | 'network'

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message?: string,
  ) {
    super(message ?? code)
  }
}

export interface Api {
  readonly kind: 'supabase' | 'mock'
  register(name: string, avatar: AvatarConfig): Promise<{ id: string; editToken: string }>
  /** 用 edit_token 取回自己的資料；token 不對回傳 null */
  getMine(id: string, editToken: string): Promise<Player | null>
  update(id: string, editToken: string, name: string, avatar: AvatarConfig): Promise<void>
  /** 所有已報名角色（公開資料：名字與造型） */
  list(): Promise<Player[]>
}

export const ERROR_TEXT: Record<ApiErrorCode, string> = {
  name_taken: '這個名字已經有人報名了，換一個吧。如果是你本人，請用當初報名的手機或瀏覽器修改。',
  invalid_name: '名字格式不正確（1～20 個字）。',
  invalid_avatar: '造型資料有誤，請重新整理頁面再試一次。',
  forbidden: '沒有權限修改這筆報名資料。',
  network: '連線失敗，請檢查網路後再試一次。',
}

let instance: Promise<Api> | null = null

export function getApi(): Promise<Api> {
  if (!instance) {
    const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    instance = hasSupabase ? import('./api-supabase').then((m) => m.createSupabaseApi()) : import('./api-mock').then((m) => m.createMockApi())
  }
  return instance
}
