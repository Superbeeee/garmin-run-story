<script setup lang="ts">
/** 報名成功：顯示自己的角色與名字，可修改造型 */
import { onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import type { AvatarConfig } from '../avatar'
import AvatarStage from '../components/AvatarStage.vue'
import CreditsFooter from '../components/CreditsFooter.vue'
import { ApiError, ERROR_TEXT, getApi } from '../lib/api'
import { clearRegistration, getRegistration } from '../lib/registration'

const router = useRouter()
const reg = getRegistration()
const name = ref(reg?.name ?? '')
const config = shallowRef<AvatarConfig | null>(null)
const state = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const err = ref('')

async function load() {
  if (!reg) return router.replace('/')
  state.value = 'loading'
  try {
    const me = await (await getApi()).getMine(reg.id, reg.editToken)
    if (!me) {
      state.value = 'missing'
      return
    }
    name.value = me.name
    config.value = me.avatar
    state.value = 'ready'
  } catch (e) {
    err.value = e instanceof ApiError ? ERROR_TEXT[e.code] : ERROR_TEXT.network
    state.value = 'error'
  }
}
onMounted(load)

function restart() {
  clearRegistration()
  router.replace('/')
}
</script>

<template>
  <main class="wrap">
    <template v-if="state === 'ready' && config">
      <header>
        <p class="banner"><span aria-hidden="true">★</span> 報名成功 <span aria-hidden="true">★</span></p>
        <h1 class="title">{{ name }}</h1>
        <p class="joined">加入了聖誕跑者隊伍！</p>
      </header>
      <AvatarStage :config="config" />
      <div class="win dialog">
        <p>活動當天就用這個角色一起玩！活動前都可以回來修改造型（請用同一支手機、同一個瀏覽器開啟）。</p>
      </div>
      <div class="actions">
        <RouterLink class="btn" to="/edit">▶ 修改造型</RouterLink>
      </div>
    </template>
    <p v-else-if="state === 'loading'" class="loading">讀取中<span class="cursor">…</span></p>
    <section v-else-if="state === 'missing'" class="win notice">
      <h1>找不到你的報名資料</h1>
      <p>可能已被主辦人刪除。你可以重新報名一次。</p>
      <button class="btn" type="button" @click="restart">▶ 重新報名</button>
    </section>
    <section v-else class="win notice">
      <h1>讀取失敗</h1>
      <p>{{ err }}</p>
      <button class="btn" type="button" @click="load">▶ 再試一次</button>
    </section>
    <CreditsFooter class="credits" />
  </main>
</template>

<style scoped>
.wrap {
  max-width: 640px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}
header {
  margin-bottom: 22px;
  text-align: center;
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
.title {
  overflow-wrap: anywhere;
}
.joined {
  margin-top: 8px !important;
  color: var(--title);
  text-shadow: var(--text-outline);
}
.dialog {
  margin-top: 18px;
}
.dialog p {
  margin: 0;
}
.actions {
  margin-top: 20px;
  text-align: center;
}
.loading {
  color: var(--title);
  text-shadow: var(--text-outline);
}
.notice h1 {
  font-size: 22px;
  margin: 0 0 8px;
}
.notice p {
  margin: 0 0 14px;
}
.credits {
  margin-top: 40px;
}
@media (max-width: 520px) {
  .wrap {
    padding: 20px 16px 40px;
  }
}
</style>
