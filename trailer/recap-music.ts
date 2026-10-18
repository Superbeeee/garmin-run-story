/**
 * 年度回顧影片配樂：8-bit Jingle Bells 完整版（主歌 + 副歌，公有領域）。
 * 一小節 1.6 秒（150 bpm），每個關卡剛好 8 小節，換關時就是換樂句。
 *   0–8        音樂盒前奏，6.6 秒「按下 START」音效
 *   8–97.6     樂團：主歌 16 + 副歌 16 + 主歌 16 + 副歌後 8 小節
 *   97.6–100.8 最後一站：音樂盒
 *   100.8–108  片尾：副歌最後 4 小節收在主和弦
 */
import { JB_CHORUS, JB_CHORUS_CHORDS, JB_CHORUS_HALF, JB_VERSE, JB_VERSE_CHORDS, ROOT, createSynth, freq, type Note } from './synth'

/** 畫面同步的音效：抵達旗子、轉場、拍照、過關 */
export interface Sfx {
  t: number
  kind: 'chime' | 'whoosh' | 'shutter' | 'clear'
}

export const BEAT = 0.4
export const BAR = BEAT * 4
/** 副歌第 13 小節的音符索引 */
const CHORUS_BAR13 = JB_CHORUS_HALF + 11

export function renderRecapMusic(file: string, t: { intro: number; outro: number; finale: number; dur: number; start: number; sfx: Sfx[] }) {
  const s = createSynth(t.dur)
  const lead = (notes: Note[], at: number) => s.melody(notes, at, BEAT, (tt, f, d) => s.square(tt, d, f, 0.16))

  // 前奏：音樂盒
  s.melody(JB_CHORUS.slice(0, 11), 0.2, 0.5, (tt, f) => s.musicBox(tt, f, 0.22))
  // 按下 START：兩聲上揚的方波
  s.square(t.start, 0.08, freq('B5'), 0.14, 0.5)
  s.square(t.start + 0.09, 0.32, freq('E6'), 0.14, 0.5)

  // 主體：樂團
  s.crash(t.intro - 0.03)
  const parts: [Note[], string[]][] = [
    [JB_VERSE, JB_VERSE_CHORDS],
    [JB_CHORUS, JB_CHORUS_CHORDS],
    [JB_VERSE, JB_VERSE_CHORDS],
    [JB_CHORUS.slice(JB_CHORUS_HALF), JB_CHORUS_CHORDS.slice(8)],
  ]
  let at = t.intro
  let bar = 0
  for (const [notes, chords] of parts) {
    lead(notes, at)
    chords.forEach((ch) => s.bandBar(t.intro + bar++ * BAR, BEAT, ...ROOT[ch]))
    at = t.intro + bar * BAR
  }

  // 最後一站：音樂盒（副歌第 13～14 小節）
  s.crash(t.outro - 0.03, 1.2, 0.2)
  s.melody(JB_CHORUS.slice(CHORUS_BAR13, CHORUS_BAR13 + 9), t.outro, BEAT, (tt, f) => s.musicBox(tt, f, 0.24))

  // 片尾：副歌最後 4 小節 + 主和弦
  s.crash(t.finale - 0.03)
  const end = lead(JB_CHORUS.slice(CHORUS_BAR13), t.finale)
  JB_CHORUS_CHORDS.slice(12).forEach((ch, b) => s.bandBar(t.finale + b * BAR, BEAT, ...ROOT[ch]))
  for (const p of ['C5', 'E5', 'G5', 'C6']) {
    s.add(end, t.dur - end, (tt) => ((tt * freq(p)) % 1 < 0.25 ? 1 : -1) * 0.06 * Math.exp(-tt * 1.2))
  }
  s.add(end, t.dur - end, (tt) => s.noise() * 0.16 * Math.exp(-tt * 2.5))

  // 音效
  for (const fx of t.sfx) {
    switch (fx.kind) {
      case 'chime':
        ;['G5', 'C6', 'E6'].forEach((n, i) => s.square(fx.t + i * 0.06, 0.08, freq(n), 0.09, 0.5))
        break
      case 'whoosh':
        s.add(fx.t, 0.35, (tt) => s.noise() * 0.1 * Math.sin((tt / 0.35) * Math.PI))
        break
      case 'shutter':
        s.add(fx.t, 0.03, (tt) => s.noise() * 0.3 * (1 - tt / 0.03))
        s.add(fx.t + 0.05, 0.04, (tt) => s.noise() * 0.22 * (1 - tt / 0.04))
        break
      case 'clear':
        ;['C5', 'E5', 'G5', 'C6'].forEach((n, i) => s.square(fx.t + i * 0.08, 0.07, freq(n), 0.11, 0.5))
        s.square(fx.t + 0.34, 0.3, freq('E6'), 0.1, 0.5)
        s.square(fx.t + 0.34, 0.3, freq('C6'), 0.08, 0.25)
        break
    }
  }

  s.writeWav(file, 1.2)
}
