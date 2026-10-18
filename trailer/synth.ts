/**
 * 簡易 8-bit 合成器：方波、三角波、音樂盒、鼓組，輸出 16-bit 單聲道 WAV。
 */
import { writeFileSync } from 'node:fs'

export const SR = 44100

/** [音高（如 'E5'，null 為休止）, 拍數] */
export type Note = [pitch: string | null, beats: number]

export function freq(p: string): number {
  const m = /^([A-G])(#?)(\d)$/.exec(p)!
  const semis: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }
  const n = semis[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12
  return 440 * 2 ** (n / 12)
}

export function createSynth(dur: number) {
  const buf = new Float32Array(Math.round(SR * dur))
  let noiseSeed = 12345
  const noise = () => {
    noiseSeed = (noiseSeed * 1103515245 + 12345) & 0x7fffffff
    return (noiseSeed / 0x7fffffff) * 2 - 1
  }

  function add(start: number, len: number, gen: (t: number, i: number) => number) {
    const s = Math.max(0, Math.floor(start * SR))
    const e = Math.min(buf.length, Math.floor((start + len) * SR))
    for (let i = s; i < e; i++) buf[i] += gen((i - s) / SR, i - s)
  }

  /** 方波（duty 可調），含簡單 ADSR */
  function square(start: number, len: number, f: number, amp: number, duty = 0.25) {
    add(start, len + 0.03, (t) => {
      const env = Math.min(1, t / 0.005) * (t < len ? 1 - 0.3 * Math.min(1, t / 0.15) : 0.7 * (1 - (t - len) / 0.03))
      return ((t * f) % 1 < duty ? 1 : -1) * amp * env
    })
  }
  function triangle(start: number, len: number, f: number, amp: number) {
    add(start, len, (t) => {
      const ph = (t * f) % 1
      const env = Math.min(1, t / 0.005) * Math.min(1, (len - t) / 0.02)
      return (4 * Math.abs(ph - 0.5) - 1) * amp * env
    })
  }
  /** 音樂盒：正弦 + 泛音，長衰減 */
  function musicBox(start: number, f: number, amp: number) {
    add(start, 1.6, (t) => (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) * amp * Math.exp(-t * 2.6) * Math.min(1, t / 0.003))
  }
  function kick(start: number, amp = 0.55) {
    add(start, 0.18, (t) => Math.sin(2 * Math.PI * (50 * t + (100 / 25) * (1 - Math.exp(-25 * t)))) * amp * Math.exp(-t * 18))
  }
  function snare(start: number, amp = 0.28) {
    add(start, 0.16, (t) => noise() * amp * Math.exp(-t * 26))
  }
  function hat(start: number, amp = 0.07) {
    let prev = 0
    add(start, 0.04, (t) => {
      const n = noise()
      const hp = n - prev
      prev = n
      return hp * amp * Math.exp(-t * 90)
    })
  }
  function blip(start: number, f = 880) {
    square(start, 0.035, f, 0.12, 0.5)
  }
  /** 鈸：長雜訊衰減 */
  function crash(start: number, len = 1.8, amp = 0.3) {
    add(start, len, (t) => noise() * amp * Math.exp(-t * 2.2))
  }
  /** 播放旋律，回傳結束時間 */
  function melody(notes: Note[], start: number, beat: number, play: (t: number, f: number, len: number) => void): number {
    let t = start
    for (const [p, b] of notes) {
      if (p) play(t, freq(p), b * beat * 0.92)
      t += b * beat
    }
    return t
  }
  /** 每小節：貝斯（根音、五度交替）+ 鼓（大鼓、小鼓、八分音符 hi-hat）；mul 為移調倍率 */
  function bandBar(start: number, beat: number, root: string, fifth: string, mul = 1) {
    ;[freq(root), freq(fifth), freq(root), freq(fifth)].forEach((f, q) => triangle(start + q * beat, beat * 0.9, f * mul, 0.22))
    for (let q = 0; q < 4; q++) {
      if (q % 2 === 0) kick(start + q * beat)
      else snare(start + q * beat)
      hat(start + q * beat)
      hat(start + q * beat + beat / 2)
    }
  }

  /** 正規化、最後 fade 秒淡出，寫成 WAV */
  function writeWav(file: string, fade = 1) {
    let peak = 0
    for (const v of buf) peak = Math.max(peak, Math.abs(v))
    const g = 0.89 / peak
    const pcm = Buffer.alloc(buf.length * 2)
    for (let i = 0; i < buf.length; i++) {
      const k = i > (dur - fade) * SR ? (buf.length - i) / SR / fade : 1
      pcm.writeInt16LE(Math.round(Math.tanh(buf[i] * g) * k * 32767), i * 2)
    }
    const header = Buffer.alloc(44)
    header.write('RIFF', 0)
    header.writeUInt32LE(36 + pcm.length, 4)
    header.write('WAVEfmt ', 8)
    header.writeUInt32LE(16, 16)
    header.writeUInt16LE(1, 20)
    header.writeUInt16LE(1, 22)
    header.writeUInt32LE(SR, 24)
    header.writeUInt32LE(SR * 2, 28)
    header.writeUInt16LE(2, 32)
    header.writeUInt16LE(16, 34)
    header.write('data', 36)
    header.writeUInt32LE(pcm.length, 40)
    writeFileSync(file, Buffer.concat([header, pcm]))
  }

  return { buf, noise, add, square, triangle, musicBox, kick, snare, hat, blip, crash, melody, bandBar, writeWav }
}

/** Jingle Bells 副歌 16 小節（C 大調，4/4，公有領域） */
export const JB_CHORUS: Note[] = [
  ['E5', 1], ['E5', 1], ['E5', 2],
  ['E5', 1], ['E5', 1], ['E5', 2],
  ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5],
  ['E5', 4],
  ['F5', 1], ['F5', 1], ['F5', 1.5], ['F5', 0.5],
  ['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5],
  ['E5', 1], ['D5', 1], ['D5', 1], ['E5', 1],
  ['D5', 2], ['G5', 2],
  ['E5', 1], ['E5', 1], ['E5', 2],
  ['E5', 1], ['E5', 1], ['E5', 2],
  ['E5', 1], ['G5', 1], ['C5', 1.5], ['D5', 0.5],
  ['E5', 4],
  ['F5', 1], ['F5', 1], ['F5', 1], ['F5', 1],
  ['F5', 1], ['E5', 1], ['E5', 1], ['E5', 0.5], ['E5', 0.5],
  ['G5', 1], ['G5', 1], ['F5', 1], ['D5', 1],
  ['C5', 4],
]
export const JB_CHORUS_CHORDS = ['C', 'C', 'C', 'C', 'F', 'C', 'D', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G', 'C']
/** 副歌前 8 小節的音符數，用來切出後 8 小節 */
export const JB_CHORUS_HALF = 26

/** Jingle Bells 主歌 16 小節（Dashing through the snow…） */
export const JB_VERSE: Note[] = [
  ['G4', 1], ['E5', 1], ['D5', 1], ['C5', 1],
  ['G4', 3], ['G4', 0.5], ['G4', 0.5],
  ['G4', 1], ['E5', 1], ['D5', 1], ['C5', 1],
  ['A4', 4],
  ['A4', 1], ['F5', 1], ['E5', 1], ['D5', 1],
  ['B4', 4],
  ['G5', 1], ['G5', 1], ['F5', 1], ['D5', 1],
  ['E5', 4],
  ['G4', 1], ['E5', 1], ['D5', 1], ['C5', 1],
  ['G4', 4],
  ['G4', 1], ['E5', 1], ['D5', 1], ['C5', 1],
  ['A4', 3], ['A4', 1],
  ['A4', 1], ['F5', 1], ['E5', 1], ['D5', 1],
  ['G5', 1], ['G5', 1], ['G5', 1], ['G5', 1],
  ['A5', 1], ['G5', 1], ['F5', 1], ['D5', 1],
  ['C5', 2], ['G5', 2],
]
export const JB_VERSE_CHORDS = ['C', 'C', 'C', 'F', 'F', 'G', 'G', 'C', 'C', 'C', 'C', 'F', 'F', 'G', 'G', 'C']

/** Deck the Halls 16 小節（C 大調，4/4，公有領域） */
export const DECK: Note[] = [
  ['G5', 1.5], ['F5', 0.5], ['E5', 1], ['D5', 1],
  ['C5', 1], ['D5', 1], ['E5', 1], ['C5', 1],
  ['D5', 0.5], ['E5', 0.5], ['F5', 0.5], ['D5', 0.5], ['E5', 1.5], ['D5', 0.5],
  ['C5', 1], ['B4', 1], ['C5', 2],
  ['G5', 1.5], ['F5', 0.5], ['E5', 1], ['D5', 1],
  ['C5', 1], ['D5', 1], ['E5', 1], ['C5', 1],
  ['D5', 0.5], ['E5', 0.5], ['F5', 0.5], ['D5', 0.5], ['E5', 1.5], ['D5', 0.5],
  ['C5', 1], ['B4', 1], ['C5', 2],
  ['D5', 1.5], ['E5', 0.5], ['F5', 1], ['D5', 1],
  ['E5', 1.5], ['F5', 0.5], ['G5', 1], ['D5', 1],
  ['E5', 0.5], ['F#5', 0.5], ['G5', 1], ['A5', 0.5], ['B5', 0.5], ['C6', 1],
  ['B5', 1], ['A5', 1], ['G5', 2],
  ['G5', 1.5], ['F5', 0.5], ['E5', 1], ['D5', 1],
  ['C5', 1], ['D5', 1], ['E5', 1], ['C5', 1],
  ['A5', 0.5], ['A5', 0.5], ['A5', 0.5], ['A5', 0.5], ['G5', 1.5], ['F5', 0.5],
  ['E5', 1], ['D5', 1], ['C5', 2],
]
export const DECK_CHORDS = ['C', 'C', 'G', 'C', 'C', 'C', 'G', 'C', 'G', 'C', 'D', 'G', 'C', 'C', 'F', 'C']
/** Deck the Halls 第 13 小節起的音符索引（最後 4 小節） */
export const DECK_BAR13 = 51

/** 貝斯的五度音（取在根音之上） */
export const ROOT: Record<string, [root: string, fifth: string]> = {
  C: ['C3', 'G3'],
  F: ['F3', 'C4'],
  D: ['D3', 'A3'],
  G: ['G3', 'D4'],
}
