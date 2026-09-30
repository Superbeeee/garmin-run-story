<script setup lang="ts">
/**
 * 手機遊戲畫面：看題目與倒數，按住左右鍵移動自己的角色，站在哪一區就是答案。
 * 換區時送出答案（伺服器以截止前最後一次為準）；位置節流後 broadcast 給主持畫面。
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { EMOTES } from '../avatar'
import CreditsFooter from '../components/CreditsFooter.vue'
import LeaderBoard from '../components/LeaderBoard.vue'
import QuizArena from '../components/QuizArena.vue'
import { useCountdown } from '../composables/useCountdown'
import { useRafLoop } from '../composables/useRafLoop'
import { useWakeLock } from '../composables/useWakeLock'
import { ApiError, ERROR_TEXT, getApi } from '../lib/api'
import { getGameApi, zoneOf, type GameAction, type GameApi, type GamePlayer, type GameState, type LeaderRow } from '../lib/game'
import { readJson, writeJson } from '../lib/storage'

const props = defineProps<{ id: string }>()

// 遊戲中螢幕不要自動休眠
useWakeLock()

/** 從最左到最右約 2 秒 */
const SPEED = 0.0005
/** 20 人同時移動約每秒 50 則，留在免費方案每秒 100 則的上限內；主持畫面會補間，看起來仍然連續 */
const SEND_MS = 400
const HEARTBEAT_MS = 5000
const ANSWER_DEBOUNCE_MS = 150
/** 送答案失敗（斷線）後隔多久重送 */
const RETRY_MS = 1000
/** 跳躍與表情的間隔（每人每秒最多 2 次，避免洗版與超過 Realtime 訊息上限） */
const ACTION_COOLDOWN_MS = 500

let gapi: GameApi | null = null
const me = shallowRef<GamePlayer | null>(null)
const game = shallowRef<GameState | null>(null)
const load = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const err = ref('')
const offset = ref(0)
const board = shallowRef<LeaderRow[]>([])

const endsAt = computed(() => (game.value?.status === 'question' ? game.value.endsAt : null))
const left = useCountdown(endsAt, offset)
const seconds = computed(() => Math.ceil(left.value / 1000))
const timeUp = computed(() => game.value?.status === 'question' && left.value === 0)
const players = computed(() => (me.value ? [me.value] : []))
const myRow = computed(() => board.value.find((r) => r.id === me.value?.id) ?? null)

// ---------- 位置 ----------
// 位置存在 sessionStorage：重新整理後回到原本的位置，不會換到別的答案區
const POS_KEY = `xmas-runner:pos:${props.id}`
const session = () => sessionStorage
const savedX = readJson<number>(POS_KEY, session)
let x = typeof savedX === 'number' ? savedX : 0.2 + Math.random() * 0.6
const positions = new Map<string, number>()
/** -1 左、0 停、1 右 */
let held = 0
let lastSent = -1
let lastSentAt = 0

// ---------- 作答 ----------
/** 伺服器已收到的答案（這一題） */
const submitted = ref<number | null>(null)
/** 已送出（或正在送）的區域；與目前站的區域不同時才送 */
let pendingZone: number | null = null
/** 已查過伺服器上自己答案的題號；查完才開始送，避免重新整理後蓋掉原本的答案 */
let readyFor = -1
let retryAt = 0
let answerTimer = 0

/** 每幀呼叫：目前站的區域與已送出的不同就送（換區、新題目、斷線後重送） */
function queueAnswer(now: number) {
  const g = game.value
  // 直接用截止時間判斷：換題的當下倒數值可能還是上一題的 0
  if (!gapi || !g || g.status !== 'question' || !g.choices || g.endsAt === null || g.endsAt <= Date.now() + offset.value) return
  if (readyFor !== g.qIndex || now < retryAt) return
  const zone = zoneOf(x, g.choices.length)
  if (zone === pendingZone) return
  pendingZone = zone
  clearTimeout(answerTimer)
  answerTimer = window.setTimeout(() => {
    const q = g.qIndex
    gapi!
      .setAnswer(g.id, q, zone)
      .then(() => {
        if (game.value?.qIndex === q) submitted.value = zone
      })
      .catch((e) => {
        // 截止就不再送；其他錯誤（多半是斷線）隔一下重送
        if (e instanceof ApiError && e.code === 'too_late') return
        if (pendingZone === zone) pendingZone = submitted.value
        retryAt = performance.now() + RETRY_MS
      })
  }, ANSWER_DEBOUNCE_MS)
}

function onState(g: GameState) {
  const prev = game.value
  game.value = g
  if (g.status === 'question' && (prev?.qIndex !== g.qIndex || prev?.status !== 'question')) {
    submitted.value = null
    pendingZone = null
    retryAt = 0
    // 先查伺服器上這題的答案：重新整理或重連回來時，把角色放回原本的答案區
    const restore = (c: number | null) => {
      if (game.value?.qIndex !== g.qIndex || !g.choices) return
      if (c !== null) {
        submitted.value = c
        pendingZone = c
        if (zoneOf(x, g.choices.length) !== c) setX((c + 0.5) / g.choices.length)
      }
      readyFor = g.qIndex
    }
    gapi?.myAnswer(g.id, g.qIndex).then(restore, () => restore(null))
  }
  if ((g.status === 'reveal' || g.status === 'finished') && prev?.status !== g.status) {
    gapi?.leaderboard(g.id).then((rows) => (board.value = rows), () => {})
  }
}

let unwatch: (() => void) | null = null
onMounted(async () => {
  try {
    gapi = await getGameApi()
    const [mine, off, g] = await Promise.all([(await getApi()).getMine(), gapi.clockOffset(), gapi.getGame(props.id)])
    if (!mine || !g) {
      load.value = 'missing'
      return
    }
    me.value = { id: mine.id, name: mine.name, avatar: mine.avatar }
    offset.value = off
    positions.set(mine.id, x)
    // 直接開網址（例如重新整理）也確保已加入
    if (g.status !== 'finished') await gapi.join(g.code)
    load.value = 'ready'
    unwatch = gapi.watch(props.id, { state: onState })
  } catch (e) {
    err.value = e instanceof ApiError ? ERROR_TEXT[e.code] : ERROR_TEXT.network
    load.value = 'error'
  }
})
onBeforeUnmount(() => {
  unwatch?.()
  clearTimeout(answerTimer)
})

function setX(v: number) {
  x = Math.min(1, Math.max(0, v))
  if (me.value) positions.set(me.value.id, x)
}

useRafLoop((now, dt) => {
  const mine = me.value
  if (!mine || !gapi) return
  if (held) setX(x + held * SPEED * dt)
  queueAnswer(now)
  // 移動中節流送出；停著時偶爾送一次，讓後來打開的主持畫面也知道位置
  const changed = Math.abs(x - lastSent) > 0.001
  if ((changed && now - lastSentAt > SEND_MS) || now - lastSentAt > HEARTBEAT_MS) {
    gapi.sendMove(props.id, mine.id, Math.round(x * 1000) / 1000)
    writeJson(POS_KEY, x, session)
    lastSent = x
    lastSentAt = now
  }
})

// ---------- 跳躍與表情 ----------
const arena = ref<InstanceType<typeof QuizArena>>()
let lastActionAt = -Infinity
function act(a: GameAction) {
  const mine = me.value
  const now = performance.now()
  if (!mine || !gapi || now - lastActionAt < ACTION_COOLDOWN_MS) return
  lastActionAt = now
  arena.value?.act(mine.id, a)
  gapi.sendAction(props.id, mine.id, a)
}

// ---------- 操作 ----------
function press(dir: number, e: PointerEvent) {
  held = dir
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}
function release(dir: number) {
  if (held === dir) held = 0
}
const KEYS: Record<string, number> = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 }
function onKey(e: KeyboardEvent) {
  if (e.type === 'keydown' && !e.repeat) {
    // 空白鍵跳躍、數字鍵 1～8 表情
    if (e.key === ' ') {
      e.preventDefault()
      return act('jump')
    }
    const n = Number(e.key)
    if (n >= 1 && n <= EMOTES.length) return act(n - 1)
  }
  const dir = KEYS[e.key]
  if (!dir) return
  e.preventDefault()
  if (e.type === 'keydown') held = dir
  else release(dir)
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKey)
})

const result = computed(() => {
  const g = game.value
  if (g?.status !== 'reveal' || g.answer === null) return null
  if (submitted.value === null) return { ok: false, text: `這題沒有作答，正確是 ${'ABCD'[g.answer]}` }
  if (submitted.value === g.answer) return { ok: true, text: '答對了！' }
  return { ok: false, text: `答錯了…正確是 ${'ABCD'[g.answer]}` }
})
</script>

<template>
  <main class="wrap">
    <p v-if="load === 'loading'" class="status-line">讀取中<span class="cursor">…</span></p>
    <section v-else-if="load === 'missing'" class="win notice">
      <p>找不到這場遊戲，請回活動專區重新輸入代碼。</p>
      <RouterLink class="btn" to="/play">▶ 輸入代碼</RouterLink>
    </section>
    <section v-else-if="load === 'error'" class="win notice">
      <p>{{ err }}</p>
      <RouterLink class="btn" to="/play">▶ 回活動專區</RouterLink>
    </section>

    <template v-else-if="game">
      <header class="bar">
        <span class="code">{{ game.code }}</span>
        <span v-if="game.qIndex >= 0 && game.status !== 'finished'" class="qno">第 {{ game.qIndex + 1 }} / {{ game.qTotal }} 題</span>
        <span v-if="game.status === 'question'" class="timer" :class="{ urgent: seconds <= 3 }">{{ seconds }}</span>
      </header>

      <!-- 結算 -->
      <template v-if="game.status === 'finished'">
        <h1 class="title">遊戲結束！</h1>
        <div v-if="myRow" class="win mine">
          你是第 <b>{{ myRow.rank }}</b> 名，答對 <b>{{ myRow.score }}</b> / {{ game.qTotal }} 題
        </div>
        <LeaderBoard :rows="board" :me-id="me?.id" :total="game.qTotal" class="board" />
        <RouterLink to="/lobby" class="back">← 回到大廳</RouterLink>
      </template>

      <template v-else>
        <div class="win prompt" aria-live="polite">
          <p v-if="game.status === 'waiting'">等待主持人開始<span class="cursor">…</span><br /><small>先練習左右移動吧！</small></p>
          <p v-else>{{ game.prompt }}</p>
        </div>

        <QuizArena
          ref="arena"
          class="arena"
          :players="players"
          :positions="positions"
          :choices="game.status === 'waiting' ? null : game.choices"
          :answer="game.status === 'reveal' ? game.answer : null"
          :me-id="me?.id"
        />

        <p class="status-line" aria-live="polite">
          <template v-if="result">
            <span :class="result.ok ? 'ok' : 'ng'">{{ result.text }}</span>
            <template v-if="myRow"> 目前 {{ myRow.score }} 分，第 {{ myRow.rank }} 名</template>
          </template>
          <template v-else-if="timeUp">時間到！等待公布答案<span class="cursor">…</span></template>
          <template v-else-if="game.status === 'question' && game.choices">
            你站在 <b>{{ 'ABCD'[submitted ?? -1] ?? '…' }}</b> 區
          </template>
        </p>

        <div class="pad" @contextmenu.prevent>
          <button
            class="btn move"
            type="button"
            aria-label="往左"
            @pointerdown="press(-1, $event)"
            @pointerup="release(-1)"
            @pointercancel="release(-1)"
            @lostpointercapture="release(-1)"
          >
            ◀
          </button>
          <button class="btn move jump" type="button" @click="act('jump')">跳</button>
          <button
            class="btn move"
            type="button"
            aria-label="往右"
            @pointerdown="press(1, $event)"
            @pointerup="release(1)"
            @pointercancel="release(1)"
            @lostpointercapture="release(1)"
          >
            ▶
          </button>
        </div>
        <div class="emotes" aria-label="表情">
          <button v-for="(e, i) in EMOTES" :key="e.face" class="btn ghost emote" type="button" @click="act(i)">{{ e.label }}</button>
        </div>
      </template>
    </template>
    <CreditsFooter v-if="game?.status === 'finished'" class="credits" />
  </main>
</template>

<style scoped>
.wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 16px 32px;
  /* 長按按鈕時不要選取文字或跳出選單 */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--title);
  text-shadow: var(--text-outline);
  min-height: 44px;
}
.code {
  padding: 2px 10px;
  background: var(--outline);
  color: var(--gold);
  text-shadow: none;
  letter-spacing: 0.1em;
}
.qno {
  flex: 1;
}
.timer {
  margin-left: auto;
  font-size: 32px;
  color: var(--gold);
}
.timer.urgent {
  color: var(--red-hi);
}
.prompt {
  margin-top: 10px;
  padding: 14px 16px;
  font-size: 20px;
  min-height: 3.4em;
  display: flex;
  align-items: center;
}
.prompt p {
  margin: 0;
  overflow-wrap: anywhere;
}
.prompt small {
  font-size: 14px;
  color: var(--muted);
}
.arena {
  margin-top: 14px;
  box-shadow: 0 0 0 4px var(--outline);
}
.status-line {
  min-height: 1.6em;
  margin: 14px 0 0;
  text-align: center;
  font-size: 18px;
  color: var(--title);
  text-shadow: var(--text-outline);
}
.ok {
  color: #a7f070;
}
.ng {
  color: var(--red-hi);
}
.pad {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  margin-top: 16px;
}
.move {
  height: 96px;
  font-size: 36px;
  touch-action: none;
}
.jump {
  width: 88px;
  font-size: 22px;
}
.emotes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 18px;
}
.emote {
  padding: 8px 0;
  font-size: 15px;
  touch-action: manipulation;
}
.notice p {
  margin: 0 0 14px;
}
.mine {
  margin: 16px 0 20px;
  padding: 12px 16px;
  font-size: 18px;
}
.mine b {
  font-weight: normal;
  font-size: 26px;
  color: var(--red);
}
.board {
  margin-top: 8px;
}
.back {
  display: inline-block;
  margin-top: 24px;
  color: var(--title);
  text-shadow: var(--text-outline);
}
.credits {
  margin-top: 32px;
}
</style>
