/**
 * 影片共用工具：畫布、像素字、對話框字幕、雪、角色群、輸出 MP4。
 * 需要亂數的地方由呼叫端傳入 rnd，確保輸出可重現。
 */
import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas'
import { spawn } from 'node:child_process'
import { AvatarActor, drawAvatar, type AvatarConfig, type MoveMode } from '../src/avatar'

// ---------- 基本設定 ----------
export const FPS = 30
export const W = 1920
export const H = 1080
export const LW = 480
export const LH = 270
export const TRACK_TOP = 72
export const DT = 1000 / FPS

export const C = {
  outline: '#1a1c2c',
  night: '#1a1c2c',
  nightMid: '#222a4d',
  nightHi: '#29366f',
  panel: '#333c57',
  panel2: '#29366f',
  panelLo: '#1f2540',
  snow: '#f4f4f4',
  red: '#b13e53',
  gold: '#ffcd75',
  goldLo: '#ef7d57',
  muted: '#94b0c2',
  green: '#38b764',
  greenLo: '#257179',
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k
export const easeOut = (k: number) => 1 - (1 - k) ** 3
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2)
export const easeOutBack = (k: number) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2

// ---------- 畫布 ----------
export type Ctx = SKRSContext2D
/** 最終畫面 1920×1080 */
export const out = createCanvas(W, H)
export const o = out.getContext('2d')
/** 像素層 480×270，放大 4 倍貼到最終畫面 */
export const px = createCanvas(LW, LH)
export const p = px.getContext('2d')
p.imageSmoothingEnabled = false
/** 給 src/avatar 用的 DOM 型別 */
export const dom = (c: Ctx) => c as unknown as CanvasRenderingContext2D

export function blitPixel(alpha = 1) {
  o.imageSmoothingEnabled = false
  o.globalAlpha = alpha
  o.drawImage(px, 0, 0, W, H)
  o.globalAlpha = 1
}

export function fill(color: string, alpha = 1) {
  if (alpha <= 0) return
  o.globalAlpha = alpha
  o.fillStyle = color
  o.fillRect(0, 0, W, H)
  o.globalAlpha = 1
}

/** 夜空底色（三段色帶，與網站深色模式相同） */
export function nightSky() {
  o.fillStyle = C.nightHi
  o.fillRect(0, 0, W, 180)
  o.fillStyle = C.nightMid
  o.fillRect(0, 180, W, 180)
  o.fillStyle = C.night
  o.fillRect(0, 360, W, H - 360)
}

// ---------- 雪 ----------
export interface Flake {
  x: number
  y: number
  v: number
  s: number
  drift: number
}
export function makeFlakes(rnd: () => number, n = 110): Flake[] {
  return Array.from({ length: n }, () => ({ x: rnd() * LW, y: rnd() * LH, v: 6 + rnd() * 14, s: rnd() < 0.25 ? 2 : 1, drift: rnd() * 6 }))
}
/** 在像素層畫雪 */
export function snow(flakes: Flake[], t: number, alpha = 0.9) {
  p.globalAlpha = alpha
  p.fillStyle = C.snow
  for (const f of flakes) {
    const y = (f.y + t * f.v) % (LH + 4)
    const x = (f.x + Math.sin(t * 0.8 + f.drift) * 3 + LW) % LW
    p.fillRect(Math.round(x), Math.round(y), f.s, f.s)
  }
  p.globalAlpha = 1
}

// ---------- 文字 ----------
export interface TextOpt {
  size?: number
  color?: string
  align?: CanvasTextAlign
  outline?: number
  shadow?: string
  alpha?: number
}
/** 像素字，預設深色描邊；shadow 為右下方的立體落影 */
export function text(str: string, x: number, y: number, opt: TextOpt = {}) {
  const { size = 44, color = C.snow, align = 'center', outline = Math.max(3, Math.round(size / 14)), shadow, alpha = 1 } = opt
  if (alpha <= 0 || !str) return
  o.globalAlpha = alpha
  o.font = `${size}px "Cubic 11"`
  o.textAlign = align
  o.textBaseline = 'middle'
  if (shadow) {
    const d = Math.round(size / 11)
    o.fillStyle = shadow
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) o.fillText(str, x + d * 2 + dx * outline, y + d * 2 + dy * outline)
  }
  if (outline) {
    o.fillStyle = C.outline
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) o.fillText(str, x + dx * outline, y + dy * outline)
  }
  o.fillStyle = color
  o.fillText(str, x, y)
  o.globalAlpha = 1
}

export function textWidth(str: string, size: number): number {
  o.font = `${size}px "Cubic 11"`
  return o.measureText(str).width
}

/** 缺角像素框 */
export function pixelBox(x: number, y: number, w: number, h: number, bg: string, border: string, b = 6) {
  o.fillStyle = border
  o.fillRect(x + b, y, w - 2 * b, h)
  o.fillRect(x, y + b, w, h - 2 * b)
  o.fillStyle = bg
  o.fillRect(x + b, y + b, w - 2 * b, h - 2 * b)
}

/** 打字機速度（每秒字數） */
export const CPS = 12
/** RPG 對話框字幕：打字機效果，完成後出現閃爍的 ▼ */
export function caption(str: string, t: number, t0: number, t1: number) {
  if (t < t0 || t > t1) return
  const chars = [...str]
  const n = Math.min(chars.length, Math.floor((t - t0) * CPS) + 1)
  const a = Math.min(seg(t, t0, t0 + 0.15), 1 - seg(t, t1 - 0.25, t1))
  o.globalAlpha = a
  o.font = '55px "Cubic 11"'
  const fullW = o.measureText(str).width
  const bw = Math.max(640, fullW + 150)
  const bx = (W - bw) / 2
  const by = H - 190
  pixelBox(bx - 6, by - 6, bw + 12, 132, C.snow, C.snow, 8)
  pixelBox(bx, by, bw, 120, 'rgba(26,28,44,0.94)', 'rgba(26,28,44,0.94)', 6)
  o.globalAlpha = 1
  text(chars.slice(0, n).join(''), bx + (bw - fullW) / 2, by + 60, { size: 55, align: 'left', outline: 0, alpha: a })
  if (n === chars.length && Math.floor(t * 2.5) % 2 === 0) text('▼', bx + bw - 44, by + 88, { size: 22, color: C.gold, outline: 0, alpha: a })
}
/** 打字機每個字出現的時間（配樂的打字音用） */
export const typeTimes = (str: string, t0: number, cps: number) => [...str].map((_, i) => t0 + i / cps)

/** 以 (cx, cy) 為中心、縮放 k 畫東西（彈出動畫用） */
export function scaled(cx: number, cy: number, k: number, draw: () => void) {
  if (k <= 0) return
  o.save()
  o.translate(cx, cy)
  o.scale(k, k)
  draw()
  o.restore()
}

// ---------- 角色群 ----------
export interface Runner {
  cfg: AvatarConfig
  actor: AvatarActor
  x: number
  y: number
  dir: number
  home: number
  spawn: number
  next: number
}
export function makeRunner(rnd: () => number, cfg: AvatarConfig, x: number, y: number, dir: number, mode: MoveMode, spawn = 0): Runner {
  const actor = new AvatarActor()
  actor.setMode(mode)
  return { cfg, actor, x, y, dir, home: x, spawn, next: spawn + 1 + rnd() * 3 }
}
/** 在像素層畫一群角色，由遠（上）到近（下） */
export function drawRunners(rs: Runner[], tms: number) {
  for (const r of [...rs].sort((a, b) => a.y - b.y)) {
    drawAvatar(dom(p), r.cfg, r.actor.pose(tms, r.cfg.face), r.x, r.y, { flip: r.dir < 0 })
  }
}

// ---------- 輸出 ----------
/** 逐格畫出影片並用 ffmpeg 壓成 MP4（H.264 + AAC） */
export async function encodeVideo(opts: { frames: number; render: (f: number) => void; wav: string; dest: string }) {
  const ff = spawn(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0', '-i', opts.wav,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', opts.dest],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  for (let f = 0; f < opts.frames; f++) {
    opts.render(f)
    const data = o.getImageData(0, 0, W, H).data
    if (!ff.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength))) await new Promise((r) => ff.stdin.once('drain', r))
    if (f % (FPS * 5) === 0) process.stdout.write(`\r  ${Math.round((f / opts.frames) * 100)}%`)
  }
  ff.stdin.end()
  await new Promise<void>((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg 結束代碼 ${code}`)))))
  console.log(`\n✓ ${opts.dest}`)
}
