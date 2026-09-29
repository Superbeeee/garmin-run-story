/**
 * 造型選項、中文名稱與預設值（照搬原型）。
 * 新增素材時：先改 scripts/assets.config.ts 並重跑 build:assets，再到這裡把選項加進清單。
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
  blue: ['#2a3c49', '#5686ae', '#57cee4'],
  brown: ['#232017', '#544c2e', '#7e4e20'],
  green: ['#2b4b29', '#53b351', '#84ec50'],
  gray: ['#3d3c37', '#8b8979', '#ada18f'],
}
export const EYE_OPTIONS: readonly Option[] = [
  ['blue', '藍眼'],
  ['brown', '棕眼'],
  ['green', '綠眼'],
  ['gray', '灰眼'],
]

export const HAIR_COLORS: readonly Option[] = [
  ['black', '黑'],
  ['dark_brown', '深棕'],
  ['light_brown', '淺棕'],
  ['blonde', '金'],
  ['gray', '灰'],
  ['blue', '藍'],
  ['pink', '粉'],
]

export const CLOTH_COLORS: readonly Option[] = [
  ['red', '紅'],
  ['orange', '橘'],
  ['yellow', '黃'],
  ['green', '綠'],
  ['forest', '墨綠'],
  ['teal', '青'],
  ['sky', '天藍'],
  ['blue', '藍'],
  ['navy', '深藍'],
  ['lavender', '薰衣草'],
  ['purple', '紫'],
  ['pink', '粉'],
  ['maroon', '酒紅'],
  ['white', '白'],
  ['gray', '灰'],
  ['slate', '石板灰'],
  ['charcoal', '炭黑'],
  ['black', '黑'],
]

export const HAIR_LABELS: Record<string, string> = {
  bangsshort: '短瀏海', curtains: '中分', parted: '旁分', swoop: '斜瀏海', messy3: '凌亂短髮', idol: '偶像頭',
  curly_short: '短捲髮', pixie: '精靈短髮', bob: '鮑伯', bangs_bun: '丸子頭', ponytail: '低馬尾', high_ponytail: '高馬尾',
  long_straight: '長直髮', half_up: '公主頭', long_center_part: '中分長髮', loose: '披肩髮', wavy: '大波浪',
  sara: '空氣長髮', xlong_wavy: '超長波浪', braid: '側編辮', princess: '公主捲', long: '長髮',
}

const hairOptions = (keys: string[]): Option[] => keys.map((k) => [k, HAIR_LABELS[k]])

export const HAIR_BY: Record<Gender, readonly Option[]> = {
  male: hairOptions(['bangsshort', 'curtains', 'parted', 'swoop', 'messy3', 'idol', 'curly_short', 'pixie', 'bob', 'bangs_bun', 'ponytail', 'high_ponytail', 'long_straight']),
  female: hairOptions(['half_up', 'long_center_part', 'loose', 'wavy', 'sara', 'xlong_wavy', 'braid', 'princess', 'long', 'long_straight', 'bob', 'bangs_bun', 'high_ponytail', 'ponytail', 'pixie']),
}

export const TOP_BY: Record<Gender, readonly Option[]> = {
  male: [
    ['singlet', '背心'],
    ['tshirt', '短袖'],
  ],
  female: [
    ['scoop', '圓領背心'],
    ['vneck', 'V 領背心'],
    ['tscoop', '修身短袖'],
    ['lscoop', '修身長袖'],
    ['singlet', '運動背心'],
    ['tshirt', '寬鬆短袖'],
  ],
}

export const BUILD_BY: Record<Gender, readonly Option[]> = {
  male: [
    ['male', '標準'],
    ['muscular', '壯碩'],
    ['teen', '纖細'],
  ],
  female: [
    ['female', '標準'],
    ['teen', '纖細'],
  ],
}

export const HEAD_BY: Record<Gender, readonly Option[]> = {
  male: [
    ['male', '標準臉'],
    ['male_plump', '圓臉'],
    ['male_small', '小臉'],
  ],
  female: [
    ['female', '標準臉'],
    ['female_small', '小臉'],
  ],
}

export const LEGS: readonly Option[] = [
  ['shortshorts', '超短跑褲'],
  ['shorts', '短褲'],
  ['leggings', '緊身褲'],
]

export const FACES: readonly Option[] = [
  ['happy', '開心'],
  ['neutral', '平靜'],
  ['blush', '害羞'],
  ['closed', '瞇眼笑'],
  ['anger', '生氣'],
  ['sad', '難過'],
  ['shock', '驚訝'],
  ['eyeroll', '白眼'],
  ['shame', '尷尬'],
]

export const BANDS: readonly Option[] = [
  ['none', '不戴'],
  ['thick', '運動髮帶'],
]

/** 表情動作（快捷鍵 1～8 依序）：臉部表情 + 頭頂圖示 */
export const EMOTES: readonly { face: string; label: string; icon: IconName }[] = [
  { face: 'happy', label: '開心', icon: 'note' },
  { face: 'blush', label: '喜歡', icon: 'heart' },
  { face: 'anger', label: '生氣', icon: 'vein' },
  { face: 'shock', label: '驚訝', icon: 'bang' },
  { face: 'neutral', label: '疑問', icon: 'quest' },
  { face: 'sad', label: '難過', icon: 'cloud' },
  { face: 'eyeroll', label: '無言', icon: 'dots' },
  { face: 'shame', label: '尷尬', icon: 'sweat' },
]

/** 眨眼用的表情 */
export const BLINK_FACES = ['closing', 'closed'] as const

export const HATS: readonly Option[] = [
  ['none', '不戴'],
  ['christmas', '聖誕帽'],
  ['elf', '精靈帽'],
  ['bandana', '頭巾'],
  ['bowler', '紳士帽'],
  ['tophat', '高禮帽'],
  ['wizard', '巫師帽'],
  ['crown', '皇冠'],
]
/** 顏色固定、不提供換色的帽子 */
export const HATS_FIXED_COLOR = new Set(['crown'])

export const GLASSES: readonly Option[] = [
  ['none', '不戴'],
  ['glasses', '一般眼鏡'],
  ['halfmoon', '半框眼鏡'],
  ['nerd', '粗框眼鏡'],
  ['round', '圓框眼鏡'],
  ['secretary', '貓眼眼鏡'],
  ['sunglasses', '墨鏡'],
  ['shades', '淺色墨鏡'],
]

/** 切換性別時套用的預設（膚色、眼睛、配件沿用目前的選擇） */
export const GENDER_DEFAULTS: Record<
  Gender,
  Omit<AvatarConfig, 'gender' | 'skin' | 'eye' | 'band' | 'bandColor' | 'hat' | 'hatColor' | 'glasses' | 'glassesColor'>
> = {
  male: { build: 'male', head: 'male', hair: 'bangsshort', hairColor: 'black', top: 'singlet', topColor: 'red', legs: 'shortshorts', legsColor: 'black', shoesColor: 'white', face: 'happy' },
  female: { build: 'female', head: 'female', hair: 'half_up', hairColor: 'dark_brown', top: 'scoop', topColor: 'lavender', legs: 'leggings', legsColor: 'charcoal', shoesColor: 'white', face: 'happy' },
}

export const DEFAULT_CONFIG: AvatarConfig = {
  gender: 'male',
  ...GENDER_DEFAULTS.male,
  skin: 'amber',
  eye: 'blue',
  band: 'none',
  bandColor: 'white',
  hat: 'none',
  hatColor: 'red',
  glasses: 'none',
  glassesColor: 'black',
}

/** 後來新增的欄位；舊資料缺少時補上預設值 */
export const OPTIONAL_DEFAULTS = {
  hat: DEFAULT_CONFIG.hat,
  hatColor: DEFAULT_CONFIG.hatColor,
  glasses: DEFAULT_CONFIG.glasses,
  glassesColor: DEFAULT_CONFIG.glassesColor,
} as const

export function withGender(c: AvatarConfig, gender: Gender): AvatarConfig {
  return { ...c, gender, ...GENDER_DEFAULTS[gender] }
}

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]

/** 隨機造型（測試與名單頁假資料用） */
export function randomConfig(): AvatarConfig {
  const gender = pick(['male', 'female'] as const)
  return {
    gender,
    build: pick(BUILD_BY[gender])[0],
    head: pick(HEAD_BY[gender])[0],
    skin: pick(SKINS)[0],
    eye: pick(EYE_OPTIONS)[0],
    face: pick(FACES)[0],
    hair: pick(HAIR_BY[gender])[0],
    hairColor: pick(HAIR_COLORS)[0],
    top: pick(TOP_BY[gender])[0],
    topColor: pick(CLOTH_COLORS)[0],
    legs: pick(LEGS)[0],
    legsColor: pick(CLOTH_COLORS)[0],
    shoesColor: pick(CLOTH_COLORS)[0],
    band: Math.random() < 0.3 ? 'thick' : 'none',
    bandColor: pick(CLOTH_COLORS)[0],
    hat: Math.random() < 0.4 ? pick(HATS)[0] : 'none',
    hatColor: pick(CLOTH_COLORS)[0],
    glasses: Math.random() < 0.4 ? pick(GLASSES)[0] : 'none',
    glassesColor: pick(CLOTH_COLORS)[0],
  }
}
