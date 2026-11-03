/**
 * 造型選項、中文名稱與預設值（《薩爾達傳說：眾神的三角力量 & 四支劍》勇者風格）。
 * 選項 key 與原版完全相容，確保既有資料庫紀錄與驗證邏輯無縫運作。
 */
import type { AvatarConfig, Gender, IconName, Option } from './types'

export const GENDERS: readonly Option[] = [
  ['male', '男'],
  ['female', '女'],
]

export const SKINS: readonly Option[] = [
  ['light', '白皙'],
  ['amber', '暖膚'],
  ['olive', '橄欖'],
  ['taupe', '小麥'],
  ['bronze', '古銅'],
  ['brown', '深膚'],
]

/** 眼睛：原圖的眼睛色（基準）與可替換的三階色 */
export const EYE_BASE = ['#2a3c49', '#5686ae', '#57cee4'] as const
export const EYES: Record<string, readonly [string, string, string]> = {
  blue: ['#1b2d48', '#3878e0', '#6ee0ff'],
  brown: ['#232017', '#6a4824', '#a87434'],
  green: ['#193c24', '#28a848', '#78ec68'],
  gray: ['#3d3c37', '#7b8290', '#b8c0cc'],
}
export const EYE_OPTIONS: readonly Option[] = [
  ['blue', '海利亞藍'],
  ['brown', '大地棕'],
  ['green', '森林綠'],
  ['gray', '賢者灰'],
]

export const HAIR_COLORS: readonly Option[] = [
  ['blonde', '勇者金'],
  ['light_brown', '亞麻棕'],
  ['dark_brown', '深栗棕'],
  ['pink', '眾神粉'],
  ['black', '暗夜黑'],
  ['blue', '卓拉藍'],
  ['gray', '賢者銀'],
]

export const CLOTH_COLORS: readonly Option[] = [
  ['green', '綠之勇者'],
  ['red', '紅之勇者'],
  ['blue', '藍之勇者'],
  ['purple', '紫之勇者'],
  ['forest', '迷途森綠'],
  ['teal', '大師劍青'],
  ['sky', '天空藍'],
  ['navy', '皇室深藍'],
  ['lavender', '希卡紫'],
  ['pink', '妖精粉'],
  ['maroon', '緋紅鎧'],
  ['orange', '哥隆橘'],
  ['yellow', '三角金'],
  ['white', '聖光白'],
  ['gray', '鋼鐵灰'],
  ['slate', '石板灰'],
  ['charcoal', '暗影黑'],
  ['black', '深淵黑'],
]

export const HAIR_LABELS: Record<string, string> = {
  bangsshort: '勇者短瀏海',
  curtains: '四支劍中分',
  parted: '騎士旁分',
  swoop: '疾風斜瀏海',
  messy3: '冒險亂髮',
  idol: '吟遊詩人頭',
  curly_short: '捲翹短髮',
  pixie: '精靈短髮',
  bob: '卡卡利科鮑伯',
  bangs_bun: '希卡丸子頭',
  ponytail: '劍士低馬尾',
  high_ponytail: '疾風高馬尾',
  long_straight: '皇室長直髮',
  half_up: '薩爾達公主頭',
  long_center_part: '賢者中分長髮',
  loose: '森林披肩髮',
  wavy: '女神大波浪',
  sara: '聖域長髮',
  xlong_wavy: '黃金超長波浪',
  braid: '牧場側編辮',
  princess: '皇室公主捲',
  long: '海利亞長髮',
}

const hairOptions = (keys: string[]): Option[] => keys.map((k) => [k, HAIR_LABELS[k]])

export const HAIR_BY: Record<Gender, readonly Option[]> = {
  male: hairOptions(['curtains', 'bangsshort', 'swoop', 'parted', 'messy3', 'idol', 'curly_short', 'pixie', 'bob', 'bangs_bun', 'ponytail', 'high_ponytail', 'long_straight']),
  female: hairOptions(['princess', 'half_up', 'long_center_part', 'loose', 'wavy', 'sara', 'xlong_wavy', 'braid', 'long', 'long_straight', 'bob', 'bangs_bun', 'high_ponytail', 'ponytail', 'pixie']),
}

export const TOP_BY: Record<Gender, readonly Option[]> = {
  male: [
    ['tshirt', '勇者短袖戰袍'],
    ['singlet', '輕裝無袖戰袍'],
  ],
  female: [
    ['tscoop', '勇者短袖戰袍'],
    ['lscoop', '眾神長袖戰袍'],
    ['vneck', '皇室 V 領戰袍'],
    ['scoop', '海利亞圓領衫'],
    ['tshirt', '寬鬆勇者衫'],
    ['singlet', '輕裝無袖戰袍'],
  ],
}

export const BUILD_BY: Record<Gender, readonly Option[]> = {
  male: [
    ['male', '標準勇者'],
    ['muscular', '力量型'],
    ['teen', '敏捷型'],
  ],
  female: [
    ['female', '標準勇者'],
    ['teen', '敏捷型'],
  ],
}

export const HEAD_BY: Record<Gender, readonly Option[]> = {
  male: [
    ['male', '標準尖耳臉'],
    ['male_plump', '圓潤尖耳臉'],
    ['male_small', '精緻尖耳臉'],
  ],
  female: [
    ['female', '標準尖耳臉'],
    ['female_small', '精緻尖耳臉'],
  ],
}

export const LEGS: readonly Option[] = [
  ['shorts', '勇者短褲'],
  ['leggings', '海利亞緊身褲'],
  ['shortshorts', '輕便跑褲'],
]

export const FACES: readonly Option[] = [
  ['happy', '開朗'],
  ['neutral', '堅定'],
  ['blush', '害羞'],
  ['closed', '笑彎眼'],
  ['anger', '戰鬥臉'],
  ['sad', '難過'],
  ['shock', '驚訝'],
  ['eyeroll', '無言'],
  ['shame', '苦笑'],
]

export const BANDS: readonly Option[] = [
  ['none', '不戴'],
  ['thick', '海利亞額飾'],
]

/** 表情動作（快捷鍵 1～8 依序）：臉部表情 + 頭頂圖示 */
export const EMOTES: readonly { face: string; label: string; icon: IconName }[] = [
  { face: 'happy', label: '開心', icon: 'note' },
  { face: 'blush', label: '愛心', icon: 'heart' },
  { face: 'anger', label: '熱血', icon: 'vein' },
  { face: 'shock', label: '發現！', icon: 'bang' },
  { face: 'neutral', label: '解謎？', icon: 'quest' },
  { face: 'sad', label: '難過', icon: 'cloud' },
  { face: 'eyeroll', label: '無言', icon: 'dots' },
  { face: 'shame', label: '流汗', icon: 'sweat' },
]

/** 眨眼用的表情 */
export const BLINK_FACES = ['closing', 'closed'] as const

export const HATS: readonly Option[] = [
  ['elf', '勇者長尖帽'],
  ['crown', '海拉魯皇冠'],
  ['wizard', '賢者魔導帽'],
  ['bandana', '海盜頭巾'],
  ['christmas', '絨球長尖帽'],
  ['bowler', '城鎮圓頂帽'],
  ['tophat', '高禮帽'],
  ['none', '不戴帽'],
]
/** 顏色固定、不提供換色的帽子 */
export const HATS_FIXED_COLOR = new Set(['crown'])

export const GLASSES: readonly Option[] = [
  ['none', '不戴'],
  ['glasses', '學者眼鏡'],
  ['halfmoon', '半框眼鏡'],
  ['nerd', '粗框眼鏡'],
  ['round', '圓框眼鏡'],
  ['secretary', '精靈細框'],
  ['sunglasses', '暗影墨鏡'],
  ['shades', '飛行員墨鏡'],
]

/** 切換性別時套用的預設（四支劍林克／薩爾達勇者配色） */
export const GENDER_DEFAULTS: Record<
  Gender,
  Omit<AvatarConfig, 'gender' | 'skin' | 'eye' | 'band' | 'bandColor' | 'hat' | 'hatColor' | 'glasses' | 'glassesColor'>
> = {
  male: {
    build: 'male',
    head: 'male',
    hair: 'curtains',
    hairColor: 'blonde',
    top: 'tshirt',
    topColor: 'green',
    legs: 'shorts',
    legsColor: 'white',
    shoesColor: 'orange',
    face: 'happy',
  },
  female: {
    build: 'female',
    head: 'female',
    hair: 'princess',
    hairColor: 'blonde',
    top: 'lscoop',
    topColor: 'red',
    legs: 'leggings',
    legsColor: 'white',
    shoesColor: 'orange',
    face: 'happy',
  },
}

export const DEFAULT_CONFIG: AvatarConfig = {
  gender: 'male',
  ...GENDER_DEFAULTS.male,
  skin: 'light',
  eye: 'blue',
  band: 'none',
  bandColor: 'yellow',
  hat: 'elf',
  hatColor: 'green',
  glasses: 'none',
  glassesColor: 'black',
}

/** 後來新增的欄位；舊資料缺少時補上預設值 */
export const OPTIONAL_DEFAULTS = {
  hat: 'none',
  hatColor: 'red',
  glasses: 'none',
  glassesColor: 'black',
} as const

export function withGender(c: AvatarConfig, gender: Gender): AvatarConfig {
  return { ...c, gender, ...GENDER_DEFAULTS[gender] }
}

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]

/** 四支劍經典四色勇者配色（綠、紅、藍、紫） */
const FOUR_SWORDS_COLORS = ['green', 'red', 'blue', 'purple'] as const

/** 隨機造型（測試與名單頁假資料用） */
export function randomConfig(): AvatarConfig {
  const gender = pick(['male', 'female'] as const)
  const heroColor = Math.random() < 0.65 ? pick(FOUR_SWORDS_COLORS) : pick(CLOTH_COLORS)[0]
  const hat = Math.random() < 0.7 ? 'elf' : Math.random() < 0.4 ? pick(HATS)[0] : 'none'
  return {
    gender,
    build: pick(BUILD_BY[gender])[0],
    head: pick(HEAD_BY[gender])[0],
    skin: pick(SKINS)[0],
    eye: pick(EYE_OPTIONS)[0],
    face: pick(FACES)[0],
    hair: pick(HAIR_BY[gender])[0],
    hairColor: Math.random() < 0.5 ? pick(['blonde', 'pink', 'light_brown'] as const) : pick(HAIR_COLORS)[0],
    top: pick(TOP_BY[gender])[0],
    topColor: heroColor,
    legs: pick(LEGS)[0],
    legsColor: Math.random() < 0.5 ? 'white' : pick(CLOTH_COLORS)[0],
    shoesColor: Math.random() < 0.6 ? 'orange' : pick(CLOTH_COLORS)[0],
    band: Math.random() < 0.25 ? 'thick' : 'none',
    bandColor: pick(CLOTH_COLORS)[0],
    hat,
    hatColor: hat === 'elf' ? heroColor : pick(CLOTH_COLORS)[0],
    glasses: Math.random() < 0.25 ? pick(GLASSES)[0] : 'none',
    glassesColor: pick(CLOTH_COLORS)[0],
  }
}
