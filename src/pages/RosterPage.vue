<script setup lang="ts">
/**
 * 管理用名單頁：所有已報名角色在跑道上跑（第二階段遊戲畫面的雛形）。
 * 以網址參數 ?key= 比對 VITE_ROSTER_KEY 保護；key 會打包進前端，只能擋路人。
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import AvatarPortrait from '../components/AvatarPortrait.vue'
import CrowdRunway, { type Runner } from '../components/CrowdRunway.vue'
import { ApiError, ERROR_TEXT, getApi, type Player } from '../lib/api'

const REFRESH_MS = 30_000

const route = useRoute()
const expected = import.meta.env.VITE_ROSTER_KEY
// 開發環境未設定 key 時直接放行
const allowed = computed(() => (expected ? route.query.key === expected : import.meta.env.DEV))

const players = shallowRef<Player[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
const err = ref('')
const updatedAt = ref('')
const runners = computed<Runner[]>(() => players.value.map((p) => ({ id: p.id, name: p.name, config: p.avatar })))

async function load() {
  try {
    players.value = await (await getApi()).list()
    state.value = 'ready'
    err.value = ''
    updatedAt.value = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch (e) {
    err.value = e instanceof ApiError ? ERROR_TEXT[e.code] : ERROR_TEXT.network
    if (state.value === 'loading') state.value = 'error'
  }
}

let timer = 0
onMounted(() => {
  if (!allowed.value) return
  load()
  timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') load()
  }, REFRESH_MS)
})
onBeforeUnmount(() => clearInterval(timer))

// 全螢幕（投影用）
const stageEl = ref<HTMLElement>()
function fullscreen() {
  stageEl.value?.requestFullscreen?.().catch(() => {})
}

const fmt = (iso: string) => new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <main class="wrap">
    <template v-if="!allowed">
      <h1>沒有權限</h1>
      <p class="muted">這個頁面需要主辦人提供的網址。</p>
    </template>
    <template v-else>
      <header>
        <h1 class="title">報名名單</h1>
        <p class="status">
          <template v-if="state === 'ready'">
            <span class="count">{{ players.length }}</span> 位跑者已報名 · {{ updatedAt }} 更新（每 30 秒自動更新）
          </template>
          <template v-else-if="state === 'loading'">讀取中<span class="cursor">…</span></template>
        </p>
        <p v-if="err" class="err" role="alert">{{ err }}</p>
      </header>

      <template v-if="state === 'ready'">
        <section ref="stageEl" class="stage">
          <CrowdRunway :runners="runners" show-names />
        </section>
        <div class="tools">
          <button class="btn ghost" type="button" @click="fullscreen">全螢幕</button>
          <button class="btn ghost" type="button" @click="load">立即更新</button>
        </div>

        <p v-if="!players.length" class="win empty">還沒有人報名。</p>
        <ol v-else class="list">
          <li v-for="p in players" :key="p.id" class="win">
            <AvatarPortrait :config="p.avatar" :label="p.name" />
            <div>
              <b>{{ p.name }}</b>
              <span class="muted">{{ fmt(p.createdAt) }}</span>
            </div>
          </li>
        </ol>
      </template>
    </template>
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
.stage {
  margin-top: 18px;
  padding: 6px;
  background: var(--outline);
}
.stage:fullscreen {
  display: flex;
  align-items: center;
  background: #000;
  padding: 0;
}
.tools {
  display: flex;
  gap: 8px;
  margin: 12px 0 24px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}
.list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  min-width: 0;
}
.empty {
  margin-top: 8px;
}
.list canvas {
  width: 40px;
  height: 62px;
  flex: none;
}
.list div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.list b {
  font-weight: normal;
  overflow-wrap: anywhere;
}
.list span {
  font-size: 12px;
}
@media (max-width: 520px) {
  .wrap {
    padding: 20px 16px 40px;
  }
}
</style>
