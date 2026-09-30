import { onBeforeUnmount, onMounted } from 'vue'

/**
 * 頁面開著時讓螢幕保持常亮（手機遊戲中、投影電腦）。
 * 切到別的 App 回來時系統會自動釋放，所以回到頁面時再要一次；不支援的瀏覽器直接略過。
 */
export function useWakeLock(): void {
  let lock: WakeLockSentinel | null = null
  let active = true

  async function request() {
    if (!active || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
    try {
      lock = await navigator.wakeLock.request('screen')
    } catch {
      // 省電模式或瀏覽器拒絕：不影響遊戲
    }
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible' && (!lock || lock.released)) request()
  }

  onMounted(() => {
    request()
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    active = false
    document.removeEventListener('visibilitychange', onVisible)
    lock?.release().catch(() => {})
  })
}
