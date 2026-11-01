// Codemod: แทนที่สี dark:[#hex] ฮาร์ดโค้ด → CSS variable tokens ตาม preset (index.css)
// ใช้: node theme-codemod.mjs <srcDir> [--apply]
import fs from 'node:fs'
import path from 'node:path'

const srcDir = process.argv[2] ?? '.'
const apply = process.argv.includes('--apply')

// ตาราง map: utility-family|hex → token  (family: bg | border | ring | offset | grad)
// ค่าอ้างอิงตามโทเคนของ preset Violet ใน index.css ซึ่ง preset อื่นจะ resolve ตาม var ของตัวเอง
const BG = {
  '070b14': '--app-bg',
  '09151e': '--card-sub', '0a1622': '--card-sub', '0c1424': '--card-sub',
  '101325': '--card-sub', '101326': '--card-sub', '111425': '--card-sub',
  '12152b': '--card-sub', '121624': '--card-sub', '121629': '--card-sub',
  '121826': '--card-sub', '131627': '--card-sub',
  '14172a': '--card-bg', '15182a': '--card-bg', '15182d': '--card-bg', '15192b': '--card-bg',
  '151b2d': '--card-bg', '14182b': '--card-bg', '16192e': '--card-bg', '161a2f': '--card-bg',
  '161a30': '--card-bg', '161a33': '--card-bg', '171b30': '--card-bg', '181528': '--card-bg',
  '181b2e': '--card-bg', '181b30': '--card-bg', '181c30': '--card-bg', '181c33': '--card-bg',
  '181c35': '--card-bg', '1a1d32': '--card-bg', '1a1e36': '--card-bg', '1a1f36': '--card-bg',
  '1a2035': '--card-bg', '1a2333': '--card-bg', '1a2338': '--card-bg',
  '1b2f3d': '--card-header', '1d2035': '--card-header', '1e233d': '--card-header',
  '1e263d': '--card-header', '20253f': '--card-header', '0d2028': '--card-header', '124259': '--card-header',
  '222d42': '--card-border', '252a48': '--card-border', '282a46': '--card-border',
  '28324e': '--card-border', '292440': '--card-border', '2a334d': '--card-border',
  '383250': '--input-border',
}
const BORDER = {
  '22263d': '--card-border', '26233d': '--card-border', '282d49': '--card-border',
  '292440': '--card-border', '2a334d': '--card-border', '2b2746': '--card-border',
  '2d2845': '--card-border', '2d284a': '--card-border', '20253f': '--card-border',
  '2f3555': '--input-border', '34304a': '--input-border', '383250': '--input-border',
  '383350': '--input-border', '383354': '--input-border', '45415d': '--input-border', '74688b': '--input-border',
  '30364b': '--header-border',
}
const GRAD = {
  '0c0916': '--app-bg', '0d1627': '--card-sub', '130f21': '--card-sub',
  '141226': '--card-bg', '161226': '--card-sub', '0c1424': '--card-sub',
}
const OFFSET = { '101326': '--card-sub', '14172a': '--card-bg' }

const files = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) files.push(p)
  }
})(srcDir)

const rx = /dark:((?:[a-z][a-z-]*:)*)(bg|border|ring-offset|ring|divide|from|via|to)(-[a-z]+)?-\[#([0-9a-fA-F]{6})\]/g
const unknown = []
let replaced = 0
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  const out = t.replace(rx, (full, prefix, utility, side, hex) => {
    const h = hex.toLowerCase()
    let token
    if (utility === 'bg') token = BG[h]
    else if (utility === 'border' || utility === 'divide' || utility === 'ring') token = BORDER[h]
    else if (utility === 'ring-offset') token = OFFSET[h]
    else token = GRAD[h] // from/via/to
    if (!token) { unknown.push(`${utility}${side ?? ''}:#${h} (${path.relative(srcDir, f)})`); return full }
    replaced++
    return `dark:${prefix}${utility}${side ?? ''}-[var(${token})]`
  })
  if (apply && out !== t) fs.writeFileSync(f, out, 'utf8')
}
console.log(`${apply ? 'REPLACED' : 'WOULD REPLACE'}: ${replaced}`)
if (unknown.length) { console.log('UNMAPPED:'); [...new Set(unknown)].forEach((u) => console.log(' ', u)) }
