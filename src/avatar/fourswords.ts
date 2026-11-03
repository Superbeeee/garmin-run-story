/**
 * 《薩爾達傳說：眾神的三角力量 & 四支劍》風格像素角色繪製器
 *
 * 以 GBA《四支劍／縮小帽》與 SNES《眾神的三角力量》的 16-bit 二頭身 Q 版比例繪製：
 * - 大頭、海利亞長尖耳、粗眉大眼（貓眼林克風）、鬢角
 * - 勇者戰袍（含皮帶、金釦、衣擺與背後四支劍柄／海利亞盾）
 * - 飛馬靴、長尖勇者帽、海拉魯皇冠與賢者魔導帽
 *
 * 完全相容既有 AvatarConfig、圖層結構（Slot）與 6 階調色盤（palettes.json）。
 */
import palettesJson from '../assets/palettes.json'
import { EYES } from './catalog'
import type { Material, SheetName } from './types'

export const FRAME = 64

type Box = [top: number, cx: number, right: number]
interface Palette {
  base: string
  colors: Record<string, string[]>
}

const PALETTES = palettesJson as Record<Material, Palette>

const SHEET_FRAMES: Record<SheetName, number> = {
  idle: 2,
  walk: 9,
  run: 8,
  jump: 5,
  front: 1,
}

/** 取得 6 階色碼 [0:極深描邊, 1:深暗, 2:暗, 3:中, 4:主色, 5:高光] */
function getShades(material: Material, pal: string): readonly string[] {
  const P = PALETTES[material]
  const colorName = material === 'body' ? pal.split('+')[0] : pal
  return P.colors[colorName] ?? P.colors[P.base]
}

function getEyeShades(pal: string): readonly [string, string, string] {
  const eye = pal.split('+')[1] ?? 'blue'
  return EYES[eye] ?? EYES.blue
}

/** 每一格的肢體動態參數（GBA 四支劍風格彈跳步伐） */
interface Motion {
  /** 身體上下起伏 */
  bob: number
  /** 頭部額外起伏（慢半拍感） */
  headBob: number
  /** 身體前傾像素（跑步衝刺感） */
  lean: number
  /** 左腳（遠端腳）前後與高低位移 */
  lFootX: number
  lFootY: number
  /** 右腳（近端腳）前後與高低位移 */
  rFootX: number
  rFootY: number
  /** 左手（遠端手）、右手（近端手）擺動 */
  lArmX: number
  lArmY: number
  rArmX: number
  rArmY: number
  /** 勇者尖帽／馬尾尾端飄動位移 */
  tailDx: number
  tailDy: number
}

function getMotion(sheet: SheetName, frame: number): Motion {
  if (sheet === 'front') {
    return {
      bob: 0,
      headBob: 0,
      lean: 0,
      lFootX: 0,
      lFootY: 0,
      rFootX: 0,
      rFootY: 0,
      lArmX: 0,
      lArmY: 0,
      rArmX: 0,
      rArmY: 0,
      tailDx: 0,
      tailDy: 0,
    }
  }
  if (sheet === 'idle') {
    const f = frame % 2
    return {
      bob: f === 1 ? 1 : 0,
      headBob: f === 1 ? 1 : 0,
      lean: 0,
      lFootX: 0,
      lFootY: 0,
      rFootX: 0,
      rFootY: 0,
      lArmX: 0,
      lArmY: f === 1 ? 1 : 0,
      rArmX: 0,
      rArmY: f === 1 ? 1 : 0,
      tailDx: 0,
      tailDy: f === 1 ? 1 : 0,
    }
  }
  if (sheet === 'walk') {
    // frame 1..8 為 8 格步行循環
    const idx = (frame <= 0 ? 0 : frame - 1) % 8
    const strideX = [-3, -2, 0, 2, 3, 2, 0, -2][idx]
    const liftL = [0, 0, -2, -1, 0, 0, 0, 0][idx]
    const liftR = [0, 0, 0, 0, 0, 0, -2, -1][idx]
    const bob = [0, -1, -1, 0, 0, -1, -1, 0][idx]
    return {
      bob,
      headBob: bob,
      lean: 0,
      lFootX: strideX,
      lFootY: liftL,
      rFootX: -strideX,
      rFootY: liftR,
      lArmX: -strideX,
      lArmY: Math.abs(strideX) >= 2 ? -1 : 0,
      rArmX: strideX,
      rArmY: Math.abs(strideX) >= 2 ? -1 : 0,
      tailDx: -1,
      tailDy: bob === -1 ? 1 : 0,
    }
  }
  if (sheet === 'run') {
    // 8 格四支劍飛馬靴衝刺循環
    const idx = frame % 8
    const strideX = [-5, -3, 0, 4, 5, 3, 0, -4][idx]
    const liftL = [-1, 0, -3, -2, -1, 0, 0, 0][idx]
    const liftR = [-1, 0, 0, 0, -1, 0, -3, -2][idx]
    const bob = [0, 1, -2, -1, 0, 1, -2, -1][idx]
    return {
      bob,
      headBob: bob,
      lean: 2,
      lFootX: strideX,
      lFootY: liftL,
      rFootX: -strideX,
      rFootY: liftR,
      lArmX: -Math.round(strideX * 0.9),
      lArmY: -1,
      rArmX: Math.round(strideX * 0.9),
      rArmY: -1,
      tailDx: -3,
      tailDy: idx % 4 < 2 ? -1 : 1,
    }
  }
  // jump: 5 格跳躍
  const idx = Math.min(4, Math.max(0, frame))
  const bobs = [2, -1, -2, -2, 1]
  const lYs = [0, -1, -3, -2, 0]
  const rYs = [0, -2, -4, -3, 0]
  const armYs = [1, -2, -5, -4, 0]
  return {
    bob: bobs[idx],
    headBob: bobs[idx],
    lean: idx === 2 || idx === 3 ? 1 : 0,
    lFootX: idx === 2 || idx === 3 ? -2 : 0,
    lFootY: lYs[idx],
    rFootX: idx === 2 || idx === 3 ? 2 : 0,
    rFootY: rYs[idx],
    lArmX: idx === 2 || idx === 3 ? -2 : 0,
    lArmY: armYs[idx],
    rArmX: idx === 2 || idx === 3 ? 3 : 0,
    rArmY: armYs[idx],
    tailDx: -2,
    tailDy: idx === 2 || idx === 3 ? 2 : 0,
  }
}

/** 畫單一像素矩形 */
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** 畫有深色描邊的像素塊 */
function outlinedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  outline: string,
  hi?: string,
  sh?: string,
): void {
  rect(ctx, x - 1, y, w + 2, h, outline)
  rect(ctx, x, y - 1, w, h + 2, outline)
  rect(ctx, x, y, w, h, fill)
  if (sh && h >= 2) rect(ctx, x, y + h - 1, w, 1, sh)
  if (hi && h >= 2) rect(ctx, x, y, w, 1, hi)
}

// ============================================================================
// 1. 身體 (body/{male|female|muscular|teen})
// ============================================================================
function drawBodyFrame(ctx: CanvasRenderingContext2D, ox: number, build: string, sheet: SheetName, frame: number, pal: string): void {
  const S = getShades('body', pal)
  const out = '#141622'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const by = m.bob

  const torsoW = build === 'muscular' ? 14 : build === 'teen' ? 10 : 12
  const halfW = Math.floor(torsoW / 2)

  if (sheet === 'front') {
    // 脖子
    rect(ctx, cx - 3, 35, 6, 4, S[3])
    // 雙腿基底
    outlinedBox(ctx, cx - 5, 49, 4, 8, S[4], out, S[5], S[3])
    outlinedBox(ctx, cx + 1, 49, 4, 8, S[4], out, S[5], S[3])
    // 軀幹基底
    outlinedBox(ctx, cx - halfW, 38, torsoW, 11, S[4], out, S[5], S[3])
    // 左右手臂與小拳頭
    const armW = build === 'muscular' ? 4 : 3
    outlinedBox(ctx, cx - halfW - armW, 39, armW, 8, S[4], out, S[5], S[3])
    outlinedBox(ctx, cx + halfW, 39, armW, 8, S[4], out, S[5], S[3])
    // 拳頭
    outlinedBox(ctx, cx - halfW - armW, 46, armW, 3, S[4], out, S[5], S[2])
    outlinedBox(ctx, cx + halfW, 46, armW, 3, S[4], out, S[5], S[2])
    return
  }

  // 側面（面向右，3/4 視角）
  // 遠端手臂（左手）
  const lx = cx + 2 + m.lArmX
  const ly = 39 + by + m.lArmY
  outlinedBox(ctx, lx, ly, 3, 7, S[3], out, S[4], S[2])
  // 脖子
  rect(ctx, cx - 3, 35 + by, 5, 4, S[3])
  // 雙腿基底
  outlinedBox(ctx, cx - 2 + m.lFootX, 49 + by + m.lFootY, 4, 7, S[3], out, undefined, S[2])
  outlinedBox(ctx, cx - 2 + m.rFootX, 49 + by + m.rFootY, 4, 7, S[4], out, S[5], S[3])
  // 軀幹基底
  outlinedBox(ctx, cx - halfW + 1, 38 + by, torsoW - 2, 11, S[4], out, S[5], S[3])
  // 近端手臂（右手）與拳頭
  const armW = build === 'muscular' ? 4 : 3
  const rx = cx - 3 + m.rArmX
  const ry = 39 + by + m.rArmY
  outlinedBox(ctx, rx, ry, armW, 7, S[4], out, S[5], S[3])
  outlinedBox(ctx, rx, ry + 6, armW, 3, S[4], out, S[5], S[2])
}

// ============================================================================
// 2. 鞋子：飛馬靴 / 勇者長靴 (shoes/{male|thin})
// ============================================================================
function drawShoesFrame(ctx: CanvasRenderingContext2D, ox: number, fit: string, sheet: SheetName, frame: number, pal: string): void {
  const C = getShades('cloth', pal)
  const out = '#141622'
  const sole = '#e8d8b8'
  const cuffGold = '#f5c84c'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const by = m.bob
  const bootW = fit === 'male' ? 5 : 4

  if (sheet === 'front') {
    // 左靴、右靴（含靴口反摺與白底）
    for (const bx of [cx - 6, cx + 1]) {
      outlinedBox(ctx, bx, 54, bootW, 7, C[4], out, C[5], C[2])
      // 飛馬靴反摺護踝與金邊
      rect(ctx, bx - 1, 54, bootW + 2, 2, C[3])
      rect(ctx, bx, 54, bootW, 1, cuffGold)
      // 靴底
      rect(ctx, bx, 60, bootW, 1, sole)
    }
    return
  }

  // 遠端腳（左腳）
  const lx = cx - 2 + m.lFootX
  const ly = 55 + Math.round(by * 0.5) + m.lFootY
  outlinedBox(ctx, lx, ly, bootW, 6, C[3], out, C[4], C[1])
  rect(ctx, lx + bootW, ly + 3, 1, 3, C[3])
  rect(ctx, lx + bootW + 1, ly + 3, 1, 3, out)
  rect(ctx, lx, ly, bootW, 1, cuffGold)
  rect(ctx, lx, ly + 5, bootW + 1, 1, sole)

  // 近端腳（右腳）
  const rx = cx - 3 + m.rFootX
  const ry = 55 + Math.round(by * 0.5) + m.rFootY
  outlinedBox(ctx, rx, ry, bootW, 6, C[4], out, C[5], C[2])
  // 勇者靴尖微翹
  rect(ctx, rx + bootW, ry + 3, 2, 3, C[4])
  rect(ctx, rx + bootW, ry + 2, 2, 1, out)
  rect(ctx, rx + bootW + 2, ry + 3, 1, 3, out)
  rect(ctx, rx + bootW, ry + 6, 2, 1, out)
  // 靴口金邊與鞋底
  rect(ctx, rx, ry, bootW, 1, cuffGold)
  rect(ctx, rx, ry + 5, bootW + 1, 1, sole)
}

// ============================================================================
// 3. 褲子 (legs/{shortshorts|shorts|leggings}/{male|thin})
// ============================================================================
function drawLegsFrame(ctx: CanvasRenderingContext2D, ox: number, style: string, fit: string, sheet: SheetName, frame: number, pal: string): void {
  const C = getShades('cloth', pal)
  const out = '#141622'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const by = m.bob
  const legH = style === 'shortshorts' ? 3 : style === 'shorts' ? 4 : 6
  const legW = fit === 'male' ? 5 : 4

  if (sheet === 'front') {
    outlinedBox(ctx, cx - 6, 48, 12, 3, C[3], out, C[4], C[2])
    outlinedBox(ctx, cx - 6, 49, legW, legH, C[4], out, C[5], C[2])
    outlinedBox(ctx, cx + 1, 49, legW, legH, C[4], out, C[5], C[2])
    return
  }

  // 遠端腿
  const lx = cx - 2 + Math.round(m.lFootX * 0.7)
  const ly = 49 + by + Math.round(m.lFootY * 0.6)
  outlinedBox(ctx, lx, ly, legW - 1, legH, C[2], out, C[3], C[1])

  // 近端腿
  const rx = cx - 3 + Math.round(m.rFootX * 0.7)
  const ry = 49 + by + Math.round(m.rFootY * 0.6)
  outlinedBox(ctx, rx, ry, legW, legH, C[4], out, C[5], C[2])
}

// ============================================================================
// 4. 上衣：四支劍勇者戰袍 (top/{singlet|tshirt|scoop|vneck|tscoop|lscoop}/{male|female|teen})
// ============================================================================
function drawTopFrame(ctx: CanvasRenderingContext2D, ox: number, style: string, fit: string, sheet: SheetName, frame: number, pal: string): void {
  const C = getShades('cloth', pal)
  const out = '#141622'
  const beltDark = '#3a2010'
  const beltMid = '#683c1c'
  const gold = '#f8d038'
  const goldLo = '#b87c14'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const by = m.bob
  const torsoW = fit === 'teen' ? 12 : 14
  const halfW = Math.floor(torsoW / 2)

  if (sheet === 'front') {
    // 背後斜背的四支劍劍柄（左肩上方探出）
    rect(ctx, cx - halfW - 2, 31, 4, 2, out)
    rect(ctx, cx - halfW - 1, 32, 2, 5, '#4868c8')
    rect(ctx, cx - halfW - 3, 35, 6, 2, gold)
    rect(ctx, cx - halfW - 1, 31, 2, 2, gold)

    // 戰袍主體（含經典短裙擺）
    outlinedBox(ctx, cx - halfW, 38, torsoW, 12, C[4], out, C[5], C[2])
    // 側邊高光與暗面
    rect(ctx, cx - halfW, 39, 2, 10, C[5])
    rect(ctx, cx + halfW - 2, 39, 2, 10, C[3])

    // 領口設計（依款式變化）
    if (style === 'vneck' || style === 'tshirt' || style === 'tscoop') {
      // 四支劍經典 V 字白色內襯與金色滾邊
      rect(ctx, cx - 2, 38, 4, 2, '#f8f4e8')
      rect(ctx, cx - 1, 40, 2, 2, '#dcd4be')
      rect(ctx, cx - 3, 38, 1, 3, C[2])
      rect(ctx, cx + 2, 38, 1, 3, C[2])
    } else if (style === 'scoop' || style === 'lscoop') {
      // 皇室圓領金邊
      rect(ctx, cx - 3, 38, 6, 2, gold)
      rect(ctx, cx - 2, 38, 4, 1, '#f8f4e8')
    } else {
      // singlet 背心肩帶與胸前小三角紋章
      rect(ctx, cx - 1, 41, 2, 1, gold)
      rect(ctx, cx - 2, 42, 4, 1, gold)
    }

    // 袖子（singlet 無袖，lscoop 長袖，其餘勇者短袖）
    if (style !== 'singlet') {
      const sleeveH = style === 'lscoop' ? 7 : 4
      const sleeveC = style === 'lscoop' ? C[3] : C[4]
      outlinedBox(ctx, cx - halfW - 3, 38, 3, sleeveH, sleeveC, out, C[5], C[2])
      outlinedBox(ctx, cx + halfW, 38, 3, sleeveH, sleeveC, out, C[5], C[2])
      if (style === 'lscoop') {
        rect(ctx, cx - halfW - 3, 38 + sleeveH - 1, 3, 1, gold)
        rect(ctx, cx + halfW, 38 + sleeveH - 1, 3, 1, gold)
      }
    }

    // 經典皮帶與大金釦
    rect(ctx, cx - halfW, 45, torsoW, 3, beltDark)
    rect(ctx, cx - halfW + 1, 45, torsoW - 2, 2, beltMid)
    // 金色皮帶釦
    rect(ctx, cx - 2, 45, 4, 3, goldLo)
    rect(ctx, cx - 2, 45, 4, 2, gold)
    rect(ctx, cx - 1, 46, 2, 1, beltDark)
    return
  }

  // 側面（面向右）
  // 背後的四支劍與海利亞盾邊緣
  const backX = cx - halfW
  rect(ctx, backX - 3, 33 + by, 3, 2, gold)
  rect(ctx, backX - 2, 31 + by, 2, 3, '#4868c8')
  rect(ctx, backX - 3, 30 + by, 4, 1, out)
  // 背盾側面弧線
  outlinedBox(ctx, backX - 3, 39 + by, 2, 8, '#3a5098', out, '#98b0d8', '#202c58')
  rect(ctx, backX - 3, 41 + by, 2, 2, gold)

  // 戰袍本體與下擺
  const bodyW = torsoW - 2
  const bx = cx - halfW + 1
  outlinedBox(ctx, bx, 38 + by, bodyW, 12, C[4], out, C[5], C[2])
  rect(ctx, bx + bodyW - 3, 39 + by, 2, 10, C[5])
  rect(ctx, bx, 39 + by, 2, 10, C[3])

  // 領口金邊或內襯
  if (style === 'vneck' || style === 'tshirt' || style === 'tscoop') {
    rect(ctx, bx + bodyW - 3, 38 + by, 2, 3, '#f8f4e8')
  } else if (style === 'scoop' || style === 'lscoop') {
    rect(ctx, bx + 2, 38 + by, bodyW - 3, 1, gold)
  }

  // 皮帶與金釦（側面偏右前）
  rect(ctx, bx, 45 + by, bodyW, 3, beltDark)
  rect(ctx, bx + 1, 45 + by, bodyW - 2, 2, beltMid)
  rect(ctx, bx + bodyW - 4, 45 + by, 3, 3, goldLo)
  rect(ctx, bx + bodyW - 4, 45 + by, 3, 2, gold)

  // 近端手臂的戰袍袖子
  if (style !== 'singlet') {
    const sleeveH = style === 'lscoop' ? 6 : 4
    const rx = cx - 3 + m.rArmX
    const ry = 39 + by + m.rArmY
    outlinedBox(ctx, rx, ry, 4, sleeveH, C[4], out, C[5], C[2])
    if (style === 'lscoop') rect(ctx, rx, ry + sleeveH - 1, 4, 1, gold)
  }
}

// ============================================================================
// 5. 頭與海利亞長尖耳 (head/{male|male_plump|male_small|female|female_small})
// ============================================================================
function drawHeadFrame(ctx: CanvasRenderingContext2D, ox: number, headKey: string, sheet: SheetName, frame: number, pal: string): void {
  const S = getShades('body', pal)
  const out = '#141622'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const hy = 17 + m.headBob

  const plump = headKey === 'male_plump' ? 1 : 0
  const small = headKey.endsWith('_small') ? -1 : 0
  const hw = 9 + plump + small // 半寬：標準 9 -> 總寬 18

  if (sheet === 'front') {
    // 左右海利亞長尖耳（四支劍招牌外翹長尖耳）
    // 左耳
    rect(ctx, cx - hw - 5, hy + 7, 5, 1, out)
    rect(ctx, cx - hw - 6, hy + 8, 6, 3, out)
    rect(ctx, cx - hw - 4, hy + 11, 4, 2, out)
    rect(ctx, cx - hw - 5, hy + 8, 5, 2, S[4])
    rect(ctx, cx - hw - 3, hy + 10, 3, 2, S[3])
    rect(ctx, cx - hw - 5, hy + 8, 2, 1, S[5])
    // 右耳
    rect(ctx, cx + hw, hy + 7, 5, 1, out)
    rect(ctx, cx + hw, hy + 8, 6, 3, out)
    rect(ctx, cx + hw, hy + 11, 4, 2, out)
    rect(ctx, cx + hw, hy + 8, 5, 2, S[4])
    rect(ctx, cx + hw, hy + 10, 3, 2, S[3])
    rect(ctx, cx + hw + 3, hy + 8, 2, 1, S[5])

    // 臉部輪廓（圓潤 Q 版下巴）
    outlinedBox(ctx, cx - hw, hy + 2, hw * 2, 15, S[4], out, S[5], S[3])
    outlinedBox(ctx, cx - hw + 2, hy + 16, (hw - 2) * 2, 2, S[4], out, undefined, S[3])
    // 臉頰微光與立體陰影
    rect(ctx, cx - hw + 1, hy + 4, 2, 11, S[5])
    rect(ctx, cx + hw - 3, hy + 4, 2, 11, S[3])
    return
  }

  // 側面（3/4 朝右）
  const hLeft = cx - hw
  const w = hw * 2
  outlinedBox(ctx, hLeft, hy + 2, w, 15, S[4], out, S[5], S[3])
  outlinedBox(ctx, hLeft + 2, hy + 16, w - 3, 2, S[4], out, undefined, S[3])
  rect(ctx, hLeft + w - 3, hy + 4, 2, 11, S[5])
  rect(ctx, hLeft + 1, hy + 4, 2, 11, S[3])

  // 左側大尖耳（往左後方斜翹，極具辨識度）
  const ex = hLeft - 5
  const ey = hy + 7
  rect(ctx, ex, ey, 6, 1, out)
  rect(ctx, ex - 1, ey + 1, 7, 3, out)
  rect(ctx, ex + 1, ey + 4, 5, 2, out)
  rect(ctx, ex, ey + 1, 6, 2, S[4])
  rect(ctx, ex + 2, ey + 3, 4, 2, S[3])
  rect(ctx, ex, ey + 1, 2, 1, S[5])
}

// ============================================================================
// 6. 表情：四支劍貓眼大眼與豐富神情 (face/{face}/{male|female})
// ============================================================================
function drawFaceFrame(ctx: CanvasRenderingContext2D, ox: number, face: string, gender: string, sheet: SheetName, frame: number, pal: string): void {
  const S = getShades('body', pal)
  const E = getEyeShades(pal)
  const out = '#141622'
  const white = '#ffffff'
  const blush = '#f27d8e'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const hy = 17 + m.headBob

  // 左右眼中心位置（正面對稱，側面偏右 3/4 視角）
  const lx = sheet === 'front' ? cx - 5 : cx - 2
  const rx = sheet === 'front' ? cx + 2 : cx + 5
  const ey = hy + 8
  const rw = sheet === 'front' ? 3 : 2 // 側面遠端眼較窄

  // 眉毛
  const drawBrows = (type: 'normal' | 'angry' | 'sad' | 'high') => {
    if (type === 'angry') {
      rect(ctx, lx - 1, ey - 3, 3, 1, out)
      rect(ctx, lx + 1, ey - 2, 2, 1, out)
      rect(ctx, rx, ey - 2, 2, 1, out)
      rect(ctx, rx + 1, ey - 3, rw, 1, out)
    } else if (type === 'sad') {
      rect(ctx, lx - 1, ey - 2, 2, 1, out)
      rect(ctx, lx + 1, ey - 3, 2, 1, out)
      rect(ctx, rx, ey - 3, 2, 1, out)
      rect(ctx, rx + 1, ey - 2, rw, 1, out)
    } else {
      const dy = type === 'high' ? -4 : -3
      rect(ctx, lx - 1, ey + dy, 4, 1, out)
      rect(ctx, rx, ey + dy, rw + 1, 1, out)
    }
  }

  // 四支劍經典貓眼繪製
  const drawOpenEyes = (lookUp = false, wide = false) => {
    const eh = wide ? 5 : 4
    // 左眼（近端大眼）
    rect(ctx, lx - 1, ey - 1, 4, 1, out) // 粗眼線
    if (gender === 'female') rect(ctx, lx - 2, ey - 1, 1, 1, out) // 女生睫毛
    rect(ctx, lx - 1, ey, 4, eh, white)
    const iy = lookUp ? ey : ey + 1
    rect(ctx, lx + 1, iy, 2, eh - 1, E[1])
    rect(ctx, lx + 1, iy, 2, 1, E[0])
    rect(ctx, lx + 1, iy + eh - 2, 2, 1, E[2])
    rect(ctx, lx, ey, 1, 1, white) // 眼神高光

    // 右眼
    rect(ctx, rx, ey - 1, rw + 1, 1, out)
    if (gender === 'female' && sheet === 'front') rect(ctx, rx + rw + 1, ey - 1, 1, 1, out)
    rect(ctx, rx, ey, rw + 1, eh, white)
    rect(ctx, rx + 1, iy, rw, eh - 1, E[1])
    rect(ctx, rx + 1, iy, rw, 1, E[0])
    rect(ctx, rx + 1, iy + eh - 2, rw, 1, E[2])
    rect(ctx, rx, ey, 1, 1, white)
  }

  const drawClosedEyes = (happyArc = false, half = false) => {
    if (half) {
      rect(ctx, lx - 1, ey + 1, 4, 1, out)
      rect(ctx, lx, ey + 2, 3, 2, E[1])
      rect(ctx, rx, ey + 1, rw + 1, 1, out)
      rect(ctx, rx, ey + 2, rw, 2, E[1])
    } else if (happyArc) {
      // 笑彎眼 ^ ^
      rect(ctx, lx, ey, 2, 1, out)
      rect(ctx, lx - 1, ey + 1, 1, 2, out)
      rect(ctx, lx + 2, ey + 1, 1, 2, out)
      rect(ctx, rx + 1, ey, Math.max(1, rw - 1), 1, out)
      rect(ctx, rx, ey + 1, 1, 2, out)
      rect(ctx, rx + rw, ey + 1, 1, 2, out)
    } else {
      // 閉眼橫線
      rect(ctx, lx - 1, ey + 2, 4, 1, out)
      rect(ctx, rx, ey + 2, rw + 1, 1, out)
    }
  }

  // 小鼻子點綴
  const mx = sheet === 'front' ? cx : cx + 3
  rect(ctx, mx, ey + 3, 1, 1, S[2])

  switch (face) {
    case 'happy':
      drawBrows('normal')
      drawOpenEyes()
      // 開朗笑容
      rect(ctx, mx - 2, ey + 5, 4, 1, out)
      rect(ctx, mx - 1, ey + 6, 2, 1, '#d84858')
      break
    case 'blush':
      drawBrows('normal')
      drawOpenEyes()
      rect(ctx, lx - 2, ey + 4, 3, 2, blush)
      rect(ctx, rx + rw - 1, ey + 4, 2, 2, blush)
      rect(ctx, mx - 1, ey + 5, 3, 1, out)
      break
    case 'closed':
      drawBrows('normal')
      drawClosedEyes(true, false)
      rect(ctx, lx - 2, ey + 4, 2, 1, blush)
      rect(ctx, mx - 2, ey + 5, 4, 1, out)
      break
    case 'closing':
      drawBrows('normal')
      drawClosedEyes(false, true)
      rect(ctx, mx - 1, ey + 5, 2, 1, out)
      break
    case 'anger':
      drawBrows('angry')
      drawOpenEyes()
      // 咬牙表情
      rect(ctx, mx - 2, ey + 5, 4, 2, out)
      rect(ctx, mx - 1, ey + 5, 2, 1, white)
      break
    case 'sad':
      drawBrows('sad')
      drawOpenEyes()
      // 眼角淚光與難過嘴型
      rect(ctx, lx - 1, ey + 3, 2, 2, '#6ec6f2')
      rect(ctx, mx - 1, ey + 5, 2, 1, out)
      rect(ctx, mx - 2, ey + 6, 1, 1, out)
      rect(ctx, mx + 1, ey + 6, 1, 1, out)
      break
    case 'shock':
      drawBrows('high')
      drawOpenEyes(false, true)
      // 驚訝 O 型嘴
      rect(ctx, mx - 1, ey + 5, 3, 3, out)
      rect(ctx, mx, ey + 6, 1, 1, '#d84858')
      break
    case 'eyeroll':
      drawBrows('normal')
      drawOpenEyes(true, false)
      rect(ctx, lx - 1, ey, 4, 1, S[4]) // 半瞇眼皮
      rect(ctx, rx, ey, rw + 1, 1, S[4])
      rect(ctx, mx - 2, ey + 5, 4, 1, out)
      break
    case 'shame':
      drawBrows('sad')
      drawClosedEyes(false, true)
      rect(ctx, lx - 2, ey + 4, 3, 2, blush)
      rect(ctx, mx - 2, ey + 5, 2, 1, out)
      rect(ctx, mx, ey + 6, 2, 1, out)
      break
    case 'neutral':
    default:
      drawBrows('normal')
      drawOpenEyes()
      rect(ctx, mx - 1, ey + 5, 3, 1, out)
      break
  }
}

// ============================================================================
// 7. 後髮層 (hairbg/{ponytail|high_ponytail|braid|long_center_part|wavy|princess|sara|xlong_wavy})
// ============================================================================
function drawHairBgFrame(ctx: CanvasRenderingContext2D, ox: number, style: string, sheet: SheetName, frame: number, pal: string): void {
  const H = getShades('hair', pal)
  const out = '#141622'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const hy = 17 + m.headBob
  const tx = m.tailDx
  const ty = m.tailDy

  if (sheet === 'front') {
    const isXLong = style === 'princess' || style === 'sara' || style === 'xlong_wavy'
    const dropH = isXLong ? 24 : 18
    if (style === 'ponytail' || style === 'high_ponytail') {
      const py = style === 'high_ponytail' ? hy - 2 : hy + 6
      outlinedBox(ctx, cx + 6, py, 5, 12, H[3], out, H[4], H[1])
      return
    }
    if (style === 'braid') {
      outlinedBox(ctx, cx - 12, hy + 10, 4, 15, H[3], out, H[4], H[1])
      rect(ctx, cx - 12, hy + 22, 4, 2, '#f8d038')
      return
    }
    // 披肩／波浪長髮後層
    outlinedBox(ctx, cx - 11, hy + 6, 22, dropH, H[2], out, H[3], H[1])
    rect(ctx, cx - 10, hy + 8, 3, dropH - 4, H[3])
    rect(ctx, cx + 7, hy + 8, 3, dropH - 4, H[3])
    return
  }

  // 側面（後髮在左後方隨跑步擺動）
  const hx = cx - 10
  if (style === 'ponytail' || style === 'high_ponytail') {
    const py = style === 'high_ponytail' ? hy + 1 : hy + 7
    rect(ctx, hx - 2, py + 1, 3, 3, '#f8d038') // 髮圈
    outlinedBox(ctx, hx - 6 + tx, py + 2 + ty, 6, 11, H[4], out, H[5], H[2])
    rect(ctx, hx - 7 + tx, py + 10 + ty, 4, 4, H[3])
    return
  }
  if (style === 'braid') {
    for (let i = 0; i < 4; i++) {
      outlinedBox(ctx, hx - 3 - i + Math.round(tx * 0.5), hy + 8 + i * 4 + ty, 4, 4, H[4], out, H[5], H[2])
    }
    rect(ctx, hx - 6 + Math.round(tx * 0.5), hy + 22 + ty, 4, 2, '#f8d038')
    return
  }
  const isXLong = style === 'princess' || style === 'sara' || style === 'xlong_wavy'
  const len = isXLong ? 22 : 17
  outlinedBox(ctx, hx - 4 + tx, hy + 6 + ty, 9, len, H[3], out, H[4], H[1])
  if (style.includes('wavy') || style === 'princess') {
    rect(ctx, hx - 5 + tx, hy + 12 + ty, 2, 5, H[4])
    rect(ctx, hx - 6 + tx, hy + 18 + ty, 3, 5, H[3])
  }
}

// ============================================================================
// 8. 前髮層：四支劍林克風厚實瀏海與經典長鬢角 (hair/{style})
// ============================================================================
function drawHairFrame(ctx: CanvasRenderingContext2D, ox: number, style: string, sheet: SheetName, frame: number, pal: string): void {
  const H = getShades('hair', pal)
  const out = '#141622'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const hy = 17 + m.headBob

  if (sheet === 'front') {
    // 頭頂圓弧髮冠
    outlinedBox(ctx, cx - 10, hy - 1, 20, 6, H[4], out, H[5], H[2])
    rect(ctx, cx - 7, hy, 14, 2, H[5]) // 天使光圈高光

    // 經典海利亞耳前長鬢角（四支劍／眾神林克招牌特徵）
    const lockH = ['long', 'long_straight', 'long_center_part', 'loose', 'wavy', 'princess', 'sara', 'xlong_wavy', 'half_up', 'bob'].includes(style) ? 14 : 9
    outlinedBox(ctx, cx - 10, hy + 4, 3, lockH, H[4], out, H[5], H[2])
    outlinedBox(ctx, cx + 7, hy + 4, 3, lockH, H[4], out, H[5], H[2])

    // 依髮型變化前額瀏海與頂部造型
    if (style === 'curtains' || style === 'long_center_part') {
      // 四支劍林克中分大瀏海
      rect(ctx, cx - 8, hy + 4, 6, 4, H[4])
      rect(ctx, cx + 2, hy + 4, 6, 4, H[4])
      rect(ctx, cx - 8, hy + 8, 4, 1, out)
      rect(ctx, cx + 4, hy + 8, 4, 1, out)
    } else if (style === 'swoop' || style === 'parted' || style === 'idol') {
      // 斜飛瀏海
      rect(ctx, cx - 7, hy + 4, 14, 3, H[4])
      rect(ctx, cx - 2, hy + 7, 7, 2, H[4])
      rect(ctx, cx - 2, hy + 9, 7, 1, out)
    } else if (style === 'messy3' || style === 'curly_short') {
      // 翹刺短髮
      rect(ctx, cx - 6, hy - 3, 3, 2, H[5])
      rect(ctx, cx + 2, hy - 3, 4, 2, H[5])
      rect(ctx, cx - 7, hy + 4, 4, 3, H[4])
      rect(ctx, cx - 1, hy + 4, 3, 4, H[4])
      rect(ctx, cx + 4, hy + 4, 3, 3, H[4])
    } else {
      // 齊瀏海／標準勇者瀏海
      rect(ctx, cx - 7, hy + 4, 14, 3, H[4])
      rect(ctx, cx - 5, hy + 7, 3, 1, H[3])
      rect(ctx, cx + 2, hy + 7, 3, 1, H[3])
      rect(ctx, cx - 7, hy + 7, 14, 1, out)
    }

    if (style === 'bangs_bun') {
      outlinedBox(ctx, cx - 4, hy - 5, 8, 5, H[4], out, H[5], H[2])
      rect(ctx, cx - 4, hy - 1, 8, 1, '#f8d038')
    }
    if (style === 'princess' || style === 'half_up') {
      // 薩爾達公主風金色髮箍／鬢飾
      rect(ctx, cx - 10, hy + 9, 3, 2, '#f8d038')
      rect(ctx, cx + 7, hy + 9, 3, 2, '#f8d038')
    }
    return
  }

  // 側面（朝右）
  // 頭頂與後腦勺髮量
  outlinedBox(ctx, cx - 10, hy - 1, 19, 6, H[4], out, H[5], H[2])
  outlinedBox(ctx, cx - 11, hy + 3, 6, 11, H[3], out, H[4], H[1])
  rect(ctx, cx - 6, hy, 12, 2, H[5])

  // 耳前長鬢角（在海利亞尖耳前方垂下，四支劍最經典的側面線條！）
  const lockH = ['long', 'long_straight', 'long_center_part', 'loose', 'wavy', 'princess', 'sara', 'xlong_wavy', 'half_up', 'bob'].includes(style) ? 14 : 9
  outlinedBox(ctx, cx - 5, hy + 5, 3, lockH, H[4], out, H[5], H[2])
  if (style === 'princess' || style === 'half_up') {
    rect(ctx, cx - 5, hy + 10, 3, 2, '#f8d038')
  }

  // 前額斜飛瀏海
  rect(ctx, cx - 2, hy + 4, 11, 3, H[4])
  rect(ctx, cx + 5, hy + 4, 5, 4, H[5])
  rect(ctx, cx + 8, hy + 6, 3, 2, H[4])
  rect(ctx, cx + 6, hy + 8, 5, 1, out)

  if (style === 'messy3' || style === 'curly_short') {
    rect(ctx, cx - 8, hy - 3, 4, 2, H[5])
    rect(ctx, cx + 1, hy - 3, 4, 2, H[5])
  }
  if (style === 'bangs_bun') {
    outlinedBox(ctx, cx - 9, hy - 5, 7, 5, H[4], out, H[5], H[2])
    rect(ctx, cx - 8, hy - 1, 6, 1, '#f8d038')
  }
}

// ============================================================================
// 9. 眼鏡 (glasses/{glasses|halfmoon|nerd|round|secretary|shades|sunglasses})
// ============================================================================
function drawGlassesFrame(ctx: CanvasRenderingContext2D, ox: number, style: string, sheet: SheetName, frame: number, pal: string): void {
  const C = getShades('cloth', pal)
  const frameCol = C[2]
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const hy = 17 + m.headBob
  const ey = hy + 7

  const isDark = style === 'sunglasses' || style === 'shades'
  const lens = isDark ? (style === 'sunglasses' ? '#182030' : '#3d6e98') : '#a8e6ff'

  if (sheet === 'front') {
    // 鏡框橫樑与左右鏡框
    rect(ctx, cx - 8, ey, 6, 5, frameCol)
    rect(ctx, cx + 2, ey, 6, 5, frameCol)
    rect(ctx, cx - 2, ey + 1, 4, 1, frameCol)
    if (isDark) {
      rect(ctx, cx - 7, ey + 1, 4, 3, lens)
      rect(ctx, cx + 3, ey + 1, 4, 3, lens)
      rect(ctx, cx - 7, ey + 1, 2, 1, '#78b8e8')
      rect(ctx, cx + 3, ey + 1, 2, 1, '#78b8e8')
    } else {
      rect(ctx, cx - 7, ey + 1, 4, 3, '#ffffff')
      rect(ctx, cx - 6, ey + 1, 1, 1, lens)
      rect(ctx, cx + 3, ey + 1, 1, 1, lens)
    }
    return
  }

  // 側面
  rect(ctx, cx - 6, ey + 1, 4, 1, frameCol) // 鏡腳延伸至耳側
  rect(ctx, cx - 3, ey, 5, 5, frameCol)
  rect(ctx, cx + 2, ey + 1, 2, 1, frameCol)
  rect(ctx, cx + 4, ey, 4, 5, frameCol)
  if (isDark) {
    rect(ctx, cx - 2, ey + 1, 3, 3, lens)
    rect(ctx, cx + 5, ey + 1, 2, 3, lens)
    rect(ctx, cx - 2, ey + 1, 1, 1, '#78b8e8')
  } else {
    rect(ctx, cx - 2, ey + 1, 1, 1, lens)
    rect(ctx, cx + 5, ey + 1, 1, 1, lens)
  }
}

// ============================================================================
// 10. 髮帶：海利亞額飾／冒險者頭帶 (band/thick)
// ============================================================================
function drawBandFrame(ctx: CanvasRenderingContext2D, ox: number, sheet: SheetName, frame: number, pal: string): void {
  const C = getShades('cloth', pal)
  const out = '#141622'
  const gold = '#f8d038'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const hy = 17 + m.headBob

  if (sheet === 'front') {
    outlinedBox(ctx, cx - 10, hy + 2, 20, 3, C[4], out, C[5], C[2])
    // 額前三角神力金飾
    rect(ctx, cx - 1, hy + 2, 2, 2, gold)
    return
  }

  outlinedBox(ctx, cx - 10, hy + 2, 19, 3, C[4], out, C[5], C[2])
  rect(ctx, cx + 5, hy + 2, 2, 2, gold)
  // 頭帶尾端飄帶
  rect(ctx, cx - 13 + m.tailDx, hy + 3 + m.tailDy, 3, 2, C[3])
}

// ============================================================================
// 11. 帽子：四支劍勇者長尖帽、海拉魯皇冠、賢者帽等 (hat/{style})
// ============================================================================
function drawHatFrame(ctx: CanvasRenderingContext2D, ox: number, style: string, sheet: SheetName, frame: number, pal: string): void {
  const C = getShades('cloth', pal)
  const out = '#141622'
  const gold = '#f8d038'
  const goldHi = '#fff29c'
  const goldLo = '#b87c14'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const hy = 17 + m.headBob
  const tx = m.tailDx
  const ty = m.tailDy

  if (style === 'crown') {
    // 海拉魯皇室金冠（薩爾達公主／國王皇冠，嵌藍寶石與三角神力紋）
    if (sheet === 'front') {
      outlinedBox(ctx, cx - 8, hy - 5, 16, 6, gold, out, goldHi, goldLo)
      // 三道皇冠尖峰
      outlinedBox(ctx, cx - 8, hy - 8, 3, 4, gold, out, goldHi)
      outlinedBox(ctx, cx - 2, hy - 10, 4, 6, gold, out, goldHi)
      outlinedBox(ctx, cx + 5, hy - 8, 3, 4, gold, out, goldHi)
      // 皇室藍寶石與紅寶石
      rect(ctx, cx - 1, hy - 5, 2, 3, '#3878e0')
      rect(ctx, cx - 6, hy - 4, 2, 2, '#d83848')
      rect(ctx, cx + 4, hy - 4, 2, 2, '#d83848')
    } else {
      outlinedBox(ctx, cx - 8, hy - 5, 16, 6, gold, out, goldHi, goldLo)
      outlinedBox(ctx, cx - 7, hy - 8, 3, 4, gold, out, goldHi)
      outlinedBox(ctx, cx - 1, hy - 9, 3, 5, gold, out, goldHi)
      outlinedBox(ctx, cx + 5, hy - 10, 3, 6, gold, out, goldHi)
      rect(ctx, cx + 5, hy - 5, 2, 3, '#3878e0')
      rect(ctx, cx - 1, hy - 4, 2, 2, '#d83848')
    }
    return
  }

  if (style === 'wizard') {
    // 賢者魔導尖帽（古夫／薩哈斯拉拉風寬簷尖帽）
    if (sheet === 'front') {
      outlinedBox(ctx, cx - 14, hy + 1, 28, 3, C[3], out, C[4], C[1])
      outlinedBox(ctx, cx - 9, hy - 4, 18, 5, C[4], out, C[5], C[2])
      outlinedBox(ctx, cx - 6, hy - 9, 12, 5, C[4], out, C[5], C[2])
      outlinedBox(ctx, cx - 3, hy - 13, 8, 4, C[3], out, C[4], C[1])
      rect(ctx, cx - 9, hy, 18, 2, gold)
    } else {
      outlinedBox(ctx, cx - 13, hy + 1, 26, 3, C[3], out, C[4], C[1])
      outlinedBox(ctx, cx - 9, hy - 4, 17, 5, C[4], out, C[5], C[2])
      outlinedBox(ctx, cx - 8, hy - 9, 12, 5, C[4], out, C[5], C[2])
      outlinedBox(ctx, cx - 11 + tx, hy - 12 + ty, 8, 4, C[3], out, C[4], C[1])
      rect(ctx, cx - 9, hy, 17, 2, gold)
    }
    return
  }

  if (style === 'bandana') {
    // 海盜風頭巾
    if (sheet === 'front') {
      outlinedBox(ctx, cx - 10, hy - 2, 20, 6, C[4], out, C[5], C[2])
      rect(ctx, cx - 10, hy + 3, 20, 1, gold)
    } else {
      outlinedBox(ctx, cx - 10, hy - 2, 19, 6, C[4], out, C[5], C[2])
      rect(ctx, cx - 10, hy + 3, 19, 1, gold)
      // 後方頭巾結
      outlinedBox(ctx, cx - 14 + tx, hy + 1 + ty, 4, 4, C[3], out, C[4], C[1])
    }
    return
  }

  if (style === 'bowler' || style === 'tophat') {
    const crownH = style === 'tophat' ? 10 : 6
    const brimW = 22
    const left = cx - 11
    outlinedBox(ctx, left, hy + 1, brimW, 2, C[3], out, C[4], C[1])
    outlinedBox(ctx, left + 3, hy + 1 - crownH, brimW - 6, crownH, C[4], out, C[5], C[2])
    rect(ctx, left + 3, hy - 1, brimW - 6, 2, gold)
    return
  }

  // christmas / elf：四支劍林克經典長尖勇者帽（Phrygian Hero's Cap）！
  if (sheet === 'front') {
    // 帽身包覆頭頂，帽尖向右後方垂墜（正面左高右垂，露出下方瀏海）
    outlinedBox(ctx, cx - 11, hy - 5, 22, 8, C[4], out, C[5], C[2])
    outlinedBox(ctx, cx - 8, hy - 8, 16, 4, C[4], out, C[5], C[2])
    // 右側垂下的勇者長帽尾
    outlinedBox(ctx, cx + 8, hy - 3, 6, 9, C[3], out, C[4], C[1])
    outlinedBox(ctx, cx + 10, hy + 5, 5, 6, C[2], out, C[3], C[1])
    return
  }

  // 側面（朝右）：帽冠飽滿，長長的勇者尖帽尾往左後方帥氣飄揚！
  outlinedBox(ctx, cx - 11, hy - 5, 20, 8, C[4], out, C[5], C[2])
  outlinedBox(ctx, cx - 8, hy - 8, 14, 4, C[4], out, C[5], C[2])
  // 往左後方延伸的三段式長尖帽尾（隨跑步與跳躍擺動）
  outlinedBox(ctx, cx - 16 + Math.round(tx * 0.5), hy - 4 + Math.round(ty * 0.5), 7, 7, C[4], out, C[5], C[2])
  outlinedBox(ctx, cx - 21 + tx, hy - 1 + ty, 7, 6, C[3], out, C[4], C[2])
  outlinedBox(ctx, cx - 25 + tx, hy + 2 + ty, 5, 5, C[2], out, C[3], C[1])
}

// ============================================================================
// 12. 帽子滾邊 (hattrim/{santa|elf})
// ============================================================================
function drawHatTrimFrame(ctx: CanvasRenderingContext2D, ox: number, style: string, sheet: SheetName, frame: number, pal: string): void {
  const C = getShades('cloth', pal)
  const out = '#141622'
  const gold = '#f8d038'
  const goldLo = '#b87c14'
  const m = getMotion(sheet, frame)
  const cx = ox + 32 + m.lean
  const hy = 17 + m.headBob
  const tx = m.tailDx
  const ty = m.tailDy

  if (style === 'elf') {
    // 勇者尖帽的經典金色／亮色帽沿滾邊（四支劍林克帽沿細節）
    if (sheet === 'front') {
      outlinedBox(ctx, cx - 11, hy + 2, 22, 2, gold, out, '#fff29c', goldLo)
    } else {
      outlinedBox(ctx, cx - 11, hy + 2, 20, 2, gold, out, '#fff29c', goldLo)
    }
    return
  }

  // santa：白色毛絨帽沿 + 帽尖毛球
  if (sheet === 'front') {
    outlinedBox(ctx, cx - 11, hy + 2, 22, 3, C[5], out, '#ffffff', C[3])
    outlinedBox(ctx, cx + 11, hy + 10, 5, 5, C[5], out, '#ffffff', C[3])
  } else {
    outlinedBox(ctx, cx - 11, hy + 2, 20, 3, C[5], out, '#ffffff', C[3])
    outlinedBox(ctx, cx - 27 + tx, hy + 4 + ty, 5, 5, C[5], out, '#ffffff', C[3])
  }
}

// ============================================================================
// 對外產生圖層精靈圖與頭頂座標
// ============================================================================

/** 畫出指定 (key, sheet, material, pal) 的整張精靈圖 */
export function renderFourSwordsSheet(key: string, sheet: SheetName, _material: Material, pal: string): HTMLCanvasElement {
  const n = SHEET_FRAMES[sheet]
  const c = document.createElement('canvas')
  c.width = n * FRAME
  c.height = FRAME
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const parts = key.split('/')
  const slot = parts[0]

  for (let f = 0; f < n; f++) {
    const ox = f * FRAME
    switch (slot) {
      case 'body':
        drawBodyFrame(ctx, ox, parts[1] ?? 'male', sheet, f, pal)
        break
      case 'shoes':
        drawShoesFrame(ctx, ox, parts[1] ?? 'male', sheet, f, pal)
        break
      case 'legs':
        drawLegsFrame(ctx, ox, parts[1] ?? 'shorts', parts[2] ?? 'male', sheet, f, pal)
        break
      case 'top':
        drawTopFrame(ctx, ox, parts[1] ?? 'tshirt', parts[2] ?? 'male', sheet, f, pal)
        break
      case 'head':
        drawHeadFrame(ctx, ox, parts[1] ?? 'male', sheet, f, pal)
        break
      case 'face':
        drawFaceFrame(ctx, ox, parts[1] ?? 'happy', parts[2] ?? 'male', sheet, f, pal)
        break
      case 'hairbg':
        drawHairBgFrame(ctx, ox, parts[1] ?? 'ponytail', sheet, f, pal)
        break
      case 'hair':
        drawHairFrame(ctx, ox, parts[1] ?? 'curtains', sheet, f, pal)
        break
      case 'glasses':
        drawGlassesFrame(ctx, ox, parts[1] ?? 'glasses', sheet, f, pal)
        break
      case 'band':
        drawBandFrame(ctx, ox, sheet, f, pal)
        break
      case 'hat':
        drawHatFrame(ctx, ox, parts[1] ?? 'elf', sheet, f, pal)
        break
      case 'hattrim':
        drawHatTrimFrame(ctx, ox, parts[1] ?? 'elf', sheet, f, pal)
        break
    }
  }
  return c
}

/** 計算四支劍角色頭頂與帽子 bounding box，讓表情符號與指標精準落在頭頂 */
export function getFourSwordsBox(key: string, sheet: SheetName, frame: number): Box | undefined {
  const m = getMotion(sheet, frame)
  const cx = 32 + m.lean
  const hy = 17 + m.headBob
  if (key.startsWith('head/')) {
    return [hy + 1, cx, cx + 11]
  }
  if (key.startsWith('hair/')) {
    const isBun = key === 'hair/bangs_bun'
    return [isBun ? hy - 6 : hy - 2, cx, cx + 11]
  }
  if (key.startsWith('hat/')) {
    const hat = key.split('/')[1]
    if (hat === 'wizard') return [hy - 13, cx, cx + 12]
    if (hat === 'tophat' || hat === 'crown') return [hy - 10, cx, cx + 11]
    if (hat === 'christmas' || hat === 'elf') return [hy - 9, cx, cx + 11]
    return [hy - 5, cx, cx + 11]
  }
  if (key.startsWith('hattrim/')) {
    return [hy - 5, cx, cx + 11]
  }
  return undefined
}
