<script setup lang="ts">
/** 活動專區：輸入主持人公布的代碼加入遊戲 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, ERROR_TEXT } from '../lib/api'
import { getGameApi } from '../lib/game'

const router = useRouter()
const code = ref('')
const err = ref('')
const busy = ref(false)

async function join() {
  const c = code.value.trim()
  if (!c) {
    err.value = '請輸入代碼。'
    return
  }
  busy.value = true
  err.value = ''
  try {
    const id = await (await getGameApi()).join(c)
    router.push({ name: 'game', params: { id } })
  } catch (e) {
    err.value = e instanceof ApiError ? ERROR_TEXT[e.code] : ERROR_TEXT.network
    busy.value = false
  }
}
</script>

<template>
  <main class="wrap">
    <p class="kicker">★ 活動專區 ★</p>
    <h1 class="title">搶答跑位</h1>
    <div class="win dialog">
      <p>主持人出題後，按住方向鍵把角色移到你選的答案區，時間到時站在哪一區就是你的答案。答對越多題分數越高！</p>
    </div>
    <form class="win panel" novalidate @submit.prevent="join">
      <label for="code">▶ 遊戲代碼</label>
      <div class="row">
        <input
          id="code"
          v-model="code"
          autocomplete="off"
          autocapitalize="characters"
          enterkeyhint="go"
          maxlength="12"
          placeholder="例如：XMAS"
          @input="err = ''"
        />
        <button class="btn" type="submit" :disabled="busy">{{ busy ? '加入中…' : '加入' }}</button>
      </div>
      <div class="err" role="alert">{{ err }}</div>
    </form>
    <RouterLink to="/lobby" class="back">← 回到大廳</RouterLink>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 560px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}
.kicker {
  display: inline-block;
  margin: 0 0 8px;
  padding: 3px 12px;
  font-size: 14px;
  letter-spacing: 0.12em;
  color: var(--gold-hi);
  background: rgba(20, 27, 38, 0.72);
  border: 1px solid var(--gold-border);
  border-radius: 2px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.dialog {
  margin-top: 18px;
}
.dialog p {
  margin: 0;
}
.panel {
  margin-top: 22px;
  padding: 18px 20px;
}
label {
  display: block;
  font-size: 16px;
  margin-bottom: 8px;
}
.row {
  display: flex;
  gap: 12px;
  align-items: center;
}
input {
  flex: 1;
  min-width: 0;
  margin: 4px;
  font: inherit;
  font-size: 24px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--panel-2);
  border: 0;
  border-radius: 2px;
  padding: 9px 14px;
  box-shadow:
    0 0 0 2px var(--outline),
    0 0 0 3.5px var(--gold-border),
    inset 0 2px 5px rgba(0, 0, 0, 0.18);
  transition:
    box-shadow 150ms ease,
    background-color 150ms ease;
}
input:focus {
  outline: none;
  background: var(--panel-solid);
  box-shadow:
    0 0 0 2px var(--outline),
    0 0 0 4px var(--gold),
    0 0 16px var(--gold-glow),
    inset 0 2px 4px rgba(0, 0, 0, 0.12);
}
input::placeholder {
  letter-spacing: normal;
  text-transform: none;
  color: var(--muted);
}
.err {
  color: var(--danger);
  font-size: 14px;
  margin-top: 8px;
  min-height: 1em;
}
.back {
  display: inline-block;
  margin-top: 20px;
  color: var(--title);
  text-shadow: var(--text-outline);
}
</style>
