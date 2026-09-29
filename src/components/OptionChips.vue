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
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--line);
  background: transparent;
  font-size: 14px;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
}
.chip[aria-pressed='true'] {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
  font-weight: 500;
}
</style>
