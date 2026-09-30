/**
 * 這台裝置上尚未送出的造型草稿；報名資料本身跟著 Google 帳號存在後端。
 */
import { parseAvatarConfig, type AvatarConfig } from '../avatar'
import { readJson, removeKey, writeJson } from './storage'

const DRAFT_KEY = 'xmas-runner:draft'

export function getDraft(): { name: string; config: AvatarConfig } | null {
  const d = readJson<{ name?: unknown; config?: unknown }>(DRAFT_KEY)
  const config = parseAvatarConfig(d?.config)
  return config ? { name: typeof d?.name === 'string' ? d.name : '', config } : null
}

export function saveDraft(name: string, config: AvatarConfig): void {
  writeJson(DRAFT_KEY, { name, config })
}

export function clearDraft(): void {
  removeKey(DRAFT_KEY)
}
