/**
 * 讓 src/avatar（原本跑在瀏覽器）可以在 Node 裡執行：
 * 用 @napi-rs/canvas 提供 document.createElement('canvas') 與 Image，
 * 圖片網址 /sprites/... 對應到 public/ 下的檔案。
 */
import { createCanvas, GlobalFonts, Image } from '@napi-rs/canvas'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

class FsImage extends Image {
  // loadSprite 先設 onload 再設 src；src 為網站路徑，改讀 public/ 下的檔案
  set src(url: string | Buffer) {
    super.src = typeof url === 'string' ? readFileSync(join(ROOT, 'public', url.replace(/^\//, ''))) : url
  }
  get src() {
    return super.src as unknown as string
  }
}

const g = globalThis as Record<string, unknown>
g.document = { createElement: (tag: string) => (tag === 'canvas' ? createCanvas(1, 1) : null) }
g.Image = FsImage

GlobalFonts.registerFromPath(join(ROOT, 'public/fonts/Cubic_11.woff2'), 'Cubic 11')

/** 固定種子的亂數，讓每次輸出都一樣（眨眼等內部隨機也用它） */
export function seedRandom(seed: number): () => number {
  let a = seed >>> 0
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  Math.random = rnd
  return rnd
}
