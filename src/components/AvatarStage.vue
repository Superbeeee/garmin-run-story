<script setup lang="ts">
/**
 * 角色預覽：正面大圖 + 跑道動畫，含動作切換與表情動作。
 * 造型改變時先預載新圖層，載完才切換，避免閃爍。
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  AvatarActor,
  EMOTES,
  PORTRAIT_H,
  PORTRAIT_W,
  SLOT_LABELS,
  Z,
  drawAvatar,
  drawPortrait,
  preloadAvatar,
  type AnimName,
  type AvatarConfig,
  type LayerRef,
  type MoveMode,
} from '../avatar'
import { useRafLoop } from '../composables/useRafLoop'
import { PREVIEW_GROUND, PREVIEW_H, PREVIEW_W, drawPreviewTrack } from '../scene/track'

const props = defineProps<{
  config: AvatarConfig
  /** 顯示慢動作與圖層除錯面板 */
  debug?: boolean
}>()

const ACTIONS: [AnimName, string][] = [
  ['idle', '站立'],
  ['walk', '走路'],
  ['run', '跑步'],
  ['jump', '跳躍'],
]

const portraitEl = ref<HTMLCanvasElement>()
const sceneEl = ref<HTMLCanvasElement>()
const shown = shallowRef<AvatarConfig | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const current = ref<AnimName>('idle')
const slow = ref(false)
const debugInfo = shallowRef<{ now: string; anim: AnimName; frame: number; layers: LayerRef[] }>({ now: '', anim: 'idle', frame: 0, layers: [] })

const actor = new AvatarActor()
actor.onJumpEnd = () => (current.value = actor.anim)
const scene = { x: 96, dir: 1 }

// ---------- 造型預載 ----------
let loadSeq = 0
watch(
  () => ({ ...props.config }),
  async (cfg) => {
    const seq = ++loadSeq
    try {
      await preloadAvatar(cfg)
      if (seq !== loadSeq) return
      shown.value = cfg
      status.value = 'ready'
    } catch {
      if (seq === loadSeq && !shown.value) status.value = 'error'
    }
  },
  { immediate: true },
)

// ---------- 操作 ----------
function act(a: AnimName) {
  if (a === 'jump') actor.jump()
  else actor.setMode(a as MoveMode)
  current.value = actor.anim
}

function fireEmote(i: number) {
  actor.emote(i, performance.now())
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const n = parseInt(e.key, 10)
  if (n >= 1 && n <= EMOTES.length) fireEmote(n - 1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ---------- 繪製 ----------
const NAMES: Record<AnimName, string> = { idle: '站立', walk: '走路', run: '跑步', jump: '跳躍' }
let lastDebugKey = ''

useRafLoop((now, dt) => {
  const cfg = shown.value
  const sctx = sceneEl.value?.getContext('2d')
  const pctx = portraitEl.value?.getContext('2d')
  if (!cfg || !sctx || !pctx) return

  const k = props.debug && slow.value ? 0.25 : 1
  actor.update(dt * k)
  if (actor.speed) {
    scene.x += scene.dir * dt * k * actor.speed
    if (scene.x > 168) {
      scene.x = 168
      scene.dir = -1
    }
    if (scene.x < 24) {
      scene.x = 24
      scene.dir = 1
    }
  }

  const pose = actor.pose(now, cfg.face)
  drawPreviewTrack(sctx)
  const layers = drawAvatar(sctx, cfg, pose, scene.x, PREVIEW_GROUND, { flip: scene.dir < 0 })
  pctx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H)
  drawPortrait(pctx, cfg, pose)

  if (props.debug) {
    const key = pose.anim + pose.frame + layers.map((l) => l.key + l.pal).join()
    if (key !== lastDebugKey) {
      lastDebugKey = key
      debugInfo.value = {
        now: `${NAMES[pose.anim]}（${pose.anim}）第 ${pose.frame} 格，所有圖層都用同一格、同一個 64×64 位置`,
        anim: pose.anim,
        frame: pose.frame,
        layers,
      }
    }
  }
})
</script>

<template>
  <section class="stage" aria-label="角色預覽">
    <div class="views">
      <div class="portrait">
        <canvas ref="portraitEl" class="pixel" :width="PORTRAIT_W" :height="PORTRAIT_H" aria-label="角色正面預覽"></canvas>
      </div>
      <div class="scene-box">
        <canvas ref="sceneEl" class="pixel" :width="PREVIEW_W" :height="PREVIEW_H" aria-label="角色動畫預覽"></canvas>
      </div>
    </div>
    <p v-if="status === 'loading'" class="status muted">素材載入中…</p>
    <p v-else-if="status === 'error'" class="status err">素材載入失敗，請重新整理頁面。</p>

    <div class="bar">
      <div class="seg" role="group" aria-label="動作">
        <button v-for="[a, label] in ACTIONS" :key="a" type="button" :aria-pressed="current === a" @click="act(a)">{{ label }}</button>
      </div>
      <label v-if="debug" class="check"><input v-model="slow" type="checkbox" /> 慢動作</label>
    </div>
    <div class="bar">
      <div class="seg" role="group" aria-label="表情動作">
        <button v-for="(e, i) in EMOTES" :key="e.face + e.icon" type="button" aria-pressed="false" @click="fireEmote(i)">{{ e.label }}</button>
      </div>
      <span class="hint muted">也可以按鍵盤 1～8</span>
    </div>

    <div v-if="debug" class="meta">
      <h2>這一格疊了哪些圖層</h2>
      <div class="now muted">{{ debugInfo.now }}</div>
      <ol>
        <li v-for="L in debugInfo.layers" :key="L.slot">
          <b>z {{ Z[L.slot] }}</b><span>{{ SLOT_LABELS[L.slot] }}　{{ L.key }}/{{ debugInfo.anim }}.png #{{ debugInfo.frame }}　{{ L.pal }}</span>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.views {
  display: grid;
  grid-template-columns: minmax(0, 0.42fr) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}
.portrait {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}
.portrait canvas {
  width: 100%;
  max-width: 220px;
  aspect-ratio: 40 / 62;
}
.scene-box {
  background: var(--track);
  border-radius: 14px;
  padding: 10px;
  display: flex;
  align-items: center;
}
.scene-box canvas {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  background: #cfe2f0;
}
.status {
  font-size: 14px;
  margin: 8px 0 0;
}
.err {
  color: var(--danger);
}
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 14px;
}
.hint {
  font-size: 13px;
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
  margin-left: 6px;
}
.meta {
  margin-top: 14px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
}
.meta h2 {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 6px;
}
.meta .now {
  font-size: 13px;
  margin-bottom: 6px;
}
.meta ol {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13.5px;
}
.meta li {
  display: flex;
  gap: 10px;
  padding: 2px 0;
  border-top: 1px dashed var(--line);
}
.meta li:first-child {
  border-top: 0;
}
.meta li b {
  font-weight: 500;
  min-width: 48px;
  color: var(--muted);
}
/* 手機：上下排列；觸控裝置不顯示鍵盤提示 */
@media (max-width: 520px) {
  .views {
    grid-template-columns: 1fr;
  }
  .portrait canvas {
    max-width: 150px;
  }
}
@media (hover: none) {
  .hint {
    display: none;
  }
}
</style>
