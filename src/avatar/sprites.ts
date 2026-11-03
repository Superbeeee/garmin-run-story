/**
 * 精靈圖產生與換色快取（《薩爾達傳說：眾神的三角力量 & 四支劍》Q 版像素角色）。
 * 快取是全域的：同一個 (圖層, 動作, 調色盤) 不論畫幾個角色都只繪製一次。
 */
import manifestJson from '../assets/manifest.json'
import palettesJson from '../assets/palettes.json'
import { getFourSwordsBox, renderFourSwordsSheet } from './fourswords'
import type { Material, SheetName } from './types'

type Box = [top: number, cx: number, right: number]
interface LayerMeta {
  slot: string
  material: string
  frames: Record<string, number>
  bbox?: Partial<Record<SheetName, Box[]>>
}
interface Palette {
  base: string
  colors: Record<string, string[]>
}

const LAYERS = manifestJson.layers as unknown as Record<string, LayerMeta>
const PALETTES = palettesJson as Record<Material, Palette>

export const FRAME = manifestJson.frameSize

/** 每個圖層都有的圖 */
export const SHEETS: readonly SheetName[] = ['idle', 'walk', 'run', 'jump', 'front']

export function hasLayer(key: string): boolean {
  return key in LAYERS
}

/** 色票顯示用：該色組的主色 */
export function swatchColor(material: Material, name: string): string {
  return PALETTES[material].colors[name]?.[4] ?? '#000'
}

/** 某圖層某格的 bounding box（頭、頭髮與帽子） */
export function frameBox(key: string, sheet: SheetName, frame: number): Box | undefined {
  return getFourSwordsBox(key, sheet, frame) ?? LAYERS[key]?.bbox?.[sheet]?.[frame]
}

export function spriteUrl(key: string, sheet: SheetName): string {
  return `${import.meta.env.BASE_URL}sprites/${key}/${sheet}.png`
}

/** 四支劍點陣角色由 Canvas 即時繪製並快取，無須等待網路圖片 */
export function loadSprite(_key: string, _sheet: SheetName): Promise<void> {
  return Promise.resolve()
}

const recolorCache = new Map<string, HTMLCanvasElement>()

/** 取得換色後的整張精靈圖 */
export function recolored(key: string, sheet: SheetName, material: Material, pal: string): HTMLCanvasElement | null {
  const id = `${key}|${sheet}|${pal}`
  const hit = recolorCache.get(id)
  if (hit) return hit
  const c = renderFourSwordsSheet(key, sheet, material, pal)
  recolorCache.set(id, c)
  return c
}
