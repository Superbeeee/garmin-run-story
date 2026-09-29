/**
 * LPC 素材管線
 *
 * 1. sparse checkout LPC repo（只抓 sheet_definitions、palette_definitions 與用到的精靈圖）
 * 2. 裁切 idle / walk / run / jump 的第 3 列（面向右），以及 idle 第 2 列第 0 格（正面）
 * 3. 輸出 public/sprites/{layerKey}/{anim}.png、front.png
 * 4. 產生 src/assets/manifest.json、credits.json、palettes.json
 *
 * 可重複執行：repo 鎖定 commit、輸出前清空目錄、JSON 依 key 排序。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { ANIMS, BBOX_SLOTS, LAYERS, LPC_COMMIT, LPC_REPO, PALETTES, type LayerSource } from './assets.config.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = join(ROOT, '.cache/lpc')
const OUT_SPRITES = join(ROOT, 'public/sprites')
const OUT_ASSETS = join(ROOT, 'src/assets')
const FRAME = 64
/** LPC 列順序：上、左、下、右 */
const ROW_FRONT = 2
const ROW_RIGHT = 3

// ---------- git ----------

function git(...args: string[]): string {
  return execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] })
}

function gitWithStdin(input: string, ...args: string[]): void {
  execFileSync('git', ['-C', REPO, ...args], { input, stdio: ['pipe', 'inherit', 'inherit'] })
}

function hasCommit(sha: string): boolean {
  try {
    git('cat-file', '-e', `${sha}^{commit}`)
    return true
  } catch {
    return false
  }
}

function sparseCheckout(patterns: string[]): void {
  gitWithStdin(patterns.join('\n') + '\n', 'sparse-checkout', 'set', '--no-cone', '--stdin')
}

function ensureRepo(): void {
  if (!existsSync(join(REPO, '.git'))) {
    console.log('› clone（blob:none、sparse）…')
    mkdirSync(dirname(REPO), { recursive: true })
    execFileSync('git', ['clone', '--filter=blob:none', '--sparse', '--no-checkout', LPC_REPO, REPO], { stdio: 'inherit' })
  }
  if (!hasCommit(LPC_COMMIT)) {
    console.log(`› fetch ${LPC_COMMIT.slice(0, 7)}…`)
    git('fetch', '--filter=blob:none', 'origin', LPC_COMMIT)
  }
  // 先只拿定義檔，讀完才知道要哪些精靈圖
  sparseCheckout(['/sheet_definitions/', '/palette_definitions/'])
  git('-c', 'advice.detachedHead=false', 'checkout', '--detach', LPC_COMMIT)
}

// ---------- sheet_definitions ----------

interface Credit {
  file: string
  notes?: string
  authors: string[]
  licenses: string[]
  urls: string[]
}
interface SheetDef {
  credits?: Credit[]
  [layer: `layer_${number}`]: Record<string, string | number> | undefined
}

const defCache = new Map<string, SheetDef>()
function readDef(rel: string): SheetDef {
  let d = defCache.get(rel)
  if (!d) {
    d = JSON.parse(readFileSync(join(REPO, 'sheet_definitions', rel), 'utf8')) as SheetDef
    defCache.set(rel, d)
  }
  return d
}

/** 圖層在 spritesheets/ 下的目錄（不含結尾斜線） */
function spritePath(L: LayerSource): string {
  const layer = readDef(L.def)[L.layer ?? 'layer_1']
  const p = layer?.[L.bodyType]
  if (typeof p !== 'string') throw new Error(`${L.key}: ${L.def} 的 ${L.layer ?? 'layer_1'} 沒有 ${L.bodyType} 欄位`)
  return p.replace('${head}', L.head ?? '').replace(/\/+$/, '')
}

/** 取 sheet_definition 裡 file 為此路徑本身或其上層的所有 credit（上層是整組素材的共同作者，也要列） */
function creditsFor(L: LayerSource, path: string): Credit[] {
  const hits = (readDef(L.def).credits ?? []).filter((c) => path === c.file || path.startsWith(c.file + '/'))
  if (!hits.length) throw new Error(`${L.key}: 在 ${L.def} 找不到 ${path} 的 credits，授權資訊不可缺漏`)
  return hits
}

/** 一般素材為 {路徑}/{動作}.png；預先上色的素材為 {路徑}/{動作}/{variant}.png */
function sheetFile(path: string, anim: string, variant?: string): string {
  return variant ? `${path}/${anim}/${variant}.png` : `${path}/${anim}.png`
}

// ---------- 圖片 ----------

function readPng(file: string): PNG {
  return PNG.sync.read(readFileSync(file))
}

/** 從來源圖裁出第 row 列、第 col0 起共 n 格 */
function crop(src: PNG, row: number, col0: number, n: number): PNG {
  const out = new PNG({ width: n * FRAME, height: FRAME })
  PNG.bitblt(src, out, col0 * FRAME, row * FRAME, n * FRAME, FRAME, 0, 0)
  return out
}

/** 每格 bounding box：[top, cx, right]，空白格與原型一致回傳 [64, 32, 0] */
function frameBoxes(img: PNG): [number, number, number][] {
  const n = img.width / FRAME
  const out: [number, number, number][] = []
  for (let f = 0; f < n; f++) {
    let top = FRAME
    let x0 = FRAME
    let x1 = 0
    for (let y = 0; y < FRAME; y++) {
      for (let x = 0; x < FRAME; x++) {
        if (img.data[(y * img.width + f * FRAME + x) * 4 + 3]) {
          if (y < top) top = y
          if (x < x0) x0 = x
          if (x > x1) x1 = x
        }
      }
    }
    out.push([top, Math.round((x0 + x1) / 2), x1])
  }
  return out
}

function writePng(file: string, png: PNG): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, PNG.sync.write(png, { colorType: 6 }))
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

function sortObject<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
}

// ---------- 主流程 ----------

function main(): void {
  const keys = new Set<string>()
  for (const L of LAYERS) {
    if (keys.has(L.key)) throw new Error(`重複的 layerKey：${L.key}`)
    keys.add(L.key)
  }

  ensureRepo()

  const paths = new Map(LAYERS.map((L) => [L.key, spritePath(L)]))
  const spriteFiles = [...new Set(LAYERS.flatMap((L) => ANIMS.map((a) => `/spritesheets/${sheetFile(paths.get(L.key)!, a, L.variant)}`)))]
  console.log(`› sparse checkout ${spriteFiles.length} 張精靈圖…`)
  sparseCheckout(['/sheet_definitions/', '/palette_definitions/', ...spriteFiles])

  rmSync(OUT_SPRITES, { recursive: true, force: true })

  type Box = [number, number, number]
  const manifest: Record<string, { slot: string; material: string; frames: Record<string, number>; bbox?: Record<string, Box[]> }> = {}
  const credits = new Map<string, Credit>()

  for (const L of LAYERS) {
    const p = paths.get(L.key)!
    const frames: Record<string, number> = {}
    const bbox: Record<string, Box[]> = {}
    const wantBox = BBOX_SLOTS.includes(L.slot)

    for (const anim of ANIMS) {
      const file = join(REPO, 'spritesheets', sheetFile(p, anim, L.variant))
      if (!existsSync(file)) throw new Error(`${L.key}: 缺少 ${anim}（${file}）`)
      const src = readPng(file)
      if (src.width % FRAME || src.height < FRAME * 4) throw new Error(`${L.key}/${anim}: 尺寸 ${src.width}×${src.height} 不符 LPC 格式`)
      const n = src.width / FRAME
      const right = crop(src, ROW_RIGHT, 0, n)
      writePng(join(OUT_SPRITES, L.key, `${anim}.png`), right)
      frames[anim] = n
      if (wantBox) bbox[anim] = frameBoxes(right)

      if (anim === 'idle') {
        const front = crop(src, ROW_FRONT, 0, 1)
        writePng(join(OUT_SPRITES, L.key, 'front.png'), front)
        if (wantBox) bbox.front = frameBoxes(front)
      }
    }

    manifest[L.key] = { slot: L.slot, material: L.material, frames, ...(wantBox ? { bbox } : {}) }

    for (const c of creditsFor(L, p)) credits.set(c.file, c)
  }

  const palettes = Object.fromEntries(
    Object.entries(PALETTES).map(([mat, { file, base }]) => {
      const colors = JSON.parse(readFileSync(join(REPO, 'palette_definitions', file), 'utf8')) as Record<string, string[]>
      if (!colors[base]) throw new Error(`${file} 沒有基準色組 ${base}`)
      return [mat, { base, colors: sortObject(colors) }]
    }),
  )

  writeJson(join(OUT_ASSETS, 'manifest.json'), {
    source: { repo: LPC_REPO, commit: LPC_COMMIT },
    frameSize: FRAME,
    layers: sortObject(manifest),
  })
  writeJson(
    join(OUT_ASSETS, 'credits.json'),
    [...credits.values()]
      .sort((a, b) => a.file.localeCompare(b.file))
      .map(({ file, notes, authors, licenses, urls }) => ({ file, ...(notes ? { notes } : {}), authors, licenses, urls })),
  )
  writeJson(join(OUT_ASSETS, 'palettes.json'), palettes)

  console.log(`✓ ${LAYERS.length} 個圖層、${credits.size} 筆 credits`)
}

main()
