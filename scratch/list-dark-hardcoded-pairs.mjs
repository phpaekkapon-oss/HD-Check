// รวมรายการ utility+hex ที่ hardcode ในคลาส dark: ทั้งหมด (สำหรับสร้างตาราง map → token)
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

const rx = /dark:((?:[a-z-]+:)*)([a-z-]+)-\[#([0-9a-fA-F]{3,8})\]/g
const map = new Map()
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  for (const m of t.matchAll(rx)) {
    const key = `${m[2]}:#${m[3].toLowerCase()}`
    map.set(key, (map.get(key) || 0) + 1)
  }
}
const rows = [...map.entries()].sort((a, b) => b[1] - a[1])
for (const [k, n] of rows) console.log(String(n).padStart(3), k)
console.log('distinct:', rows.length, 'total:', rows.reduce((s, [, n]) => s + n, 0))
