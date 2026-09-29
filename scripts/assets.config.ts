/**
 * 素材清單設定檔：之後要加減髮型、衣服，只改這個檔案，再執行 `pnpm build:assets`。
 *
 * 每個圖層（layerKey）對應到 LPC 的一個 sheet_definition、其中一個 layer_N，
 * 以及該 layer 裡的某個體型欄位（male / female / teen / muscular…）。
 */

export const LPC_REPO = 'https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator.git'
/** 鎖定 commit，確保每次產出一致；要更新素材時改這裡 */
export const LPC_COMMIT = '4963a69795255fb15a934c47f478a8bdcf3668f5'

/** 要擷取的動作；只取面向右（第 3 列） */
export const ANIMS = ['idle', 'walk', 'run', 'jump'] as const
export type AnimName = (typeof ANIMS)[number]

export type Slot = 'hairbg' | 'body' | 'shoes' | 'legs' | 'top' | 'head' | 'face' | 'hair' | 'band'
export type Material = 'body' | 'hair' | 'cloth'

/** 換色基準：palette_definitions 的檔案與色組名稱 */
export const PALETTES = {
  body: { file: 'body/body_ulpc.json', base: 'light' },
  hair: { file: 'hair/hair_ulpc.json', base: 'orange' },
  cloth: { file: 'cloth/cloth_ulpc.json', base: 'white' },
} as const satisfies Record<Material, { file: string; base: string }>

export interface LayerSource {
  /** 輸出路徑 public/sprites/{key}/ */
  key: string
  slot: Slot
  material: Material
  /** sheet_definitions 下的相對路徑 */
  def: string
  /** 預設 layer_1；後髮用 layer_2 */
  layer?: 'layer_1' | 'layer_2'
  /** sheet_definition 裡的體型欄位 */
  bodyType: string
  /** 替換路徑中的 ${head}（表情用） */
  head?: 'male' | 'female'
}

const layers: LayerSource[] = []

// 身體
for (const b of ['male', 'female', 'muscular', 'teen']) {
  layers.push({ key: `body/${b}`, slot: 'body', material: 'body', def: 'body/body.json', bodyType: b })
}

// 頭
for (const h of ['male', 'male_plump', 'male_small', 'female', 'female_small']) {
  layers.push({ key: `head/${h}`, slot: 'head', material: 'body', def: `head/heads/human/heads_human_${h}.json`, bodyType: 'male' })
}

// 表情（male / female 臉各一套）
const FACE_DEFS: Record<string, string> = {
  neutral: 'face_neutral', happy: 'face_happy', blush: 'face_blush', closed: 'face_closed', closing: 'face_closing',
  anger: 'face_angry', sad: 'face_sad', shock: 'face_shock', eyeroll: 'face_eyeroll', shame: 'face_shame',
}
for (const [face, file] of Object.entries(FACE_DEFS)) {
  for (const g of ['male', 'female'] as const) {
    layers.push({ key: `face/${face}/${g}`, slot: 'face', material: 'body', def: `head/faces/${file}.json`, bodyType: 'male', head: g })
  }
}

// 髮型：[key, sheet_definition, 是否有後髮層]
const HAIRS: [string, string, boolean][] = [
  ['bangsshort', 'hair/short/hair_bangsshort.json', false],
  ['curtains', 'hair/short/hair_curtains.json', false],
  ['parted', 'hair/short/hair_parted.json', false],
  ['swoop', 'hair/short/hair_swoop.json', false],
  ['messy3', 'hair/short/hair_messy3.json', false],
  ['idol', 'hair/short/hair_idol.json', false],
  ['pixie', 'hair/short/hair_pixie.json', false],
  ['curly_short', 'hair/curly/hair_curly_short.json', false],
  ['bob', 'hair/bob/hair_bob.json', false],
  ['bangs_bun', 'hair/braids/hair_bangs_bun.json', false],
  ['ponytail', 'hair/braids/hair_ponytail.json', true],
  ['high_ponytail', 'hair/braids/hair_high_ponytail.json', true],
  ['braid', 'hair/braids/hair_braid.json', true],
  ['half_up', 'hair/braids/hair_half_up.json', false],
  ['long', 'hair/long/hair_long.json', false],
  ['long_straight', 'hair/long/hair_long_straight.json', false],
  ['long_center_part', 'hair/long/hair_long_center_part.json', true],
  ['loose', 'hair/long/hair_loose.json', false],
  ['wavy', 'hair/long/hair_wavy.json', true],
  ['princess', 'hair/xlong/hair_princess.json', true],
  ['sara', 'hair/xlong/hair_sara.json', true],
  ['xlong_wavy', 'hair/xlong/hair_xlong_wavy.json', true],
]
for (const [h, def, hasBg] of HAIRS) {
  layers.push({ key: `hair/${h}`, slot: 'hair', material: 'hair', def, bodyType: 'male' })
  if (hasBg) layers.push({ key: `hairbg/${h}`, slot: 'hairbg', material: 'hair', def, layer: 'layer_2', bodyType: 'male' })
}

// 上衣：[key, sheet_definition, 版本]
const TOPS: [string, string, string[]][] = [
  ['singlet', 'torso/shirts/sleeveless/torso_clothes_sleeveless2.json', ['male', 'female', 'teen']],
  ['tshirt', 'torso/shirts/shortsleeve/torso_clothes_tshirt.json', ['male', 'female', 'teen']],
  ['scoop', 'torso/shirts/sleeveless/torso_clothes_sleeveless2_scoop.json', ['female', 'teen']],
  ['vneck', 'torso/shirts/sleeveless/torso_clothes_sleeveless2_vneck.json', ['female', 'teen']],
  ['tscoop', 'torso/shirts/shortsleeve/torso_clothes_tshirt_scoop.json', ['female', 'teen']],
  ['lscoop', 'torso/shirts/longsleeve/torso_clothes_longsleeve2_scoop.json', ['female', 'teen']],
]
for (const [t, def, variants] of TOPS) {
  for (const v of variants) layers.push({ key: `top/${t}/${v}`, slot: 'top', material: 'cloth', def, bodyType: v })
}

// 褲子、鞋子：male 版與 thin 版（thin 取 sheet_definition 的 female 欄位）
const FIT = { male: 'male', thin: 'female' } as const
const LEGS: [string, string][] = [
  ['shortshorts', 'legs/shorts/legs_shorts_short.json'],
  ['shorts', 'legs/shorts/legs_shorts.json'],
  ['leggings', 'legs/leggings/legs_leggings.json'],
]
for (const [l, def] of LEGS) {
  for (const [fit, bodyType] of Object.entries(FIT)) {
    layers.push({ key: `legs/${l}/${fit}`, slot: 'legs', material: 'cloth', def, bodyType })
  }
}
for (const [fit, bodyType] of Object.entries(FIT)) {
  layers.push({ key: `shoes/${fit}`, slot: 'shoes', material: 'cloth', def: 'feet/shoes/feet_shoes_basic.json', bodyType })
}

// 配件
layers.push({ key: 'band/thick', slot: 'band', material: 'cloth', def: 'headwear/coverings/headbands/hat_headband_thick.json', bodyType: 'male' })

export const LAYERS: readonly LayerSource[] = layers

/** 需要在 manifest 記錄每格 bounding box 的圖層（用來算頭頂圖示位置） */
export const BBOX_SLOTS: readonly Slot[] = ['head', 'hair']
