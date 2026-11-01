// นับการใช้สี hex ฮาร์ดโค้ดในคลาส dark: ต่อไฟล์ (audit ธีม)
import fs from 'node:fs'
import path from 'node:path'

const src = process.argv[2] ?? '.'
const files = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) files.push(p)
  }
})(src)

const rx = /dark:[a-z-:]+\[#([0-9a-fA-F]{3,8})\]/g
const rows = []
let total = 0
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  const n = [...t.matchAll(rx)].length
  if (n > 0) { rows.push([n, path.relative(src, f)]); total += n }
}
rows.sort((a, b) => b[0] - a[0])
for (const [n, f] of rows) console.log(String(n).padStart(4), ' ', f)
console.log('TOTAL:', total, 'in', rows.length, 'files')
