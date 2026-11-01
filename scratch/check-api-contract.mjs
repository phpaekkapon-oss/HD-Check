// ตรวจว่าทุก /api ที่ frontend เรียก มี route ใน backend จริง
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

// ---- backend routes ----
const beRoutes = new Set()
for (const f of fs.readdirSync(path.join(root, 'backend')).filter((f) => f.endsWith('.mjs'))) {
  const t = fs.readFileSync(path.join(root, 'backend', f), 'utf8')
  for (const m of t.matchAll(/(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
    beRoutes.add(`${m[1].toUpperCase()} ${m[2]}`)
  }
}

// ---- frontend calls ----
const srcDir = path.join(root, 'frontend', 'src')
const files = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p)
  }
})(srcDir)

const calls = [] // {url, file, method}
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  const lines = t.split('\n')
  // string literal: fetch('/api/...') or fetch("/api/...") or `...`
  for (const m of t.matchAll(/fetch\(\s*(['"`])((?:[^'"`$]*\/api\/)[^'"`$]*)\1/g)) {
    calls.push({ raw: m[2], file: path.relative(root, f) })
  }
  // template literal with expressions
  for (const m of t.matchAll(/fetch\(\s*`([^`]*\/api\/[^`]*)`/g)) {
    calls.push({ raw: m[1].replace(/\$\{[^}]*\}/g, '*'), file: path.relative(root, f) })
  }
  // react-query api helper: query/get/post style wrappers in herbdx.api.ts
  for (const m of t.matchAll(/(?:getJson|postJson|putJson|deleteJson|request)\(\s*(['"`])([^'"`]*\/api\/[^'"`]*)\1/g)) {
    calls.push({ raw: m[2].replace(/\$\{[^}]*\}/g, '*'), file: path.relative(root, f) })
  }
  void lines
}

const norm = (u) =>
  u
    .split('?')[0]
    .replace(/\*+/g, '*')
    .replace(/\/+$/, '')

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const beMatchers = [...beRoutes].map((r) => {
  const [method, p] = r.split(' ')
  const src = esc(norm(p)).replace(/\\:[A-Za-z_]+/g, '[^/]+')
  return { method, path: norm(p), rx: new RegExp('^' + src + '$') }
})

const missing = []
const seen = new Set()
for (const c of calls) {
  const p = norm(c.raw)
  if (!p.startsWith('/api')) continue
  if (seen.has(p)) continue
  seen.add(p)
  const feRx = new RegExp('^' + esc(p).replace(/\\\*/g, '[^/]+').replace(/\\:/g, ':') + '$')
  const ok = beMatchers.some((b) => feRx.test(b.path) || b.rx.test(p))
  if (!ok) missing.push({ api: p, file: c.file })
}

console.log(`backend routes: ${beRoutes.size}`)
console.log(`frontend api call sites: ${calls.length}, unique paths: ${seen.size}`)
console.log('--- frontend เรียกแต่ไม่มี route ใน backend ---')
if (missing.length === 0) console.log('(ไม่มี)')
for (const m of missing) console.log(`${m.api}  <-  ${m.file}`)

// reverse: backend routes never called (informative only)
const calledSet = new Set(seen)
const unused = [...beRoutes].filter((r) => {
  const bp = norm(r.split(' ')[1])
  const base = bp.replace(/\$$/, '')
  return ![...calledSet].some((c) => c === base || (base.includes(':') && new RegExp('^' + base.replace(/:[A-Za-z_]+/g, '[^/]+') + '$').test(c)))
})
console.log('--- backend routesที่ไม่พบการเรียกจาก frontend (informative) ---')
for (const u of unused.sort()) console.log(u)
