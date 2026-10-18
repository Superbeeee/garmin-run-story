/**
 * GRS（GARMIN RUN STORY）像素 logo。圖案全部為原創手繪點陣，不使用 LPC 素材。
 *
 * 執行：pnpm logo            → 三個方向的比較圖 brand/out/concepts.png
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'brand/out')
GlobalFonts.registerFromPath(join(ROOT, 'public/fonts/Cubic_11.woff2'), 'Cubic 11')

// ---------- 調色盤（Sweetie 16，與網站相同） ----------
export const PAL = {
  outline: '#1a1c2c',
  gold: '#ffcd75',
  goldHi: '#fff4cf',
  goldLo: '#ef7d57',
  red: '#b13e53',
  redLo: '#5d275d',
  snow: '#f4f4f4',
  snowLo: '#94b0c2',
  navy: '#29366f',
  navyHi: '#3b5dc9',
  panel: '#333c57',
  blue: '#3b5dc9',
  sky: '#41a6f6',
  green: '#38b764',
  greenLo: '#257179',
} as const
type Color = keyof typeof PAL

// ---------- 點陣畫布 ----------
export class Art {
  px: (Color | null)[]
  constructor(
    public w: number,
    public h: number,
  ) {
    this.px = new Array(w * h).fill(null)
  }
  get(x: number, y: number) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]
  }
  set(x: number, y: number, c: Color | null) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c
  }
  rect(x: number, y: number, w: number, h: number, c: Color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
  /** 蓋上另一張（null 為透明） */
  stamp(src: Art, ox: number, oy: number) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y)
      if (c) this.set(ox + x, oy + y, c)
    }
  }
  /** 在所有非透明像素外圍加 r 格外框（不覆蓋原有像素） */
  outline(c: Color = 'outline', r = 1): Art {
    const out = new Art(this.w, this.h)
    out.px = [...this.px]
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue
      let near = false
      for (let dy = -r; dy <= r && !near; dy++) for (let dx = -r; dx <= r && !near; dx++) if (this.get(x + dx, y + dy)) near = true
      if (near) out.set(x, y, c)
    }
    return out
  }
  /** 以 fill 色重新上色（保留形狀） */
  tint(c: Color): Art {
    const out = new Art(this.w, this.h)
    out.px = this.px.map((v) => (v ? c : null))
    return out
  }
  /** 每格放大成 k×k（最近鄰） */
  scaled(k: number): Art {
    const out = new Art(this.w * k, this.h * k)
    for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.px[y * out.w + x] = this.get(Math.floor(x / k), Math.floor(y / k))
    return out
  }
  padded(p: number): Art {
    const out = new Art(this.w + 2 * p, this.h + 2 * p)
    out.stamp(this, p, p)
    return out
  }
  /** 從字串圖案建立：每個字元對應一個顏色，'.' 為透明 */
  static from(rows: string[], map: Record<string, Color>): Art {
    const a = new Art(Math.max(...rows.map((r) => r.length)), rows.length)
    rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && ch !== ' ' && a.set(x, y, map[ch])))
    return a
  }
}

// ---------- 字形：粗像素字 G R S（7×9 格） ----------
const GLYPHS: Record<string, string[]> = {
  G: ['.#####.', '##...##', '##.....', '##.....', '##..###', '##...##', '##...##', '##...##', '.#####.'],
  R: ['######.', '##...##', '##...##', '##...##', '######.', '##.##..', '##..##.', '##...##', '##...##'],
  S: ['.#####.', '##...##', '##.....', '.###...', '..####.', '....###', '.....##', '##...##', '.#####.'],
}

/** 一個字：每格 cell×cell，頂端亮邊、底端暗邊，立體金字 */
function glyph(ch: string, cell: number, face: Color, hi: Color, lo: Color): Art {
  const g = GLYPHS[ch]
  const a = new Art(7 * cell, 9 * cell)
  const on = (x: number, y: number) => y >= 0 && y < 9 && x >= 0 && x < 7 && g[y][x] === '#'
  for (let y = 0; y < 9; y++) for (let x = 0; x < 7; x++) {
    if (!on(x, y)) continue
    a.rect(x * cell, y * cell, cell, cell, face)
    if (!on(x, y - 1)) a.rect(x * cell, y * cell, cell, 1, hi)
    if (!on(x, y + 1)) a.rect(x * cell, y * cell + cell - Math.max(1, cell >> 1), cell, Math.max(1, cell >> 1), lo)
  }
  return a
}

interface MarkStyle {
  face: Color
  hi: Color
  lo: Color
  shadow: Color
}
const GOLD: MarkStyle = { face: 'gold', hi: 'goldHi', lo: 'goldLo', shadow: 'red' }

/** GRS 字標：金字 + 深色外框 + 紅色立體落影（顏色可換） */
function wordmark(cell: number, depth: number, st: MarkStyle = GOLD): Art {
  const gap = cell * 2
  const letters = ['G', 'R', 'S'].map((c) => glyph(c, cell, st.face, st.hi, st.lo))
  const w = letters.reduce((s, l) => s + l.w, 0) + gap * 2
  const base = new Art(w, letters[0].h)
  let x = 0
  for (const l of letters) {
    base.stamp(l, x, 0)
    x += l.w + gap
  }
  const pad = depth + 3
  const out = new Art(w + pad * 2, base.h + pad * 2)
  // 落影：同一個形狀往右下疊 depth 次，最外層加深色外框
  const solid = base.tint(st.shadow)
  for (let d = depth; d >= 1; d--) out.stamp(d === depth ? solid.outline('outline', 1) : solid, pad + d, pad + d)
  out.stamp(base.outline('outline', 1), pad, pad)
  return out
}

// ---------- 圖案 ----------
/** 聖誕帽（歪戴），約 26×18 */
const SANTA_HAT = Art.from(
  [
    '..............oo..........',
    '...........oo#oo#o........',
    '.........oo#rrrr#ro.......',
    '.......oo#rrrrrrrrrr.oooo.',
    '......o#rrrrrrrrrrrrro#ww#o',
    '.....o#rrrrrrrrrrrrrrrowwwwo',
    '....o#rrrrrrrrrrrr#rrrowwwwo',
    '...o#rrrrrrrrrrrrrr#rro#ww#o',
    '..owwwwwwwwwwwwwwwwwwwwooooo',
    '.owwwwwwwwwwwwwwwwwwwwwo....',
    '.owssswwwssswwwsssswwwwo....',
    '..ooooooooooooooooooooo.....',
  ],
  { o: 'outline', '#': 'redLo', r: 'red', w: 'snow', s: 'snowLo' },
)

/** 跑步小人（剪影），14×18 */
function runner(c: Color): Art {
  return Art.from(
    [
      '........##....',
      '.......####...',
      '.......####...',
      '........##....',
      '.....#####....',
      '....###.###.#.',
      '...##..####.##',
      '..##...####...',
      '.......####...',
      '......##.###..',
      '.....##...##..',
      '....##.....##.',
      '...##.......##',
      '..##..........',
      '.##...........',
    ],
    { '#': c },
  )
}

/** 實心圓（含邊界） */
function disc(a: Art, cx: number, cy: number, r: number, c: Color) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) a.set(x, y, c)
}
const centered = (a: Art, art: Art, y: number, dx = 0) => a.stamp(art, Math.floor((a.w - art.w) / 2) + dx, y)

function star(c: Color): Art {
  return Art.from(['..#..', '..#..', '#####', '..#..', '..#..'], { '#': c })
}

/** 自製 5×7 英文像素字（只收 logo 用得到的字母） */
const MINI: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
}
function pixelText(str: string, c: Color): Art {
  const glyphs = [...str].map((ch) => MINI[ch])
  const w = glyphs.reduce((s, g) => s + g[0].length + 1, -1)
  const a = new Art(w, 7)
  let x = 0
  for (const g of glyphs) {
    g.forEach((row, y) => [...row].forEach((ch, i) => ch === '#' && a.set(x + i, y, c)))
    x += g[0].length + 1
  }
  return a
}

// ---------- 三個方向 ----------
function conceptWordmark(): Art {
  const mark = wordmark(5, 4)
  const hat = SANTA_HAT.scaled(2)
  // 副標放在深色底板上，淺色、深色背景都清楚
  const text = pixelText('GARMIN RUN STORY', 'snow')
  const plate = new Art(text.w + 12, text.h + 8)
  plate.rect(0, 0, plate.w, plate.h, 'outline')
  plate.stamp(text, 6, 4)
  const top = 34
  const w = Math.max(mark.w, plate.w * 2) + 24
  const a = new Art(w, top + mark.h + plate.h * 2 + 8)
  const mx = Math.floor((w - mark.w) / 2)
  a.stamp(mark, mx, top)
  // 帽子只壓在 G 的頂端
  a.stamp(hat, mx - 8, top - hat.h + 8)
  a.stamp(plate.scaled(2), Math.floor((w - plate.w * 2) / 2), top + mark.h + 2)
  a.stamp(star('gold').scaled(2).outline(), w - 26, 6)
  a.stamp(star('snow').outline(), w - 46, 22)
  return a.padded(2)
}

function conceptBadge(): Art {
  const W = 132
  const H = 140
  const a = new Art(W, H)
  // 八角形徽章：外框金、內圈深藍
  const inside = (x: number, y: number, r: number, cut: number) => x >= r && y >= r && x < W - r && y < H - r && x + y >= cut + r * 2 && W - 1 - x + y >= cut + r * 2 && x + (H - 1 - y) >= cut + r * 2 && W - 1 - x + (H - 1 - y) >= cut + r * 2
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inside(x, y, 0, 30)) a.set(x, y, 'outline')
    if (inside(x, y, 3, 30)) a.set(x, y, 'goldLo')
    if (inside(x, y, 4, 30)) a.set(x, y, 'gold')
    if (inside(x, y, 7, 30)) a.set(x, y, 'outline')
    if (inside(x, y, 9, 30)) a.set(x, y, 'navy')
  }
  // 地平線跑道
  a.rect(12, 90, W - 24, 2, 'navyHi')
  const r = runner('snow').scaled(2).outline()
  a.stamp(r, Math.floor((W - r.w) / 2) + 2, 10)
  const mark = wordmark(3, 3)
  a.stamp(mark, Math.floor((W - mark.w) / 2), 44)
  // 緞帶
  const rib = pixelText('RUN STORY', 'snow')
  const rw = rib.w + 18
  const rx = Math.floor((W - rw) / 2)
  a.rect(rx - 8, 104, 10, 14, 'redLo')
  a.rect(rx + rw - 2, 104, 10, 14, 'redLo')
  const band = new Art(rw, 15)
  band.rect(0, 0, rw, 15, 'red')
  band.rect(0, 12, rw, 3, 'redLo')
  a.stamp(band.outline(), rx - 1, 98)
  a.stamp(rib, rx + 9, 102)
  for (const [sx, sy] of [[22, 30], [W - 27, 30]]) a.stamp(star('gold'), sx, sy)
  return a.padded(2)
}

function conceptTrack(): Art {
  const mark = wordmark(5, 4)
  const W = mark.w + 76
  const H = mark.h + 44
  const a = new Art(W, H)
  // 跑道（斜向透視簡化為水平條紋）
  const ty = mark.h - 6
  a.rect(0, ty, W, H - ty, 'blue')
  for (const ly of [ty + 8, ty + 17, ty + 26, ty + 35]) a.rect(0, ly, W, 1, 'snow')
  a.rect(0, ty, W, 2, 'outline')
  // 終點線（黑白格）
  for (let y = ty + 2; y < H; y += 3) for (let x = W - 16; x < W - 10; x += 3) a.rect(x + ((y - ty) % 6 < 3 ? 0 : 3), y, 3, 3, 'snow')
  a.stamp(mark, 4, 4)
  // 跑者 + 速度線
  const r = runner('gold').scaled(2).outline()
  const rx = W - 52
  const ry = ty - r.h + 20
  for (const [lx, ly, lw] of [[rx - 30, ry + 12, 24], [rx - 40, ry + 18, 32], [rx - 26, ry + 24, 18]]) a.rect(lx, ly, lw, 3, 'snow')
  a.stamp(r, rx, ry)
  return a.padded(2)
}

// ---------- 第二批方向 ----------
function conceptMedal(): Art {
  const W = 132
  const H = 150
  const a = new Art(W, H)
  const cx = 66
  const cy = 100
  // 掛帶：左右兩條紅白綠斜帶交會到獎牌
  const stripe: Color[] = ['red', 'red', 'red', 'red', 'red', 'snow', 'snow', 'green', 'green', 'green', 'green', 'green']
  for (let y = 0; y < 66; y++) {
    const off = Math.round(y * 0.42)
    for (let i = 0; i < stripe.length * 2; i++) {
      a.set(22 + off + i, y, stripe[Math.floor(i / 2)])
      a.set(W - 23 - off - i, y, stripe[Math.floor(i / 2)])
    }
  }
  const straps = new Art(W, H)
  straps.stamp(a, 0, 0)
  a.stamp(straps.outline(), 0, 0)
  // 獎牌
  disc(a, cx, cy, 44, 'outline')
  disc(a, cx, cy, 42, 'goldLo')
  disc(a, cx, cy, 39, 'gold')
  disc(a, cx - 3, cy - 3, 33, 'goldHi')
  disc(a, cx, cy, 33, 'gold')
  for (let t = 0; t < 360; t += 3) {
    const r = 35
    a.set(Math.round(cx + r * Math.cos((t * Math.PI) / 180)), Math.round(cy + r * Math.sin((t * Math.PI) / 180)), 'goldLo')
  }
  // 掛環
  a.rect(cx - 6, cy - 50, 12, 8, 'outline')
  a.rect(cx - 4, cy - 48, 8, 4, 'goldLo')
  const mark = wordmark(3, 2, { face: 'red', hi: 'goldLo', lo: 'redLo', shadow: 'goldLo' })
  centered(a, mark, cy - 20)
  a.stamp(star('goldLo'), cx - 2, cy - 30)
  centered(a, pixelText('12.23', 'goldLo'), cy + 16)
  return a.padded(2)
}

function conceptBib(): Art {
  const W = 176
  const H = 124
  const a = new Art(W, H)
  a.rect(4, 4, W - 8, H - 8, 'outline')
  a.rect(6, 6, W - 12, H - 12, 'snow')
  a.rect(W - 10, 10, 4, H - 16, 'snowLo')
  a.rect(10, H - 10, W - 16, 4, 'snowLo')
  // 上方紅條
  a.rect(6, 6, W - 12, 20, 'red')
  a.rect(6, 23, W - 12, 3, 'redLo')
  centered(a, pixelText('GARMIN RUN STORY', 'snow'), 12)
  // 號碼：GRS
  const mark = wordmark(4, 3, { face: 'navy', hi: 'navyHi', lo: 'outline', shadow: 'red' })
  centered(a, mark, 32)
  // 撕線與日期
  for (let x = 12; x < W - 12; x += 6) a.rect(x, 96, 3, 1, 'snowLo')
  centered(a, pixelText('12.23', 'navy').scaled(2), 101)
  // 四角別針
  const pin = Art.from(['.oooooooooo.', 'o#sssssssss#o', '.oooooooooo.'], { o: 'outline', '#': 'snowLo', s: 'snow' })
  for (const [px, py] of [[10, 30], [W - 23, 30], [10, 86], [W - 23, 86]]) a.stamp(pin, px, py)
  return a.padded(2)
}

function conceptWreath(): Art {
  const W = 140
  const a = new Art(W, W)
  const c = 70
  disc(a, c, c, 64, 'outline')
  disc(a, c, c, 62, 'green')
  disc(a, c, c, 40, 'outline')
  disc(a, c, c, 38, null as unknown as Color)
  // 葉子紋理
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - c, y - c)
    if (d > 40 && d < 62 && (x * 7 + y * 13) % 11 < 3) a.set(x, y, 'greenLo')
  }
  // 漿果
  for (let k = 0; k < 12; k++) {
    const ang = (k / 12) * Math.PI * 2 + 0.2
    const bx = Math.round(c + 51 * Math.cos(ang))
    const by = Math.round(c + 51 * Math.sin(ang))
    if (by > c + 40 && Math.abs(bx - c) < 24) continue
    disc(a, bx, by, 3.2, 'outline')
    disc(a, bx, by, 2.2, 'red')
    a.set(bx - 1, by - 1, 'snow')
  }
  // 蝴蝶結
  const bow = Art.from(
    [
      'oooo........oooo',
      'orrroo....oorrro',
      'orrrrrooooorrrro',
      'orrrrrorrorrrrro',
      'orrrrroRRorrrrro',
      'orrrrrorrorrrrro',
      'orrrrrooooorrrro',
      'orrroo.orro.oorro',
      'oooo..orrrro..ooo',
      '.....orrr.rro....',
      '....orrr...rro...',
      '....oooo...oooo..',
    ],
    { o: 'outline', r: 'red', R: 'redLo' },
  ).scaled(2)
  centered(a, bow, W - bow.h - 2)
  const mark = wordmark(3, 2)
  centered(a, mark, c - Math.floor(mark.h / 2) - 4)
  return a.padded(2)
}

function conceptGift(): Art {
  const W = 156
  const H = 156
  const a = new Art(W, H)
  // 盒身
  a.rect(14, 68, W - 28, 82, 'outline')
  a.rect(16, 70, W - 32, 78, 'red')
  a.rect(W - 34, 70, 18, 78, 'redLo')
  // 盒蓋
  a.rect(8, 50, W - 16, 22, 'outline')
  a.rect(10, 52, W - 20, 18, 'red')
  a.rect(10, 52, W - 20, 3, 'redLo')
  a.rect(10, 66, W - 20, 4, 'redLo')
  // 緞帶（直）
  a.rect(W / 2 - 9, 50, 18, 100, 'outline')
  a.rect(W / 2 - 7, 52, 14, 96, 'gold')
  a.rect(W / 2 + 3, 52, 4, 96, 'goldLo')
  // 蝴蝶結
  const bow = Art.from(
    [
      '..oooo......oooo..',
      '.oggggoo..ooggggo.',
      'ogggGGggoogGGggggo',
      'oggG..Ggggg..Gggo.',
      'oggG...GggG...Ggo.',
      '.oggGGGgoogGGGggo.',
      '..oooooo..oooooo..',
    ],
    { o: 'outline', g: 'gold', G: 'goldLo' },
  ).scaled(3)
  centered(a, bow, 50 - bow.h + 6)
  const mark = wordmark(4, 3)
  centered(a, mark, 82)
  return a.padded(2)
}

function conceptCartridge(): Art {
  const W = 128
  const H = 150
  const a = new Art(W, H)
  // 卡帶外殼（右上切角）
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x + (H - y) < 0) continue
    if (W - x + y < 16) continue
    a.set(x, y, 'outline')
  }
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (W - x + y >= 20) a.set(x, y, 'snowLo')
  // 頂端溝槽
  for (let i = 0; i < 5; i++) a.rect(18 + i * 16, 8, 10, 3, 'panel')
  // 標籤
  a.rect(10, 22, W - 20, 104, 'outline')
  a.rect(12, 24, W - 24, 100, 'navy')
  a.rect(12, 24, W - 24, 34, 'panel')
  for (const [sx, sy] of [[20, 30], [96, 36], [40, 64], [100, 70], [24, 96], [90, 104]]) a.set(sx, sy, 'snow')
  const mark = wordmark(3, 2)
  centered(a, mark, 34)
  const r = runner('gold').outline()
  centered(a, r, 72, -18)
  centered(a, pixelText('12.23', 'snow').scaled(2), 76, 22)
  centered(a, pixelText('PRESS START', 'gold'), 110)
  // 底部握把紋
  for (let i = 0; i < 6; i++) a.rect(26 + i * 13, 134, 8, 8, 'panel')
  return a.padded(2)
}

// ---------- 輸出 ----------
export function toCanvas(art: Art, scale: number, bg?: string) {
  const c = createCanvas(art.w * scale, art.h * scale)
  const x = c.getContext('2d')
  if (bg) {
    x.fillStyle = bg
    x.fillRect(0, 0, c.width, c.height)
  }
  for (let y = 0; y < art.h; y++) for (let i = 0; i < art.w; i++) {
    const col = art.get(i, y)
    if (!col) continue
    x.fillStyle = PAL[col]
    x.fillRect(i * scale, y * scale, scale, scale)
  }
  return c
}

/** 比較圖：每個方向上排淺色底、下排深色底 */
async function sheet(concepts: [string, Art][], file: string) {
  const S = 4
  const cellW = 520
  const cellH = 560
  const cv = createCanvas(cellW * concepts.length, cellH * 2 + 60)
  const x = cv.getContext('2d')
  x.fillStyle = '#ffffff'
  x.fillRect(0, 0, cv.width, cv.height)
  x.imageSmoothingEnabled = false
  concepts.forEach(([name, art], i) => {
    for (const [row, bg] of [[0, '#f4f4f4'], [1, '#1a1c2c']] as const) {
      x.fillStyle = bg
      x.fillRect(i * cellW + 10, 60 + row * cellH + 10, cellW - 20, cellH - 20)
      const c = toCanvas(art, S)
      const k = Math.min(1, (cellW - 60) / c.width, (cellH - 60) / c.height)
      x.drawImage(c, i * cellW + (cellW - c.width * k) / 2, 60 + row * cellH + (cellH - c.height * k) / 2, c.width * k, c.height * k)
    }
    x.fillStyle = '#1a1c2c'
    x.font = '36px "Cubic 11"'
    x.fillText(name, i * cellW + 20, 44)
  })
  writeFileSync(join(OUT, file), await cv.encode('png'))
  console.log(`✓ brand/out/${file}`)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  await sheet(
    [
      ['1 經典字標', conceptWordmark()],
      ['2 徽章', conceptBadge()],
      ['3 跑道', conceptTrack()],
    ],
    'concepts.png',
  )
  await sheet(
    [
      ['4 完賽獎牌', conceptMedal()],
      ['5 號碼布', conceptBib()],
      ['6 聖誕花圈', conceptWreath()],
      ['7 交換禮物', conceptGift()],
      ['8 遊戲卡帶', conceptCartridge()],
    ],
    'concepts2.png',
  )
}

main()
