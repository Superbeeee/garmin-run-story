/**
 * GRS 年度回顧（活動開始前播放）：像素遊戲「關卡地圖」風格。
 * 一年的活動是一個個關卡，每關的節奏（對齊配樂，一關 8 小節）：
 *   地圖鏡頭推近、小隊跑到旗子 → 光圈轉場 → 照片一張張特寫（拍照閃光、慢慢推移）
 *   → 飛進拍立得照片牆 → STAGE CLEAR! 蓋章、彩帶 → 光圈轉場到下一關
 * 每關依標題關鍵字加上主題特效（氣球、煙火、霓虹、小火車、應援）。
 *
 * 照片放在 trailer/private/recap/（已被 gitignore），每個資料夾是一個關卡，
 * 資料夾名稱開頭的數字是順序，其餘文字就是關卡標題。
 *
 * 執行：pnpm recap            → ~/Downloads/GRS-年度回顧.mp4
 *      pnpm recap --stills   → 關鍵畫面輸出到 trailer/out/recap-*.png
 */
import { ROOT, seedRandom } from './env'
import { createCanvas, loadImage, type Canvas, type Image } from '@napi-rs/canvas'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { preloadAvatar, randomConfig } from '../src/avatar'
import { Fx, themeOf, type Theme } from './fx'
import {
  C,
  DT,
  FPS,
  H,
  LH,
  LW,
  W,
  blitPixel,
  caption,
  drawRunners,
  easeInOut,
  easeOut,
  easeOutBack,
  encodeVideo,
  fill,
  lerp,
  makeFlakes,
  makeRunner,
  nightSky,
  o,
  out,
  p,
  px,
  pixelBox,
  scaled,
  seg,
  snow as snowOn,
  text,
  type Runner,
} from './kit'
import { BAR, BEAT, renderRecapMusic, type Sfx } from './recap-music'

const stillsMode = process.argv.includes('--stills')
const rnd = seedRandom(20261223)
const flakes = makeFlakes(rnd)
const snow = (t: number, alpha?: number) => snowOn(flakes, t, alpha)
const fx = new Fx(rnd)
const STEP = DT / 1000
/** 這一格剛好跨過時間點 at */
const crossed = (t: number, at: number) => t >= at && t - STEP < at

// ---------- 關卡資料 ----------
const RECAP = join(ROOT, 'trailer/private/recap')
interface Stage {
  title: string
  theme: Theme
  photos: Image[]
  /** 每張照片特寫的開始時間（關卡內秒數），最後一個是照片牆開始 */
  spots: number[]
  /** 到這一關之前累計的照片數 */
  before: number
}
const stageDirs = readdirSync(RECAP, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d+/.test(d.name))
  .sort((a, b) => parseInt(a.name) - parseInt(b.name))
let stages: Stage[] = []
let totalPhotos = 0

// ---------- 時間軸（一拍 0.4 秒、一小節 1.6 秒） ----------
const INTRO = 8
const STAGE_LEN = 8 * BAR
const MAP_LEN = 6 * BEAT
const ARRIVE = 1.8
const CLEAR = 25 * BEAT
const FLY = 0.45
const START_PRESS = 6.6
const OUTRO = INTRO + stageDirs.length * STAGE_LEN
const FINALE = OUTRO + 2 * BAR
const DUR = FINALE + 7.2

/** 把特寫時間平均分配到拍子上（MAP_LEN 到 CLEAR 之間） */
function spotTimes(n: number): number[] {
  const beats = Math.round((CLEAR - MAP_LEN) / BEAT)
  const out: number[] = []
  for (let i = 0; i <= n; i++) out.push(MAP_LEN + Math.round((beats * i) / n) * BEAT)
  return out
}

// ---------- 地圖 ----------
const MAP = { ground: '#dfe6ec', groundLo: '#c7d5e0', path: '#b8cfdd', pathEdge: '#94b0c2', trunk: '#6b4a3a' }
/** 旗子位置（像素層座標，腳底）；最後一個是 12.23 */
const FLAGS: [number, number][] = [
  [52, 214],
  [108, 150],
  [176, 206],
  [226, 120],
  [292, 182],
  [340, 104],
  [398, 164],
  [446, 84],
]
const START: [number, number] = [-20, 236]
const pathPts = [START, ...FLAGS]

/** 靜態地圖底圖：雪地、結冰小路、雪松 */
function buildMap(): Canvas {
  const c = createCanvas(LW, LH)
  const m = c.getContext('2d')
  m.fillStyle = MAP.ground
  m.fillRect(0, 0, LW, LH)
  for (let i = 0; i < 900; i++) {
    m.fillStyle = rnd() < 0.5 ? MAP.groundLo : C.snow
    m.fillRect(Math.floor(rnd() * LW), Math.floor(rnd() * LH), rnd() < 0.2 ? 2 : 1, 1)
  }
  const samples: [number, number][] = []
  for (let i = 0; i < pathPts.length - 1; i++) {
    const [x0, y0] = pathPts[i]
    const [x1, y1] = pathPts[i + 1]
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)
    for (let k = 0; k <= n; k++) samples.push([lerp(x0, x1, k / n), lerp(y0, y1, k / n)])
  }
  for (const [color, r] of [[MAP.pathEdge, 6], [MAP.path, 4]] as const) {
    m.fillStyle = color
    for (const [x, y] of samples) m.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r * 2)
  }
  const trees: [number, number][] = []
  for (let tries = 0; trees.length < 26 && tries < 2000; tries++) {
    const x = 8 + rnd() * (LW - 16)
    const y = 20 + rnd() * (LH - 26)
    if (samples.some(([sx, sy]) => Math.abs(sx - x) < 16 && sy - y < 30 && y - sy < 8)) continue
    if (trees.some(([tx, ty]) => Math.abs(tx - x) < 14 && Math.abs(ty - y) < 14)) continue
    trees.push([x, y])
  }
  trees.sort((a, b) => a[1] - b[1])
  for (const [x, y] of trees) {
    const tx = Math.round(x)
    const ty = Math.round(y)
    m.fillStyle = MAP.trunk
    m.fillRect(tx - 1, ty - 3, 3, 4)
    for (const [w, dy, col] of [[13, -6, C.greenLo], [11, -8, C.green], [9, -11, C.greenLo], [7, -13, C.green], [5, -16, C.greenLo], [3, -18, C.green]] as const) {
      m.fillStyle = col
      m.fillRect(tx - Math.floor(w / 2), ty + dy, w, 3)
    }
    m.fillStyle = C.snow
    m.fillRect(tx - 1, ty - 19, 3, 2)
    m.fillRect(tx - 5, ty - 12, 2, 1)
    m.fillRect(tx + 3, ty - 9, 2, 1)
  }
  return c
}
let mapBg: Canvas

function drawFlag(x: number, y: number, state: 'todo' | 'current' | 'done', t: number) {
  const bob = state === 'current' ? Math.round(Math.abs(Math.sin(t * 6)) * -3) : 0
  p.fillStyle = C.outline
  p.fillRect(x, y - 16 + bob, 1, 16 - bob)
  p.fillRect(x + 1, y - 17 + bob, 8, 7)
  p.fillStyle = state === 'done' ? C.gold : C.red
  p.fillRect(x + 1, y - 16 + bob, 7, 5)
  p.fillStyle = C.outline
  p.fillRect(x - 2, y, 5, 1)
}
function drawGoal(x: number, y: number, t: number) {
  p.fillStyle = C.outline
  p.fillRect(x, y - 20, 1, 20)
  const star = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##']
  p.fillStyle = C.gold
  star.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && p.fillRect(x - 3 + i, y - 27 + j, 1, 1)))
  if (Math.floor(t * 4) % 2) {
    p.fillStyle = C.snow
    p.fillRect(x + 6, y - 30, 1, 1)
    p.fillRect(x - 6, y - 24, 1, 1)
  }
}

// 三人小隊（戴聖誕帽）
const team: Runner[] = [0, 1, 2].map((i) => makeRunner(rnd, { ...randomConfig(), hat: 'christmas', hatColor: ['red', 'green', 'red'][i] }, START[0], START[1], 1, 'idle'))
/** 小隊停在旗子左邊，不擋住旗子；終點在右上角，停得更遠 */
const stand = (i: number): [number, number] => (i === FLAGS.length - 1 ? [FLAGS[i][0] - 38, FLAGS[i][1] + 14] : [FLAGS[i][0] - 14, FLAGS[i][1] + 4])

/** 地圖鏡頭：(cx, cy) 為中心、放大 z 倍；回傳像素層座標 → 畫面座標的換算 */
function camera(cx: number, cy: number, z: number) {
  const rw = LW / z
  const rh = LH / z
  const x0 = Math.min(LW - rw, Math.max(0, cx - rw / 2))
  const y0 = Math.min(LH - rh, Math.max(0, cy - rh / 2))
  o.imageSmoothingEnabled = false
  o.drawImage(px, x0, y0, rw, rh, 0, 0, W, H)
  return (x: number, y: number): [number, number] => [((x - x0) / rw) * W, ((y - y0) / rh) * H]
}

/** 地圖場景：小隊跑向第 goingTo 面旗子，arrive 為抵達時間（絕對秒數），since 為場景開始後經過的秒數 */
function mapScene(t: number, tms: number, arrive: number, goingTo: number, since: number) {
  p.drawImage(mapBg, 0, 0)
  const doneUpTo = t >= arrive ? goingTo : goingTo - 1
  FLAGS.forEach(([x, y], i) => {
    if (i === FLAGS.length - 1) return drawGoal(x, y, t)
    drawFlag(x, y, i <= doneUpTo ? 'done' : i === goingTo ? 'current' : 'todo', t)
  })
  const from = goingTo === 0 ? START : stand(goingTo - 1)
  const to = stand(goingTo)
  const k = seg(t, arrive - 1.6, arrive)
  const moving = k > 0 && k < 1
  team.forEach((r, i) => {
    const kk = seg(k, i * 0.08, 1 - (2 - i) * 0.08)
    r.x = lerp(from[0], to[0], easeInOut(kk)) - i * 9 + 9
    r.y = lerp(from[1], to[1], easeInOut(kk)) + i * 3 + 2
    r.dir = to[0] >= from[0] ? 1 : -1
    const want = moving ? 'run' : 'idle'
    if (r.actor.mode !== want) r.actor.setMode(want)
    if (crossed(t, arrive)) {
      r.actor.jump()
      if (i === 1) r.actor.emote(0, tms)
    }
    r.actor.update(DT)
  })
  // 抵達時旗子噴出金色閃光
  if (crossed(t, arrive)) fx.burst(FLAGS[goingTo][0] + 4, FLAGS[goingTo][1] - 14, 26, [C.gold, C.snow, C.goldLo])
  fx.update(STEP)
  drawRunners(team, tms)
  fx.draw()
  snow(t, 0.5)
  // 鏡頭：從全圖推近到目標旗子
  const kc = easeInOut(seg(since, 0, 1.6))
  const z = lerp(1, 1.9, kc)
  const toScreen = camera(lerp(LW / 2, FLAGS[goingTo][0] - 20, kc), lerp(LH / 2, FLAGS[goingTo][1] - 20, kc), z)
  FLAGS.forEach(([x, y], i) => {
    const last = i === FLAGS.length - 1
    const [sx, sy] = toScreen(x + (last ? 0 : 4), y - (last ? 36 : 22))
    text(last ? '12.23' : String(i + 1), sx, sy, { size: Math.round((last ? 40 : 30) * Math.min(z, 1.6)), color: last || i <= doneUpTo ? C.gold : C.snow })
  })
  return toScreen
}

/** 光圈轉場：畫面只剩以 (cx, cy) 為中心、半徑 r 的圓 */
function iris(cx: number, cy: number, r: number) {
  if (r >= 2400) return
  o.save()
  o.beginPath()
  o.rect(0, 0, W, H)
  o.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2, true)
  o.fillStyle = '#000'
  o.fill('evenodd')
  o.restore()
}

// ---------- 照片 ----------
interface Rect {
  x: number
  y: number
  w: number
  h: number
  rot: number
}
const ANGLES = [-3, 2.5, -2, 3]
/** 照片牆：一排拍立得，微微歪斜（x、y 為中心） */
function collage(photos: Image[]): Rect[] {
  const gap = 70
  const maxW = 1640
  const maxH = 600
  const ratios = photos.map((im) => im.width / im.height)
  const hh = Math.min(maxH, (maxW - gap * (photos.length - 1)) / ratios.reduce((s, r) => s + r, 0))
  const total = ratios.reduce((s, r) => s + r * hh, 0) + gap * (photos.length - 1)
  let x = (W - total) / 2
  return photos.map((_, i) => {
    const w = ratios[i] * hh
    const r = { x: x + w / 2, y: 580 + (i % 2 ? 18 : -18), w, h: hh, rot: ANGLES[i % ANGLES.length] }
    x += w + gap
    return r
  })
}
/** 特寫：盡量大，置中 */
function spotlightRect(img: Image): Rect {
  const k = Math.min(1300 / img.width, 680 / img.height)
  return { x: W / 2, y: 570, w: img.width * k, h: img.height * k, rot: 0 }
}
const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k), rot: lerp(a.rot, b.rot, k) })

/** 拍立得：白框（下緣較寬）+ 深色外框；kb 為照片內的推移（0～1），flash 為閃光強度 */
function polaroid(img: Image, r: Rect, kb = 0, panDir = 1, flash = 0) {
  const b = Math.max(10, r.w * 0.03)
  o.save()
  o.translate(r.x, r.y)
  o.rotate((r.rot * Math.PI) / 180)
  pixelBox(-r.w / 2 - b - 6, -r.h / 2 - b - 6, r.w + b * 2 + 12, r.h + b * 3.2 + 12, C.outline, C.outline, 6)
  pixelBox(-r.w / 2 - b, -r.h / 2 - b, r.w + b * 2, r.h + b * 3.2, C.snow, C.snow, 4)
  // 照片本身：慢慢放大並橫向平移（Ken Burns）
  o.save()
  o.beginPath()
  o.rect(-r.w / 2, -r.h / 2, r.w, r.h)
  o.clip()
  const z = 1 + 0.12 * kb
  const dx = (z - 1) * r.w * 0.25 * (panDir > 0 ? lerp(-1, 1, kb) : lerp(1, -1, kb))
  o.imageSmoothingEnabled = true
  o.imageSmoothingQuality = 'high'
  o.drawImage(img, (-r.w / 2) * z + dx, (-r.h / 2) * z, r.w * z, r.h * z)
  if (flash > 0) {
    o.globalAlpha = flash
    o.fillStyle = '#fff'
    o.fillRect(-r.w / 2, -r.h / 2, r.w, r.h)
    o.globalAlpha = 1
  }
  o.restore()
  o.restore()
}

/** 右上角：♥ 回憶 n/總數 */
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']
function memoryCounter(n: number, bump: number) {
  const x = W - 400
  const y = 40
  const s = 6
  o.fillStyle = C.red
  HEART.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && o.fillRect(x + i * s, y + j * s - Math.round(bump * 10), s, s)))
  text(`回憶 ${n}/${totalPhotos}`, x + 58, y + 18, { size: 40, align: 'left', color: bump > 0 ? C.gold : C.snow })
}

/** 照片階段：特寫 → 飛進照片牆 → STAGE CLEAR */
function photoScene(t: number, tms: number, s: number, local: number) {
  const st = stages[s]
  const n = st.photos.length
  const pops = st.spots.slice(0, n)
  const slots = collage(st.photos)
  const shake = local >= CLEAR && local < CLEAR + 0.25 ? (rnd() - 0.5) * 18 : 0
  o.save()
  o.translate(shake, shake * 0.6)
  nightSky()
  pixelBox(W / 2 - 110, 30, 220, 56, C.red, C.red, 6)
  text(`STAGE ${s + 1}`, W / 2, 58, { size: 33, outline: 0 })
  text(st.title, W / 2, 140, { size: 60, shadow: C.red })

  // 已經飛進照片牆的
  st.photos.forEach((img, i) => local >= st.spots[i + 1] && polaroid(img, slots[i]))
  // 目前特寫中的（背景變暗）
  const cur = pops.findIndex((a, i) => local >= a && local < st.spots[i + 1])
  if (cur >= 0) {
    const [a, b] = [st.spots[cur], st.spots[cur + 1]]
    o.globalAlpha = 0.6 * (1 - seg(local, b - FLY, b))
    o.fillStyle = C.night
    o.fillRect(-20, 190, W + 40, H)
    o.globalAlpha = 1
    const img = st.photos[cur]
    const pop = easeOutBack(seg(local, a, a + 0.35))
    const r = lerpRect(spotlightRect(img), slots[cur], easeInOut(seg(local, b - FLY, b)))
    polaroid(img, { ...r, w: r.w * pop, h: r.h * pop }, seg(local, a, b - FLY), cur % 2 ? -1 : 1, 0.9 * (1 - seg(local, a, a + 0.3)))
  }

  // 像素層：主題特效、左下角的小隊
  p.clearRect(0, 0, LW, LH)
  snow(t, 0.5)
  fx.emit(st.theme, STEP, local >= CLEAR ? 0.5 : 1)
  if (crossed(local, CLEAR)) {
    fx.burst(LW * 0.25, LH * 0.45, 70)
    fx.burst(LW * 0.75, LH * 0.45, 70)
  }
  fx.update(STEP)
  fx.draw(st.theme)
  const popIdx = pops.findIndex((a) => crossed(local, a))
  team.forEach((r, i) => {
    r.x = 18 + i * 17
    r.y = 266
    r.dir = 1
    if (r.actor.mode !== 'idle') r.actor.setMode('idle')
    if (popIdx >= 0 && popIdx % 3 === i) {
      r.actor.jump()
      r.actor.emote([1, 0, 3][i], tms)
    }
    if (crossed(local, CLEAR)) {
      r.actor.jump()
      r.actor.emote(0, tms)
    }
    if (crossed(local, CLEAR + 1.2)) r.actor.jump()
    r.actor.update(DT)
  })
  drawRunners(team, tms)
  blitPixel()

  // 應援主題：「加油！」對話泡泡
  if (st.theme === 'cheer') {
    const bubbles: [number, number, number][] = [[230, 300, 3.0], [1700, 420, 4.4], [1640, 860, 6.2], [260, 640, 7.6]]
    for (const [bx, by, at] of bubbles) {
      const k = easeOutBack(seg(local, at, at + 0.3)) * (1 - seg(local, at + 1.6, at + 1.9))
      scaled(bx, by, k, () => {
        pixelBox(-112, -48, 224, 96, C.outline, C.outline, 8)
        pixelBox(-106, -42, 212, 84, C.snow, C.snow, 6)
        text('加油！', 0, 0, { size: 50, color: C.red, outline: 0 })
      })
    }
  }

  // 回憶計數
  const shown = pops.filter((a) => local >= a).length
  const lastPop = Math.max(-9, ...pops.filter((a) => local >= a))
  memoryCounter(st.before + shown, 1 - seg(local, lastPop, lastPop + 0.3))

  // STAGE CLEAR!
  if (local >= CLEAR) {
    const k = seg(local, CLEAR, CLEAR + 0.3)
    o.save()
    o.translate(W / 2, 560)
    o.rotate((-6 * Math.PI) / 180)
    const sc = lerp(2.4, 1, easeOut(k))
    o.scale(sc, sc)
    o.globalAlpha = Math.min(1, k * 3)
    text('STAGE CLEAR!', 0, 0, { size: 132, color: C.gold, shadow: C.red })
    o.globalAlpha = 1
    o.restore()
    text(`+${n} 回憶`, W / 2, 700, { size: 55, alpha: seg(local, CLEAR + 0.4, CLEAR + 0.7) })
  }
  o.restore()
}

// ---------- 開場與片尾 ----------
const parade: Runner[] = Array.from({ length: 8 }, (_, i) =>
  makeRunner(rnd, { ...randomConfig(), hat: i % 2 === 0 ? 'christmas' : 'none', hatColor: 'red' }, -30 - i * 58, 262, 1, 'run'),
)
function paradeLayer(t: number, tms: number, theme: Theme) {
  p.clearRect(0, 0, LW, LH)
  snow(t, 0.8)
  fx.emit(theme, STEP)
  fx.update(STEP)
  fx.draw(theme)
  p.fillStyle = C.snow
  p.fillRect(0, 264, LW, 6)
  p.fillStyle = '#dfe6ec'
  p.fillRect(0, 262, LW, 2)
  for (const r of parade) {
    r.actor.update(DT)
    r.x += DT * r.actor.speed
    if (r.x > LW + 30) r.x -= LW + 60 + 58 * 2
  }
  drawRunners(parade.filter((r) => r.x > -30), tms)
  blitPixel()
}

function intro(t: number, tms: number) {
  nightSky()
  paradeLayer(t, tms, 'sparkle')
  const drop = (t0: number, y: number) => y - (1 - easeOutBack(seg(t, t0, t0 + 0.6))) * 240
  text('★ GRC ★', W / 2, drop(0.9, 230), { size: 55, color: C.gold, alpha: seg(t, 0.9, 1.2) })
  // 標題逐字彈出
  const chars = [...'我們的 2026']
  const widths = chars.map((ch) => (ch === ' ' ? 50 : /\d/.test(ch) ? 80 : 143))
  let x = W / 2 - widths.reduce((s, w) => s + w, 0) / 2
  chars.forEach((ch, i) => {
    const at = 1.4 + i * 0.12
    const cx = x + widths[i] / 2
    x += widths[i]
    if (ch !== ' ') scaled(cx, 390, easeOutBack(seg(t, at, at + 0.35)), () => text(ch, 0, 0, { size: 143, shadow: C.red }))
  })
  text('GARMIN RUN STORY・年度回顧', W / 2, 545, { size: 55, alpha: seg(t, 2.6, 3.1) })
  const pressed = t >= START_PRESS
  const on = pressed ? Math.floor(t * 12) % 2 === 0 : Math.floor(t * 2) % 2 === 0
  if (t >= 3.6 && on) text('PRESS START', W / 2, 700, { size: 55, color: pressed ? C.snow : C.gold })
  fill('#000', 1 - seg(t, 0, 0.8))
  iris(W / 2, H / 2, lerp(2400, 0, easeInOut(seg(t, 7.5, 8))))
}

function finale(t: number, tms: number) {
  nightSky()
  paradeLayer(t, tms, 'party')
  const l = t - FINALE
  const drop = (t0: number, y: number) => y - (1 - easeOutBack(seg(l, t0, t0 + 0.6))) * 260
  text('★ GRC 聖誕交換禮物 ★', W / 2, drop(0.1, 110), { size: 44, color: C.gold, alpha: seg(l, 0.1, 0.4) })
  text('GARMIN RUN STORY', W / 2, drop(0.3, 240), { size: 121, shadow: C.red, alpha: seg(l, 0.3, 0.6) })
  scaled(W / 2, 410, easeOutBack(seg(l, 0.9, 1.4)), () => text('GRS', 0, 0, { size: 176, color: C.gold, shadow: C.red }))
  scaled(W / 2, 600, easeOutBack(seg(l, 1.5, 2.0)), () => text('12.23', 0, 0, { size: 110, shadow: C.red }))
  const slogan = '交換禮物，開始！'
  const n = Math.max(0, Math.min([...slogan].length, Math.floor((l - 2.3) * 10) + 1))
  if (l >= 2.3) text([...slogan].slice(0, n).join(''), W / 2, 745, { size: 66, color: C.gold })
  fill('#fff', 1 - seg(l, 0, 0.3))
  fill('#000', seg(t, DUR - 1, DUR - 0.05))
}

// ---------- 每一格 ----------
let scene = ''
/** 換場景時清掉上一段的粒子 */
function enter(name: string) {
  if (scene !== name) {
    scene = name
    fx.clear()
  }
}

function renderFrame(f: number) {
  const t = f / FPS
  const tms = t * 1000
  if (t < INTRO) {
    enter('intro')
    return intro(t, tms)
  }
  if (t < OUTRO) {
    const s = Math.floor((t - INTRO) / STAGE_LEN)
    const local = t - INTRO - s * STAGE_LEN
    if (local < MAP_LEN) {
      enter(`map${s}`)
      const toScreen = mapScene(t, tms, INTRO + s * STAGE_LEN + ARRIVE, s, local)
      caption(stages[s].title, local, 0.35, MAP_LEN)
      iris(W / 2, H / 2, lerp(0, 2400, easeInOut(seg(local, 0, 0.35))))
      const [ix, iy] = toScreen(FLAGS[s][0], FLAGS[s][1] - 10)
      iris(ix, iy, lerp(2400, 0, easeInOut(seg(local, MAP_LEN - 0.35, MAP_LEN))))
    } else {
      enter(`photo${s}`)
      photoScene(t, tms, s, local)
      iris(W / 2, H / 2, lerp(0, 2400, easeInOut(seg(local, MAP_LEN, MAP_LEN + 0.35))))
      iris(W / 2, H / 2, lerp(2400, 0, easeInOut(seg(local, STAGE_LEN - 0.35, STAGE_LEN))))
    }
    return
  }
  if (t < FINALE) {
    enter('last')
    mapScene(t, tms, OUTRO + 2.2, FLAGS.length - 1, t - OUTRO)
    caption('最後一站……', t - OUTRO, 0.4, FINALE - OUTRO)
    iris(W / 2, H / 2, lerp(0, 2400, easeInOut(seg(t, OUTRO, OUTRO + 0.35))))
    fill('#fff', seg(t, FINALE - 0.2, FINALE))
    return
  }
  enter('finale')
  finale(t, tms)
}

/** 音效時間點（給配樂） */
function sfxCues(): Sfx[] {
  const cues: Sfx[] = [{ t: 7.5, kind: 'whoosh' }]
  stages.forEach((st, s) => {
    const t0 = INTRO + s * STAGE_LEN
    cues.push({ t: t0 + ARRIVE, kind: 'chime' }, { t: t0 + MAP_LEN - 0.35, kind: 'whoosh' })
    st.spots.slice(0, st.photos.length).forEach((a) => cues.push({ t: t0 + a, kind: 'shutter' }))
    cues.push({ t: t0 + CLEAR, kind: 'clear' }, { t: t0 + STAGE_LEN - 0.35, kind: 'whoosh' })
  })
  cues.push({ t: OUTRO + 2.2, kind: 'chime' })
  return cues
}

// ---------- 主程式 ----------
async function main() {
  let before = 0
  for (const d of stageDirs) {
    const files = readdirSync(join(RECAP, d.name)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()
    const photos = await Promise.all(files.map((f) => loadImage(join(RECAP, d.name, f))))
    const title = d.name.replace(/^\d+\s*/, '').trim()
    stages.push({ title, theme: themeOf(title), photos, spots: spotTimes(photos.length), before })
    before += photos.length
  }
  totalPhotos = before
  mapBg = buildMap()
  await Promise.all([...team, ...parade].map((r) => preloadAvatar(r.cfg)))
  const outDir = join(ROOT, 'trailer/out')
  mkdirSync(outDir, { recursive: true })
  console.log(`${stages.length} 個關卡、${totalPhotos} 張照片，長度 ${DUR.toFixed(1)} 秒`)
  console.log(stages.map((s, i) => `  ${i + 1}. ${s.title}（${s.theme}）`).join('\n'))

  if (stillsMode) {
    const S = (s: number, l: number) => INTRO + s * STAGE_LEN + l
    const times = [2.6, 7.7, S(0, 0.9), S(0, 2.1), S(0, 3.0), S(0, 6.3), S(0, 10.6), S(1, 4.0), S(2, 5.0), S(3, 9.5), S(4, 6.0), S(5, 6.4), S(6, 4.2), OUTRO + 2.6, FINALE + 4.5]
    const want = new Map(times.map((s) => [Math.round(s * FPS), s]))
    const last = Math.max(...want.keys())
    for (let f = 0; f <= last; f++) {
      renderFrame(f)
      if (want.has(f)) writeFileSync(join(outDir, `recap-${want.get(f)!.toFixed(1).padStart(5, '0')}.png`), await out.encode('png'))
    }
    console.log(`✓ 輸出 ${want.size} 張關鍵畫面到 trailer/out/`)
    return
  }

  const wav = join(outDir, 'recap.wav')
  renderRecapMusic(wav, { intro: INTRO, outro: OUTRO, finale: FINALE, dur: DUR, start: START_PRESS, sfx: sfxCues() })
  await encodeVideo({ frames: Math.round(FPS * DUR), render: renderFrame, wav, dest: join(homedir(), 'Downloads', 'GRS-年度回顧.mp4') })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
