/**
 * 這台裝置的報名資料（id + edit_token）與尚未送出的造型草稿。
 */
import { parseAvatarConfig, type AvatarConfig } from '../avatar'
import { readJson, removeKey, writeJson } from './storage'

const REG_KEY = 'xmas-runner:registration'
const DRAFT_KEY = 'xmas-runner:draft'

export interface Registration {
  id: string
  editToken: string
  name: string
}

export function getRegistration(): Registration | null {
  const r = readJson<Registration>(REG_KEY)
  return r && typeof r.id === 'string' && typeof r.editToken === 'string' ? r : null
}

export function saveRegistration(r: Registration): boolean {
  return writeJson(REG_KEY, r)
}

export function clearRegistration(): void {
  removeKey(REG_KEY)
}

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
