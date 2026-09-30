<script setup lang="ts">
/** 登入頁：先用 Google 登入，才能捏角色與進大廳 */
import { ref } from 'vue'
import { DEFAULT_CONFIG } from '../avatar'
import AvatarStage from '../components/AvatarStage.vue'
import CreditsFooter from '../components/CreditsFooter.vue'
import { ERROR_TEXT, getApi } from '../lib/api'

const busy = ref(false)
const err = ref('')

async function signIn() {
  busy.value = true
  err.value = ''
  try {
    // 回到首頁後由路由依報名狀態導到捏角色或大廳
    await (await getApi()).signIn('/')
  } catch {
    err.value = ERROR_TEXT.network
    busy.value = false
  }
}
</script>

<template>
  <main class="wrap">
    <header>
      <p class="kicker">★ 聖誕交換禮物 ★ 跑者報名 ★</p>
      <h1 class="title">聖誕跑者</h1>
    </header>
    <AvatarStage :config="DEFAULT_CONFIG" />
    <div class="win dialog">
      <p>捏一個你的像素跑者，活動當天大家一起用角色玩遊戲！先用 Google 登入，一個帳號可以報名一個角色，之後在任何裝置登入都能修改。</p>
    </div>
    <div class="actions">
      <button class="btn" type="button" :disabled="busy" @click="signIn">{{ busy ? '前往 Google…' : '▶ 用 Google 登入' }}</button>
      <div class="err" role="alert">{{ err }}</div>
    </div>
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
.kicker {
  margin: 0 0 6px;
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--gold);
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
.err {
  color: var(--danger);
  font-size: 14px;
  margin-top: 8px;
  min-height: 1em;
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
