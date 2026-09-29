/**
 * 跑道背景（原型的 192×108 預覽場景）。寬度可以更寬，雲與刻度會延伸。
 */
export const PREVIEW_W = 192
export const PREVIEW_H = 108
/** 預覽場景中角色腳底的 y */
export const PREVIEW_GROUND = 97

export function drawPreviewTrack(ctx: CanvasRenderingContext2D, w = PREVIEW_W): void {
  ctx.fillStyle = '#CFE2F0'
  ctx.fillRect(0, 0, w, 60)
  ctx.fillStyle = '#E6F0F7'
  for (let ox = 0; ox < w; ox += PREVIEW_W) {
    ctx.fillRect(ox + 18, 14, 26, 5)
    ctx.fillRect(ox + 24, 10, 14, 4)
    ctx.fillRect(ox + 128, 22, 30, 5)
    ctx.fillRect(ox + 135, 18, 16, 4)
  }
  ctx.fillStyle = '#6E8AA3'
  ctx.fillRect(0, 56, w, 1)
  for (let i = 3; i < w; i += 8) ctx.fillRect(i, 56, 1, 5)
  ctx.fillStyle = '#8FA9BF'
  ctx.fillRect(0, 61, w, 5)
  ctx.fillStyle = '#2F5DA8'
  ctx.fillRect(0, 66, w, 42)
  ctx.fillStyle = '#F4F6F8'
  ctx.fillRect(0, 74, w, 1)
  ctx.fillRect(0, 104, w, 1)
}

/** 多人跑道：上方天空與看台，下方寬跑道（trackTop 以下） */
export function drawCrowdTrack(ctx: CanvasRenderingContext2D, w: number, h: number, trackTop: number): void {
  ctx.fillStyle = '#CFE2F0'
  ctx.fillRect(0, 0, w, trackTop)
  ctx.fillStyle = '#E6F0F7'
  for (let ox = 0; ox < w; ox += 160) {
    ctx.fillRect(ox + 18, 12, 26, 5)
    ctx.fillRect(ox + 24, 8, 14, 4)
    ctx.fillRect(ox + 98, 22, 30, 5)
    ctx.fillRect(ox + 105, 18, 16, 4)
  }
  ctx.fillStyle = '#6E8AA3'
  ctx.fillRect(0, trackTop - 10, w, 1)
  for (let i = 3; i < w; i += 8) ctx.fillRect(i, trackTop - 10, 1, 5)
  ctx.fillStyle = '#8FA9BF'
  ctx.fillRect(0, trackTop - 5, w, 5)
  ctx.fillStyle = '#2F5DA8'
  ctx.fillRect(0, trackTop, w, h - trackTop)
  ctx.fillStyle = '#F4F6F8'
  const lanes = 6
  for (let i = 0; i <= lanes; i++) ctx.fillRect(0, Math.round(trackTop + 6 + ((h - trackTop - 10) * i) / lanes), w, 1)
}
