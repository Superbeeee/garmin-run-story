/**
 * GARMIN RUN STORY 前導影片（60 秒，1920×1080，30fps）
 *
 * 執行：pnpm trailer            → 輸出到 ~/Downloads/GRS-前導影片.mp4
 *      pnpm trailer --stills   → 只輸出幾張關鍵畫面到 trailer/out/ 預覽
 *
 * 去年的海報與人物圖放在 trailer/private/（已被 gitignore，不會進版控）。
 * 像素場景先畫在 480×270，再放大 4 倍，字幕則直接畫在 1920×1080。
 */
import { ROOT, seedRandom } from './env'
import { createCanvas, loadImage, type Canvas, type Image } from '@napi-rs/canvas'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  AvatarActor,
  CLOTH_COLORS,
  DEFAULT_CONFIG,
  GLASSES,
  HAIR_BY,
  HAIR_COLORS,
  HAIR_LABELS,
  HATS,
  HATS_FIXED_COLOR,
  PORTRAIT_H,
  PORTRAIT_W,
  SKINS,
  TOP_BY,
  drawPortrait,
  preloadAvatar,
  randomConfig,
  withGender,
  type AvatarConfig,
  type Option,
} from '../src/avatar'
import { drawCrowdTrack } from '../src/scene/track'
import {
  C,
  CPS,
  DT,
  FPS,
  H,
  LH,
  LW,
  TRACK_TOP,
  W,
  blitPixel,
  caption,
  dom,
  drawRunners,
  easeInOut,
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
  pixelBox,
  seg,
  snow as snowOn,
  text,
  typeTimes,
  type Ctx,
  type Runner,
} from './kit'
import { renderMusic } from './music'

const DUR = 60
const stillsMode = process.argv.includes('--stills')
const rnd = seedRandom(20251223)
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]
const labelOf = (opts: readonly Option[], v: string) => opts.find(([k]) => k === v)?.[1] ?? v

// 雪（在建立角色之前取亂數，維持輸出不變）
const flakes = makeFlakes(rnd)
const snow = (t: number, alpha?: number) => snowOn(flakes, t, alpha)

// 場景 4：一個個跑進像素世界
const parade: Runner[] = Array.from({ length: 18 }, (_, i) =>
  makeRunner(rnd, randomConfig(), -26, 112 + ((i * 7) % 18) * 8.3, 1, rnd() < 0.72 ? 'run' : 'walk', 20.2 + i * 0.5),
)

// 場景 6：戴聖誕帽的大合照
const HAT_COLORS = ['red', 'red', 'red', 'green', 'forest', 'blue', 'pink']
const crowd: Runner[] = Array.from({ length: 30 }, (_, i) => {
  const row = i % 3
  const col = Math.floor(i / 3)
  const cfg = { ...randomConfig(), hat: rnd() < 0.8 ? 'christmas' : 'elf', hatColor: pick(HAT_COLORS) }
  return makeRunner(rnd, cfg, 30 + col * 46 + row * 15 + rnd() * 8, 150 + row * 44 + rnd() * 6, rnd() < 0.5 ? 1 : -1, rnd() < 0.5 ? 'walk' : 'idle')
})
const JUMPS = [45.0, 47.6, 50.1]

// 場景 7：片尾橫越畫面
const finale: Runner[] = Array.from({ length: 8 }, (_, i) => {
  const cfg = { ...randomConfig(), hat: i % 3 === 0 ? 'christmas' : randomConfig().hat, hatColor: 'red' }
  return makeRunner(rnd, cfg, -30 - i * 58, 262, 1, 'run', 52)
})

// 場景 5：捏角色快轉
type Op = 'hair' | 'hairColor' | 'top' | 'topColor' | 'skin' | 'gender' | `hat:${string}` | `glasses:${string}`
const OPS: Op[] = [
  'hair', 'hairColor', 'top', 'topColor', 'hat:christmas', 'glasses:sunglasses', 'skin', 'gender', 'hair', 'hairColor',
  'hat:crown', 'glasses:round', 'topColor', 'hat:wizard', 'hair', 'glasses:shades', 'skin', 'hat:elf', 'hairColor', 'topColor', 'hat:christmas',
]
const OP_START = 32.6
const OP_STEP = 0.42
const ROWS = ['性別', '髮型', '上衣', '帽子', '眼鏡', '膚色'] as const
const rowOf = (op: Op): (typeof ROWS)[number] =>
  op === 'gender' ? '性別' : op.startsWith('hair') ? '髮型' : op.startsWith('top') ? '上衣' : op.startsWith('hat') ? '帽子' : op.startsWith('glasses') ? '眼鏡' : '膚色'
const nextOf = (opts: readonly Option[], cur: string) => {
  const others = opts.filter(([k]) => k !== cur && k !== 'none')
  return pick(others)[0]
}
const creatorConfigs: AvatarConfig[] = [{ ...DEFAULT_CONFIG, hairColor: 'dark_brown' }]
for (const op of OPS) {
  const c = { ...creatorConfigs[creatorConfigs.length - 1] }
  const g = c.gender
  if (op === 'hair') c.hair = nextOf(HAIR_BY[g], c.hair)
  else if (op === 'hairColor') c.hairColor = nextOf(HAIR_COLORS, c.hairColor)
  else if (op === 'top') c.top = nextOf(TOP_BY[g], c.top)
  else if (op === 'topColor') c.topColor = nextOf(CLOTH_COLORS, c.topColor)
  else if (op === 'skin') c.skin = nextOf(SKINS, c.skin)
  else if (op === 'gender') Object.assign(c, withGender(c, g === 'male' ? 'female' : 'male'))
  else if (op.startsWith('hat:')) {
    c.hat = op.slice(4)
    c.hatColor = pick(['red', 'green', 'navy', 'purple'])
  } else if (op.startsWith('glasses:')) {
    c.glasses = op.slice(8)
    c.glassesColor = pick(['black', 'red', 'navy'])
  }
  creatorConfigs.push(c)
}
const creatorActor = new AvatarActor()

function rowValue(row: (typeof ROWS)[number], c: AvatarConfig): string {
  switch (row) {
    case '性別':
      return c.gender === 'male' ? '男' : '女'
    case '髮型':
      return `${HAIR_LABELS[c.hair]}・${labelOf(HAIR_COLORS, c.hairColor)}`
    case '上衣':
      return `${labelOf(TOP_BY[c.gender], c.top)}・${labelOf(CLOTH_COLORS, c.topColor)}`
    case '帽子':
      return c.hat === 'none' ? '不戴' : labelOf(HATS, c.hat) + (HATS_FIXED_COLOR.has(c.hat) ? '' : `・${labelOf(CLOTH_COLORS, c.hatColor)}`)
    case '眼鏡':
      return c.glasses === 'none' ? '不戴' : `${labelOf(GLASSES, c.glasses)}・${labelOf(CLOTH_COLORS, c.glassesColor)}`
    case '膚色':
      return labelOf(SKINS, c.skin)
  }
}

// ---------- 去年的素材 ----------
let poster: Image
let posterBg = '#5b0f14'
let chars: Image[] = []
const scene2Cache: { canvas: Canvas | null } = { canvas: null }

async function loadPrivate() {
  poster = await loadImage(join(ROOT, 'trailer/private/poster.png'))
  const probe = createCanvas(4, 4)
  const pc = probe.getContext('2d')
  pc.drawImage(poster, 10, 10, 4, 4, 0, 0, 4, 4)
  const d = pc.getImageData(0, 0, 1, 1).data
  posterBg = `rgb(${d[0]},${d[1]},${d[2]})`
  const dir = join(ROOT, 'trailer/private/chars')
  chars = await Promise.all(
    readdirSync(dir)
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => loadImage(join(dir, f))),
  )
}

// ---------- 場景 ----------
const S1_TEXT = '還記得去年嗎？'
const S1_T0 = 0.8
const S1_CPS = 5
const S3_TEXT = '今年……'
const S3_T0 = 15.8

function scene1(t: number) {
  fill('#000')
  p.clearRect(0, 0, LW, LH)
  snow(t, 0.35)
  blitPixel()
  const n = Math.min([...S1_TEXT].length, Math.max(0, Math.floor((t - S1_T0) * S1_CPS) + 1))
  const a = 1 - seg(t, 4.3, 4.95)
  const shown = t >= S1_T0 ? [...S1_TEXT].slice(0, n).join('') : ''
  o.font = '88px "Cubic 11"'
  const fullW = o.measureText(S1_TEXT).width
  text(shown, (W - fullW) / 2, H / 2, { size: 88, align: 'left', outline: 0, alpha: a })
  if (Math.floor(t * 2.5) % 2 === 0) {
    o.font = '88px "Cubic 11"'
    const cx = (W - fullW) / 2 + o.measureText(shown).width + 14
    o.globalAlpha = a
    o.fillStyle = C.gold
    o.fillRect(cx, H / 2 - 40, 38, 80)
    o.globalAlpha = 1
  }
}

/** 去年的海報與人物（t 超過 15 時固定在最後的樣子，給轉場用） */
function drawScene2(ctx: Ctx, t: number) {
  ctx.fillStyle = posterBg
  ctx.fillRect(0, 0, W, H)
  // 海報：淡入、緩慢推近
  const pa = Math.min(seg(t, 5, 6), 1 - seg(t, 10.4, 11.3))
  if (pa > 0) {
    const k = easeInOut(seg(t, 5, 11))
    const scale = lerp(1, 1.12, k)
    const ph = H * 0.96 * scale
    const pw = (poster.width / poster.height) * ph
    ctx.globalAlpha = pa
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(poster, (W - pw) / 2, (H - ph) / 2 - lerp(0, 60, k), pw, ph)
    ctx.globalAlpha = 1
  }
  // 人物依序彈出，排成兩排
  const rows = [chars.slice(0, 11), chars.slice(11)]
  const boxH = 360
  rows.forEach((row, r) => {
    const boxW = W / (row.length + 0.6)
    row.forEach((img, i) => {
      const idx = r * 11 + i
      const t0 = 10.9 + idx * 0.12
      if (t < t0) return
      const k = easeOutBack(seg(t, t0, t0 + 0.38))
      const bob = Math.sin((t - t0) * 3 + idx) * 6 * seg(t, t0 + 0.4, t0 + 1)
      const h0 = boxH
      const w0 = (img.width / img.height) * h0
      const fit = Math.min(1, (boxW * 1.02) / w0)
      const w = w0 * fit * k
      const h = h0 * fit * k
      const cx = boxW * (i + 0.8) + (r === 1 ? boxW * 0.5 : 0)
      const bottom = 60 + boxH * (r + 1) + r * 20 + bob
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(img, cx - w / 2, bottom - h, w, h)
    })
  })
}

function scene2(t: number) {
  drawScene2(o, t)
  caption('去年，我們都是頒獎典禮的主角', t, 6.2, 14.7)
}

function scene3(t: number) {
  if (!scene2Cache.canvas) {
    scene2Cache.canvas = createCanvas(W, H)
    drawScene2(scene2Cache.canvas.getContext('2d'), 15)
  }
  const k = seg(t, 15, 18.6)
  const block = Math.max(1, Math.round(2 ** (k * k * 6.8)))
  const small = createCanvas(Math.ceil(W / block), Math.ceil(H / block))
  const sc = small.getContext('2d')
  sc.imageSmoothingEnabled = true
  sc.drawImage(scene2Cache.canvas, 0, 0, small.width, small.height)
  o.imageSmoothingEnabled = false
  o.drawImage(small, 0, 0, small.width * block, small.height * block)
  fill('#fff', seg(t, 18.6, 19.7))
  caption(S3_TEXT, t, S3_T0, 19.4)
}

function scene4(t: number, tms: number) {
  for (const r of parade) {
    if (t < r.spawn) continue
    r.actor.update(DT)
    r.x += r.dir * DT * r.actor.speed
    if (r.x > LW + 26) r.x = -26
    if (t >= r.next) {
      if (rnd() < 0.45) r.actor.jump()
      else r.actor.emote(Math.floor(rnd() * 8), tms)
      r.next = t + 1.2 + rnd() * 2.8
    }
  }
  drawCrowdTrack(dom(p), LW, LH, TRACK_TOP)
  drawRunners(parade.filter((r) => t >= r.spawn), tms)
  snow(t, 0.8)
  blitPixel()
  fill('#fff', 1 - seg(t, 20, 20.7))
  caption('今年，我們走進像素世界', t, 21, 31.5)
  fill('#000', seg(t, 31.6, 32))
}

function scene5(t: number, tms: number) {
  nightSky()
  p.clearRect(0, 0, LW, LH)
  snow(t, 0.4)
  blitPixel()

  const step = Math.min(OPS.length, Math.max(0, Math.floor((t - OP_START) / OP_STEP) + 1))
  const cfg = creatorConfigs[step]
  const sinceChange = t - (OP_START + (step - 1) * OP_STEP)
  const activeRow = step > 0 ? rowOf(OPS[step - 1]) : null
  if (step > 0 && sinceChange < DT / 1000 + 1e-6 && step % 3 === 0) creatorActor.emote(step % 2 ? 1 : 0, tms)
  creatorActor.update(DT)

  text('捏一個你的跑者', W / 2, 92, { size: 66, shadow: C.red })

  // 左：正面大圖
  const bx = 190
  const by = 170
  const bw = 520
  const bh = 700
  pixelBox(bx - 8, by - 8, bw + 16, bh + 16, C.outline, C.outline, 8)
  pixelBox(bx, by, bw, bh, C.panel, C.panel, 6)
  o.fillStyle = C.panelLo
  o.fillRect(bx + 6, by + bh - 70, bw - 12, 64)
  const portrait = createCanvas(PORTRAIT_W, PORTRAIT_H)
  drawPortrait(dom(portrait.getContext('2d')), cfg, creatorActor.pose(tms, cfg.face))
  const scale = 10
  o.imageSmoothingEnabled = false
  o.drawImage(portrait, bx + (bw - PORTRAIT_W * scale) / 2, by + bh - 40 - PORTRAIT_H * scale, PORTRAIT_W * scale, PORTRAIT_H * scale)
  // 換裝瞬間的閃光
  if (sinceChange < 0.12 && step > 0) {
    o.globalAlpha = 0.35 * (1 - sinceChange / 0.12)
    o.fillStyle = '#fff'
    o.fillRect(bx + 6, by + 6, bw - 12, bh - 12)
    o.globalAlpha = 1
  }

  // 右：造型選項
  const rx = 800
  const rw = 930
  pixelBox(rx - 8, by - 8, rw + 16, bh + 16, C.outline, C.outline, 8)
  pixelBox(rx, by, rw, bh, C.panel, C.panel, 6)
  o.fillStyle = C.red
  o.fillRect(rx + 30, by - 26, 180, 46)
  text('造型設定', rx + 120, by - 3, { size: 33, outline: 0 })
  ROWS.forEach((row, i) => {
    const y = by + 80 + i * 104
    const active = row === activeRow && sinceChange < OP_STEP
    text('▶', rx + 50, y, { size: 22, color: C.red, outline: 0 })
    text(row, rx + 80, y, { size: 44, align: 'left', outline: 0, color: active ? C.gold : C.snow })
    const val = rowValue(row, cfg)
    o.font = '40px "Cubic 11"'
    const vw = o.measureText(val).width + 56
    const vx = rx + rw - 50 - vw
    pixelBox(vx, y - 34, vw, 68, active ? C.gold : C.panel2, active ? C.gold : C.panel2, 5)
    text(val, vx + vw / 2, y, { size: 40, outline: 0, color: active ? C.outline : C.snow })
    if (i < ROWS.length - 1) {
      o.fillStyle = C.panelLo
      for (let dx = rx + 40; dx < rx + rw - 40; dx += 20) o.fillRect(dx, y + 52, 10, 4)
    }
  })

  caption('髮型、衣服、帽子、墨鏡——捏一個你自己', t, 32.8, 41.6)
  fill('#000', Math.max(1 - seg(t, 32, 32.4), seg(t, 41.6, 42)))
}

function scene6(t: number, tms: number) {
  for (const r of crowd) {
    const a = r.actor
    // 在原位附近來回走動
    if (a.mode === 'walk') {
      r.x += r.dir * DT * a.speed
      if (Math.abs(r.x - r.home) > 14) r.dir = -r.dir
    }
    a.update(DT)
    for (const j of JUMPS) {
      const at = j + (r.x / LW) * 0.45
      if (t >= at && t - DT / 1000 < at) a.jump()
    }
    const e1 = 45.6 + ((r.x * 7) % 10) / 20
    const e2 = 48.3 + ((r.y * 3) % 10) / 20
    if (t >= e1 && t - DT / 1000 < e1) a.emote(rnd() < 0.5 ? 1 : 0, tms)
    if (t >= e2 && t - DT / 1000 < e2) a.emote(Math.floor(rnd() * 8), tms)
  }
  drawCrowdTrack(dom(p), LW, LH, TRACK_TOP)
  drawRunners(crowd, tms)
  snow(t, 0.9)
  blitPixel()
  caption('12/23，用你的角色一起玩遊戲', t, 42.8, 51.6)
  fill('#000', Math.max(1 - seg(t, 42, 42.4), seg(t, 51.6, 52)))
}

function scene7(t: number, tms: number) {
  nightSky()
  p.clearRect(0, 0, LW, LH)
  snow(t, 0.8)
  // 雪地
  p.fillStyle = C.snow
  p.fillRect(0, 264, LW, 6)
  p.fillStyle = '#dfe6ec'
  p.fillRect(0, 262, LW, 2)
  for (const r of finale) {
    r.actor.update(DT)
    r.x += DT * r.actor.speed
    if (r.x > LW + 30) r.x -= LW + 60 + 58 * 2
  }
  drawRunners(finale.filter((r) => r.x > -30), tms)
  blitPixel()

  const drop = (t0: number, y: number) => y - (1 - easeOutBack(seg(t, t0, t0 + 0.6))) * 260
  const fade = (t0: number) => seg(t, t0, t0 + 0.3)
  text('★ GRC 聖誕交換禮物 ★', W / 2, drop(52.1, 110), { size: 44, color: C.gold, alpha: fade(52.1) })
  text('GARMIN RUN STORY', W / 2, drop(52.4, 240), { size: 121, shadow: C.red, alpha: fade(52.4) })
  // GRS 放大、彈出
  const grs = easeOutBack(seg(t, 53.0, 53.5))
  if (grs > 0) {
    o.save()
    o.translate(W / 2, 410)
    o.scale(grs, grs)
    text('GRS', 0, 0, { size: 176, color: C.gold, shadow: C.red })
    o.restore()
  }
  const pop = easeOutBack(seg(t, 53.8, 54.3))
  if (pop > 0) {
    o.save()
    o.translate(W / 2, 600)
    o.scale(pop, pop)
    text('12.23', 0, 0, { size: 110, color: C.snow, shadow: C.red })
    o.restore()
  }
  const slogan = '現在就去捏你的跑者！'
  const n = Math.max(0, Math.min([...slogan].length, Math.floor((t - 54.7) * CPS) + 1))
  if (t >= 54.7) text([...slogan].slice(0, n).join(''), W / 2, 740, { size: 55 })
  fill('#000', seg(t, 59, 59.9))
}

function renderFrame(f: number) {
  const t = f / FPS
  const tms = t * 1000
  if (t < 5) scene1(t)
  else if (t < 15) scene2(t)
  else if (t < 20) scene3(t)
  else if (t < 32) scene4(t, tms)
  else if (t < 42) scene5(t, tms)
  else if (t < 52) scene6(t, tms)
  else scene7(t, tms)
}

// ---------- 主程式 ----------
async function main() {
  await loadPrivate()
  await Promise.all([...parade, ...crowd, ...finale].map((r) => preloadAvatar(r.cfg)).concat(creatorConfigs.map(preloadAvatar)))

  const outDir = join(ROOT, 'trailer/out')
  mkdirSync(outDir, { recursive: true })

  if (stillsMode) {
    const times = [2.5, 8, 13.5, 16.5, 18.3, 24, 30, 35.2, 39, 45.3, 49, 53.2, 57]
    const want = new Set(times.map((s) => Math.round(s * FPS)))
    const last = Math.max(...want)
    for (let f = 0; f <= last; f++) {
      renderFrame(f)
      if (want.has(f)) writeFileSync(join(outDir, `still-${String(f / FPS).padStart(4, '0')}.png`), await out.encode('png'))
    }
    console.log(`✓ 輸出 ${want.size} 張關鍵畫面到 trailer/out/`)
    return
  }

  const wav = join(outDir, 'music.wav')
  renderMusic({ typeBlips: [...typeTimes(S1_TEXT, S1_T0, S1_CPS), ...typeTimes(S3_TEXT, S3_T0, CPS)] }, wav)

  await encodeVideo({ frames: FPS * DUR, render: renderFrame, wav, dest: join(homedir(), 'Downloads', 'GRS-前導影片.mp4') })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
