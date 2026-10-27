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
/* 海拉魯寶石色塊；具備切面反光，選中時外圍浮現黃金鑲框與靈光 */
.sw {
  position: relative;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 3px;
  padding: 0;
  cursor: pointer;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.32) 0%, transparent 45%, rgba(0, 0, 0, 0.22) 100%),
    var(--c);
  box-shadow:
    0 0 0 2px var(--outline),
    inset 2px 2px 0 0 rgba(255, 255, 255, 0.34),
    inset -2px -2px 0 0 rgba(0, 0, 0, 0.26),
    0 2px 5px rgba(0, 0, 0, 0.25);
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;
}
.sw:hover {
  transform: scale(1.08);
  box-shadow:
    0 0 0 2px var(--outline),
    0 0 0 4px var(--gold),
    inset 2px 2px 0 0 rgba(255, 255, 255, 0.4),
    inset -2px -2px 0 0 rgba(0, 0, 0, 0.26);
}
.sw[aria-pressed='true'] {
  transform: scale(1.08);
  box-shadow:
    0 0 0 2px var(--outline),
    0 0 0 5px var(--gold),
    0 0 0 6.5px var(--outline),
    0 0 14px var(--gold-glow),
    inset 2px 2px 0 0 rgba(255, 255, 255, 0.38),
    inset -2px -2px 0 0 rgba(0, 0, 0, 0.24);
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
