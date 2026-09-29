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
/* 小像素鍵；選中時金底，左側出現 ▶ */
.chip {
  position: relative;
  border: 0;
  margin: 2px;
  padding: 5px 11px 7px;
  font-size: 15px;
  line-height: 1.2;
  background: var(--panel-2);
  color: var(--ink);
  cursor: pointer;
  box-shadow:
    -2px 0 0 0 var(--outline),
    2px 0 0 0 var(--outline),
    0 -2px 0 0 var(--outline),
    0 2px 0 0 var(--outline),
    inset 0 -3px 0 0 var(--panel-lo);
}
.chip:hover {
  background: var(--panel);
}
.chip:active {
  transform: translateY(2px);
}
.chip[aria-pressed='true'] {
  background: var(--accent);
  color: var(--accent-ink);
  padding-left: 22px;
  box-shadow:
    -2px 0 0 0 var(--outline),
    2px 0 0 0 var(--outline),
    0 -2px 0 0 var(--outline),
    0 2px 0 0 var(--outline),
    inset 0 -3px 0 0 var(--gold-lo);
}
.chip[aria-pressed='true']::before {
  content: '▶';
  position: absolute;
  left: 7px;
  font-size: 10px;
  top: 50%;
  transform: translateY(-55%);
}
</style>
