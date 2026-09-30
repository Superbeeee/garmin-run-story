<script setup lang="ts">
/**
 * 被抽中時手機跳出的通知。等主持畫面的拉霸動畫跑完（revealAt）才顯示，避免比投影先爆雷。
 * 已看過的抽籤（seq）記在 sessionStorage，換頁不會重複跳。
 */
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { getApi } from '../lib/api'
import { getDrawApi, type DrawResult } from '../lib/draw'
import { getGameApi } from '../lib/game'
import { readJson, writeJson } from '../lib/storage'
import ConfettiLayer from './ConfettiLayer.vue'
import JumpingAvatar from './JumpingAvatar.vue'

const SEEN_KEY = 'xmas-runner:draw-seen'
/** 抽中後多久內打開頁面還會補跳通知 */
const LATE_MS = 60_000

const shown = shallowRef<DrawResult | null>(null)
const confetti = ref<InstanceType<typeof ConfettiLayer>>()
let off: (() => void) | null = null
let timer = 0

const session = () => sessionStorage

onMounted(async () => {
  const [me, offset] = await Promise.all([
    getApi()
      .then((a) => a.getMine())
      .catch(() => null),
    getGameApi()
      .then((g) => g.clockOffset())
      .catch(() => 0),
  ])
  if (!me) return
  off = (await getDrawApi()).watchLatest((seq, r) => {
    if (!r || r.playerId !== me.id || (readJson<number>(SEEN_KEY, session) ?? 0) >= seq) return
    const wait = r.revealAt - (Date.now() + offset)
    if (wait < -LATE_MS) return
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      writeJson(SEEN_KEY, seq, session)
      shown.value = r
      navigator.vibrate?.([200, 100, 200, 100, 400])
      requestAnimationFrame(() => confetti.value?.burst(180))
    }, Math.max(0, wait))
  })
})
onBeforeUnmount(() => {
  off?.()
  clearTimeout(timer)
})
</script>

<template>
  <div v-if="shown" class="overlay" role="alertdialog" aria-labelledby="draw-notice-title">
    <div class="win card">
      <p class="order">第 {{ shown.order }} 位</p>
      <JumpingAvatar class="hero" :config="shown.avatar" celebrate />
      <h2 id="draw-notice-title">你被抽中了！</h2>
      <p>請上台抽禮物 🎁</p>
      <button class="btn" type="button" @click="shown = null">▶ 好！</button>
    </div>
    <ConfettiLayer ref="confetti" />
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(26, 28, 44, 0.75);
}
.card {
  width: min(100%, 360px);
  padding: 20px 20px 22px;
  text-align: center;
  animation: pop 0.6s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}
@keyframes pop {
  from {
    transform: scale(0.3);
    opacity: 0;
  }
}
.order {
  display: inline-block;
  margin: 0;
  padding: 3px 12px;
  color: #fff;
  background: var(--red);
}
.hero {
  display: block;
  height: 160px;
  width: auto;
  margin: 4px auto 0;
}
h2 {
  margin: 0;
  font-size: 30px;
  color: var(--red);
}
p {
  margin: 6px 0 16px;
}
</style>
