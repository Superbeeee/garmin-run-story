<script setup lang="ts">
import type { Option } from '../avatar'

defineProps<{ options: readonly Option[]; label: string }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="opts" role="group" :aria-label="label">
    <button v-for="[v, text] in options" :key="v" type="button" class="chip" :aria-pressed="model === v" @click="model = v">{{ text }}</button>
  </div>
</template>

<style scoped>
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  padding: 2px;
}
/* 薩爾達裝備欄風格選項鍵；選中時煥發皇室金光，左側浮現海拉魯菱紋 ◆ */
.chip {
  position: relative;
  border: 0;
  border-radius: 2px;
  margin: 2px;
  padding: 5px 12px 7px;
  font-size: 15px;
  line-height: 1.2;
  background: var(--panel-2);
  color: var(--ink);
  cursor: pointer;
  box-shadow:
    0 0 0 2px var(--outline),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.25),
    inset 0 -3px 0 0 var(--panel-lo);
  transition:
    background-color 120ms ease,
    box-shadow 120ms ease,
    transform 80ms ease;
}
.chip:hover {
  background: var(--panel-solid);
  box-shadow:
    0 0 0 2px var(--gold),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
    inset 0 -3px 0 0 var(--panel-lo);
}
.chip:active {
  transform: translateY(2px);
}
.chip[aria-pressed='true'] {
  background: linear-gradient(180deg, var(--gold-hi) 0%, var(--gold) 100%);
  color: var(--accent-ink);
  padding-left: 23px;
  box-shadow:
    0 0 0 2px var(--outline),
    0 0 0 4px var(--gold),
    inset 0 -3px 0 0 var(--gold-lo),
    0 0 12px var(--gold-glow);
}
.chip[aria-pressed='true']::before {
  content: '◆';
  position: absolute;
  left: 7px;
  font-size: 10px;
  color: #8c5a08;
  top: 50%;
  transform: translateY(-55%);
}
</style>
