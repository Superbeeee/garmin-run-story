import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError, type ApiErrorCode } from './api'

let client: SupabaseClient | null = null

/** 共用的 Supabase client（登入狀態存在 localStorage；Google 登入回來時自動把網址的 ?code= 換成 session） */
export function supabase(): SupabaseClient {
  client ??= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}

/** DB function 以錯誤訊息回傳錯誤代碼（見 migration），其餘視為連線問題 */
export function toApiError(e: PostgrestError | Error, known: readonly string[]): ApiError {
  const code = known.find((c) => e.message === c)
  if (!code) console.error('[api]', e)
  return new ApiError((code ?? 'network') as ApiErrorCode, e.message)
}
