/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 名單頁的網址參數 ?key= 需與此相同 */
  readonly VITE_ROSTER_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
