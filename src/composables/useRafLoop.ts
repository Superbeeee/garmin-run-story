import { onBeforeUnmount, onMounted } from 'vue'

/** 元件掛載期間每幀呼叫 cb；dt 上限 50ms，避免切回分頁時暴衝 */
export function useRafLoop(cb: (now: number, dt: number) => void): void {
  let id = 0
  let last = 0
  const loop = (now: number) => {
    const dt = Math.min(50, now - (last || now))
    last = now
    cb(now, dt)
    id = requestAnimationFrame(loop)
  }
  onMounted(() => {
    id = requestAnimationFrame(loop)
  })
  onBeforeUnmount(() => cancelAnimationFrame(id))
}
