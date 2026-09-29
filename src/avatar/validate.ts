import {
  BANDS,
  BUILD_BY,
  CLOTH_COLORS,
  EYE_OPTIONS,
  FACES,
  GLASSES,
  HAIR_BY,
  HAIR_COLORS,
  HATS,
  HEAD_BY,
  LEGS,
  OPTIONAL_DEFAULTS,
  SKINS,
  TOP_BY,
} from './catalog'
import type { AvatarConfig, Gender, Option } from './types'

const has = (opts: readonly Option[], v: unknown) => typeof v === 'string' && opts.some(([k]) => k === v)

/**
 * 檢查並正規化來自外部（localStorage、資料庫）的造型資料。
 * 不合法回傳 null；只保留 AvatarConfig 的欄位。後來新增的欄位（帽子、眼鏡）缺少時補預設值。
 */
export function parseAvatarConfig(x: unknown): AvatarConfig | null {
  if (!x || typeof x !== 'object') return null
  const o: Record<string, unknown> = { ...OPTIONAL_DEFAULTS, ...(x as Record<string, unknown>) }
  if (o.gender !== 'male' && o.gender !== 'female') return null
  const g = o.gender as Gender
  const ok =
    has(BUILD_BY[g], o.build) &&
    has(HEAD_BY[g], o.head) &&
    has(SKINS, o.skin) &&
    has(EYE_OPTIONS, o.eye) &&
    has(FACES, o.face) &&
    has(HAIR_BY[g], o.hair) &&
    has(HAIR_COLORS, o.hairColor) &&
    has(TOP_BY[g], o.top) &&
    has(CLOTH_COLORS, o.topColor) &&
    has(LEGS, o.legs) &&
    has(CLOTH_COLORS, o.legsColor) &&
    has(CLOTH_COLORS, o.shoesColor) &&
    has(BANDS, o.band) &&
    has(CLOTH_COLORS, o.bandColor) &&
    has(HATS, o.hat) &&
    has(CLOTH_COLORS, o.hatColor) &&
    has(GLASSES, o.glasses) &&
    has(CLOTH_COLORS, o.glassesColor)
  if (!ok) return null
  return {
    gender: g,
    build: o.build as string,
    head: o.head as string,
    skin: o.skin as string,
    eye: o.eye as string,
    face: o.face as string,
    hair: o.hair as string,
    hairColor: o.hairColor as string,
    top: o.top as string,
    topColor: o.topColor as string,
    legs: o.legs as string,
    legsColor: o.legsColor as string,
    shoesColor: o.shoesColor as string,
    band: o.band as AvatarConfig['band'],
    bandColor: o.bandColor as string,
    hat: o.hat as string,
    hatColor: o.hatColor as string,
    glasses: o.glasses as string,
    glassesColor: o.glassesColor as string,
  }
}
