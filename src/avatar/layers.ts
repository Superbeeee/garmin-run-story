import { hasLayer } from './sprites'
import type { AvatarConfig, Material, Slot } from './types'

/** 圖層 z 順序（數字越大越上層） */
export const Z: Record<Slot, number> = { hairbg: 9, body: 10, shoes: 15, legs: 20, top: 35, head: 100, face: 101, hair: 120, band: 125 }

export const SLOT_LABELS: Record<Slot, string> = {
  band: '髮帶', hairbg: '頭髮（後）', body: '身體', shoes: '鞋子', legs: '褲子', top: '上衣', head: '頭', face: '表情', hair: '頭髮（前）',
}

export interface LayerRef {
  slot: Slot
  /** public/sprites 下的圖層 key */
  key: string
  material: Material
  /** 調色盤：body 為「膚色+眼睛」，其他為色組名稱 */
  pal: string
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
  out.push({ slot: 'hair', key: `hair/${c.hair}`, material: 'hair', pal: c.hairColor })
  if (c.band === 'thick') out.push({ slot: 'band', key: 'band/thick', material: 'cloth', pal: c.bandColor })
  return out.sort((a, b) => Z[a.slot] - Z[b.slot])
}
