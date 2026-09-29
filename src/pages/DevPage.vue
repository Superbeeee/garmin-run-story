<script setup lang="ts">
/** 開發用：單一角色完整預覽 + 多角色壓力測試（只在 dev server 提供） */
import { computed, ref } from 'vue'
import AvatarStage from '../components/AvatarStage.vue'
import CrowdRunway, { type Runner } from '../components/CrowdRunway.vue'
import { DEFAULT_CONFIG, randomConfig, withGender, type AvatarConfig } from '../avatar'
import { useRafLoop } from '../composables/useRafLoop'

const config = ref<AvatarConfig>({ ...DEFAULT_CONFIG })
const count = ref(30)
const pool = ref<Runner[]>(makeRunners(60))
const runners = computed(() => pool.value.slice(0, count.value))

function makeRunners(n: number): Runner[] {
  return Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: `跑者 ${i + 1}`, config: randomConfig() }))
}

// FPS：每 500ms 統計一次
const fps = ref(0)
let frames = 0
let since = 0
useRafLoop((now) => {
  frames++
  if (!since) since = now
  if (now - since >= 500) {
    fps.value = Math.round((frames * 1000) / (now - since))
    frames = 0
    since = now
  }
})
</script>

<template>
  <main class="dev">
    <h1>角色渲染模組測試</h1>
    <section>
      <h2>單一角色</h2>
      <div class="bar">
        <button class="btn ghost" type="button" @click="config = withGender(config, 'male')">男預設</button>
        <button class="btn ghost" type="button" @click="config = withGender(config, 'female')">女預設</button>
        <button class="btn" type="button" @click="config = randomConfig()">隨機造型</button>
      </div>
      <AvatarStage :config="config" debug />
      <pre class="json">{{ JSON.stringify(config) }}</pre>
    </section>
    <section>
      <h2>多角色壓力測試</h2>
      <div class="bar">
        <label>角色數 <input v-model.number="count" type="range" min="1" max="60" /> {{ count }}</label>
        <button class="btn ghost" type="button" @click="pool = makeRunners(60)">全部重新隨機</button>
        <span class="muted">{{ fps }} fps</span>
      </div>
      <CrowdRunway :runners="runners" show-names />
    </section>
  </main>
</template>

<style scoped>
.dev {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}
section {
  margin-top: 28px;
}
h2 {
  font-size: 18px;
  margin: 0 0 10px;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}
.json {
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--muted);
}
</style>
