<script setup lang="ts">
/**
 * 多角色跑道：所有角色在同一張 canvas 上各自跑、走、停、跳、做表情。
 * 名字畫在另一張高解析度的疊加 canvas，避免像素放大後文字糊掉。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AvatarActor, EMOTES, drawAvatar, preloadAvatar, type AvatarConfig, type MoveMode } from '../avatar'
import { useRafLoop } from '../composables/useRafLoop'
import { drawCrowdTrack } from '../scene/track'

export interface Runner {
  id: string
  name?: string
  config: AvatarConfig
}

const props = defineProps<{
  runners: Runner[]
  showNames?: boolean
}>()

const W = computed(() => (props.runners.length > 20 ? 480 : 384))
const H = computed(() => Math.round((W.value * 9) / 16))
const TRACK_TOP = 72
const MARGIN = 20

const canvasEl = ref<HTMLCanvasElement>()
const labelsEl = ref<HTMLCanvasElement>()

interface Sprite {
  runner: Runner
  actor: AvatarActor
  x: number
  y: number
  dir: number
  ready: boolean
  nextMode: number
  nextEmote: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
function pickMode(): MoveMode {
  const r = Math.random()
  return r < 0.6 ? 'run' : r < 0.9 ? 'walk' : 'idle'
}

let sprites: Sprite[] = []

/** 依 runners 更新精靈清單，保留既有角色的位置與動作 */
watch(
  () => props.runners,
  (runners) => {
    const old = new Map(sprites.map((s) => [s.runner.id, s]))
    const now = performance.now()
    sprites = runners.map((r) => {
      const prev = old.get(r.id)
      if (prev) {
        if (prev.runner.config !== r.config) {
          prev.ready = false
          preloadAvatar(r.config).then(() => (prev.ready = true), () => {})
        }
        prev.runner = r
        return prev
      }
      const actor = new AvatarActor()
      actor.setMode(pickMode())
      const s: Sprite = {
        runner: r,
        actor,
        x: rand(MARGIN, W.value - MARGIN),
        y: rand(TRACK_TOP + 40, H.value - 6),
        dir: Math.random() < 0.5 ? -1 : 1,
        ready: false,
        nextMode: now + rand(2000, 8000),
        nextEmote: now + rand(1500, 12000),
      }
      preloadAvatar(r.config).then(() => (s.ready = true), () => {})
      return s
    })
  },
  { immediate: true },
)

// 寬度改變時把角色收回畫面內
watch(W, (w) => {
  for (const s of sprites) {
    s.x = Math.min(s.x, w - MARGIN)
    s.y = Math.min(s.y, H.value - 6)
  }
})

// ---------- 名字疊加層尺寸 ----------
let ro: ResizeObserver | undefined
let labelScale = 1
function syncLabelSize() {
  const el = labelsEl.value
  if (!el) return
  const dpr = window.devicePixelRatio || 1
  el.width = Math.round(el.clientWidth * dpr)
  el.height = Math.round(el.clientHeight * dpr)
  labelScale = el.width / W.value
}
onMounted(() => {
  if (!labelsEl.value) return
  ro = new ResizeObserver(syncLabelSize)
  ro.observe(labelsEl.value)
})
onBeforeUnmount(() => ro?.disconnect())
watch(W, () => requestAnimationFrame(syncLabelSize))

// ---------- 每幀 ----------
useRafLoop((now, dt) => {
  const ctx = canvasEl.value?.getContext('2d')
  if (!ctx) return
  const w = W.value
  const h = H.value

  for (const s of sprites) {
    const a = s.actor
    if (now >= s.nextMode) {
      a.setMode(pickMode())
      if (Math.random() < 0.15) s.dir = -s.dir
      s.nextMode = now + rand(2500, 8000)
    }
    if (now >= s.nextEmote) {
      if (Math.random() < 0.3) a.jump()
      else a.emote(Math.floor(Math.random() * EMOTES.length), now)
      s.nextEmote = now + rand(3000, 14000)
    }
    a.update(dt)
    s.x += s.dir * dt * a.speed
    if (s.x > w - MARGIN) {
      s.x = w - MARGIN
      s.dir = -1
    }
    if (s.x < MARGIN) {
      s.x = MARGIN
      s.dir = 1
    }
  }

  drawCrowdTrack(ctx, w, h, TRACK_TOP)
  // 由遠（上）到近（下）畫，前面的人蓋住後面的人
  const order = sprites.filter((s) => s.ready).sort((p, q) => p.y - q.y)
  for (const s of order) {
    drawAvatar(ctx, s.runner.config, s.actor.pose(now, s.runner.config.face), s.x, s.y, { flip: s.dir < 0 })
  }

  const lctx = labelsEl.value?.getContext('2d')
  if (!lctx) return
  lctx.clearRect(0, 0, lctx.canvas.width, lctx.canvas.height)
  if (!props.showNames) return
  const k = labelScale
  lctx.font = `500 ${Math.max(11, Math.round(4.2 * k))}px 'Noto Sans TC', 'PingFang TC', system-ui, sans-serif`
  lctx.textAlign = 'center'
  lctx.textBaseline = 'top'
  lctx.lineJoin = 'round'
  lctx.lineWidth = Math.max(2, k)
  lctx.strokeStyle = 'rgba(15,21,28,.85)'
  lctx.fillStyle = '#fff'
  for (const s of order) {
    if (!s.runner.name) continue
    const tx = s.x * k
    const ty = (s.y + 3) * k
    lctx.strokeText(s.runner.name, tx, ty)
    lctx.fillText(s.runner.name, tx, ty)
  }
})
</script>

<template>
  <div class="crowd" :style="{ aspectRatio: `${W} / ${H}` }">
    <canvas ref="canvasEl" class="pixel" :width="W" :height="H" aria-label="跑道上的角色"></canvas>
    <canvas ref="labelsEl" class="labels" aria-hidden="true"></canvas>
  </div>
</template>

<style scoped>
.crowd {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: var(--track);
}
.crowd canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
