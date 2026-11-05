/**
 * 薩爾達風格跑道背景（海拉魯平原與古代石板大道）。
 * 原型為 192×108 預覽場景，寬度可無限延伸，遠山、雙子山、靜謐公主花叢與石板路皆可無縫重複。
 */
export const PREVIEW_W = 192
export const PREVIEW_H = 108
/** 預覽場景中角色腳底的 y */
export const PREVIEW_GROUND = 97

/** 繪製海拉魯天空、雙子山遠景、流雲與森林草坡（0 ～ skyBottom） */
function drawHyruleSkyAndHills(ctx: CanvasRenderingContext2D, w: number, skyBottom: number, tileW: number): void {
  // 分層晴空漸層色帶（曠野之息風格天空）
  const h1 = Math.round(skyBottom * 0.28)
  const h2 = Math.round(skyBottom * 0.56)
  const h3 = Math.round(skyBottom * 0.82)
  ctx.fillStyle = '#5c9ec8'
  ctx.fillRect(0, 0, w, h1)
  ctx.fillStyle = '#7eb7d8'
  ctx.fillRect(0, h1, w, h2 - h1)
  ctx.fillStyle = '#a7d3da'
  ctx.fillRect(0, h2, w, h3 - h2)
  ctx.fillStyle = '#d6e8cf'
  ctx.fillRect(0, h3, w, skyBottom - h3)

  for (let ox = 0; ox < w; ox += tileW) {
    // 遠方雙子山（Dueling Peaks）剪影
    const mx = ox + Math.round(tileW * 0.52)
    ctx.fillStyle = '#89aec0'
    for (let row = 0; row < 18; row++) {
      // 左峰與右峰中間留一道峽谷裂隙
      ctx.fillRect(mx - row, skyBottom - 26 + row, row + 2, 1)
      ctx.fillRect(mx + 6, skyBottom - 24 + row, row + 2, 1)
    }
    // 遠方海拉魯城堡尖塔剪影
    const cx = ox + Math.round(tileW * 0.16)
    ctx.fillStyle = '#95b7c7'
    ctx.fillRect(cx, skyBottom - 20, 5, 12)
    ctx.fillRect(cx + 1, skyBottom - 24, 3, 4)
    ctx.fillRect(cx + 2, skyBottom - 27, 1, 3)
    ctx.fillRect(cx - 3, skyBottom - 16, 2, 8)
    ctx.fillRect(cx + 6, skyBottom - 16, 2, 8)

    // 暖白流雲（上層亮金白、下層淡藍灰陰影）
    ctx.fillStyle = '#d8e7ef'
    ctx.fillRect(ox + 16, 15, 30, 4)
    ctx.fillRect(ox + 118, 23, 34, 4)
    ctx.fillStyle = '#fbf9ed'
    ctx.fillRect(ox + 18, 12, 26, 5)
    ctx.fillRect(ox + 24, 9, 14, 4)
    ctx.fillRect(ox + 120, 20, 30, 5)
    ctx.fillRect(ox + 127, 16, 16, 4)

    // 遠處起伏的翠綠丘陵
    ctx.fillStyle = '#6da67a'
    ctx.fillRect(ox, skyBottom - 10, tileW, 6)
    ctx.fillRect(ox + 12, skyBottom - 13, 44, 3)
    ctx.fillRect(ox + 30, skyBottom - 15, 20, 2)
    ctx.fillRect(ox + 96, skyBottom - 12, 52, 2)
    ctx.fillRect(ox + 110, skyBottom - 14, 24, 2)

    // 近景森林草坡
    ctx.fillStyle = '#4e8a62'
    ctx.fillRect(ox, skyBottom - 6, tileW, 6)
    ctx.fillRect(ox + 4, skyBottom - 8, 28, 2)
    ctx.fillRect(ox + 68, skyBottom - 8, 36, 2)
    ctx.fillRect(ox + 144, skyBottom - 7, 26, 2)
  }
}

/** 繪製路旁草地、古代石欄杆與靜謐公主小花（vergeTop ～ trackTop） */
function drawRoadsideVerge(ctx: CanvasRenderingContext2D, w: number, vergeTop: number, trackTop: number, withShrine = false): void {
  // 古代石造矮欄杆
  ctx.fillStyle = '#6b7785'
  ctx.fillRect(0, vergeTop, w, 2)
  ctx.fillStyle = '#9aa6b2'
  ctx.fillRect(0, vergeTop, w, 1)
  for (let i = 4; i < w; i += 12) {
    ctx.fillStyle = '#55606e'
    ctx.fillRect(i, vergeTop - 2, 3, 7)
    ctx.fillStyle = '#aeb9c4'
    ctx.fillRect(i, vergeTop - 2, 2, 2)
  }

  // 翠綠草地帶
  const grassTop = vergeTop + 4
  const grassH = Math.max(2, trackTop - grassTop)
  ctx.fillStyle = '#3f8454'
  ctx.fillRect(0, grassTop, w, grassH)
  ctx.fillStyle = '#63ab66'
  ctx.fillRect(0, grassTop, w, Math.min(2, grassH))

  // 草叢細節與「靜謐公主（Silent Princess）」藍白小花 + 向陽草金花
  for (let i = 6; i < w; i += 24) {
    // 靜謐公主（淡藍花瓣 + 白蕊）
    ctx.fillStyle = '#67e8f9'
    ctx.fillRect(i, grassTop + 1, 3, 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(i + 1, grassTop + 1, 1, 1)
    // 向陽草（金色小花）
    if (i + 13 < w) {
      ctx.fillStyle = '#f5c84c'
      ctx.fillRect(i + 13, grassTop + 2, 2, 2)
      ctx.fillStyle = '#fff3b0'
      ctx.fillRect(i + 13, grassTop + 2, 1, 1)
    }
  }

  // 預覽場景專屬：路旁希卡導引石碑與三角紋章
  if (withShrine) {
    const sx = 10
    const sy = vergeTop - 11
    ctx.fillStyle = '#4a5564'
    ctx.fillRect(sx, sy + 2, 7, 13)
    ctx.fillStyle = '#738091'
    ctx.fillRect(sx + 1, sy, 5, 14)
    ctx.fillStyle = '#2d3540'
    ctx.fillRect(sx + 2, sy + 3, 3, 6)
    // 發光的希卡藍符文心
    ctx.fillStyle = '#4deeea'
    ctx.fillRect(sx + 3, sy + 4, 1, 3)
    ctx.fillStyle = '#bef8fd'
    ctx.fillRect(sx + 3, sy + 5, 1, 1)
  }
}

export function drawPreviewTrack(ctx: CanvasRenderingContext2D, w = PREVIEW_W): void {
  drawHyruleSkyAndHills(ctx, w, 56, PREVIEW_W)
  drawRoadsideVerge(ctx, w, 56, 66, true)

  // 海拉魯古代石板跑道（66 ～ 108）
  ctx.fillStyle = '#3b4b5c'
  ctx.fillRect(0, 66, w, 42)
  // 上下石板路緣（暖沙金石磚）
  ctx.fillStyle = '#c8b892'
  ctx.fillRect(0, 66, w, 2)
  ctx.fillRect(0, 106, w, 2)
  ctx.fillStyle = '#8b7b5b'
  ctx.fillRect(0, 68, w, 1)

  // 石板磚縫與紋理
  ctx.fillStyle = '#32404f'
  for (let ox = 0; ox < w; ox += 16) {
    ctx.fillRect(ox + 4, 76, 8, 1)
    ctx.fillRect(ox, 86, 10, 1)
    ctx.fillRect(ox + 8, 96, 8, 1)
    ctx.fillRect(ox + 7, 70, 1, 6)
    ctx.fillRect(ox + 13, 86, 1, 10)
  }
  ctx.fillStyle = '#47596d'
  for (let ox = 0; ox < w; ox += 24) {
    ctx.fillRect(ox + 2, 71, 6, 1)
    ctx.fillRect(ox + 14, 89, 7, 1)
    ctx.fillRect(ox + 6, 99, 5, 1)
  }

  // 跑道黃金符文標線
  ctx.fillStyle = '#e5cf94'
  ctx.fillRect(0, 74, w, 1)
  ctx.fillRect(0, 104, w, 1)
}

/** 多人跑道：上方海拉魯天空與遠山草坡，下方寬石板跑道（trackTop 以下） */
export function drawCrowdTrack(ctx: CanvasRenderingContext2D, w: number, h: number, trackTop: number): void {
  const vergeTop = trackTop - 10
  drawHyruleSkyAndHills(ctx, w, vergeTop, 160)
  drawRoadsideVerge(ctx, w, vergeTop, trackTop, false)

  // 寬石板跑道基底
  const trackH = h - trackTop
  ctx.fillStyle = '#3b4b5c'
  ctx.fillRect(0, trackTop, w, trackH)

  // 跑道上緣石磚鑲邊
  ctx.fillStyle = '#c8b892'
  ctx.fillRect(0, trackTop, w, 2)
  ctx.fillStyle = '#8b7b5b'
  ctx.fillRect(0, trackTop + 2, w, 1)

  // 石板紋理塊
  ctx.fillStyle = '#334150'
  for (let y = trackTop + 10; y < h - 4; y += 14) {
    const shift = ((y * 7) % 16)
    for (let x = shift; x < w; x += 22) {
      ctx.fillRect(x, y, 10, 1)
      ctx.fillRect(x + 4, y - 3, 1, 3)
    }
  }
  ctx.fillStyle = '#46586b'
  for (let y = trackTop + 16; y < h - 4; y += 18) {
    const shift = ((y * 11) % 20)
    for (let x = shift; x < w; x += 28) {
      ctx.fillRect(x, y, 8, 1)
    }
  }

  // 跑道分道線（溫潤象牙金石線）
  ctx.fillStyle = '#e6dbb8'
  const lanes = 6
  for (let i = 0; i <= lanes; i++) {
    const ly = Math.round(trackTop + 6 + ((trackH - 10) * i) / lanes)
    ctx.fillRect(0, ly, w, 1)
  }
}
