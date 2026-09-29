<script setup lang="ts">
import { EYES, swatchColor, type Material, type Option } from '../avatar'

const props = defineProps<{ options: readonly Option[]; label: string; material: Material | 'eye' }>()
const model = defineModel<string>({ required: true })

const color = (v: string) => (props.material === 'eye' ? EYES[v][1] : swatchColor(props.material, v))
</script>

<template>
  <div class="opts" role="group" :aria-label="label">
    <button
      v-for="[v, text] in options"
      :key="v"
      type="button"
      class="sw"
      :style="{ background: color(v) }"
      :aria-label="text"
      :title="text"
      :aria-pressed="model === v"
      @click="model = v"
    ></button>
  </div>
</template>

<style scoped>
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sw {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  outline: 1px solid var(--line);
  cursor: pointer;
  padding: 0;
}
.sw[aria-pressed='true'] {
  border-color: var(--surface);
  outline: 3px solid var(--ink);
}
/* 觸控裝置放大點擊範圍 */
@media (pointer: coarse) {
  .opts {
    gap: 10px;
  }
  .sw {
    width: 34px;
    height: 34px;
  }
}
</style>
