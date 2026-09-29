/**
 * 精靈圖載入與換色。
 * 快取是全域的：同一個 (圖層, 動作, 調色盤) 不論畫幾個角色都只換色一次。
 */
import manifestJson from '../assets/manifest.json'
import palettesJson from '../assets/palettes.json'
import { EYE_BASE, EYES } from './catalog'
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

/** 某圖層某格的 bounding box（只有頭與頭髮有記錄） */
export function frameBox(key: string, sheet: SheetName, frame: number): Box | undefined {
  return LAYERS[key]?.bbox?.[sheet]?.[frame]
}

export function spriteUrl(key: string, sheet: SheetName): string {
  return `${import.meta.env.BASE_URL}sprites/${key}/${sheet}.png`
}

// ---------- 載入 ----------

const images = new Map<string, HTMLImageElement>()
const loading = new Map<string, Promise<void>>()

export function loadSprite(key: string, sheet: SheetName): Promise<void> {
  const id = `${key}|${sheet}`
  if (images.has(id)) return Promise.resolve()
  let p = loading.get(id)
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const im = new Image()
      im.onload = () => {
        images.set(id, im)
        resolve()
      }
      im.onerror = () => reject(new Error(`素材載入失敗：${id}`))
      im.src = spriteUrl(key, sheet)
    })
    // 失敗時移除，之後可以重試
    p.catch(() => loading.delete(id))
    loading.set(id, p)
  }
  return p
}

// ---------- 換色 ----------

type RGB = [number, number, number]
const rgbOf = (hex: string): RGB => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
const packed = ([r, g, b]: RGB) => (r << 16) | (g << 8) | b

const swapMaps = new Map<string, Map<number, RGB>>()

/** 基準色 → 目標色的對照表；body 的 pal 為「膚色+眼睛」 */
function swapMap(material: Material, pal: string): Map<number, RGB> {
  const id = `${material}|${pal}`
  let m = swapMaps.get(id)
  if (m) return m
  m = new Map()
  const P = PALETTES[material]
  const [colorName, eye] = material === 'body' ? pal.split('+') : [pal]
  const base = P.colors[P.base]
  const to = P.colors[colorName]
  if (!to) throw new Error(`未知的色組：${material}.${colorName}`)
  base.forEach((b, i) => m!.set(packed(rgbOf(b)), rgbOf(to[i])))
  if (eye) EYE_BASE.forEach((b, i) => m!.set(packed(rgbOf(b)), rgbOf(EYES[eye][i])))
  swapMaps.set(id, m)
  return m
}

const recolorCache = new Map<string, HTMLCanvasElement>()

/** 取得換色後的整張圖（尚未載入時回傳 null 並開始載入） */
export function recolored(key: string, sheet: SheetName, material: Material, pal: string): HTMLCanvasElement | null {
  const id = `${key}|${sheet}|${pal}`
  const hit = recolorCache.get(id)
  if (hit) return hit
  const im = images.get(`${key}|${sheet}`)
  if (!im) {
    loadSprite(key, sheet).catch(() => {})
    return null
  }
  const c = document.createElement('canvas')
  c.width = im.width
  c.height = im.height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(im, 0, 0)
  const data = ctx.getImageData(0, 0, c.width, c.height)
  const p = data.data
  const map = swapMap(material, pal)
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue
    const t = map.get((p[i] << 16) | (p[i + 1] << 8) | p[i + 2])
    if (t) {
      p[i] = t[0]
      p[i + 1] = t[1]
      p[i + 2] = t[2]
    }
  }
  ctx.putImageData(data, 0, 0)
  recolorCache.set(id, c)
  return c
}
