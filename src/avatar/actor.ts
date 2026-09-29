/**
 * 角色的動畫狀態：動作、格數、跳躍、眨眼、表情。
 * 不處理位置與移動（交給場景），只產生給 render 用的 Pose。
 */
import { EMOTES } from './catalog'
import type { AnimName, IconName, MoveMode } from './types'

interface AnimDef {
  /** 精靈圖上的格號 */
  frames: number[]
  /** 每格毫秒 */
  delay: number[]
  loop: boolean
  /** 移動速度（px/ms），場景用 */
  speed?: number
  /** 每格的垂直位移（跳躍） */
  lift?: number[]
}

export const ANIM: Record<AnimName, AnimDef> = {
  idle: { frames: [0, 1], delay: [520, 520], loop: true },
  walk: { frames: [1, 2, 3, 4, 5, 6, 7, 8], delay: Array(8).fill(105), loop: true, speed: 0.024 },
  run: { frames: [0, 1, 2, 3, 4, 5, 6, 7], delay: Array(8).fill(80), loop: true, speed: 0.055 },
  jump: { frames: [0, 1, 2, 3, 4], delay: [110, 110, 150, 170, 160], loop: false, lift: [0, 0, -9, -13, -2] },
}

export const EMOTE_MS = 2000
const BLINK_MIN = 2200
const BLINK_RANGE = 3000

export interface EmoteState {
  face: string
  icon: IconName
  start: number
  until: number
}

/** 某一瞬間要畫的樣子 */
export interface Pose {
  anim: AnimName
  /** 精靈圖上的格號 */
  frame: number
  lift: number
  face: string
  /** 頭頂圖示（沒有則為 null） */
  emote: EmoteState | null
  /** 產生此 Pose 的時間（ms，performance.now 時間軸），圖示動畫用 */
  now: number
}

export class AvatarActor {
  mode: MoveMode = 'idle'
  jumping = false
  private i = 0
  private acc = 0
  private emo: EmoteState | null = null
  private blinkAt: number | null = null
  private blinkSeq: [face: string, until: number][] | null = null
  /** 跳躍播完時呼叫（UI 同步按鈕狀態用） */
  onJumpEnd?: () => void

  get anim(): AnimName {
    return this.jumping ? 'jump' : this.mode
  }

  /** 目前移動模式的速度（跳躍時沿用原本的移動） */
  get speed(): number {
    return ANIM[this.mode].speed ?? 0
  }

  setMode(mode: MoveMode): void {
    this.mode = mode
    if (!this.jumping) this.resetFrame()
  }

  jump(): void {
    if (this.jumping) return
    this.jumping = true
    this.resetFrame()
  }

  /** 觸發第 index 個表情（0 起算，對應快捷鍵 1～8） */
  emote(index: number, now: number): void {
    const e = EMOTES[index]
    if (!e) return
    this.emo = { face: e.face, icon: e.icon, start: now, until: now + EMOTE_MS }
    this.blinkSeq = null
  }

  /** 前進 dt 毫秒（慢動作由呼叫端縮放 dt） */
  update(dt: number): void {
    this.acc += dt
    for (;;) {
      const A = ANIM[this.anim]
      if (this.acc < A.delay[this.i]) break
      this.acc -= A.delay[this.i]
      if (this.i < A.frames.length - 1) this.i++
      else if (A.loop) this.i = 0
      else {
        this.jumping = false
        this.resetFrame()
        this.onJumpEnd?.()
        break
      }
    }
  }

  pose(now: number, baseFace: string): Pose {
    const A = ANIM[this.anim]
    return {
      anim: this.anim,
      frame: A.frames[this.i],
      lift: A.lift?.[this.i] ?? 0,
      face: this.faceAt(now, baseFace),
      emote: this.emo && now < this.emo.until ? this.emo : null,
      now,
    }
  }

  private resetFrame(): void {
    this.i = 0
    this.acc = 0
  }

  /** 表情優先，其次眨眼（closing → closed → closing），否則為預設表情 */
  private faceAt(now: number, baseFace: string): string {
    if (this.emo && now < this.emo.until) return this.emo.face
    this.emo = null
    // 第一次呼叫時才排眨眼，讓多個角色錯開
    if (this.blinkAt === null) this.blinkAt = now + BLINK_MIN + Math.random() * BLINK_RANGE
    if (!this.blinkSeq && now >= this.blinkAt && baseFace !== 'closed') {
      this.blinkSeq = [
        ['closing', now + 70],
        ['closed', now + 180],
        ['closing', now + 250],
      ]
    }
    if (this.blinkSeq) {
      const s = this.blinkSeq.find(([, until]) => now < until)
      if (s) return s[0]
      this.blinkSeq = null
      this.blinkAt = now + BLINK_MIN + Math.random() * BLINK_RANGE
    }
    return baseFace
  }
}
