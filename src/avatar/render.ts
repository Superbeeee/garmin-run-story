/**
 * 無狀態的繪製函式：給 AvatarConfig + Pose，畫到任意 canvas。
 */
import type { Pose } from './actor'
import { getIcon } from './icons'
import { layerList, type LayerRef } from './layers'
import { FRAME, frameBox, recolored } from './sprites'
import type { AvatarConfig, SheetName } from './types'

/** 角色腳底在 64×64 格子裡的 y（從格子頂端算） */
const FOOT_Y = 62

/** 正面大圖的畫布尺寸與從 front 圖裁切的範圍 */
export const PORTRAIT_W = 40
export const PORTRAIT_H = 62
// 從格子第 0 列開始裁，高帽子才不會被切掉；原有圖層的位置與原型相同
const PORTRAIT_SRC = { x: 12, y: 0, w: 40, h: 56 }
const PORTRAIT_DY = 6
/** 正面圖示最高只到這裡，避免戴高帽時超出畫布 */
const PORTRAIT_ICON_MIN_Y = 11

const HEAD_TOP_SLOTS = new Set(['head', 'hair', 'hat', 'hattrim'])

/**
 * 頭頂位置（格內座標）：top 含帽子（頭頂圖示用），hairTop 只算頭與頭髮（汗滴用）；
 * 水平位置以頭為準。
 */
function headBox(layers: LayerRef[], sheet: SheetName, frame: number) {
  let top = FRAME
  let hairTop = FRAME
  let cx = 32
  let right = 40
  for (const L of layers) {
    if (!HEAD_TOP_SLOTS.has(L.slot)) continue
    const b = frameBox(L.key, sheet, frame)
    if (!b) continue
    if (b[0] < top) top = b[0]
    if ((L.slot === 'head' || L.slot === 'hair') && b[0] < hairTop) hairTop = b[0]
    if (L.slot === 'head') {
      cx = b[1]
      right = b[2]
    }
  }
  return { top, hairTop, cx, right }
}

/** 畫頭頂圖示；(x, y) 為圖示底部中心（sweat 為左緣） */
function drawIcon(ctx: CanvasRenderingContext2D, pose: Pose, x: number, y: number): void {
  const e = pose.emote
  if (!e) return
  const ic = getIcon(e.icon)
  const age = pose.now - e.start
  const left = e.until - pose.now
  let dy = age < 120 ? Math.round(4 - age / 20) : Math.round(Math.sin(age / 260))
  if (e.icon === 'sweat') dy = Math.min(3, Math.floor(age / 300))
  const ix = e.icon === 'sweat' ? x : x - Math.floor(ic.width / 2)
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * (left < 300 ? left / 300 : 1)
  ctx.drawImage(ic, ix, y - ic.height + dy)
  ctx.globalAlpha = prev
}

export interface DrawOptions {
  /** 面向左（水平翻轉） */
  flip?: boolean
  /** 腳下影子，預設 true */
  shadow?: boolean
}

/**
 * 畫側面動畫角色。(x, y) 為腳底中心；跑道場景裡 y 就是地面線。
 * 回傳本次疊的圖層（除錯面板用）。
 */
export function drawAvatar(ctx: CanvasRenderingContext2D, config: AvatarConfig, pose: Pose, x: number, y: number, opts: DrawOptions = {}): LayerRef[] {
  const { flip = false, shadow = true } = opts
  const layers = layerList(config, pose.face)
  const gx = Math.round(x)
  const gy = Math.round(y)
  ctx.imageSmoothingEnabled = false

  if (shadow) {
    const sw = Math.max(8, 16 + Math.round(pose.lift / 2))
    ctx.fillStyle = 'rgba(10,20,40,.28)'
    ctx.fillRect(gx - Math.floor(sw / 2), gy, sw, 2)
  }

  const top = gy - FOOT_Y + pose.lift
  ctx.save()
  if (flip) {
    ctx.translate(gx, 0)
    ctx.scale(-1, 1)
    ctx.translate(-gx, 0)
  }
  for (const L of layers) {
    const c = recolored(L.key, pose.anim, L.material, L.pal)
    if (c) ctx.drawImage(c, pose.frame * FRAME, 0, FRAME, FRAME, gx - FRAME / 2, top, FRAME, FRAME)
  }
  ctx.restore()

  if (pose.emote) {
    const hb = headBox(layers, pose.anim, pose.frame)
    const wx = (px: number) => (flip ? gx + FRAME / 2 - px : gx - FRAME / 2 + px)
    if (pose.emote.icon === 'sweat') drawIcon(ctx, pose, flip ? wx(hb.right) - 6 : wx(hb.right) + 1, top + hb.hairTop + 10)
    else drawIcon(ctx, pose, wx(hb.cx), top + hb.top - 1)
  }
  return layers
}

/** 畫正面大圖（PORTRAIT_W × PORTRAIT_H），(x, y) 為左上角 */
export function drawPortrait(ctx: CanvasRenderingContext2D, config: AvatarConfig, pose: Pose, x = 0, y = 0): void {
  const layers = layerList(config, pose.face)
  const S = PORTRAIT_SRC
  ctx.imageSmoothingEnabled = false
  for (const L of layers) {
    const c = recolored(L.key, 'front', L.material, L.pal)
    if (c) ctx.drawImage(c, S.x, S.y, S.w, S.h, x, y + PORTRAIT_DY, S.w, S.h)
  }
  if (pose.emote) {
    const hb = headBox(layers, 'front', 0)
    // 格內座標轉成畫布座標：減去裁切起點、加上下移量
    const toX = (px: number) => x + px - S.x
    const toY = (py: number) => y + py - S.y + PORTRAIT_DY
    if (pose.emote.icon === 'sweat') drawIcon(ctx, pose, toX(hb.right) + 1, toY(hb.hairTop) + 10)
    else drawIcon(ctx, pose, toX(hb.cx), Math.max(PORTRAIT_ICON_MIN_Y, toY(hb.top) - 1))
  }
}
