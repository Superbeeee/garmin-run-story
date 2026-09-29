/**
 * 表情頭頂圖示（自繪點陣，非 LPC 素材）。每個字元一個像素，外圍自動加深色描邊。
 */
import type { IconName } from './types'

const COLORS: Record<string, string> = { r: '#E8435A', w: '#FFFFFF', y: '#F5B82E', b: '#3D7BE0', c: '#6EC6F2', g: '#9AA3AE' }
const OUTLINE = '#1B2330'

const ART: Record<IconName, string[]> = {
  heart: ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  note: ['...yy..', '...yyy.', '...y.yy', '...y..y', '...y...', '.yyy...', 'yyyy...', '.yy....'],
  bang: ['rr', 'rr', 'rr', 'rr', '..', 'rr'],
  quest: ['.bbb.', 'bb.bb', '...bb', '..bb.', '..b..', '.....', '..b..'],
  vein: ['.r...r.', 'rr...rr', '..r.r..', '.......', '..r.r..', 'rr...rr', '.r...r.'],
  cloud: ['.gggg..', 'ggggggg', 'ggggggg', '.......', '.c..c..', '...c..c'],
  dots: ['gg.gg.gg', 'gg.gg.gg'],
  sweat: ['..c..', '..c..', '.ccc.', 'cwccc', 'cwccc', '.ccc.'],
}

const cache = new Map<IconName, HTMLCanvasElement>()

export function getIcon(name: IconName): HTMLCanvasElement {
  const hit = cache.get(name)
  if (hit) return hit
  const rows = ART[name]
  const w = rows[0].length + 2
  const h = rows.length + 2
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')!
  const filled: boolean[] = new Array(w * h).fill(false)
  rows.forEach((row, y) =>
    [...row].forEach((ch, i) => {
      if (ch === '.') return
      x.fillStyle = COLORS[ch]
      x.fillRect(i + 1, y + 1, 1, 1)
      filled[(y + 1) * w + i + 1] = true
    }),
  )
  // 描邊：與實心像素上下左右相鄰的空格
  x.fillStyle = OUTLINE
  for (let y = 0; y < h; y++) {
    for (let X = 0; X < w; X++) {
      if (filled[y * w + X]) continue
      const near =
        (X > 0 && filled[y * w + X - 1]) ||
        (X < w - 1 && filled[y * w + X + 1]) ||
        (y > 0 && filled[(y - 1) * w + X]) ||
        (y < h - 1 && filled[(y + 1) * w + X])
      if (near) x.fillRect(X, y, 1, 1)
    }
  }
  cache.set(name, c)
  return c
}
