import { hasLayer } from './sprites'
import type { AvatarConfig, Material, Slot } from './types'

/** 圖層 z 順序（數字越大越上層） */
export const Z: Record<Slot, number> = {
  hairbg: 9, body: 10, shoes: 15, legs: 20, top: 35, head: 100, face: 101, glasses: 115, hair: 120, band: 125, hat: 130, hattrim: 131,
}

export const SLOT_LABELS: Record<Slot, string> = {
  band: '髮帶', hairbg: '頭髮（後）', body: '身體', shoes: '鞋子', legs: '褲子', top: '上衣', head: '頭', face: '表情',
  glasses: '眼鏡', hair: '頭髮（前）', hat: '帽子', hattrim: '帽子毛邊',
}

export interface LayerRef {
  slot: Slot
  /** public/sprites 下的圖層 key */
  key: string
  material: Material
  /** 調色盤：body 為「膚色+眼睛」，其他為色組名稱 */
  pal: string
}

/**
 * 帽子由哪些圖層組成。color 為 true 時用 hatColor，否則為固定色組
 * （cloth 的 white 是基準色，等於不換色）。
 */
const HAT_PARTS: Record<string, { slot: Slot; key: string; color: true | string }[]> = {
  christmas: [
    { slot: 'hat', key: 'hat/christmas', color: true },
    { slot: 'hattrim', key: 'hattrim/santa', color: 'white' },
  ],
  elf: [
    { slot: 'hat', key: 'hat/christmas', color: true },
    { slot: 'hattrim', key: 'hattrim/elf', color: 'red' },
  ],
  bandana: [{ slot: 'hat', key: 'hat/bandana', color: true }],
  bowler: [{ slot: 'hat', key: 'hat/bowler', color: true }],
  tophat: [{ slot: 'hat', key: 'hat/tophat', color: true }],
  wizard: [{ slot: 'hat', key: 'hat/wizard', color: true }],
  crown: [{ slot: 'hat', key: 'hat/crown', color: 'white' }],
}

/** 上衣版本：teen 體型穿 teen 版，否則依性別 */
export function topFit(c: AvatarConfig): string {
  return c.build === 'teen' ? 'teen' : c.gender
}

/** 褲鞋版本：male / muscular 穿 male 版，其他穿 thin 版 */
export function legFit(c: AvatarConfig): 'male' | 'thin' {
  return c.build === 'male' || c.build === 'muscular' ? 'male' : 'thin'
}

/** 依造型與目前表情列出要疊的圖層（已依 z 排序） */
export function layerList(c: AvatarConfig, face: string): LayerRef[] {
  const skin = `${c.skin}+${c.eye}`
  const lf = legFit(c)
  const out: LayerRef[] = []
  if (hasLayer(`hairbg/${c.hair}`)) out.push({ slot: 'hairbg', key: `hairbg/${c.hair}`, material: 'hair', pal: c.hairColor })
  out.push({ slot: 'body', key: `body/${c.build}`, material: 'body', pal: skin })
  out.push({ slot: 'shoes', key: `shoes/${lf}`, material: 'cloth', pal: c.shoesColor })
  out.push({ slot: 'legs', key: `legs/${c.legs}/${lf}`, material: 'cloth', pal: c.legsColor })
  out.push({ slot: 'top', key: `top/${c.top}/${topFit(c)}`, material: 'cloth', pal: c.topColor })
  out.push({ slot: 'head', key: `head/${c.head}`, material: 'body', pal: skin })
  out.push({ slot: 'face', key: `face/${face}/${c.gender}`, material: 'body', pal: skin })
  if (c.glasses !== 'none') out.push({ slot: 'glasses', key: `glasses/${c.glasses}`, material: 'cloth', pal: c.glassesColor })
  out.push({ slot: 'hair', key: `hair/${c.hair}`, material: 'hair', pal: c.hairColor })
  if (c.band === 'thick') out.push({ slot: 'band', key: 'band/thick', material: 'cloth', pal: c.bandColor })
  for (const p of HAT_PARTS[c.hat] ?? []) {
    out.push({ slot: p.slot, key: p.key, material: 'cloth', pal: p.color === true ? c.hatColor : p.color })
  }
  return out.sort((a, b) => Z[a.slot] - Z[b.slot])
}
