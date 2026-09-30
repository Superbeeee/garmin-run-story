/**
 * 產生網站圖示：用現有素材合成「戴聖誕帽的跑者頭像」。
 *   public/favicon-32.png         分頁圖示（透明背景）
 *   public/apple-touch-icon.png   180×180 加到主畫面用（夜空底色）
 * 執行：pnpm build:favicon（需先有 public/sprites）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const palettes = JSON.parse(readFileSync(join(ROOT, 'src/assets/palettes.json'), 'utf8')) as Record<string, { base: string; colors: Record<string, string[]> }>
const EYE_BASE = ['#2a3c49', '#5686ae', '#57cee4']
const EYE_BROWN = ['#232017', '#544c2e', '#7e4e20']

/** 圖層：[layerKey, 材質, 色組]，由下往上疊 */
const LAYERS: [string, 'body' | 'hair' | 'cloth', string][] = [
  ['head/male', 'body', 'amber'],
  ['face/happy/male', 'body', 'amber'],
  ['hair/bangsshort', 'hair', 'black'],
  ['hat/christmas', 'cloth', 'red'],
  ['hattrim/santa', 'cloth', 'white'],
]
const NIGHT = [0x29, 0x36, 0x6f]

const rgb = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

function recolor(img: PNG, material: string, pal: string): PNG {
  const P = palettes[material]
  const map = new Map<string, number[]>()
  P.colors[P.base].forEach((c, i) => map.set(rgb(c).join(), rgb(P.colors[pal][i])))
  if (material === 'body') EYE_BASE.forEach((c, i) => map.set(rgb(c).join(), rgb(EYE_BROWN[i])))
  for (let i = 0; i < img.data.length; i += 4) {
    const t = map.get([img.data[i], img.data[i + 1], img.data[i + 2]].join())
    if (t) [img.data[i], img.data[i + 1], img.data[i + 2]] = t
  }
  return img
}

// 疊出 64×64 正面圖
const comp = new PNG({ width: 64, height: 64 })
for (const [key, mat, pal] of LAYERS) {
  const L = recolor(PNG.sync.read(readFileSync(join(ROOT, 'public/sprites', key, 'front.png'))), mat, pal)
  for (let i = 0; i < L.data.length; i += 4) {
    if (!L.data[i + 3]) continue
    comp.data.set(L.data.subarray(i, i + 4), i)
  }
}

// 找頭像範圍，置中放進 32×32
let x0 = 64, y0 = 64, x1 = 0, y1 = 0
for (let y = 0; y < 64; y++)
  for (let x = 0; x < 64; x++)
    if (comp.data[(y * 64 + x) * 4 + 3]) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
const w = x1 - x0 + 1
const h = y1 - y0 + 1
if (w > 32 || h > 32) throw new Error(`頭像 ${w}×${h} 超過 32×32`)
const icon = new PNG({ width: 32, height: 32 })
PNG.bitblt(comp, icon, x0, y0, w, h, Math.floor((32 - w) / 2), Math.floor((32 - h) / 2))
writeFileSync(join(ROOT, 'public/favicon-32.png'), PNG.sync.write(icon))

// 180×180：放大 5 倍（160）置中，夜空底色（iOS 主畫面圖示不支援透明）
const S = 5
const apple = new PNG({ width: 180, height: 180 })
for (let i = 0; i < apple.data.length; i += 4) apple.data.set([...NIGHT, 255], i)
const off = (180 - 32 * S) / 2
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++) {
    const si = (y * 32 + x) * 4
    if (!icon.data[si + 3]) continue
    for (let dy = 0; dy < S; dy++)
      for (let dx = 0; dx < S; dx++) apple.data.set(icon.data.subarray(si, si + 4), ((off + y * S + dy) * 180 + off + x * S + dx) * 4)
  }
writeFileSync(join(ROOT, 'public/apple-touch-icon.png'), PNG.sync.write(apple))

console.log(`✓ 頭像 ${w}×${h}，輸出 favicon-32.png、apple-touch-icon.png`)
