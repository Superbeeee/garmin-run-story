/**
 * GRS 年度回顧・第二版「2026 年度路跑」：橫向捲軸跑酷。
 * 小隊從起跑線出發一路往右跑，風景隨季節變化（冬 → 春 → 夏 → 秋 → 聖誕夜）。
 * 每個活動是一個檢查站：穿過拱門 → 路邊看板一張張出現，小隊停下來看、照片放大特寫
 * → 回憶金幣飛進計數器 → 衝刺到下一張。最後一大群跑者一起衝過 12.23 終點線。
 *
 * 照片與第一版共用 trailer/private/recap/（已被 gitignore）。
 *
 * 執行：pnpm recap2            → ~/Downloads/GRS-年度回顧-第二版.mp4
 *      pnpm recap2 --stills   → 關鍵畫面輸出到 trailer/out/run-*.png
 */
import { ROOT, seedRandom } from './env'
import { createCanvas, loadImage, type Image } from '@napi-rs/canvas'
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
  drawRunners,
  easeInOut,
  easeOut,
  easeOutBack,
  encodeVideo,
  fill,
  lerp,
  makeFlakes,
  makeRunner,
  o,
  out,
  p,
  pixelBox,
  scaled,
  seg,
  snow as snowOn,
  text,
  type Runner,
} from './kit'
import { renderMarathonMusic, type MarathonSfx } from './marathon-music'
import { BAR, BEAT } from './recap-music'

const stillsMode = process.argv.includes('--stills')
const rnd = seedRandom(20261224)
const flakes = makeFlakes(rnd, 140)
const fx = new Fx(rnd)
const STEP = DT / 1000
const crossed = (t: number, at: number) => t >= at && t - STEP < at

// ---------- 時間軸 ----------
const RECAP = join(ROOT, 'trailer/private/recap')
const stageDirs = readdirSync(RECAP, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d+/.test(d.name))
  .sort((a, b) => parseInt(a.name) - parseInt(b.name))
const INTRO = 8
const STAGE_LEN = 8 * BAR
const ARCH_AT = 2.0
const PH_START = 6 * BEAT
const PH_END = 28 * BEAT
const OUTRO = INTRO + stageDirs.length * STAGE_LEN
const TAPE = OUTRO + 10 * BEAT
const DUR = TAPE + 4 * BAR

// ---------- 季節 ----------
type Season = 'winter' | 'spring' | 'summer' | 'autumn' | 'night'
interface Palette {
  sky: [string, string, string]
  mountain: string
  cap?: string
  hill: string
  tree: 'pine' | 'blossom' | 'round' | 'maple'
  leaf: [string, string]
  grass: string
  particle?: 'snow' | 'petal' | 'leaf'
}
const SEASON: Record<Season, Palette> = {
  winter: { sky: ['#94b0c2', '#b8cfdd', '#dfe6ec'], mountain: '#566c86', cap: '#f4f4f4', hill: '#94b0c2', tree: 'pine', leaf: ['#257179', '#38b764'], grass: '#f4f4f4', particle: 'snow' },
  spring: { sky: ['#41a6f6', '#73c4f8', '#b8e2fb'], mountain: '#3b5dc9', cap: '#f4f4f4', hill: '#38b764', tree: 'blossom', leaf: ['#e07aa5', '#f4b6cf'], grass: '#a7f070', particle: 'petal' },
  summer: { sky: ['#3b5dc9', '#41a6f6', '#73eff7'], mountain: '#257179', hill: '#38b764', tree: 'round', leaf: ['#257179', '#38b764'], grass: '#38b764' },
  autumn: { sky: ['#ef7d57', '#ffa76a', '#ffcd75'], mountain: '#5d275d', hill: '#b13e53', tree: 'maple', leaf: ['#b13e53', '#ef7d57'], grass: '#c98a4b', particle: 'leaf' },
  night: { sky: ['#1a1c2c', '#222a4d', '#29366f'], mountain: '#333c57', cap: '#94b0c2', hill: '#1f2540', tree: 'pine', leaf: ['#1f4a4a', '#257179'], grass: '#dfe6ec', particle: 'snow' },
}
const ORDER: Season[] = ['winter', 'spring', 'summer', 'autumn']
const seasonOfStage = (i: number): Season => ORDER[Math.min(3, Math.floor((i * 4) / stageDirs.length))]

/** 某時間點的季節（換季時回傳兩個季節與混合比例） */
function seasonAt(t: number): [Season, Season, number] {
  if (t < INTRO) return ['winter', 'winter', 0]
  if (t >= OUTRO) return ['night', 'night', 0]
  const s = Math.floor((t - INTRO) / STAGE_LEN)
  const local = t - INTRO - s * STAGE_LEN
  const cur = seasonOfStage(s)
  const next = s + 1 < stageDirs.length ? seasonOfStage(s + 1) : 'night'
  return [cur, next, next === cur ? 0 : seg(local, STAGE_LEN - 1.4, STAGE_LEN)]
}

// 背景地形：山與丘陵的高度（固定種子）
const mountainPhase = [rnd() * 6, rnd() * 6, rnd() * 6]
const mountainY = (x: number) => 118 + Math.sin(x * 0.011 + mountainPhase[0]) * 18 + Math.sin(x * 0.027 + mountainPhase[1]) * 9 + Math.sin(x * 0.06 + mountainPhase[2]) * 3
const hillY = (x: number) => 172 + Math.sin(x * 0.018 + 1.3) * 8 + Math.sin(x * 0.045 + 0.4) * 4
const ROAD_TOP = 214

/** 背景：天空、太陽月亮、山、丘陵、行道樹、跑道（S 為捲動距離） */
function backdrop(ctx: typeof p, season: Season, S: number, t: number) {
  const P = SEASON[season]
  ctx.fillStyle = P.sky[0]
  ctx.fillRect(0, 0, LW, 50)
  ctx.fillStyle = P.sky[1]
  ctx.fillRect(0, 50, LW, 50)
  ctx.fillStyle = P.sky[2]
  ctx.fillRect(0, 100, LW, 120)
  // 太陽、月亮、星星
  const disc = (cx: number, cy: number, r: number, col: string) => {
    ctx.fillStyle = col
    for (let y = -r; y <= r; y++) {
      const w = Math.round(Math.sqrt(r * r - y * y))
      ctx.fillRect(cx - w, cy + y, w * 2, 1)
    }
  }
  if (season === 'summer') disc(400, 36, 16, '#ffcd75')
  if (season === 'autumn') disc(330, 104, 26, '#fff4cf')
  if (season === 'spring') disc(70, 34, 12, '#fff4cf')
  if (season === 'night') {
    disc(392, 40, 12, '#f4f4f4')
    disc(398, 36, 10, P.sky[0])
    ctx.fillStyle = '#f4f4f4'
    for (let i = 0; i < 40; i++) if ((i * 7 + Math.floor(t * 3)) % 9) ctx.fillRect((i * 97) % LW, (i * 37) % 100, 1, 1)
  }
  // 山（視差 0.15）
  for (let x = 0; x < LW; x++) {
    const wx = x + S * 0.15
    const y = Math.round(mountainY(wx))
    ctx.fillStyle = P.mountain
    ctx.fillRect(x, y, 1, ROAD_TOP - y)
    if (P.cap) {
      const capH = Math.max(0, Math.round((112 - y) * 0.6))
      if (capH > 0) {
        ctx.fillStyle = P.cap
        ctx.fillRect(x, y, 1, capH)
      }
    }
  }
  // 丘陵（視差 0.35）
  ctx.fillStyle = P.hill
  for (let x = 0; x < LW; x++) {
    const y = Math.round(hillY(x + S * 0.35))
    ctx.fillRect(x, y, 1, ROAD_TOP - y)
  }
  // 行道樹（視差 0.6）
  const spacing = 38
  const off = (S * 0.6) % spacing
  for (let i = -1; i < LW / spacing + 2; i++) {
    const x = Math.round(i * spacing - off)
    const idx = Math.floor((S * 0.6) / spacing) + i
    tree(ctx, x + ((idx * 13) % 11), ROAD_TOP, P, idx, t)
  }
  // 草地邊與跑道
  ctx.fillStyle = P.grass
  ctx.fillRect(0, ROAD_TOP, LW, 6)
  ctx.fillStyle = '#3b5dc9'
  ctx.fillRect(0, ROAD_TOP + 6, LW, LH - ROAD_TOP - 6)
  ctx.fillStyle = '#f4f4f4'
  for (const y of [ROAD_TOP + 6, 232, 248, 264]) ctx.fillRect(0, y, LW, 1)
  const tick = 48
  for (let x = -((S % tick) + tick); x < LW; x += tick) ctx.fillRect(Math.round(x), 238, 6, 1)
}

function tree(ctx: typeof p, x: number, base: number, P: Palette, idx: number, t: number) {
  const [dark, light] = P.leaf
  ctx.fillStyle = '#6b4a3a'
  ctx.fillRect(x - 1, base - 6, 3, 6)
  if (P.tree === 'pine') {
    for (const [w, dy, col] of [[15, -8, dark], [13, -11, light], [11, -14, dark], [9, -17, light], [7, -20, dark], [5, -23, light], [3, -26, dark]] as const) {
      ctx.fillStyle = col
      ctx.fillRect(x - Math.floor(w / 2), base + dy, w, 3)
    }
    if (P === SEASON.night) {
      // 聖誕燈
      const cols = ['#b13e53', '#ffcd75', '#41a6f6', '#a7f070']
      for (let k = 0; k < 6; k++) {
        if ((k + idx + Math.floor(t * 4)) % 3 === 0) continue
        ctx.fillStyle = cols[(k + idx) % 4]
        ctx.fillRect(x - 6 + ((k * 5) % 12), base - 10 - k * 3, 1, 1)
      }
      ctx.fillStyle = '#ffcd75'
      ctx.fillRect(x, base - 29, 1, 2)
    } else {
      ctx.fillStyle = '#f4f4f4'
      ctx.fillRect(x - 1, base - 27, 3, 2)
    }
    return
  }
  // 圓頂樹（櫻花、綠樹、楓樹）
  const r = 9 + (idx % 3)
  const cy = base - 8 - r
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y))
    ctx.fillStyle = y < -r / 3 ? light : dark
    ctx.fillRect(x - w, cy + y, w * 2, 1)
  }
  if (P.tree === 'blossom') {
    ctx.fillStyle = '#fff4cf'
    for (let k = 0; k < 5; k++) ctx.fillRect(x - r + 2 + ((k * 7 + idx) % (r * 2 - 3)), cy - r + 3 + ((k * 5) % (r + 3)), 1, 1)
  }
}

// 季節粒子：櫻花瓣、落葉
const drift = Array.from({ length: 70 }, () => ({ x: rnd() * LW, y: rnd() * LH, v: 14 + rnd() * 16, ph: rnd() * 6 }))
function weather(season: Season, t: number, alpha = 1) {
  const kind = SEASON[season].particle
  if (!kind) return
  if (kind === 'snow') return snowOn(flakes, t, 0.8 * alpha)
  p.globalAlpha = alpha
  for (const d of drift) {
    const y = (d.y + t * d.v) % (LH + 6)
    const x = (((d.x - t * (18 + d.v)) % LW) + LW) % LW
    const flip = Math.floor(t * 4 + d.ph) % 2
    p.fillStyle = kind === 'petal' ? (flip ? '#f4b6cf' : '#e07aa5') : flip ? '#ef7d57' : '#b13e53'
    p.fillRect(Math.round(x), Math.round(y), flip ? 2 : 1, flip ? 1 : 2)
  }
  p.globalAlpha = 1
}

// ---------- 關卡與捲動 ----------
interface Stage {
  title: string
  theme: Theme
  photos: Image[]
  /** 每張照片抵達（停下）的時間（關卡內秒數） */
  arrive: number[]
  /** 每張照片離開的時間 */
  leave: number[]
  before: number
}
let stages: Stage[] = []
let totalPhotos = 0

/** 照片抵達、離開時間：平均分配到拍子上 */
function photoTimes(n: number): { arrive: number[]; leave: number[] } {
  const beats = Math.round((PH_END - PH_START) / BEAT)
  const arrive: number[] = []
  const leave: number[] = []
  for (let i = 0; i < n; i++) {
    const a = PH_START + Math.round((beats * i) / n) * BEAT + 0.6
    const b = PH_START + Math.round((beats * (i + 1)) / n) * BEAT
    arrive.push(a)
    leave.push(b - 0.3)
  }
  return { arrive, leave }
}

const BASE = 150
const DASH = 240
const SPRINT = 160
/** 某時間點的捲動速度（像素層 px/秒） */
function speedAt(t: number): number {
  if (t < INTRO) return 0
  if (t < INTRO + 0.5) return BASE * easeOut(seg(t, INTRO, INTRO + 0.5))
  if (t >= OUTRO) return t < TAPE ? SPRINT : SPRINT * (1 - easeOut(seg(t, TAPE, TAPE + 1.4)))
  const s = Math.floor((t - INTRO) / STAGE_LEN)
  const local = t - INTRO - s * STAGE_LEN
  const st = stages[s]
  let k = 1
  let fast = false
  st.arrive.forEach((a, i) => {
    const l = st.leave[i]
    let g = 1
    if (local >= a - 0.6 && local < a) g = 1 - easeInOut(seg(local, a - 0.6, a))
    else if (local >= a && local < l) g = 0
    else if (local >= l && local < l + 0.4) g = easeInOut(seg(local, l, l + 0.4))
    k = Math.min(k, g)
    if (i + 1 < st.arrive.length && local >= l && local < st.arrive[i + 1] - 0.6) fast = true
  })
  return k * (fast ? DASH : BASE)
}
/** 每一格的累計捲動距離 */
let scroll: number[] = []
const S = (t: number) => scroll[Math.min(scroll.length - 1, Math.max(0, Math.round(t * FPS)))]

// 小隊：螢幕上的固定位置（像素層）
const RX = [112, 136, 160]
const RY = [252, 244, 258]
const team: Runner[] = [0, 1, 2].map((i) => makeRunner(rnd, { ...randomConfig(), hat: 'christmas', hatColor: ['red', 'green', 'red'][i] }, RX[i], RY[i], 1, 'idle'))
// 終點前加入的大批跑者
const crowd: Runner[] = Array.from({ length: 14 }, (_, i) =>
  makeRunner(rnd, { ...randomConfig(), hat: rnd() < 0.6 ? 'christmas' : 'none', hatColor: 'red' }, -40 - i * 14, 228 + ((i * 3) % 5) * 8, 1, 'run', OUTRO + i * 0.12),
)
// 終點時平均分散在跑道上
const crowdHome = crowd.map((_, i) => 12 + ((i * 5) % 14) * 23)

// ---------- 道具：拱門、看板、跨欄 ----------
function arch(x: number, label: 'start' | 'checkpoint' | 'finish', tapeBroken = false) {
  const X = Math.round(x)
  if (X < -80 || X > LW + 80) return
  const post = (px: number) => {
    p.fillStyle = C.outline
    p.fillRect(px - 1, 150, 6, 116)
    for (let y = 151; y < 265; y += 8) {
      p.fillStyle = ((y - 151) / 8) % 2 ? '#f4f4f4' : C.red
      p.fillRect(px, y, 4, 8)
    }
  }
  post(X - 54)
  post(X + 50)
  p.fillStyle = C.outline
  p.fillRect(X - 60, 146, 120, 30)
  p.fillStyle = label === 'finish' ? '#f4f4f4' : C.red
  p.fillRect(X - 58, 148, 116, 26)
  if (label === 'finish') {
    for (let i = 0; i < 29; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) {
      p.fillStyle = C.outline
      p.fillRect(X - 58 + i * 4, 148 + j * 4, 4, 4)
    }
    p.fillStyle = C.red
    p.fillRect(X - 58, 156, 116, 18)
    if (!tapeBroken) {
      p.fillStyle = '#ffcd75'
      p.fillRect(X - 52, 236, 104, 2)
    }
  }
  p.fillStyle = C.gold
  p.fillRect(X - 58, 148, 116, 1)
}
/** 拱門布條上的高解析度文字 */
function archLabel(x: number, label: string, size = 30) {
  if (x < -80 || x > LW + 80) return
  text(label, x * 4, (label.startsWith('FINISH') ? 166 : 161) * 4, { size, color: C.snow })
}

const BOARD_W = 124
const BOARD_H = 86
const BOARD_BOTTOM = 146
function billboard(x: number) {
  const X = Math.round(x)
  if (X < -BOARD_W || X > LW + BOARD_W) return
  p.fillStyle = C.outline
  p.fillRect(X - 3, BOARD_BOTTOM, 6, ROAD_TOP - BOARD_BOTTOM)
  p.fillStyle = '#6b4a3a'
  p.fillRect(X - 2, BOARD_BOTTOM, 4, ROAD_TOP - BOARD_BOTTOM)
  p.fillStyle = C.outline
  p.fillRect(X - BOARD_W / 2 - 4, BOARD_BOTTOM - BOARD_H - 4, BOARD_W + 8, BOARD_H + 8)
  p.fillStyle = C.gold
  p.fillRect(X - BOARD_W / 2 - 3, BOARD_BOTTOM - BOARD_H - 3, BOARD_W + 6, BOARD_H + 6)
  p.fillStyle = C.outline
  p.fillRect(X - BOARD_W / 2, BOARD_BOTTOM - BOARD_H, BOARD_W, BOARD_H)
}
/** 看板照片的畫面座標（高解析度） */
function boardRect(x: number) {
  return { x: (x - BOARD_W / 2) * 4, y: (BOARD_BOTTOM - BOARD_H) * 4, w: BOARD_W * 4, h: BOARD_H * 4 }
}
/** 以 cover 方式把照片填進矩形 */
function drawCover(img: Image, r: { x: number; y: number; w: number; h: number }) {
  const k = Math.max(r.w / img.width, r.h / img.height)
  const sw = r.w / k
  const sh = r.h / k
  o.imageSmoothingEnabled = true
  o.imageSmoothingQuality = 'high'
  o.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, r.x, r.y, r.w, r.h)
}

function hurdle(x: number) {
  const X = Math.round(x)
  if (X < -20 || X > LW + 20) return
  p.fillStyle = C.outline
  p.fillRect(X - 7, 246, 2, 12)
  p.fillRect(X + 6, 246, 2, 12)
  p.fillRect(X - 8, 244, 17, 4)
  p.fillStyle = '#f4f4f4'
  p.fillRect(X - 7, 245, 4, 2)
  p.fillRect(X + 1, 245, 4, 2)
  p.fillStyle = C.red
  p.fillRect(X - 3, 245, 4, 2)
  p.fillRect(X + 5, 245, 3, 2)
}

// ---------- 高解析度 UI ----------
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']
function heart(x: number, y: number, s: number, color = C.red) {
  o.fillStyle = C.outline
  HEART.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && o.fillRect(x + i * s - 2, y + j * s - 2, s + 4, s + 4)))
  o.fillStyle = color
  HEART.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && o.fillRect(x + i * s, y + j * s, s, s)))
}
const COUNTER = { x: W - 400, y: 40 }
function memoryCounter(n: number, bump: number) {
  heart(COUNTER.x, COUNTER.y - Math.round(bump * 10), 6)
  text(`回憶 ${n}/${totalPhotos}`, COUNTER.x + 60, COUNTER.y + 18, { size: 40, align: 'left', color: bump > 0 ? C.gold : C.snow })
}

/** 速度線（衝刺時） */
function speedLines(t: number, k: number) {
  if (k <= 0) return
  o.globalAlpha = 0.5 * k
  o.fillStyle = '#f4f4f4'
  for (let i = 0; i < 14; i++) {
    const y = 260 + ((i * 131) % 700)
    const len = 160 + ((i * 53) % 220)
    const x = W - (((t * 2600 + i * 337) % (W + len)))
    o.fillRect(Math.round(x), y, len, 6)
  }
  o.globalAlpha = 1
}

// ---------- 每一格 ----------
const bp = createCanvas(LW, LH)
const bpc = bp.getContext('2d')
bpc.imageSmoothingEnabled = false
let scene = ''
const enter = (name: string) => {
  if (scene !== name) {
    scene = name
    fx.clear()
  }
}

function renderFrame(f: number) {
  const t = f / FPS
  const tms = t * 1000
  const sc = S(t)
  const [sa, sb, mix] = seasonAt(t)

  // 背景（換季時混合）
  backdrop(p, sa, sc, t)
  if (mix > 0) {
    backdrop(bpc, sb, sc, t)
    p.globalAlpha = mix
    p.drawImage(bp, 0, 0)
    p.globalAlpha = 1
  }

  // 目前關卡
  const s = t >= INTRO && t < OUTRO ? Math.floor((t - INTRO) / STAGE_LEN) : -1
  const local = s >= 0 ? t - INTRO - s * STAGE_LEN : 0
  const st = s >= 0 ? stages[s] : null
  enter(s >= 0 ? `stage${s}` : t < INTRO ? 'intro' : 'finale')

  // 道具
  arch(200 - sc, 'start')
  stages.forEach((g, i) => {
    const t0 = INTRO + i * STAGE_LEN
    // 第一關直接從起跑拱門開始
    if (i > 0) arch(S(t0 + ARCH_AT) + 136 - sc, 'checkpoint')
    hurdle(S(t0 + 1.0) + 168 - sc)
    hurdle(S(t0 + PH_END + 0.3) + 168 - sc)
    g.arrive.forEach((a) => billboard(S(t0 + a) + LW / 2 - sc))
  })
  const finishX = S(TAPE) + 168 - sc
  arch(finishX, 'finish', t >= TAPE)

  // 小隊
  const v = speedAt(t)
  team.forEach((r, i) => {
    const want = v > 4 ? 'run' : 'idle'
    if (r.actor.mode !== want) r.actor.setMode(want)
    // 跨欄
    stages.forEach((_, k) => {
      const t0 = INTRO + k * STAGE_LEN
      for (const at of [t0 + 1.0, t0 + PH_END + 0.3]) {
        const hx = S(at) + 168 - sc
        if (hx - RX[i] > 4 && hx - RX[i] <= 4 + v * STEP + 0.5) r.actor.jump()
      }
    })
    if (crossed(t, INTRO + 0.1) && i === 1) r.actor.emote(0, tms)
    r.actor.update(DT)
  })
  // 看照片時的表情、過拱門時跳起來
  if (st) {
    st.arrive.forEach((a, k) => {
      if (crossed(local, a)) team[k % 3].actor.emote([1, 0, 3][k % 3], tms)
      if (crossed(local, a + 0.4)) team[(k + 1) % 3].actor.emote(1, tms)
    })
    if (s > 0 && crossed(local, ARCH_AT)) team.forEach((r) => r.actor.jump())
  }
  // 終點：大家加入、撞線後歡呼
  const runners = [...team]
  if (t >= OUTRO) {
    crowd.forEach((r, i) => {
      if (t < r.spawn) return
      const target = crowdHome[i]
      r.x = Math.min(target, r.x + (DT / 1000) * 160)
      const want = t < TAPE + 1.2 ? 'run' : 'idle'
      if (r.actor.mode !== want) r.actor.setMode(want)
      if (t > TAPE + 1.2 && rnd() < 0.012) r.actor.jump()
      if (crossed(t, TAPE + 0.3 + (i % 5) * 0.15)) r.actor.emote(rnd() < 0.5 ? 1 : 0, tms)
      r.actor.update(DT)
      runners.push(r)
    })
    if (crossed(t, TAPE)) {
      team.forEach((r) => r.actor.jump())
      fx.burst(170, 200, 90)
      fx.burst(90, 190, 60)
    }
    if (t > TAPE + 1.2) team.forEach((r) => rnd() < 0.015 && r.actor.jump())
  }
  drawRunners(runners, tms)

  // 特效
  if (st && local >= PH_START - 0.3 && local < PH_END + 0.4) fx.emit(st.theme, STEP, 0.7)
  if (t >= TAPE) fx.emit('party', STEP, 1.2)
  fx.update(STEP)
  fx.draw(st && st.theme === 'train' && local > PH_START ? 'train' : undefined)
  weather(sa, t, 1 - mix)
  if (mix > 0) weather(sb, t, mix)
  blitPixel()

  // 高解析度：拱門文字、看板照片
  archLabel(200 - sc, 'START', 40)
  stages.forEach((_, i) => i > 0 && archLabel(S(INTRO + i * STAGE_LEN + ARCH_AT) + 136 - sc, `CHECKPOINT ${i + 1}`, 28))
  archLabel(finishX, 'FINISH 12.23', 34)
  stages.forEach((g, i) => {
    const t0 = INTRO + i * STAGE_LEN
    g.arrive.forEach((a, k) => {
      const x = S(t0 + a) + LW / 2 - sc
      if (x < -BOARD_W || x > LW + BOARD_W) return
      drawCover(g.photos[k], boardRect(x))
    })
  })

  speedLines(t, v > BASE + 10 ? seg(v, BASE, DASH) : 0)

  // 特寫
  if (st) {
    st.arrive.forEach((a, k) => {
      const l = st.leave[k]
      if (local < a || local >= l) return
      const zin = easeOutBack(seg(local, a, a + 0.35))
      const zout = easeInOut(seg(local, l - 0.3, l))
      const k2 = zin * (1 - zout)
      const img = st.photos[k]
      const from = boardRect(LW / 2)
      const fit = Math.min(1240 / img.width, 640 / img.height)
      const to = { x: (W - img.width * fit) / 2, y: 610 - (img.height * fit) / 2, w: img.width * fit, h: img.height * fit }
      const r = { x: lerp(from.x, to.x, k2), y: lerp(from.y, to.y, k2), w: lerp(from.w, to.w, k2), h: lerp(from.h, to.h, k2) }
      o.globalAlpha = 0.55 * Math.min(1, k2)
      o.fillStyle = C.night
      o.fillRect(0, 0, W, H)
      o.globalAlpha = 1
      pixelBox(r.x - 26, r.y - 26, r.w + 52, r.h + 52, C.outline, C.outline, 8)
      pixelBox(r.x - 20, r.y - 20, r.w + 40, r.h + 40, C.gold, C.gold, 6)
      o.imageSmoothingEnabled = true
      o.imageSmoothingQuality = 'high'
      o.drawImage(img, r.x, r.y, r.w, r.h)
      const flash = 0.85 * (1 - seg(local, a, a + 0.3))
      if (flash > 0) fill('#fff', flash * 0.6)
    })
  }

  // 標題列、回憶計數、飛行中的金幣
  if (st && local >= ARCH_AT - 0.2) {
    const a = seg(local, ARCH_AT - 0.2, ARCH_AT + 0.2) * (1 - seg(local, STAGE_LEN - 0.3, STAGE_LEN))
    o.globalAlpha = a
    pixelBox(60, 30, 300, 56, C.red, C.red, 6)
    o.globalAlpha = 1
    text(`CHECKPOINT ${s + 1}`, 210, 58, { size: 30, outline: 0, alpha: a })
    text(st.title, 60, 130, { size: 58, align: 'left', shadow: C.red, alpha: a })
  }
  if (t >= INTRO) {
    let n = 0
    let bump = 0
    stages.forEach((g, i) => {
      const t0 = INTRO + i * STAGE_LEN
      g.arrive.forEach((a) => {
        const land = t0 + a + 0.6 + 0.7
        if (t >= land) n++
        bump = Math.max(bump, 1 - seg(t, land, land + 0.3) - (t < land ? 1 : 0))
        // 金幣飛向計數器
        const k = seg(t, t0 + a + 0.6, land)
        if (k > 0 && k < 1) {
          const sx = W / 2
          const sy = 380
          const x = lerp(sx, COUNTER.x + 20, easeInOut(k))
          const y = lerp(sy, COUNTER.y + 20, easeInOut(k)) - Math.sin(k * Math.PI) * 220
          scaled(x, y, 1 + Math.sin(k * Math.PI) * 0.6, () => heart(-21, -18, 6, C.gold))
        }
      })
    })
    memoryCounter(n, bump)
  }

  // 開場
  if (t < INTRO + 1) {
    const a = 1 - seg(t, 4.6, 5.2)
    scaled(W / 2, 300, easeOutBack(seg(t, 1.0, 1.5)), () => text('2026 GRS 年度路跑', 0, 0, { size: 121, shadow: C.red, alpha: a }))
    const sub = '我們一起跑過的這一年'
    const n = Math.max(0, Math.min([...sub].length, Math.floor((t - 2.0) * 10) + 1))
    if (t >= 2.0) text([...sub].slice(0, n).join(''), W / 2, 450, { size: 66, color: C.gold, alpha: a })
    ;(['3', '2', '1', 'GO!'] as const).forEach((label, i) => {
      const at = 5.6 + i * 0.8
      const k = seg(t, at, at + 0.8)
      if (k <= 0 || k >= 1) return
      scaled(W / 2, 420, lerp(1.8, 1, easeOut(seg(t, at, at + 0.2))), () =>
        text(label, 0, 0, { size: label === 'GO!' ? 220 : 200, color: label === 'GO!' ? C.gold : C.snow, shadow: C.red, alpha: 1 - seg(k, 0.7, 1) }),
      )
    })
    fill('#000', 1 - seg(t, 0, 0.8))
  }

  // 片尾
  if (t >= TAPE) {
    const l = t - TAPE
    const drop = (t0: number, y: number) => y - (1 - easeOutBack(seg(l, t0, t0 + 0.6))) * 260
    o.globalAlpha = 0.45 * seg(l, 0.6, 1.2)
    o.fillStyle = C.night
    o.fillRect(0, 0, W, H)
    o.globalAlpha = 1
    text('★ GRC 聖誕交換禮物 ★', W / 2, drop(0.8, 110), { size: 44, color: C.gold, alpha: seg(l, 0.8, 1.1) })
    text('GARMIN RUN STORY', W / 2, drop(1.0, 240), { size: 121, shadow: C.red, alpha: seg(l, 1.0, 1.3) })
    scaled(W / 2, 410, easeOutBack(seg(l, 1.6, 2.1)), () => text('GRS', 0, 0, { size: 176, color: C.gold, shadow: C.red }))
    scaled(W / 2, 600, easeOutBack(seg(l, 2.2, 2.7)), () => text('12.23', 0, 0, { size: 110, shadow: C.red }))
    const slogan = '交換禮物，開始！'
    const n = Math.max(0, Math.min([...slogan].length, Math.floor((l - 3.0) * 10) + 1))
    if (l >= 3.0) text([...slogan].slice(0, n).join(''), W / 2, 745, { size: 66, color: C.gold })
    fill('#fff', 0.8 * (1 - seg(l, 0, 0.25)))
  }
  fill('#000', seg(t, DUR - 1, DUR - 0.05))
}

/** 音效時間點 */
function sfxCues(): MarathonSfx[] {
  const cues: MarathonSfx[] = [5.6, 6.4, 7.2].map((t) => ({ t, kind: 'beep' as const }))
  cues.push({ t: INTRO, kind: 'go' })
  stages.forEach((g, i) => {
    const t0 = INTRO + i * STAGE_LEN
    if (i > 0) cues.push({ t: t0 + ARCH_AT, kind: 'chime' })
    cues.push({ t: t0 + 1.0, kind: 'hop' }, { t: t0 + PH_END + 0.3, kind: 'hop' })
    g.arrive.forEach((a) => cues.push({ t: t0 + a, kind: 'shutter' }, { t: t0 + a + 1.3, kind: 'coin' }))
  })
  cues.push({ t: TAPE, kind: 'clear' })
  return cues
}

// ---------- 主程式 ----------
async function main() {
  let before = 0
  for (const d of stageDirs) {
    const files = readdirSync(join(RECAP, d.name)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()
    const photos = await Promise.all(files.map((f) => loadImage(join(RECAP, d.name, f))))
    const title = d.name.replace(/^\d+\s*/, '').trim()
    stages.push({ title, theme: themeOf(title), photos, ...photoTimes(photos.length), before })
    before += photos.length
  }
  totalPhotos = before
  // 預先算好每一格的捲動距離
  const frames = Math.round(FPS * DUR)
  scroll = [0]
  for (let f = 1; f <= frames; f++) scroll.push(scroll[f - 1] + speedAt((f - 1) / FPS) * STEP)
  await Promise.all([...team, ...crowd].map((r) => preloadAvatar(r.cfg)))
  const outDir = join(ROOT, 'trailer/out')
  mkdirSync(outDir, { recursive: true })
  console.log(`${stages.length} 個檢查站、${totalPhotos} 張照片，長度 ${DUR.toFixed(1)} 秒`)
  console.log(stages.map((g, i) => `  ${i + 1}. ${g.title}（${seasonOfStage(i)}・${g.theme}）`).join('\n'))

  if (stillsMode) {
    const SA = (s: number, l: number) => INTRO + s * STAGE_LEN + l
    const times = [3.0, 6.5, SA(0, 0.6), SA(0, 2.0), SA(0, stages[0].arrive[0] + 1.0), SA(0, stages[0].arrive[0] + 1.6), SA(1, 4.4), SA(2, 9.0), SA(3, 12.4), SA(4, 7.5), SA(5, 3.6), SA(6, 5.4), OUTRO + 2.4, TAPE + 0.2, TAPE + 4.5]
    const want = new Map(times.map((x) => [Math.round(x * FPS), x]))
    const last = Math.max(...want.keys())
    for (let f = 0; f <= last; f++) {
      renderFrame(f)
      if (want.has(f)) writeFileSync(join(outDir, `run-${want.get(f)!.toFixed(1).padStart(5, '0')}.png`), await out.encode('png'))
    }
    console.log(`✓ 輸出 ${want.size} 張關鍵畫面到 trailer/out/`)
    return
  }

  const wav = join(outDir, 'marathon.wav')
  renderMarathonMusic(wav, { intro: INTRO, outro: OUTRO, tape: TAPE, dur: DUR, sfx: sfxCues() })
  await encodeVideo({ frames, render: renderFrame, wav, dest: join(homedir(), 'Downloads', 'GRS-年度回顧-第二版.mp4') })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
