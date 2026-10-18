/**
 * 年度回顧第二版（年度路跑）配樂：8-bit Deck the Halls（公有領域）。
 *   0–4.4      音樂盒前奏
 *   5.6–8      倒數嗶聲、8 秒鳴槍 GO!
 *   8–97.6     樂團 56 小節：第一輪原調、第二輪加琶音、第三輪升 2 個半音
 *   97.6–tape  最後衝刺：鼓聲漸密、貝斯停在屬音
 *   tape–結尾  撞線：鈸 + 最後 4 小節收在主和弦
 */
import { BAR, BEAT } from './recap-music'
import { DECK, DECK_BAR13, DECK_CHORDS, ROOT, createSynth, freq, type Note } from './synth'

export interface MarathonSfx {
  t: number
  kind: 'beep' | 'go' | 'chime' | 'shutter' | 'coin' | 'hop' | 'clear'
}

const UP = 2 ** (2 / 12)
/** 和弦內音（琶音用） */
const TRIAD: Record<string, string[]> = { C: ['C4', 'E4', 'G4'], F: ['F4', 'A4', 'C5'], G: ['G4', 'B4', 'D5'], D: ['D4', 'F#4', 'A4'] }
/** Deck the Halls 第 9 小節起的音符索引 */
const DECK_BAR9 = 34

export function renderMarathonMusic(file: string, t: { intro: number; outro: number; tape: number; dur: number; sfx: MarathonSfx[] }) {
  const s = createSynth(t.dur)
  const lead = (notes: Note[], at: number, mul = 1) => s.melody(notes, at, BEAT, (tt, f, d) => s.square(tt, d, f * mul, 0.16))
  const arp = (at: number, ch: string, mul: number) => {
    const tones = TRIAD[ch]
    for (let i = 0; i < 8; i++) s.square(at + i * (BEAT / 2), BEAT / 2 * 0.8, freq(tones[[0, 1, 2, 1][i % 4]]) * mul, 0.05, 0.125)
  }

  // 前奏
  s.melody(DECK.slice(0, 8), 0.4, 0.5, (tt, f) => s.musicBox(tt, f, 0.22))

  // 樂團：三輪 + 後半
  s.crash(t.intro - 0.03)
  const rounds: [Note[], string[], number, boolean][] = [
    [DECK, DECK_CHORDS, 1, false],
    [DECK, DECK_CHORDS, 1, true],
    [DECK, DECK_CHORDS, UP, true],
    [DECK.slice(DECK_BAR9), DECK_CHORDS.slice(8), UP, true],
  ]
  let bar = 0
  for (const [notes, chords, mul, withArp] of rounds) {
    lead(notes, t.intro + bar * BAR, mul)
    for (const ch of chords) {
      const at = t.intro + bar++ * BAR
      s.bandBar(at, BEAT, ...ROOT[ch], mul)
      if (withArp) arp(at, ch, mul)
    }
  }
  // 第三輪升 Key 時補一聲鈸
  s.crash(t.intro + 32 * BAR - 0.03, 1.2, 0.22)

  // 最後衝刺：貝斯停在屬音、小鼓越來越密、上行音階
  const roll = t.tape - t.outro
  for (let x = 0; x < roll; ) {
    const k = x / roll
    s.snare(t.outro + x, 0.12 + 0.12 * k)
    x += lerpStep(k)
  }
  for (let q = 0; q < Math.floor(roll / BEAT); q++) s.triangle(t.outro + q * BEAT, BEAT * 0.9, freq('G3') * UP, 0.22)
  ;['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5', 'A5', 'B5'].forEach((n, i, arr) => s.square(t.outro + (roll * i) / arr.length, BEAT * 0.8, freq(n) * UP, 0.08, 0.25))

  // 撞線：最後 4 小節
  s.crash(t.tape - 0.03, 2.2, 0.32)
  lead(DECK.slice(DECK_BAR13), t.tape, UP)
  DECK_CHORDS.slice(12).forEach((ch, b) => {
    s.bandBar(t.tape + b * BAR, BEAT, ...ROOT[ch], UP)
    arp(t.tape + b * BAR, ch, UP)
  })

  // 音效
  for (const fx of t.sfx) {
    switch (fx.kind) {
      case 'beep':
        s.square(fx.t, 0.14, freq('A5'), 0.13, 0.5)
        break
      case 'go':
        s.square(fx.t, 0.5, freq('A6'), 0.13, 0.5)
        s.add(fx.t, 0.25, (tt) => s.noise() * 0.45 * Math.exp(-tt * 20))
        break
      case 'chime':
        ;['G5', 'C6', 'E6'].forEach((n, i) => s.square(fx.t + i * 0.06, 0.08, freq(n), 0.09, 0.5))
        break
      case 'shutter':
        s.add(fx.t, 0.03, (tt) => s.noise() * 0.3 * (1 - tt / 0.03))
        s.add(fx.t + 0.05, 0.04, (tt) => s.noise() * 0.22 * (1 - tt / 0.04))
        break
      case 'coin':
        s.square(fx.t, 0.06, freq('B5'), 0.1, 0.5)
        s.square(fx.t + 0.07, 0.2, freq('E6'), 0.1, 0.5)
        break
      case 'hop':
        s.add(fx.t, 0.12, (tt) => ((tt * (400 + tt * 3000)) % 1 < 0.5 ? 1 : -1) * 0.06 * (1 - tt / 0.12))
        break
      case 'clear':
        ;['C5', 'E5', 'G5', 'C6'].forEach((n, i) => s.square(fx.t + i * 0.08, 0.07, freq(n) * UP, 0.11, 0.5))
        break
    }
  }
  s.writeWav(file, 1.2)
}

/** 鼓聲間隔：從八分音符漸密到三十二分音符 */
function lerpStep(k: number) {
  return BEAT / 2 - (BEAT / 2 - BEAT / 8) * k
}
