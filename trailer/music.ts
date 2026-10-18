/**
 * 前導影片配樂：8-bit Jingle Bells（公有領域）。
 * 段落對齊分鏡：
 *   0–5    打字音效
 *   5–15   音樂盒版副歌（慢）
 *   15–20  上升琶音 + 雜訊 → 20 秒整點鈸聲
 *   20–58.4 完整 chiptune（主旋律 + 貝斯 + 鼓），最後停在主和弦
 *   58.4–60 和弦餘音淡出
 */
import { JB_CHORUS, JB_CHORUS_CHORDS, JB_CHORUS_HALF, ROOT, createSynth, freq } from './synth'

const DUR = 60

export interface MusicCues {
  /** 打字音效的時間點 */
  typeBlips: number[]
}

export function renderMusic(cues: MusicCues, file: string) {
  const s = createSynth(DUR)
  // 打字音
  cues.typeBlips.forEach((t, i) => s.blip(t, i % 2 ? 988 : 880))

  // 5–15：音樂盒（慢），只放前 5 小節
  s.melody(JB_CHORUS.slice(0, 16), 5.2, 0.5, (t, f) => s.musicBox(t, f, 0.22))

  // 15–19.5：上升琶音 + 雜訊漸強
  const arp = ['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6']
  for (let i = 0, t = 15.2; t < 19.4; i++) {
    const step = 0.28 - 0.2 * ((t - 15.2) / 4.2)
    s.square(t, step * 0.8, freq(arp[i % arp.length]) * (i >= arp.length ? 2 : 1), 0.1 + 0.06 * ((t - 15.2) / 4.2), 0.125)
    t += step
  }
  s.add(16, 3.5, (t) => s.noise() * 0.12 * (t / 3.5) ** 2)
  // 20：鈸聲
  s.crash(19.97)

  // 20–58.4：完整 chiptune，150 bpm（一拍 0.4 秒）：副歌 16 小節，接後 8 小節收尾
  const beat = 0.4
  const t0 = 20
  let t = s.melody(JB_CHORUS, t0, beat, (at, f, d) => s.square(at, d, f, 0.16))
  t = s.melody(JB_CHORUS.slice(JB_CHORUS_HALF), t, beat, (at, f, d) => s.square(at, d, f, 0.16))
  const bars = [...JB_CHORUS_CHORDS, ...JB_CHORUS_CHORDS.slice(8)]
  bars.forEach((ch, b) => s.bandBar(t0 + b * beat * 4, beat, ...ROOT[ch]))

  // 58.4：主和弦長音淡出
  const end = t0 + bars.length * beat * 4
  for (const p of ['C5', 'E5', 'G5', 'C6']) {
    s.add(end, DUR - end, (tt) => ((tt * freq(p)) % 1 < 0.25 ? 1 : -1) * 0.06 * Math.exp(-tt * 1.4))
  }
  s.add(end, DUR - end, (tt) => s.noise() * 0.18 * Math.exp(-tt * 2.5))

  s.writeWav(file)
  return { chorusEnd: end }
}
