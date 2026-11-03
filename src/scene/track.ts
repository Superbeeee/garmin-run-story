/**
 * 《薩爾達傳說：眾神的三角力量 & 四支劍》16-bit 海拉魯原野與四支劍聖域跑道場景。
 * 原型為 192×108 預覽場景，寬度可無限延伸：死亡之山、海拉魯城堡、圓頂像素樹、可砍草叢與石板古道皆可無縫重複。
 */
export const PREVIEW_W = 192
export const PREVIEW_H = 108
/** 預覽場景中角色腳底的 y */
export const PREVIEW_GROUND = 97

/** 繪製 16-bit 海拉魯晴空、死亡之山、海拉魯城堡與迷途森林樹冠（0 ～ skyBottom） */
function drawAlttpSkyAndHorizon(ctx: CanvasRenderingContext2D, w: number, skyBottom: number, tileW: number): void {
  // 16-bit 藍天色帶（GBA 眾神的三角力量明亮天空）
  const h1 = Math.round(skyBottom * 0.34)
  const h2 = Math.round(skyBottom * 0.68)
  ctx.fillStyle = '#4888e0'
  ctx.fillRect(0, 0, w, h1)
  ctx.fillStyle = '#68a8f0'
  ctx.fillRect(0, h1, w, h2 - h1)
  ctx.fillStyle = '#98ccf8'
  ctx.fillRect(0, h2, w, skyBottom - h2)

  for (let ox = 0; ox < w; ox += tileW) {
    // 遠方「死亡之山（Death Mountain）」棕岩山脈與山頂雲環
    const mx = ox + Math.round(tileW * 0.62)
    for (let row = 0; row < 20; row++) {
      const rw = 8 + row * 2
      ctx.fillStyle = '#685048'
      ctx.fillRect(mx - Math.floor(rw / 2), skyBottom - 26 + row, rw, 1)
      ctx.fillStyle = '#886858'
      ctx.fillRect(mx - Math.floor(rw / 2) + 2, skyBottom - 26 + row, Math.max(2, rw - 6), 1)
    }
    // 死亡之山山頂白雲環
    ctx.fillStyle = '#d8e8f8'
    ctx.fillRect(mx - 11, skyBottom - 23, 22, 3)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(mx - 9, skyBottom - 24, 18, 2)

    // 遠方「海拉魯城堡（Hyrule Castle）」16-bit 藍紅尖塔與城牆
    const cx = ox + Math.round(tileW * 0.2)
    const cy = skyBottom - 8
    // 城牆基座
    ctx.fillStyle = '#98a0b0'
    ctx.fillRect(cx - 10, cy - 11, 20, 11)
    ctx.fillStyle = '#d0d8e0'
    ctx.fillRect(cx - 8, cy - 10, 16, 9)
    // 中央主塔與左右副塔
    ctx.fillStyle = '#d0d8e0'
    ctx.fillRect(cx - 4, cy - 18, 8, 8)
    ctx.fillRect(cx - 11, cy - 15, 5, 5)
    ctx.fillRect(cx + 6, cy - 15, 5, 5)
    // 眾神經典藍／紅斜屋頂
    ctx.fillStyle = '#d83848'
    ctx.fillRect(cx - 5, cy - 20, 10, 2)
    ctx.fillRect(cx - 3, cy - 22, 6, 2)
    ctx.fillRect(cx - 1, cy - 24, 2, 2)
    ctx.fillStyle = '#3868c8'
    ctx.fillRect(cx - 12, cy - 17, 7, 2)
    ctx.fillRect(cx - 10, cy - 19, 3, 2)
    ctx.fillRect(cx + 5, cy - 17, 7, 2)
    ctx.fillRect(cx + 7, cy - 19, 3, 2)
    // 城門與金色三角神力紋章
    ctx.fillStyle = '#282838'
    ctx.fillRect(cx - 2, cy - 6, 4, 6)
    ctx.fillStyle = '#f8d038'
    ctx.fillRect(cx - 1, cy - 15, 2, 2)

    // 16-bit 像素浮雲
    ctx.fillStyle = '#d0e4f8'
    ctx.fillRect(ox + 12, 13, 28, 4)
    ctx.fillRect(ox + 112, 19, 32, 4)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(ox + 14, 10, 24, 5)
    ctx.fillRect(ox + 19, 7, 14, 3)
    ctx.fillRect(ox + 114, 16, 28, 5)
    ctx.fillRect(ox + 120, 13, 16, 3)

    // 眾神的三角力量經典翠綠森林樹叢（背景遠樹）
    ctx.fillStyle = '#185828'
    ctx.fillRect(ox, skyBottom - 8, tileW, 8)
    ctx.fillStyle = '#288838'
    ctx.fillRect(ox, skyBottom - 6, tileW, 6)
    for (let tx = 4; tx < tileW - 12; tx += 22) {
      ctx.fillStyle = '#185828'
      ctx.fillRect(ox + tx, skyBottom - 12, 14, 5)
      ctx.fillStyle = '#288838'
      ctx.fillRect(ox + tx + 1, skyBottom - 11, 12, 4)
      ctx.fillStyle = '#58c048'
      ctx.fillRect(ox + tx + 3, skyBottom - 11, 8, 2)
    }
  }
}

/** 繪製海拉魯原野草地、經典可砍草叢、木樁與四支劍聖域石座（vergeTop ～ trackTop） */
function drawAlttpVerge(ctx: CanvasRenderingContext2D, w: number, vergeTop: number, trackTop: number, withSanctuary = false): void {
  const vergeH = Math.max(4, trackTop - vergeTop)
  // 眾神經典亮綠草地底色
  ctx.fillStyle = '#309838'
  ctx.fillRect(0, vergeTop, w, vergeH)
  ctx.fillStyle = '#58c048'
  ctx.fillRect(0, vergeTop, w, 2)
  ctx.fillStyle = '#207028'
  ctx.fillRect(0, trackTop - 2, w, 2)

  // 草地上的深淺 V 字草紋與經典可砍圓草叢（Bush）+ 木槌木樁
  for (let x = 6; x < w - 10; x += 24) {
    // 眾神經典可砍圓草叢（深綠底 + 翠綠葉 + 亮綠高光）
    const by = vergeTop - 2
    ctx.fillStyle = '#144820'
    ctx.fillRect(x, by, 8, 6)
    ctx.fillStyle = '#288838'
    ctx.fillRect(x + 1, by, 6, 5)
    ctx.fillStyle = '#68d848'
    ctx.fillRect(x + 2, by + 1, 4, 2)

    // 路旁小紅花／藍盧比光點（四支劍四色點綴）
    if (x + 14 < w) {
      const jewelColors = ['#58d858', '#f84848', '#4898f8', '#b868f8']
      const jc = jewelColors[Math.floor(x / 24) % 4]
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x + 13, vergeTop + 2, 3, 3)
      ctx.fillStyle = jc
      ctx.fillRect(x + 14, vergeTop + 2, 2, 2)
    }
  }

  // 多人跑道中央：四支劍聖域（Four Sword Sanctuary）石造祭壇與三角神力金紋
  if (withSanctuary) {
    const sx = Math.round(w * 0.5) - 14
    const sy = vergeTop - 16
    // 聖域石座與雙柱
    ctx.fillStyle = '#282c3c'
    ctx.fillRect(sx - 1, sy, 30, 18)
    ctx.fillStyle = '#788098'
    ctx.fillRect(sx, sy + 1, 28, 16)
    ctx.fillStyle = '#b0b8c8'
    ctx.fillRect(sx + 2, sy + 2, 24, 13)
    // 四支劍拱門深底
    ctx.fillStyle = '#182038'
    ctx.fillRect(sx + 6, sy + 5, 16, 12)
    // 黃金三角神力（Triforce）標誌
    ctx.fillStyle = '#f8d038'
    ctx.fillRect(sx + 13, sy + 6, 2, 2)
    ctx.fillRect(sx + 11, sy + 8, 2, 2)
    ctx.fillRect(sx + 15, sy + 8, 2, 2)
    // 祭壇中插著的四支劍（Four Sword）劍柄
    ctx.fillStyle = '#f8d038'
    ctx.fillRect(sx + 12, sy + 12, 4, 1)
    ctx.fillStyle = '#4888f8'
    ctx.fillRect(sx + 13, sy + 10, 2, 2)
    ctx.fillStyle = '#d8e8ff'
    ctx.fillRect(sx + 13, sy + 13, 2, 3)
  }
}

/** 繪製眾神的三角力量石板古道與黃土跑道（trackTop ～ h） */
function drawAlttpRoad(ctx: CanvasRenderingContext2D, w: number, h: number, trackTop: number, lanes: number): void {
  const trackH = h - trackTop
  // 海拉魯溫暖黃土石道底色
  ctx.fillStyle = '#d8b068'
  ctx.fillRect(0, trackTop, w, trackH)
  ctx.fillStyle = '#e8c880'
  ctx.fillRect(0, trackTop + 4, w, Math.max(0, trackH - 8))

  // 上下緣眾神經典立體灰白石磚路緣（Cobblestone Curb）
  ctx.fillStyle = '#383028'
  ctx.fillRect(0, trackTop, w, 4)
  ctx.fillRect(0, h - 4, w, 4)
  for (let x = 0; x < w; x += 12) {
    ctx.fillStyle = '#98a0a8'
    ctx.fillRect(x + 1, trackTop + 1, 10, 2)
    ctx.fillRect(x + 1, h - 3, 10, 2)
    ctx.fillStyle = '#c8d0d8'
    ctx.fillRect(x + 1, trackTop + 1, 9, 1)
    ctx.fillRect(x + 1, h - 3, 9, 1)
  }

  // 跑道分道線：海拉魯石板縫與金色三角紋點綴
  for (let i = 1; i < lanes; i++) {
    const ly = Math.round(trackTop + 4 + ((trackH - 8) * i) / lanes)
    ctx.fillStyle = '#b88840'
    ctx.fillRect(0, ly, w, 1)
    ctx.fillStyle = '#f0d898'
    for (let x = (i % 2) * 10; x < w; x += 20) {
      ctx.fillRect(x, ly + 1, 12, 1)
    }
  }

  // 石道上的像素小鵝卵石與三角神力地磚紋
  for (let x = 14; x < w; x += 36) {
    const py = trackTop + 8 + ((x * 7) % Math.max(6, trackH - 16))
    ctx.fillStyle = '#c09448'
    ctx.fillRect(x, py, 3, 2)
    ctx.fillStyle = '#f0d898'
    ctx.fillRect(x, py, 2, 1)
  }
}

export function drawPreviewTrack(ctx: CanvasRenderingContext2D, w = PREVIEW_W): void {
  drawAlttpSkyAndHorizon(ctx, w, 56, PREVIEW_W)
  drawAlttpVerge(ctx, w, 56, 66, false)
  drawAlttpRoad(ctx, w, PREVIEW_H, 66, 2)
}

/** 多人跑道：上方海拉魯原野與四支劍聖域，下方石板古道（trackTop 以下） */
export function drawCrowdTrack(ctx: CanvasRenderingContext2D, w: number, h: number, trackTop: number): void {
  const vergeTop = Math.max(12, trackTop - 10)
  drawAlttpSkyAndHorizon(ctx, w, vergeTop, 192)
  drawAlttpVerge(ctx, w, vergeTop, trackTop, true)
  drawAlttpRoad(ctx, w, h, trackTop, 6)
}
