<script setup lang="ts">
/**
 * 主持畫面（投影用）：顯示代碼、題目、倒數與所有人的角色；主持人在這裡按下一題。
 * 倒數結束時自動公布答案。
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import LeaderBoard from '../components/LeaderBoard.vue'
import QuizArena from '../components/QuizArena.vue'
import { useCountdown } from '../composables/useCountdown'
import { useWakeLock } from '../composables/useWakeLock'
import { ApiError, ERROR_TEXT } from '../lib/api'
import { getGameApi, zoneOf, type GameApi, type GamePlayer, type GameState, type LeaderRow, type Pos } from '../lib/game'

const props = defineProps<{ id: string }>()

// 投影中螢幕不要自動休眠
useWakeLock()

let gapi: GameApi | null = null
const load = ref<'loading' | 'ready' | 'forbidden' | 'missing' | 'error'>('loading')
const err = ref('')
const game = shallowRef<GameState | null>(null)
const players = shallowRef<GamePlayer[]>([])
const board = shallowRef<LeaderRow[]>([])
const positions = new Map<string, Pos>()
const offset = ref(0)
const busy = ref(false)
const arena = ref<InstanceType<typeof QuizArena>>()

const endsAt = computed(() => (game.value?.status === 'question' ? game.value.endsAt : null))
const left = useCountdown(endsAt, offset)
const seconds = computed(() => Math.ceil(left.value / 1000))
const joinUrl = computed(() => `${location.host}/play`)

/** 公布時各區的人數（依畫面上的位置，僅供參考；計分以伺服器為準） */
const zoneCounts = ref<number[]>([])

const message = (e: unknown) => (e instanceof ApiError ? ERROR_TEXT[e.code] : ERROR_TEXT.network)

async function refreshPlayers() {
  if (!gapi) return
  players.value = await gapi.getPlayers(props.id).catch(() => players.value)
}
async function refreshBoard() {
  if (!gapi) return
  board.value = await gapi.leaderboard(props.id).catch(() => board.value)
}

function onState(g: GameState) {
  const prev = game.value
  game.value = g
  if (g.status !== prev?.status && (g.status === 'reveal' || g.status === 'finished')) {
    refreshBoard()
    if (g.status === 'reveal' && g.choices) {
      const counts = g.choices.map(() => 0)
      for (const p of players.value) {
        const pos = positions.get(p.id)
        if (pos !== undefined) counts[zoneOf(pos.x, g.choices.length)]++
      }
      zoneCounts.value = counts
    }
  }
}

let offs: (() => void)[] = []
onMounted(async () => {
  try {
    gapi = await getGameApi()
    if (!(await gapi.isAdmin())) {
      load.value = 'forbidden'
      return
    }
    const [g, off] = await Promise.all([gapi.getGame(props.id), gapi.clockOffset()])
    if (!g) {
      load.value = 'missing'
      return
    }
    offset.value = off
    load.value = 'ready'
    offs = [
      gapi.watch(props.id, { state: onState, players: refreshPlayers }),
      gapi.watchMoves(props.id, {
        move(p, pos) {
          positions.set(p, { x: pos.x, y: pos.y ?? positions.get(p)?.y })
          // 還不在清單上的人（剛加入）補抓一次
          if (!players.value.some((pl) => pl.id === p)) refreshPlayers()
        },
        action: (p, a) => arena.value?.act(p, a),
      }),
    ]
  } catch (e) {
    err.value = message(e)
    load.value = 'error'
  }
})
onBeforeUnmount(() => offs.forEach((f) => f()))

async function run(action: 'next' | 'reveal' | 'finish') {
  if (!gapi || busy.value) return
  busy.value = true
  err.value = ''
  try {
    await gapi[action](props.id)
  } catch (e) {
    err.value = message(e)
  } finally {
    busy.value = false
  }
}

// 時間到自動公布答案（包含打開畫面時就已經超過時間）
watch([left, () => game.value?.status], ([ms, status]) => {
  const end = game.value?.endsAt
  // 再用目前時間確認一次，避免倒數值還沒更新到新題目時誤觸
  if (ms === 0 && status === 'question' && end != null && end <= Date.now() + offset.value) run('reveal')
})

const nextLabel = computed(() => {
  const g = game.value
  if (!g) return ''
  if (g.status === 'waiting') return '▶ 開始第 1 題'
  return g.qIndex + 1 >= g.qTotal ? '▶ 看最終排名' : `▶ 第 ${g.qIndex + 2} 題`
})

const stageEl = ref<HTMLElement>()
function fullscreen() {
  stageEl.value?.requestFullscreen?.().catch(() => {})
}
</script>

<template>
  <main class="wrap">
    <p v-if="load === 'loading'" class="note">讀取中<span class="cursor">…</span></p>
    <section v-else-if="load !== 'ready'" class="win box">
      <p v-if="load === 'forbidden'">這個帳號不是主持人。</p>
      <p v-else-if="load === 'missing'">找不到這個場次。</p>
      <p v-else>{{ err }}</p>
      <RouterLink class="btn" to="/host">▶ 回主持後台</RouterLink>
    </section>

    <template v-else-if="game">
      <section ref="stageEl" class="screen">
        <header class="top">
          <div class="join">
            <span class="muted-on-dark">手機登入 {{ joinUrl }} → 活動專區，輸入代碼</span>
            <b class="code">{{ game.code }}</b>
          </div>
          <div class="count"><b>{{ players.length }}</b> 人加入</div>
        </header>

        <!-- 最終排名 -->
        <div v-if="game.status === 'finished'" class="final">
          <h1 class="title">最終排名</h1>
          <LeaderBoard :rows="board.slice(0, 10)" :total="game.qTotal" class="board" />
          <p v-if="!board.length" class="note">沒有人參加。</p>
        </div>

        <template v-else>
          <div class="question">
            <span v-if="game.qIndex >= 0" class="qno">第 {{ game.qIndex + 1 }} / {{ game.qTotal }} 題</span>
            <p class="prompt">{{ game.status === 'waiting' ? '等待大家加入…' : game.prompt }}</p>
            <span v-if="game.status === 'question'" class="timer" :class="{ urgent: seconds <= 3 }">{{ seconds }}</span>
          </div>
          <QuizArena
            ref="arena"
            class="arena"
            :players="players"
            :positions="positions"
            :choices="game.status === 'waiting' ? null : game.choices"
            :answer="game.status === 'reveal' ? game.answer : null"
            show-names
            :name-size="6.5"
          />
          <div v-if="game.status === 'reveal' && game.choices && game.answer !== null" class="reveal">
            <p>
              正確答案：<b>{{ 'ABCD'[game.answer] }}. {{ game.choices[game.answer] }}</b>
              <span class="muted-on-dark">（站在正確區的約 {{ zoneCounts[game.answer] ?? 0 }} 人）</span>
            </p>
            <LeaderBoard :rows="board.slice(0, 5)" :total="game.qIndex + 1" class="mini" />
          </div>
        </template>
      </section>

      <nav class="controls" aria-label="主持操作">
        <button v-if="game.status === 'waiting' || game.status === 'reveal'" class="btn" type="button" :disabled="busy" @click="run('next')">{{ nextLabel }}</button>
        <button v-if="game.status === 'question'" class="btn" type="button" :disabled="busy" @click="run('reveal')">提早公布答案</button>
        <button class="btn ghost" type="button" @click="fullscreen">全螢幕</button>
        <button v-if="game.status !== 'finished'" class="btn ghost" type="button" :disabled="busy" @click="run('finish')">結束遊戲</button>
        <RouterLink class="back" to="/host">← 主持後台</RouterLink>
      </nav>
      <p v-if="err" class="err" role="alert">{{ err }}</p>
    </template>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 20px 40px;
}
.note {
  color: var(--title);
  text-shadow: var(--text-outline);
}
.box {
  padding: 16px 18px;
}
.screen {
  padding: 16px 20px 20px;
  background: var(--outline);
  color: var(--snow);
}
.screen:fullscreen {
  overflow: auto;
  padding: 2vw 3vw;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.join {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.muted-on-dark {
  color: #94b0c2;
  font-size: 16px;
}
.code {
  font-weight: normal;
  font-size: 40px;
  letter-spacing: 0.12em;
  color: var(--gold);
}
.count {
  font-size: 18px;
}
.count b {
  font-weight: normal;
  font-size: 32px;
  color: var(--gold);
}
.question {
  display: flex;
  align-items: center;
  gap: 18px;
  margin: 14px 0;
}
.qno {
  flex: none;
  padding: 4px 10px;
  background: var(--red);
  font-size: 16px;
}
.prompt {
  flex: 1;
  margin: 0;
  font-size: clamp(22px, 3vw, 44px);
  overflow-wrap: anywhere;
}
.timer {
  flex: none;
  font-size: clamp(36px, 5vw, 72px);
  color: var(--gold);
}
.timer.urgent {
  color: var(--red-hi);
}
.arena {
  /* 依螢幕高度限制寬度，讓題目、場地與主持按鈕同時在畫面內 */
  width: min(100%, calc((100vh - 290px) * 384 / 216));
  margin: 0 auto;
  box-shadow: 0 0 0 4px #333c57;
}
.screen:fullscreen .arena {
  width: min(100%, calc((100vh - 220px) * 384 / 216));
}
.reveal {
  display: grid;
  grid-template-columns: 1fr minmax(260px, 420px);
  gap: 20px;
  align-items: start;
  margin-top: 16px;
}
.reveal p {
  margin: 0;
  font-size: 22px;
}
.reveal b {
  font-weight: normal;
  color: #a7f070;
}
.mini {
  color: var(--ink);
}
.final {
  max-width: 720px;
  margin: 12px auto 0;
  color: var(--ink);
}
.final .title {
  text-align: center;
  margin-bottom: 18px;
}
.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.back {
  margin-left: auto;
  color: var(--title);
  text-shadow: var(--text-outline);
}
.err {
  color: var(--gold);
  text-shadow: var(--text-outline);
}
@media (max-width: 720px) {
  .reveal {
    grid-template-columns: 1fr;
  }
}
</style>
