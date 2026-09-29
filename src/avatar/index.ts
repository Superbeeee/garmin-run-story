/**
 * 角色渲染模組對外介面。
 *
 * 用法：
 *   await preloadAvatar(config)
 *   const actor = new AvatarActor()
 *   每一幀：actor.update(dt); drawAvatar(ctx, config, actor.pose(now, config.face), x, groundY, { flip })
 */
import { BLINK_FACES, EMOTES } from './catalog'
import { layerList } from './layers'
import { loadSprite, SHEETS } from './sprites'
import type { AvatarConfig } from './types'

export * from './types'
export * from './catalog'
export { AvatarActor, ANIM, EMOTE_MS, type Pose, type EmoteState } from './actor'
export { drawAvatar, drawPortrait, PORTRAIT_W, PORTRAIT_H, type DrawOptions } from './render'
export { layerList, Z, SLOT_LABELS, type LayerRef } from './layers'
export { parseAvatarConfig } from './validate'
export { swatchColor } from './sprites'

/** 載入一個造型會用到的所有圖（所有動作、正面、眨眼與表情動作的臉） */
export function preloadAvatar(config: AvatarConfig): Promise<void> {
  const faces = new Set([config.face, ...BLINK_FACES, ...EMOTES.map((e) => e.face)])
  const keys = new Set<string>()
  for (const f of faces) for (const L of layerList(config, f)) keys.add(L.key)
  return Promise.all([...keys].flatMap((k) => SHEETS.map((s) => loadSprite(k, s)))).then(() => {})
}
