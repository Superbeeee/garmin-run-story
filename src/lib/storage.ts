/** localStorage 包一層：私密模式或被封鎖時不讓頁面壞掉。store 可改成 sessionStorage */
type Store = () => Storage
const local: Store = () => localStorage

export function readJson<T>(key: string, store = local): T | null {
  try {
    const s = store().getItem(key)
    return s ? (JSON.parse(s) as T) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown, store = local): boolean {
  try {
    store().setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string, store = local): void {
  try {
    store().removeItem(key)
  } catch {
    /* 忽略 */
  }
}
