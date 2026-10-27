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
  /** 窄螢幕時把預覽圖固定在畫面頂端（外層需為 grid/flex 容器，讓預覽能跨過整頁黏住） */
  stickyOnMobile?: boolean
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
  <section class="stage" :class="{ 'mobile-sticky': stickyOnMobile }" aria-label="角色預覽">
    <div class="views">
      <div class="win portrait">
        <canvas ref="portraitEl" class="pixel" :width="PORTRAIT_W" :height="PORTRAIT_H" aria-label="角色正面預覽"></canvas>
      </div>
      <div class="win scene-box">
        <canvas ref="sceneEl" class="pixel" :width="PREVIEW_W" :height="PREVIEW_H" aria-label="角色動畫預覽"></canvas>
      </div>
    </div>
    <p v-if="status === 'loading'" class="status">素材載入中<span class="cursor">…</span></p>
    <p v-else-if="status === 'error'" class="status err">素材載入失敗，請重新整理頁面。</p>

    <div class="win controls">
      <div class="bar">
        <span class="bar-label">動作</span>
        <div class="seg" role="group" aria-label="動作">
          <button v-for="[a, label] in ACTIONS" :key="a" type="button" :aria-pressed="current === a" @click="act(a)">{{ label }}</button>
        </div>
        <label v-if="debug" class="check"><input v-model="slow" type="checkbox" /> 慢動作</label>
      </div>
      <div class="bar">
        <span class="bar-label">表情</span>
        <div class="seg" role="group" aria-label="表情動作">
          <button v-for="(e, i) in EMOTES" :key="e.face + e.icon" type="button" aria-pressed="false" @click="fireEmote(i)">{{ e.label }}</button>
        </div>
      </div>
      <p class="hint muted">鍵盤 1～8 也能做表情</p>
    </div>

    <div v-if="debug" class="win meta">
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
  gap: 14px;
  align-items: stretch;
}
/* 正面大圖：角色站在海拉魯神殿石座與三角聖紋舞台上 */
.portrait {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 10px 8px 0;
  background:
    linear-gradient(to top, var(--panel-lo) 0 8px, var(--gold-border) 8px 10px, var(--panel-2) 10px 15px, transparent 15px),
    radial-gradient(circle at 50% 42%, rgba(240, 196, 77, 0.22) 0%, transparent 65%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='46' r='34' fill='none' stroke='%23d4a843' stroke-width='1' stroke-dasharray='3 2' opacity='0.35'/%3E%3Cpolygon points='50,20 35,46 65,46' fill='none' stroke='%23d4a843' stroke-width='1.2' opacity='0.28'/%3E%3Cpolygon points='35,46 20,72 50,72' fill='none' stroke='%23d4a843' stroke-width='1.2' opacity='0.28'/%3E%3Cpolygon points='65,46 50,72 80,72' fill='none' stroke='%23d4a843' stroke-width='1.2' opacity='0.28'/%3E%3C/svg%3E")
      center 36% / 82% no-repeat,
    var(--panel-solid);
}
.portrait canvas {
  width: 100%;
  max-width: 220px;
  aspect-ratio: 40 / 62;
  position: relative;
  z-index: 1;
}
.scene-box {
  display: flex;
  align-items: center;
  padding: 6px;
  background: var(--outline);
  box-shadow:
    0 0 0 2px var(--outline),
    0 0 0 4px var(--gold-border),
    0 0 0 6px var(--outline),
    0 12px 28px -6px rgba(10, 16, 26, 0.42);
}
.scene-box canvas {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #5c9ec8;
}
.status {
  font-size: 15px;
  margin: 10px 4px 0;
  color: var(--title);
  text-shadow: var(--text-outline);
}
.err {
  color: var(--gold);
}
.controls {
  margin-top: 18px;
  padding: 10px 12px;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
}
.bar + .bar {
  margin-top: 8px;
}
.bar-label {
  font-size: 14px;
  color: var(--muted);
  min-width: 2.6em;
}
.bar-label::before {
  content: '◆ ';
  color: var(--gold-lo);
  font-size: 11px;
  vertical-align: 1px;
}
.hint {
  font-size: 13px;
  margin: 6px 0 0;
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
  margin-top: 18px;
  font-family: var(--font-text);
}
.meta h2 {
  font-family: var(--font-pixel);
  font-size: 15px;
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
  border-top: 1px dashed var(--panel-lo);
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
/*
 * 手機：外層容器 display: contents，讓 .views 成為頁面 grid 的直接子元素，
 * 才能在捲動整個造型面板時一直黏在頂端。
 */
@media (max-width: 820px) {
  .mobile-sticky {
    display: contents;
  }
  .mobile-sticky .views {
    position: sticky;
    top: env(safe-area-inset-top, 0px);
    z-index: 5;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;
    background: var(--bg);
    padding: 10px 4px;
    margin: -10px -4px;
    box-shadow: 0 4px 0 0 var(--outline);
  }
  .mobile-sticky .portrait {
    padding: 6px 6px 0;
  }
  .mobile-sticky .controls {
    margin-top: 0;
  }
  .mobile-sticky .portrait canvas {
    width: auto;
    height: 120px;
    max-width: none;
  }
  .mobile-sticky .bar {
    margin-top: 0;
  }
  .mobile-sticky .status {
    margin: 0;
  }
}
</style>
