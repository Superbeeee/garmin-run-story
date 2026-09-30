<script setup lang="ts">
/**
 * 接力抽禮物的主持畫面（投影用）：拉霸機。
 * 按下拉桿時伺服器先決定抽中的人，畫面再用滾輪動畫慢慢停到那個人身上。
 * 抽中的人上台拿禮物後，按「抽下一位」接力，直到籤池抽完。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { DEFAULT_CONFIG } from '../avatar'
import AvatarPortrait from '../components/AvatarPortrait.vue'
import ConfettiLayer from '../components/ConfettiLayer.vue'
import JumpingAvatar from '../components/JumpingAvatar.vue'
import { useRafLoop } from '../composables/useRafLoop'
import { ApiError, ERROR_TEXT } from '../lib/api'
import { getDrawApi, type DrawApi, type DrawEntry, type DrawResult } from '../lib/draw'
import { getGameApi } from '../lib/game'
import { isMuted, setMuted, sfxDrum, sfxFanfare, sfxFinale, sfxLever, sfxTick } from '../lib/sfx'

/** 滾輪動畫總長（含最後回彈） */
const SPIN_MS = 6500
const SETTLE_MS = 500
/** 最後停下前多轉過頭的格數，回彈到正確位置 */
const OVERSHOOT = 0.35
/** 至少轉過幾格 */
const MIN_ITEMS = 42

let api: DrawApi | null = null
const load = ref<'loading' | 'ready' | 'forbidden' | 'error'>('loading')
const err = ref('')
const pool = shallowRef<DrawEntry[]>([])
const phase = ref<'idle' | 'spinning' | 'win'>('idle')
const winner = shallowRef<DrawResult | null>(null)
const muted = ref(isMuted())

const history = computed(() => pool.value.filter((e) => e.order !== null).sort((a, b) => a.order! - b.order!))
const remaining = computed(() => pool.value.filter((e) => !e.excluded && e.order === null))
const last = computed(() => winner.value ?? (history.value.length ? toResult(history.value.at(-1)!) : null))
const finished = computed(() => phase.value !== 'spinning' && remaining.value.length === 0 && history.value.length > 0)

function toResult(e: DrawEntry): DrawResult {
  return { id: e.id, playerId: e.playerId, name: e.name, avatar: e.avatar, order: e.order ?? 0, revealAt: 0 }
}
const message = (e: unknown) => (e instanceof ApiError ? ERROR_TEXT[e.code] : ERROR_TEXT.network)

async function refresh() {
  if (api) pool.value = await api.pool()
}

onMounted(async () => {
  try {
    if (!(await (await getGameApi()).isAdmin())) {
      load.value = 'forbidden'
      return
    }
    api = await getDrawApi()
    await refresh()
    load.value = 'ready'
  } catch (e) {
    err.value = message(e)
    load.value = 'error'
  }
})

// ---------- 滾輪 ----------
interface ReelItem {
  key: string
  name: string
  avatar: DrawEntry['avatar']
}
const strip = shallowRef<ReelItem[]>([])
const reelEl = ref<HTMLElement>()
/** 目前最上面那格的位置（格數，可為小數）；窗格顯示 3 格，中間那格為結果 */
const pos = ref(0)
const blur = ref(0)
let itemH = 0
let spin: { start: number; distance: number; lastIndex: number; lastDrum: number } | null = null

const shuffle = <T,>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/** 滾輪內容：候選人隨機排好幾輪，最後一格前後放別人、中間是抽中的人 */
function buildStrip(candidates: DrawEntry[], win: DrawResult): { items: ReelItem[]; target: number } {
  const base = candidates.length ? candidates : [{ ...win, excluded: false, order: null } as DrawEntry]
  const items: ReelItem[] = []
  let n = 0
  const push = (e: { id: string; name: string; avatar: DrawEntry['avatar'] }) => items.push({ key: `${n++}-${e.id}`, name: e.name, avatar: e.avatar })
  while (items.length < MIN_ITEMS) for (const e of shuffle(base)) push(e)
  const others = base.filter((e) => e.id !== win.id)
  const filler = () => (others.length ? others[Math.floor(Math.random() * others.length)] : base[0])
  push(filler())
  const target = items.length
  push(win)
  push(filler())
  push(filler())
  return { items, target }
}

const easeOutQuart = (u: number) => 1 - Math.pow(1 - u, 4)

useRafLoop((now) => {
  if (!spin) return
  const t = now - spin.start
  const main = SPIN_MS - SETTLE_MS
  let p: number
  if (t < main) {
    p = (spin.distance + OVERSHOOT) * easeOutQuart(t / main)
  } else {
    const v = Math.min(1, (t - main) / SETTLE_MS)
    p = spin.distance + OVERSHOOT * Math.pow(1 - v, 2) * Math.cos(v * Math.PI * 1.5)
  }
  const speed = Math.abs(p - pos.value)
  pos.value = p
  blur.value = Math.min(5, speed * 6)
  // 每經過一格「喀」一聲；最後兩秒小鼓越打越快
  const idx = Math.floor(p + 0.5)
  if (idx !== spin.lastIndex) {
    sfxTick(1 + Math.min(1, speed))
    spin.lastIndex = idx
  }
  const left = SPIN_MS - t
  if (left < 2200 && now - spin.lastDrum > Math.max(45, left / 18)) {
    sfxDrum(1 - left / 2200)
    spin.lastDrum = now
  }
  if (t >= SPIN_MS) {
    pos.value = spin.distance
    blur.value = 0
    spin = null
    win()
  }
})

// ---------- 操作 ----------
const lever = ref(false)
const busy = ref(false)
const confetti = ref<InstanceType<typeof ConfettiLayer>>()

async function pull() {
  if (!api || busy.value || phase.value === 'spinning') return
  busy.value = true
  err.value = ''
  lever.value = true
  sfxLever()
  setTimeout(() => (lever.value = false), 450)
  try {
    const before = await api.pool()
    const candidates = before.filter((e) => !e.excluded && e.order === null)
    if (!candidates.length) {
      pool.value = before
      throw new ApiError('pool_empty')
    }
    const r = await api.next(SPIN_MS)
    const { items, target } = buildStrip(candidates, r)
    winner.value = r
    strip.value = items
    pos.value = 0
    phase.value = 'spinning'
    await nextTick()
    itemH = reelEl.value?.querySelector<HTMLElement>('.item')?.offsetHeight ?? 1
    spin = { start: performance.now(), distance: target - 1, lastIndex: 0, lastDrum: 0 }
  } catch (e) {
    err.value = message(e)
    busy.value = false
  }
}

async function win() {
  phase.value = 'win'
  busy.value = false
  await refresh().catch(() => {})
  confetti.value?.burst()
  setTimeout(() => confetti.value?.burst(160), 700)
  if (remaining.value.length === 0) {
    sfxFinale()
    setTimeout(() => confetti.value?.burst(300), 1500)
  } else {
    sfxFanfare()
  }
}

const reelStyle = computed(() => ({
  transform: `translateY(${-pos.value * itemH}px)`,
  filter: blur.value > 0.3 ? `blur(${blur.value.toFixed(1)}px)` : 'none',
}))

const buttonLabel = computed(() => {
  if (phase.value === 'spinning') return '抽籤中…'
  if (!history.value.length) return '▶ 拉下拉桿，抽出第一位！'
  return `▶ ${last.value?.name} 抽下一位`
})

function toggleMute() {
  muted.value = !muted.value
  setMuted(muted.value)
}
const stageEl = ref<HTMLElement>()
function fullscreen() {
  stageEl.value?.requestFullscreen?.().catch(() => {})
}
// 空白鍵或 Enter 也能拉桿（方便主持人用簡報筆）
function onKey(e: KeyboardEvent) {
  if ((e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault()
    if (!finished.value) pull()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <main class="wrap">
    <p v-if="load === 'loading'" class="note">讀取中<span class="cursor">…</span></p>
    <section v-else-if="load !== 'ready'" class="win box">
      <p>{{ load === 'forbidden' ? '這個帳號不是主持人。' : err }}</p>
      <RouterLink class="btn" to="/host">▶ 回主持後台</RouterLink>
    </section>

    <template v-else>
      <section ref="stageEl" class="stage" :class="phase">
        <div class="rays" aria-hidden="true"></div>
        <div class="flash" aria-hidden="true"></div>

        <header class="marquee">
          <span class="star">★</span> 聖誕交換禮物 <span class="star">★</span> 接力抽籤機 <span class="star">★</span>
        </header>

        <div class="machine">
          <div class="cabinet">
            <div class="bulbs" aria-hidden="true">
              <i v-for="n in 36" :key="n" :style="{ '--i': n }"></i>
            </div>

            <div class="window" aria-live="polite">
              <div class="payline" aria-hidden="true"><span>▶</span><span>◀</span></div>
              <!-- 還沒抽：三個禮物盒 -->
              <div v-if="phase === 'idle'" class="reel idle">
                <div v-for="n in 3" :key="n" class="item">
                  <span class="gift">?</span>
                  <span class="name">{{ n === 2 ? (finished ? '全部抽完了！' : last ? `上一位：${last.name}` : '誰會是第一位？') : '？？？' }}</span>
                </div>
              </div>
              <div v-else ref="reelEl" class="reel" :style="reelStyle">
                <div v-for="it in strip" :key="it.key" class="item">
                  <AvatarPortrait :config="it.avatar ?? DEFAULT_CONFIG" :label="it.name" />
                  <span class="name">{{ it.name }}</span>
                </div>
              </div>
            </div>

            <button class="lever" :class="{ pulled: lever }" type="button" aria-label="拉桿" :disabled="busy || finished" @click="pull">
              <span class="stick"></span><span class="knob"></span>
            </button>
          </div>

          <!-- 抽中 -->
          <div v-if="phase === 'win' && winner" class="winner">
            <p class="order">第 {{ winner.order }} 位</p>
            <JumpingAvatar class="hero" :config="winner.avatar" celebrate />
            <h1 class="wname">{{ winner.name }}</h1>
            <p class="call">{{ finished ? '最後一位！全部抽完了，聖誕快樂！' : '請上台抽禮物！' }}</p>
          </div>
        </div>

        <div class="controls">
          <button v-if="!finished" class="btn pull" type="button" :disabled="busy" @click="pull">{{ buttonLabel }}</button>
          <p class="left">籤池還有 <b>{{ remaining.length }}</b> 人 · 已抽 {{ history.length }} 人</p>
        </div>
        <p v-if="err" class="err" role="alert">{{ err }}</p>

        <ol v-if="history.length" class="history">
          <li v-for="h in history" :key="h.id" :class="{ now: phase !== 'spinning' && h.id === last?.id }">
            <span class="no">{{ h.order }}</span>{{ h.name }}
          </li>
        </ol>
      </section>

      <nav class="tools">
        <button class="btn ghost" type="button" @click="toggleMute">{{ muted ? '🔇 音效關' : '🔊 音效開' }}</button>
        <button class="btn ghost" type="button" @click="fullscreen">全螢幕</button>
        <button class="btn ghost" type="button" :disabled="busy" @click="refresh">重新整理籤池</button>
        <RouterLink class="back" to="/host">← 主持後台</RouterLink>
      </nav>
      <ConfettiLayer ref="confetti" />
    </template>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px 20px 32px;
}
.note {
  color: var(--title);
  text-shadow: var(--text-outline);
}
.box {
  padding: 16px 18px;
}

/* ---------- 舞台 ---------- */
.stage {
  --gold: #ffcd75;
  --bulb-speed: 1.2s;
  position: relative;
  overflow: hidden;
  padding: 18px 24px 22px;
  background: radial-gradient(ellipse at 50% 30%, #3b1d4a 0%, #1a1c2c 70%);
  color: var(--snow);
  min-height: min(86vh, 900px);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stage.spinning {
  --bulb-speed: 0.25s;
}
.stage:fullscreen {
  min-height: 100vh;
  justify-content: center;
}
/* 抽中時背後旋轉的光束 */
.rays {
  position: absolute;
  left: 50%;
  top: 45%;
  width: 220vmax;
  height: 220vmax;
  margin: -110vmax 0 0 -110vmax;
  background: repeating-conic-gradient(from 0deg, rgba(255, 205, 117, 0.16) 0deg 8deg, transparent 8deg 20deg);
  opacity: 0;
  transition: opacity 0.6s;
  animation: spin 14s linear infinite;
  pointer-events: none;
}
.win .rays {
  opacity: 1;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.flash {
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  pointer-events: none;
}
.win .flash {
  animation: flash 0.7s ease-out;
}
@keyframes flash {
  from {
    opacity: 0.9;
  }
  to {
    opacity: 0;
  }
}

.marquee {
  position: relative;
  padding: 8px 26px 10px;
  font-size: clamp(20px, 2.6vw, 34px);
  color: var(--outline);
  background: linear-gradient(#ffe2a3, var(--gold));
  box-shadow:
    0 0 0 4px var(--outline),
    0 0 0 8px #b13e53,
    0 0 0 12px var(--outline),
    0 0 30px 10px rgba(255, 205, 117, 0.35);
  z-index: 1;
}
.star {
  color: #b13e53;
  display: inline-block;
  animation: twinkle 0.9s steps(2) infinite;
}
@keyframes twinkle {
  50% {
    color: #38b764;
  }
}

/* ---------- 拉霸機 ---------- */
/* 抽中卡片疊在拉霸機上，不蓋住下方按鈕 */
.machine {
  position: relative;
  z-index: 1;
  margin-top: 30px;
}
.cabinet {
  position: relative;
  padding: 26px 30px;
  display: flex;
  align-items: center;
  gap: 26px;
  background: linear-gradient(#c0374f, #7a1f3a);
  box-shadow:
    0 0 0 4px var(--outline),
    inset 0 6px 0 0 #ef7d57,
    inset 0 -8px 0 0 #5d275d,
    0 18px 0 -4px #3d1530;
}
.bulbs {
  position: absolute;
  inset: 8px;
  pointer-events: none;
}
.bulbs i {
  --n: 36;
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff3c4;
  box-shadow: 0 0 0 2px var(--outline);
  animation: chase var(--bulb-speed) steps(1) infinite;
  animation-delay: calc(var(--bulb-speed) * var(--i) / 6 * -1);
}
/* 燈泡沿著外框排：上 12、右 6、下 12、左 6 */
.bulbs i:nth-child(-n + 12) {
  top: 0;
  left: calc((var(--i) - 1) / 11 * (100% - 10px));
}
.bulbs i:nth-child(n + 13):nth-child(-n + 18) {
  right: 0;
  top: calc((var(--i) - 12) / 7 * (100% - 10px));
}
.bulbs i:nth-child(n + 19):nth-child(-n + 30) {
  bottom: 0;
  right: calc((var(--i) - 19) / 11 * (100% - 10px));
}
.bulbs i:nth-child(n + 31) {
  left: 0;
  bottom: calc((var(--i) - 30) / 7 * (100% - 10px));
}
@keyframes chase {
  0% {
    background: #fff3c4;
    box-shadow:
      0 0 0 2px var(--outline),
      0 0 12px 4px rgba(255, 243, 196, 0.9);
  }
  33% {
    background: #7a5a2a;
    box-shadow: 0 0 0 2px var(--outline);
  }
}
.win .bulbs i {
  animation: party 0.3s steps(1) infinite;
  animation-delay: calc(var(--i) * -0.1s);
}
@keyframes party {
  0% {
    background: #ffcd75;
    box-shadow:
      0 0 0 2px var(--outline),
      0 0 14px 5px #ffcd75;
  }
  33% {
    background: #73eff7;
    box-shadow:
      0 0 0 2px var(--outline),
      0 0 14px 5px #73eff7;
  }
  66% {
    background: #a7f070;
    box-shadow:
      0 0 0 2px var(--outline),
      0 0 14px 5px #a7f070;
  }
}

.window {
  --item-h: clamp(96px, 13vh, 150px);
  position: relative;
  width: min(62vw, 640px);
  height: calc(var(--item-h) * 3);
  overflow: hidden;
  background: linear-gradient(#e9eef3, #fff 45%, #fff 55%, #e9eef3);
  box-shadow:
    0 0 0 6px var(--outline),
    inset 0 18px 18px -8px rgba(0, 0, 0, 0.45),
    inset 0 -18px 18px -8px rgba(0, 0, 0, 0.45);
}
.payline {
  position: absolute;
  left: 0;
  right: 0;
  top: var(--item-h);
  height: var(--item-h);
  border-top: 4px solid #b13e53;
  border-bottom: 4px solid #b13e53;
  background: rgba(255, 205, 117, 0.18);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #b13e53;
  font-size: 28px;
  z-index: 2;
  pointer-events: none;
}
.win .payline {
  animation: glow 0.5s steps(2) infinite;
}
@keyframes glow {
  50% {
    background: rgba(255, 205, 117, 0.55);
  }
}
.reel {
  will-change: transform;
}
.item {
  height: var(--item-h);
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 60px;
  color: var(--outline);
}
.item canvas {
  height: 88%;
  width: auto;
  aspect-ratio: 40 / 62;
  flex: none;
}
.item .name {
  font-size: clamp(28px, 4.2vw, 54px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gift {
  flex: none;
  display: grid;
  place-items: center;
  width: calc(var(--item-h) * 0.62);
  height: calc(var(--item-h) * 0.62);
  font-size: calc(var(--item-h) * 0.38);
  color: #fff;
  background: linear-gradient(90deg, #38b764 0 42%, #ffcd75 42% 58%, #38b764 58%);
  box-shadow: 0 0 0 4px var(--outline);
}
.reel.idle .item:not(:nth-child(2)) {
  opacity: 0.35;
}

/* 拉桿 */
.lever {
  position: relative;
  width: 60px;
  height: 240px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  flex: none;
}
.lever:disabled {
  cursor: default;
}
.stick {
  position: absolute;
  left: 50%;
  bottom: 20px;
  width: 14px;
  height: 180px;
  margin-left: -7px;
  background: linear-gradient(90deg, #8b9bb4, #f4f4f4, #8b9bb4);
  box-shadow: 0 0 0 3px var(--outline);
  transform-origin: 50% 100%;
  transition: transform 0.2s cubic-bezier(0.5, 1.8, 0.5, 1);
}
.knob {
  position: absolute;
  left: 50%;
  top: 0;
  width: 48px;
  height: 48px;
  margin-left: -24px;
  background: radial-gradient(circle at 35% 35%, #ff8f8f, #b13e53 60%);
  box-shadow: 0 0 0 4px var(--outline);
  transition: transform 0.2s cubic-bezier(0.5, 1.8, 0.5, 1);
}
.lever::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 44px;
  height: 30px;
  margin-left: -22px;
  background: #3d1530;
  box-shadow: 0 0 0 4px var(--outline);
}
.lever.pulled .stick {
  transform: scaleY(0.35);
}
.lever.pulled .knob {
  transform: translateY(117px);
}
.lever:not(:disabled):hover .knob {
  filter: brightness(1.15);
}

/* ---------- 抽中 ---------- */
.winner {
  position: absolute;
  z-index: 3;
  left: 50%;
  top: 50%;
  width: min(92vw, 820px);
  padding: 18px 24px 22px;
  transform: translate(-50%, -50%);
  text-align: center;
  background: rgba(26, 28, 44, 0.9);
  box-shadow:
    0 0 0 6px var(--gold),
    0 0 0 10px var(--outline),
    0 0 80px 20px rgba(255, 205, 117, 0.45);
  animation: zoom 0.7s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}
@keyframes zoom {
  from {
    transform: translate(-50%, -50%) scale(0.2) rotate(-8deg);
    opacity: 0;
  }
  to {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}
.order {
  display: inline-block;
  margin: 0;
  padding: 4px 16px;
  font-size: clamp(18px, 2vw, 26px);
  background: #b13e53;
}
.hero {
  display: block;
  height: clamp(120px, 18vh, 220px);
  width: auto;
  margin: 6px auto 0;
}
.wname {
  margin: 0;
  font-size: clamp(44px, 6vw, 96px);
  line-height: 1.1;
  color: var(--gold);
  text-shadow:
    4px 4px 0 #b13e53,
    8px 8px 0 var(--outline);
  overflow-wrap: anywhere;
  animation: shimmer 1.2s steps(2) infinite;
}
@keyframes shimmer {
  50% {
    color: #fff3c4;
  }
}
.call {
  margin: 12px 0 0;
  font-size: clamp(20px, 2.4vw, 32px);
}

/* ---------- 下方 ---------- */
.controls {
  position: relative;
  z-index: 4;
  margin-top: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.pull {
  font-size: clamp(20px, 2.4vw, 30px);
  padding: 12px 28px;
}
.left {
  margin: 0;
  color: #94b0c2;
}
.left b {
  font-weight: normal;
  color: var(--gold);
  font-size: 1.4em;
}
.err {
  position: relative;
  z-index: 4;
  color: var(--gold);
}
.history {
  position: relative;
  z-index: 1;
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  max-width: 100%;
}
.history li {
  padding: 3px 10px 4px 4px;
  background: #333c57;
  box-shadow: 0 0 0 2px var(--outline);
  font-size: 15px;
}
.history li.now {
  background: #b13e53;
}
.no {
  display: inline-block;
  min-width: 1.6em;
  margin-right: 6px;
  text-align: center;
  background: var(--outline);
  color: var(--gold);
}
.tools {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 14px;
}
.back {
  margin-left: auto;
  color: var(--title);
  text-shadow: var(--text-outline);
}
@media (max-width: 720px) {
  .cabinet {
    padding: 18px;
    gap: 12px;
  }
  .lever {
    width: 44px;
    height: 180px;
  }
  .stick {
    height: 130px;
  }
  .lever.pulled .knob {
    transform: translateY(80px);
  }
  .item {
    padding: 0 20px;
    gap: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .rays,
  .bulbs i,
  .star,
  .wname {
    animation: none;
  }
}
</style>
