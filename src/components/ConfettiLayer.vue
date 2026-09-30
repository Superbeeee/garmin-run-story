<script setup lang="ts">
/** 全螢幕彩帶（像素方塊），呼叫 burst() 噴一次；不擋滑鼠 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRafLoop } from '../composables/useRafLoop'

const COLORS = ['#ffcd75', '#ef7d57', '#b13e53', '#38b764', '#a7f070', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4']
const el = ref<HTMLCanvasElement>()

interface P {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  spin: number
  phase: number
}
let parts: P[] = []

function resize() {
  const c = el.value
  if (!c) return
  c.width = c.clientWidth
  c.height = c.clientHeight
}
onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => window.removeEventListener('resize', resize))

/** 從畫面兩側下方與中央噴出 */
function burst(count = 260) {
  const c = el.value
  if (!c) return
  resize()
  const w = c.width
  const h = c.height
  const k = Math.max(0.6, Math.min(1.6, w / 1200))
  for (let i = 0; i < count; i++) {
    const from = i % 3
    const x = from === 0 ? 0 : from === 1 ? w : w / 2
    const y = from === 2 ? h * 0.45 : h
    const angle = from === 0 ? -Math.PI / 3 : from === 1 ? (-2 * Math.PI) / 3 : -Math.PI / 2
    const a = angle + (Math.random() - 0.5) * (from === 2 ? Math.PI * 1.6 : 0.7)
    const speed = (from === 2 ? 6 + Math.random() * 10 : 14 + Math.random() * 12) * k
    parts.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: (6 + Math.random() * 8) * k,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      spin: 0.1 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
    })
  }
}
defineExpose({ burst })

useRafLoop((_, dt) => {
  const c = el.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  ctx.clearRect(0, 0, c.width, c.height)
  if (!parts.length) return
  const f = dt / 16.7
  for (const p of parts) {
    p.vy += 0.35 * f
    p.vx *= 0.99
    p.vy *= 0.99
    p.x += p.vx * f
    p.y += p.vy * f
    p.phase += p.spin * f
    // 翻面：寬度隨相位變化
    const w = Math.max(1, Math.abs(Math.cos(p.phase)) * p.size)
    ctx.fillStyle = p.color
    ctx.fillRect(Math.round(p.x - w / 2), Math.round(p.y - p.size / 2), Math.round(w), Math.round(p.size * 0.6))
  }
  parts = parts.filter((p) => p.y < c.height + 40)
})
</script>

<template>
  <canvas ref="el" class="confetti" aria-hidden="true"></canvas>
</template>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 50;
}
</style>
