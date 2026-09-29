export type Gender = 'male' | 'female'

export type AvatarConfig = {
  gender: Gender
  build: string
  head: string
  skin: string
  eye: string
  face: string
  hair: string
  hairColor: string
  top: string
  topColor: string
  legs: string
  legsColor: string
  shoesColor: string
  band: 'none' | 'thick'
  bandColor: string
}

/** 精靈圖動作 */
export type AnimName = 'idle' | 'walk' | 'run' | 'jump'
/** 可持續的移動模式（jump 是疊加在上面的一次性動作） */
export type MoveMode = Exclude<AnimName, 'jump'>
/** 一個圖層可用的圖：四個動作 + 正面 */
export type SheetName = AnimName | 'front'

export type Slot = 'hairbg' | 'body' | 'shoes' | 'legs' | 'top' | 'head' | 'face' | 'hair' | 'band'
export type Material = 'body' | 'hair' | 'cloth'

export type IconName = 'heart' | 'note' | 'bang' | 'quest' | 'vein' | 'cloud' | 'dots' | 'sweat'

/** 選項：[值, 顯示名稱] */
export type Option = readonly [value: string, label: string]
