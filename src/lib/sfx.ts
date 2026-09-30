/**
 * 抽籤機音效：全部用 Web Audio 即時合成，不需要音檔。
 * 瀏覽器要求使用者操作後才能出聲，第一次按「抽」時才建立 AudioContext。
 */
import { readJson, writeJson } from './storage'

const MUTE_KEY = 'xmas-runner:sfx-muted'
let ctx: AudioContext | null = null
let muted = readJson<boolean>(MUTE_KEY) === true

export const isMuted = () => muted
export function setMuted(v: boolean) {
  muted = v
  writeJson(MUTE_KEY, v)
}

function ac(): AudioContext | null {
  if (muted) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.08) {
  const c = ac()
  if (!c) return
  const t = c.currentTime + start
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

let noiseBuf: AudioBuffer | null = null
function noise(start: number, dur: number, vol: number, freq = 1800) {
  const c = ac()
  if (!c) return
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t = c.currentTime + start
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  const g = c.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(c.destination)
  src.start(t)
  src.stop(t + dur + 0.02)
}

/** 拉桿：低沉的「喀噹」 */
export function sfxLever() {
  noise(0, 0.12, 0.5, 400)
  tone(110, 0, 0.18, 'triangle', 0.2)
  tone(80, 0.08, 0.2, 'triangle', 0.15)
}

/** 滾輪經過一格 */
export function sfxTick(pitch = 1) {
  tone(900 * pitch, 0, 0.035, 'square', 0.035)
}

/** 小鼓連擊，intensity 0～1 */
export function sfxDrum(intensity: number) {
  noise(0, 0.06, 0.08 + intensity * 0.25, 2200)
}

/** 抽中：號角 + 和弦 + 亮晶晶 */
export function sfxFanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((f, i) => tone(f, i * 0.11, 0.16, 'square', 0.09))
  for (const f of [523.25, 659.25, 783.99, 1046.5]) tone(f, 0.46, 1.1, 'square', 0.06)
  tone(261.63, 0.46, 1.1, 'triangle', 0.14)
  for (let i = 0; i < 10; i++) tone(1568 + ((i * 523) % 1600), 0.5 + i * 0.07, 0.12, 'triangle', 0.05)
  noise(0.46, 0.5, 0.25, 5000)
}

/** 全部抽完：再長一點的勝利音樂 */
export function sfxFinale() {
  const seq = [523.25, 523.25, 523.25, 698.46, 880, 783.99, 698.46, 1046.5]
  seq.forEach((f, i) => tone(f, i * 0.14, 0.2, 'square', 0.08))
  for (const f of [698.46, 880, 1046.5]) tone(f, 1.2, 1.4, 'square', 0.06)
  tone(174.61, 1.2, 1.4, 'triangle', 0.15)
}
