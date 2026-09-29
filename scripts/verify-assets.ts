/**
 * 與原型 reference/runner-avatar-lpc.html 內嵌的素材逐像素比對，確認素材管線輸出一致。
 * 原型的 thin 版褲鞋 key 叫 female，比對時換成 thin。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(join(ROOT, 'reference/runner-avatar-lpc.html'), 'utf8')
const json = html.match(/<script id="assets" type="application\/json">([\s\S]*?)<\/script>/)?.[1]
if (!json) throw new Error('原型裡找不到 assets JSON')
const DATA = JSON.parse(json) as {
  layers: Record<string, Record<string, string>>
  credits: { file: string }[]
  pal: Record<string, Record<string, string[]>>
}

const toNewKey = (k: string) => k.replace(/^(legs\/[^/]+|shoes)\/female$/, '$1/thin')

const manifest = JSON.parse(readFileSync(join(ROOT, 'src/assets/manifest.json'), 'utf8')) as { layers: Record<string, unknown> }
const credits = JSON.parse(readFileSync(join(ROOT, 'src/assets/credits.json'), 'utf8')) as { file: string }[]
const palettes = JSON.parse(readFileSync(join(ROOT, 'src/assets/palettes.json'), 'utf8')) as Record<string, { colors: Record<string, string[]> }>

const problems: string[] = []
let compared = 0

// 圖層清單
const protoKeys = new Set(Object.keys(DATA.layers).map(toNewKey))
const ourKeys = new Set(Object.keys(manifest.layers))
for (const k of protoKeys) if (!ourKeys.has(k)) problems.push(`缺少圖層 ${k}`)
const extras = [...ourKeys].filter((k) => !protoKeys.has(k))
if (extras.length) console.log(`原型之後新增的圖層（不比對）：${extras.join(', ')}`)

// 逐像素
for (const [protoKey, anims] of Object.entries(DATA.layers)) {
  const key = toNewKey(protoKey)
  for (const [anim, dataUrl] of Object.entries(anims)) {
    const file = join(ROOT, 'public/sprites', key, `${anim}.png`)
    if (!existsSync(file)) continue
    const a = PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64'))
    const b = PNG.sync.read(readFileSync(file))
    compared++
    if (a.width !== b.width || a.height !== b.height) {
      problems.push(`${key}/${anim}: 尺寸 原型 ${a.width}×${a.height}，輸出 ${b.width}×${b.height}`)
      continue
    }
    let diff = 0
    for (let i = 0; i < a.data.length; i += 4) {
      // 完全透明的像素不比 RGB
      if (a.data[i + 3] === 0 && b.data[i + 3] === 0) continue
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) diff++
    }
    if (diff) problems.push(`${key}/${anim}: ${diff} 個像素不同`)
  }
}

// credits
const protoCredits = new Set(DATA.credits.map((c) => c.file))
const ourCredits = new Set(credits.map((c) => c.file))
for (const f of protoCredits) if (!ourCredits.has(f)) problems.push(`credits 缺少 ${f}`)
// 新增素材會多出 credits，屬於預期結果

// 調色盤
for (const [mat, sets] of Object.entries(DATA.pal)) {
  for (const [name, colors] of Object.entries(sets)) {
    const ours = palettes[mat]?.colors[name]
    if (!ours || ours.join().toLowerCase() !== colors.join().toLowerCase()) problems.push(`調色盤 ${mat}.${name} 不一致`)
  }
}

console.log(`比對 ${compared} 張圖、${protoCredits.size} 筆 credits`)
if (problems.length) {
  console.log(problems.map((p) => '✗ ' + p).join('\n'))
  process.exit(1)
}
console.log('✓ 原型有的圖層與原型完全一致')
