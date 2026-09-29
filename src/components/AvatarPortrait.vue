<script setup lang="ts">
/** 靜態正面大圖（名單用，不跑動畫） */
import { onMounted, ref, watch } from 'vue'
import { PORTRAIT_H, PORTRAIT_W, drawPortrait, preloadAvatar, type AvatarConfig } from '../avatar'

const props = defineProps<{ config: AvatarConfig; label?: string }>()
const el = ref<HTMLCanvasElement>()

async function draw() {
  const cfg = props.config
  await preloadAvatar(cfg).catch(() => {})
  const ctx = el.value?.getContext('2d')
  if (!ctx || cfg !== props.config) return
  ctx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H)
  drawPortrait(ctx, cfg, { anim: 'idle', frame: 0, lift: 0, face: cfg.face, emote: null, now: 0 })
}
onMounted(draw)
watch(() => props.config, draw)
</script>

<template>
  <canvas ref="el" class="pixel" :width="PORTRAIT_W" :height="PORTRAIT_H" :aria-label="label ?? '角色正面'"></canvas>
</template>
