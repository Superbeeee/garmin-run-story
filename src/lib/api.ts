/**
 * 後端介面。沒有設定 Supabase 環境變數時使用本機模擬（資料與登入狀態存在 localStorage），方便開發。
 * 報名、修改都要先用 Google 登入，一個帳號一個角色。
 */
import type { AvatarConfig } from '../avatar'

export interface Player {
  id: string
  name: string
  avatar: AvatarConfig
  createdAt: string
}

export interface User {
  email: string
}

export type ApiErrorCode =
  | 'name_taken'
  | 'invalid_name'
  | 'invalid_avatar'
  | 'not_signed_in'
  | 'already_registered'
  | 'not_registered'
  | 'forbidden'
  | 'game_not_found'
  | 'not_joined'
  | 'too_late'
  | 'invalid_choice'
  | 'invalid_code'
  | 'no_questions'
  | 'code_taken'
  | 'invalid_state'
  | 'question_missing'
  | 'pool_empty'
  | 'network'

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
  /** 目前登入的使用者；未登入回傳 null */
  getUser(): Promise<User | null>
  /** 導向 Google 登入，完成後回到 path（站內路徑，例如 /done） */
  signIn(path: string): Promise<void>
  signOut(): Promise<void>
  register(name: string, avatar: AvatarConfig): Promise<void>
  /** 目前登入帳號的角色；未登入或還沒報名回傳 null */
  getMine(): Promise<Player | null>
  update(name: string, avatar: AvatarConfig): Promise<void>
  /** 所有已報名角色（公開資料：名字與造型） */
  list(): Promise<Player[]>
}

export const ERROR_TEXT: Record<ApiErrorCode, string> = {
  name_taken: '這個名字已經有人報名了，換一個吧。如果是你本人，請用當初報名的 Google 帳號登入。',
  invalid_name: '名字格式不正確（1～20 個字）。',
  invalid_avatar: '造型資料有誤，請重新整理頁面再試一次。',
  not_signed_in: '登入已過期，請重新登入。',
  already_registered: '這個 Google 帳號已經報名過了。',
  not_registered: '這個 Google 帳號還沒有報名。',
  forbidden: '只有主持人可以操作。',
  game_not_found: '找不到這個代碼的遊戲，請確認代碼是否正確。',
  not_joined: '你還沒有加入這場遊戲，請重新輸入代碼。',
  too_late: '這題已經截止了。',
  invalid_choice: '選項不正確。',
  invalid_code: '代碼只能是 2～12 個英文字母或數字。',
  no_questions: '題庫還沒有題目，請先新增題目。',
  code_taken: '這個代碼已經有進行中的場次，換一個吧。',
  invalid_state: '目前的遊戲狀態不能這樣操作，請重新整理頁面。',
  question_missing: '找不到這一題（可能已從題庫刪除）。',
  pool_empty: '籤池裡已經沒有可以抽的人了。',
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
