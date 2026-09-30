<script setup lang="ts">
/** 單一角色的動畫：celebrate 時每隔一下就跳起來、做開心或喜歡的表情 */
import { ref, watch } from 'vue'
import { AvatarActor, DEFAULT_CONFIG, drawAvatar, preloadAvatar, type AvatarConfig } from '../avatar'
import { useRafLoop } from '../composables/useRafLoop'

const props = defineProps<{ config: AvatarConfig | null; celebrate?: boolean }>()

const W = 64
const H = 84
const GROUND = 80
const el = ref<HTMLCanvasElement>()
const actor = new AvatarActor()
let ready = false
let nextCheer = 0

const cfg = () => props.config ?? DEFAULT_CONFIG
watch(
  () => props.config,
  () => {
    ready = false
    preloadAvatar(cfg()).then(() => (ready = true), () => {})
  },
  { immediate: true },
)
watch(
  () => props.celebrate,
  (v) => {
    if (v) nextCheer = 0
  },
)

useRafLoop((now, dt) => {
  const ctx = el.value?.getContext('2d')
  if (!ctx) return
  if (props.celebrate && now >= nextCheer) {
    actor.jump()
    actor.emote(Math.random() < 0.5 ? 0 : 1, now)
    nextCheer = now + 1300
  }
  actor.update(dt)
  ctx.clearRect(0, 0, W, H)
  if (ready) drawAvatar(ctx, cfg(), actor.pose(now, cfg().face), W / 2, GROUND)
})
</script>

<template>
  <canvas ref="el" class="pixel" :width="W" :height="H" aria-hidden="true"></canvas>
</template>
