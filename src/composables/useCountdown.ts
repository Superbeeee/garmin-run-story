import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * 距離 endsAt（伺服器時間 epoch ms）還剩幾毫秒；offset 為伺服器時間 − 本機時間。
 * endsAt 為 null 時為 0。
 */
export function useCountdown(endsAt: Ref<number | null>, offset: Ref<number>) {
  const left = ref(0)
  const tick = () => {
    left.value = endsAt.value === null ? 0 : Math.max(0, endsAt.value - (Date.now() + offset.value))
  }
  const id = window.setInterval(tick, 100)
  watch([endsAt, offset], tick, { immediate: true })
  onBeforeUnmount(() => clearInterval(id))
  return left
}
