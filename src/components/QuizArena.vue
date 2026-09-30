<script setup lang="ts">
/**
 * 搶答跑位的場地：跑道依選項分成幾個答案區，角色依位置（0～1）左右移動。
 * 位置由父層放在 positions（每幀讀取，不需要是 reactive）；公布答案時答對的人跳起來、答錯的人難過。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AvatarActor, drawAvatar, preloadAvatar } from '../avatar'
import { useRafLoop } from '../composables/useRafLoop'
import { zoneOf, type GameAction, type GamePlayer } from '../lib/game'
import { drawCrowdTrack } from '../scene/track'

const props = defineProps<{
  players: GamePlayer[]
  positions: Map<string, number>
  /** 目前題目的選項；null 表示沒有題目（等待中） */
  choices: string[] | null
  /** 公布後的正確答案 */
  answer: number | null
  /** 自己（畫出箭頭標記） */
  meId?: string
  showNames?: boolean
  /** 名字字級（場地像素）；投影時放大 */
  nameSize?: number
}>()

const W = 384
const H = 216
const TRACK_TOP = 64
const MARGIN = 14
const BOTTOM_PAD = 14
/** 畫面上的移動速度上限（px/ms），比角色跑步快一點，才跟得上手機操作 */
const MAX_SPEED = 0.2
const ZONE_COLORS = ['#b13e53', '#3b5dc9', '#38b764', '#ef7d57']
const HAPPY = 0
const SAD = 5

const canvasEl = ref<HTMLCanvasElement>()
const labelsEl = ref<HTMLCanvasElement>()

interface Sprite {
  player: GamePlayer
  actor: AvatarActor
  x: number
  y: number
  dir: number
  ready: boolean
}

/** 依 id 決定固定的前後位置，讓角色不會全部疊在同一條線上 */
function laneY(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TRACK_TOP + 34 + (h % 1000) / 1000 * (H - BOTTOM_PAD - TRACK_TOP - 34)
}
const toPx = (pos: number) => MARGIN + pos * (W - MARGIN * 2)

let sprites: Sprite[] = []
watch(
  () => props.players,
  (players) => {
    const old = new Map(sprites.map((s) => [s.player.id, s]))
    sprites = players.map((p) => {
      const prev = old.get(p.id)
      if (prev) {
        prev.player = p
        return prev
      }
      const s: Sprite = { player: p, actor: new AvatarActor(), x: toPx(props.positions.get(p.id) ?? 0.5), y: laneY(p.id), dir: 1, ready: false }
      preloadAvatar(p.avatar).then(() => (s.ready = true), () => {})
      return s
    })
  },
  { immediate: true },
)

// 公布答案：答對跳起來開心，答錯難過
watch(
  () => props.answer,
  (ans) => {
    if (ans === null || !props.choices) return
    const now = performance.now()
    for (const s of sprites) {
      const pos = props.positions.get(s.player.id)
      if (pos === undefined) continue
      if (zoneOf(pos, props.choices.length) === ans) {
        s.actor.jump()
        s.actor.emote(HAPPY, now)
      } else {
        s.actor.emote(SAD, now)
      }
    }
  },
)

/** 讓某個角色跳躍或做表情 */
function act(playerId: string, a: GameAction) {
  const s = sprites.find((x) => x.player.id === playerId)
  if (!s) return
  if (a === 'jump') s.actor.jump()
  else s.actor.emote(a, performance.now())
}
defineExpose({ act })

// ---------- 名字疊加層 ----------
let ro: ResizeObserver | undefined
let k = 1
function syncLabelSize() {
  const el = labelsEl.value
  if (!el) return
  const dpr = window.devicePixelRatio || 1
  el.width = Math.round(el.clientWidth * dpr)
  el.height = Math.round(el.clientHeight * dpr)
  k = el.width / W
}
onMounted(() => {
  if (!labelsEl.value) return
  ro = new ResizeObserver(syncLabelSize)
  ro.observe(labelsEl.value)
})
onBeforeUnmount(() => ro?.disconnect())

const n = computed(() => props.choices?.length ?? 0)

function drawZones(ctx: CanvasRenderingContext2D) {
  const count = n.value
  if (!count) return
  const zw = W / count
  for (let i = 0; i < count; i++) {
    const revealed = props.answer !== null
    const right = props.answer === i
    ctx.globalAlpha = revealed ? (right ? 0.55 : 0.12) : 0.28
    ctx.fillStyle = revealed && right ? '#38b764' : ZONE_COLORS[i % ZONE_COLORS.length]
    ctx.fillRect(Math.round(i * zw), TRACK_TOP, Math.ceil(zw), H - TRACK_TOP)
    ctx.globalAlpha = 1
    if (i > 0) {
      // 區域分隔：白色虛線
      ctx.fillStyle = '#f4f4f4'
      for (let y = TRACK_TOP; y < H; y += 6) ctx.fillRect(Math.round(i * zw), y, 1, 3)
    }
  }
}

useRafLoop((now, dt) => {
  const ctx = canvasEl.value?.getContext('2d')
  if (!ctx) return

  for (const s of sprites) {
    const pos = props.positions.get(s.player.id)
    const target = pos === undefined ? s.x : toPx(pos)
    const dx = target - s.x
    const step = Math.sign(dx) * Math.min(Math.abs(dx), MAX_SPEED * dt)
    s.x += step
    const moving = Math.abs(dx) > 0.5
    if (moving) s.dir = Math.sign(dx)
    const mode = moving ? 'run' : 'idle'
    if (s.actor.mode !== mode) s.actor.setMode(mode)
    s.actor.update(dt)
  }

  drawCrowdTrack(ctx, W, H, TRACK_TOP)
  drawZones(ctx)
  const order = sprites.filter((s) => s.ready).sort((a, b) => a.y - b.y)
  for (const s of order) {
    drawAvatar(ctx, s.player.avatar, s.actor.pose(now, s.player.avatar.face), s.x, s.y, { flip: s.dir < 0 })
  }

  const lctx = labelsEl.value?.getContext('2d')
  if (!lctx) return
  lctx.clearRect(0, 0, lctx.canvas.width, lctx.canvas.height)
  lctx.textAlign = 'center'
  lctx.lineJoin = 'round'
  lctx.lineWidth = Math.max(2, k)
  lctx.strokeStyle = 'rgba(15,21,28,.85)'
  for (const s of order) {
    const isMe = s.player.id === props.meId
    if (isMe) {
      // 頭頂的金色箭頭
      const tx = s.x * k
      const ty = (s.y - 60 + Math.sin(now / 180) * 1.5) * k
      lctx.fillStyle = '#ffcd75'
      lctx.beginPath()
      lctx.moveTo(tx - 4 * k, ty - 5 * k)
      lctx.lineTo(tx + 4 * k, ty - 5 * k)
      lctx.lineTo(tx, ty)
      lctx.closePath()
      lctx.stroke()
      lctx.fill()
    }
    if (!props.showNames && !isMe) continue
    lctx.font = `${Math.max(12, Math.round((props.nameSize ?? 4.4) * k))}px 'Cubic 11', 'PingFang TC', system-ui, sans-serif`
    lctx.textBaseline = 'top'
    lctx.fillStyle = isMe ? '#ffcd75' : '#fff'
    const label = isMe && !props.showNames ? '你' : s.player.name
    lctx.strokeText(label, s.x * k, (s.y + 3) * k)
    lctx.fillText(label, s.x * k, (s.y + 3) * k)
  }
})
</script>

<template>
  <div class="arena" :style="{ aspectRatio: `${W} / ${H}` }">
    <canvas ref="canvasEl" class="pixel" :width="W" :height="H" aria-label="答題場地"></canvas>
    <canvas ref="labelsEl" class="labels" aria-hidden="true"></canvas>
    <ol v-if="choices" class="zones" :style="{ gridTemplateColumns: `repeat(${choices.length}, 1fr)` }">
      <li
        v-for="(c, i) in choices"
        :key="i"
        :class="{ right: answer === i, wrong: answer !== null && answer !== i }"
        :style="{ '--zone': ZONE_COLORS[i % ZONE_COLORS.length] }"
      >
        <span class="tag">{{ 'ABCD'[i] }}</span>
        <span class="text">{{ c }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.arena {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--track);
}
.arena canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
/* 答案區標籤：蓋在天空的位置（場地上方 64/216） */
.zones {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: calc(100% * 64 / 216);
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
}
.zones li {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
  padding: 0 0.4em;
  min-width: 0;
  font-size: clamp(12px, 2.6cqi, 40px);
  color: var(--outline);
  border-left: 2px dashed rgba(26, 28, 44, 0.3);
}
.zones li:first-child {
  border-left: 0;
}
.arena {
  container-type: inline-size;
}
.tag {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 1.6em;
  height: 1.6em;
  color: #fff;
  background: var(--zone);
  box-shadow: 0 0 0 2px var(--outline);
}
.text {
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.right {
  background: rgba(56, 183, 100, 0.55);
}
.right .tag {
  background: var(--green);
}
.wrong {
  opacity: 0.45;
}
</style>
