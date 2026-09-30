<script setup lang="ts">
/** 大廳：所有已報名角色在跑道上跑，下方是自己的角色與全部名單 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AvatarPortrait from '../components/AvatarPortrait.vue'
import CreditsFooter from '../components/CreditsFooter.vue'
import CrowdRunway, { type Runner } from '../components/CrowdRunway.vue'
import PlayerGrid from '../components/PlayerGrid.vue'
import { ApiError, ERROR_TEXT, getApi, type Player } from '../lib/api'
import { getGameApi, type GameState } from '../lib/game'

const REFRESH_MS = 30_000

const route = useRoute()
const router = useRouter()
/** 剛報名完成（從捏角色頁過來） */
const joined = 'joined' in route.query

const players = shallowRef<Player[]>([])
const me = shallowRef<Player | null>(null)
const email = ref('')
const state = ref<'loading' | 'ready' | 'error'>('loading')
const err = ref('')
const isAdmin = ref(false)
/** 已加入、還沒結束的遊戲 */
const activeGame = shallowRef<GameState | null>(null)
const runners = computed<Runner[]>(() => players.value.map((p) => ({ id: p.id, name: p.name, config: p.avatar })))

async function load() {
  try {
    const api = await getApi()
    const [list, mine, user] = await Promise.all([api.list(), api.getMine(), api.getUser()])
    players.value = list
    me.value = mine
    email.value = user?.email ?? ''
    if (mine) {
      getGameApi()
        .then((g) => g.activeGameOf(mine.id))
        .then((g) => (activeGame.value = g), () => {})
    }
    state.value = 'ready'
    err.value = ''
  } catch (e) {
    err.value = e instanceof ApiError ? ERROR_TEXT[e.code] : ERROR_TEXT.network
    if (state.value === 'loading') state.value = 'error'
  }
}

let timer = 0
onMounted(() => {
  load()
  getGameApi()
    .then((g) => g.isAdmin())
    .then((v) => (isAdmin.value = v), () => {})
  timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') load()
  }, REFRESH_MS)
})
onBeforeUnmount(() => clearInterval(timer))

async function signOut() {
  await (await getApi()).signOut()
  router.replace('/login')
}
</script>

<template>
  <main class="wrap">
    <header>
      <p v-if="joined" class="banner"><span aria-hidden="true">★</span> 報名成功 <span aria-hidden="true">★</span></p>
      <h1 class="title">跑者大廳</h1>
      <p class="status">
        <template v-if="state === 'ready'"><span class="count">{{ players.length }}</span> 位跑者已報名</template>
        <template v-else-if="state === 'loading'">讀取中<span class="cursor">…</span></template>
      </p>
      <p v-if="err" class="err" role="alert">{{ err }}</p>
    </header>

    <section v-if="state === 'error'" class="win notice">
      <p>{{ err }}</p>
      <button class="btn" type="button" @click="load">▶ 再試一次</button>
    </section>

    <template v-if="state === 'ready'">
      <RouterLink v-if="activeGame" class="win event active" :to="{ name: 'game', params: { id: activeGame.id } }">
        <span class="win-tag">活動專區</span>
        <span class="event-title">▶ 繼續遊戲</span>
        <span class="event-desc">你已加入代碼 {{ activeGame.code }} 的搶答跑位，點這裡回到遊戲。</span>
      </RouterLink>
      <RouterLink v-else class="win event" to="/play">
        <span class="win-tag">活動專區</span>
        <span class="event-title">▶ 搶答跑位</span>
        <span class="event-desc">輸入主持人公布的代碼，用手機移動角色搶答！</span>
      </RouterLink>

      <section class="stage" aria-label="所有跑者">
        <CrowdRunway :runners="runners" show-names />
      </section>

      <section v-if="me" class="win mine" aria-label="我的角色">
        <span class="win-tag">我的角色</span>
        <AvatarPortrait :config="me.avatar" :label="me.name" />
        <div class="mine-info">
          <b>{{ me.name }}</b>
          <span class="muted">活動前都可以回來修改造型</span>
        </div>
        <RouterLink class="btn" to="/edit">▶ 修改造型</RouterLink>
      </section>

      <h2 class="section-title">全部跑者</h2>
      <PlayerGrid :players="players" :me-id="me?.id" />
    </template>

    <p class="account">
      已用 {{ email }} 登入 ·
      <template v-if="isAdmin"><RouterLink to="/host">主持後台</RouterLink> · </template>
      <button type="button" class="linklike" @click="signOut">登出</button>
    </p>
    <CreditsFooter class="credits" />
  </main>
</template>

<style scoped>
.wrap {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}
header p {
  margin: 0;
}
/* 金色橫幅，像過關畫面 */
.banner {
  display: inline-block;
  margin: 4px 4px 14px !important;
  padding: 6px 18px 8px;
  font-size: 20px;
  background: var(--gold);
  color: var(--outline);
  box-shadow:
    -4px 0 0 0 var(--outline),
    4px 0 0 0 var(--outline),
    0 -4px 0 0 var(--outline),
    0 4px 0 0 var(--outline),
    inset 0 -4px 0 0 var(--gold-lo);
  animation: pop 0.5s steps(4) both;
}
@keyframes pop {
  from {
    transform: scale(0.4);
  }
  to {
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .banner {
    animation: none;
  }
}
.status {
  margin-top: 10px !important;
  color: var(--title);
  text-shadow: var(--text-outline);
}
.count {
  font-size: 26px;
  color: var(--gold);
}
.err {
  color: var(--gold);
  text-shadow: var(--text-outline);
  margin-top: 6px !important;
}
.notice {
  margin-top: 18px;
}
.notice p {
  margin: 0 0 14px;
}
.event {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 22px;
  padding: 20px 18px 16px;
  text-decoration: none;
  color: var(--ink);
}
.event.active {
  outline: 4px solid var(--gold);
  outline-offset: 4px;
}
.event:hover .event-title {
  color: var(--red);
}
.event-title {
  font-size: 22px;
}
.event-desc {
  font-size: 14px;
  color: var(--muted);
}
.stage {
  margin-top: 22px;
  padding: 6px;
  background: var(--outline);
}
.mine {
  margin-top: 28px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px 14px;
}
.mine canvas {
  width: 48px;
  height: 74px;
  flex: none;
}
.mine-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.mine-info b {
  font-weight: normal;
  font-size: 20px;
  overflow-wrap: anywhere;
}
.mine-info span {
  font-size: 13px;
}
.section-title {
  margin: 32px 0 12px;
  font-size: 20px;
  color: var(--title);
  text-shadow: var(--text-outline);
}
.account {
  margin: 28px 0 0;
  color: var(--title);
  text-shadow: var(--text-outline);
  text-align: center;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.credits {
  margin-top: 28px;
}
@media (max-width: 520px) {
  .wrap {
    padding: 20px 16px 40px;
  }
  .mine {
    flex-wrap: wrap;
  }
  .mine .btn {
    flex: 1 1 100%;
    text-align: center;
  }
}
</style>
