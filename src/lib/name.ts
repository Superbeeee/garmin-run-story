export const NAME_MAX = 20

/** 名字正規化：去頭尾空白、內部連續空白合併為一個 */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** 回傳錯誤訊息，合法則為 null */
export function nameError(name: string): string | null {
  if (!name) return '請先輸入名字'
  if ([...name].length > NAME_MAX) return `名字最多 ${NAME_MAX} 個字`
  return null
}
