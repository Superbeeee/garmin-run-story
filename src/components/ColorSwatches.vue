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
      :style="{ '--c': color(v) }"
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
  gap: 10px;
  padding: 4px;
}
/* 方形像素色塊；選中時外圍出現金色游標框 */
.sw {
  width: 26px;
  height: 26px;
  border: 0;
  padding: 0;
  cursor: pointer;
  background: var(--c);
  box-shadow:
    -2px 0 0 0 var(--outline),
    2px 0 0 0 var(--outline),
    0 -2px 0 0 var(--outline),
    0 2px 0 0 var(--outline),
    inset 3px 3px 0 0 rgba(255, 255, 255, 0.28),
    inset -3px -3px 0 0 rgba(0, 0, 0, 0.22);
}
.sw[aria-pressed='true'] {
  box-shadow:
    -2px 0 0 0 var(--outline),
    2px 0 0 0 var(--outline),
    0 -2px 0 0 var(--outline),
    0 2px 0 0 var(--outline),
    -5px 0 0 0 var(--gold),
    5px 0 0 0 var(--gold),
    0 -5px 0 0 var(--gold),
    0 5px 0 0 var(--gold),
    inset 3px 3px 0 0 rgba(255, 255, 255, 0.28),
    inset -3px -3px 0 0 rgba(0, 0, 0, 0.22);
}
@media (pointer: coarse) {
  .opts {
    gap: 12px;
  }
  .sw {
    width: 32px;
    height: 32px;
  }
}
</style>
