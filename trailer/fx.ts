/**
 * 像素特效（畫在 480×270 像素層）：彩帶、氣球、煙火、霓虹閃光、小火車、閃光爆發。
 * 全部用固定種子的亂數，輸出可重現。
 */
import { C, LH, LW, p } from './kit'

export type Theme = 'birthday' | 'party' | 'night' | 'train' | 'cheer' | 'sparkle'

/** 依關卡標題的關鍵字決定主題特效 */
export function themeOf(title: string): Theme {
  if (/火車/.test(title)) return 'train'
  if (/應援|加油/.test(title)) return 'cheer'
  if (/夜跑|螢光|run/i.test(title)) return 'night'
  if (/春酒|尾牙|聚餐/.test(title)) return 'party'
  if (/生日|誕辰|壽星|慶生/.test(title)) return 'birthday'
  return 'sparkle'
}

const CONFETTI = [C.red, C.gold, C.green, '#41a6f6', '#f4f4f4', '#ef7d57', '#a7f070']
const NEON = ['#73eff7', '#a7f070', '#ff6ec7', '#ffcd75', '#f4f4f4']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  color: string
  size: number
  kind: 'square' | 'spark' | 'balloon' | 'puff' | 'neon' | 'rocket'
  gravity: number
  sway: number
}

export class Fx {
  private ps: Particle[] = []
  private trainX = -200
  constructor(private rnd: () => number) {}

  clear() {
    this.ps = []
    this.trainX = -60
  }

  private add(p: Partial<Particle> & Pick<Particle, 'x' | 'y' | 'kind'>) {
    this.ps.push({ vx: 0, vy: 0, age: 0, life: 2, color: C.snow, size: 1, gravity: 0, sway: 0, ...p })
  }

  /** 一次爆開的彩帶（STAGE CLEAR 用） */
  burst(x: number, y: number, n = 60, palette = CONFETTI) {
    const r = this.rnd
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2
      const v = 40 + r() * 110
      this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, kind: 'square', color: palette[Math.floor(r() * palette.length)], size: r() < 0.4 ? 3 : 2, life: 1.6 + r(), gravity: 140, sway: r() * 6 })
    }
  }

  /** 煙火：在 (x, y) 爆成一圈 */
  firework(x: number, y: number) {
    const r = this.rnd
    const col = [C.gold, C.red, '#41a6f6', C.green, '#ff6ec7'][Math.floor(r() * 5)]
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2
      const v = 62 + r() * 20
      this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, kind: 'spark', color: i % 4 === 0 ? C.snow : col, life: 1.1 + r() * 0.4, gravity: 30, size: 2 })
    }
  }

  /** 每格依主題補充粒子 */
  emit(theme: Theme, dt: number, intensity = 1) {
    const r = this.rnd
    const chance = (perSec: number) => r() < perSec * dt * intensity
    switch (theme) {
      case 'birthday':
        if (chance(3.2)) this.add({ x: 10 + r() * (LW - 20), y: LH + 12, vy: -(24 + r() * 14), kind: 'balloon', color: CONFETTI[Math.floor(r() * 4)], life: 12, sway: r() * 6 })
        if (chance(26)) this.add({ x: r() * LW, y: -4, vy: 26 + r() * 20, kind: 'square', color: CONFETTI[Math.floor(r() * CONFETTI.length)], life: 14, sway: r() * 6, size: r() < 0.4 ? 3 : 2 })
        break
      case 'party':
        if (chance(2.6)) this.add({ x: 30 + r() * (LW - 60), y: LH, vy: -210 - r() * 50, kind: 'rocket', color: C.gold, life: 0.55 + r() * 0.3, gravity: 60, size: 2 })
        break
      case 'night':
        if (chance(55)) this.add({ x: r() * LW, y: r() * LH, kind: 'neon', color: NEON[Math.floor(r() * NEON.length)], life: 0.5 + r() * 0.6 })
        break
      case 'cheer':
        if (chance(30)) this.add({ x: r() * LW, y: -4, vy: 28 + r() * 20, kind: 'square', color: CONFETTI[Math.floor(r() * CONFETTI.length)], life: 14, sway: r() * 6, size: r() < 0.4 ? 3 : 2 })
        break
      case 'train':
        this.trainX += dt * 95
        if (this.trainX > LW + 140) this.trainX = -160
        if (chance(5)) this.add({ x: this.trainX + 8, y: LH - 30, vy: -14 - r() * 8, vx: -10, kind: 'puff', color: C.snow, life: 1.4, size: 2 })
        break
      case 'sparkle':
        if (chance(24)) this.add({ x: r() * LW, y: r() * LH, kind: 'neon', color: r() < 0.5 ? C.gold : C.snow, life: 0.6 })
        break
    }
  }

  update(dt: number) {
    const next: Particle[] = []
    for (const q of this.ps) {
      q.age += dt
      if (q.age > q.life) {
        // 火箭到頂就爆成煙火
        if (q.kind === 'rocket') this.firework(q.x, q.y)
        continue
      }
      q.vy += q.gravity * dt
      q.x += (q.vx + (q.sway ? Math.sin(q.age * 3 + q.sway) * 12 : 0)) * dt
      q.y += q.vy * dt
      if (q.y < -30 || q.y > LH + 30 || q.x < -30 || q.x > LW + 30) continue
      next.push(q)
    }
    this.ps = next
  }

  draw(theme?: Theme) {
    if (theme === 'train') drawTrain(this.trainX)
    for (const q of this.ps) {
      const x = Math.round(q.x)
      const y = Math.round(q.y)
      const fade = q.age > q.life - 0.3 ? Math.floor(q.age * 20) % 2 === 0 : true
      if (!fade) continue
      switch (q.kind) {
        case 'square':
        case 'spark':
        case 'rocket':
          p.fillStyle = q.color
          p.fillRect(x, y, q.size, q.size)
          break
        case 'neon': {
          const k = Math.sin((q.age / q.life) * Math.PI)
          p.fillStyle = q.color
          p.fillRect(x, y, 1, 1)
          if (k > 0.5) {
            p.fillRect(x - 1, y, 3, 1)
            p.fillRect(x, y - 1, 1, 3)
          }
          if (k > 0.75) {
            p.fillRect(x - 3, y, 7, 1)
            p.fillRect(x, y - 3, 1, 7)
          }
          break
        }
        case 'balloon':
          p.fillStyle = C.outline
          p.fillRect(x - 3, y - 4, 7, 8)
          p.fillRect(x - 2, y - 5, 5, 10)
          p.fillStyle = q.color
          p.fillRect(x - 2, y - 4, 5, 8)
          p.fillRect(x - 1, y - 5, 3, 10)
          p.fillStyle = C.snow
          p.fillRect(x - 1, y - 3, 1, 2)
          p.fillStyle = C.outline
          for (let k = 0; k < 8; k++) p.fillRect(x + (k % 4 < 2 ? 0 : 1), y + 6 + k, 1, 1)
          break
        case 'puff': {
          const s = 2 + Math.floor(q.age * 3)
          p.globalAlpha = Math.max(0, 1 - q.age / q.life)
          p.fillStyle = q.color
          p.fillRect(x - s, y - s + 1, s * 2, s * 2 - 2)
          p.fillRect(x - s + 1, y - s, s * 2 - 2, s * 2)
          p.globalAlpha = 1
          break
        }
      }
    }
  }
}

/** 小火車：車頭 + 兩節車廂，在畫面底部行駛 */
function drawTrain(x0: number) {
  const y = LH - 26
  const x = Math.round(x0)
  const car = (cx: number, color: string) => {
    p.fillStyle = C.outline
    p.fillRect(cx - 1, y - 1, 46, 18)
    p.fillStyle = color
    p.fillRect(cx, y, 44, 14)
    p.fillStyle = '#73eff7'
    for (let i = 0; i < 4; i++) p.fillRect(cx + 4 + i * 10, y + 3, 6, 5)
    p.fillStyle = C.outline
    p.fillRect(cx + 6, y + 15, 7, 7)
    p.fillRect(cx + 31, y + 15, 7, 7)
  }
  car(x - 100, C.green)
  car(x - 52, C.red)
  // 車頭
  p.fillStyle = C.outline
  p.fillRect(x - 1, y - 9, 40, 26)
  p.fillStyle = '#3b5dc9'
  p.fillRect(x, y - 8, 22, 22)
  p.fillRect(x + 22, y + 2, 16, 12)
  p.fillStyle = C.outline
  p.fillRect(x + 28, y - 6, 6, 8)
  p.fillStyle = C.gold
  p.fillRect(x + 36, y + 5, 2, 3)
  p.fillStyle = '#73eff7'
  p.fillRect(x + 4, y - 4, 12, 7)
  p.fillStyle = C.outline
  p.fillRect(x + 4, y + 15, 9, 9)
  p.fillRect(x + 24, y + 15, 9, 9)
  p.fillStyle = C.muted
  p.fillRect(x - 100, y + 21, 140, 1)
}
