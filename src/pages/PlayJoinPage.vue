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
      <p>主持人出題後，按住左右鍵把角色移到你選的答案區，時間到時站在哪一區就是你的答案。答對越多題分數越高！</p>
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
.panel {
  margin-top: 22px;
  padding: 16px 18px;
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
  padding: 9px 12px;
  box-shadow:
    -4px 0 0 0 var(--outline),
    4px 0 0 0 var(--outline),
    0 -4px 0 0 var(--outline),
    0 4px 0 0 var(--outline),
    inset 3px 3px 0 0 var(--panel-lo);
}
input:focus {
  outline: 3px dashed var(--gold);
  outline-offset: 8px;
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
