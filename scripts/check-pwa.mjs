// ตรวจการตั้งค่า PWA ไม่ให้ชนกับระบบอื่นบนโดเมนเดียวกัน
//   node scripts/check-pwa.mjs            -> ตรวจไฟล์ในโปรเจกต์ (ก่อน deploy)
//   node scripts/check-pwa.mjs --live     -> ตรวจ manifest บนเซิร์ฟเวอร์จริง + เทียบกับระบบอื่น (หลัง deploy)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import './ui.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = 'https://pkhospital.moph.go.th'
const APP = '/hd-check/'
const CACHE_PREFIX = 'hd-check-'
const OTHERS = ['/hrms/', '/narcotic/']
const live = process.argv.includes('--live')

const errors = []
const warns = []
const ok = (m) => console.log(`  [OK] ${m}`)
const fail = (m) => { errors.push(m); console.log(`  [FAIL] ${m}`) }
const warn = (m) => { warns.push(m); console.log(`  [WARN] ${m}`) }

// Chrome แปลง id/scope ที่เป็น relative ให้เป็น absolute จากฐาน manifest URL
const resolveId = (v, manifestPath) => new URL(v ?? '', ORIGIN + manifestPath).pathname

function checkManifest(m, label) {
  const mp = APP + 'manifest.webmanifest'
  for (const k of ['id', 'start_url', 'scope']) {
    if (m[k] !== APP) fail(`${label}: "${k}" ต้องเป็น "${APP}" แต่เป็น ${JSON.stringify(m[k])}`)
  }
  if (m.id === APP && m.scope === APP && m.start_url === APP) ok(`${label}: id/start_url/scope = ${APP}`)
  return resolveId(m.id, mp)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const READY_TIMEOUT_MS = 120_000
const READY_INTERVAL_MS = 5_000

/** ถามซ้ำทุก 5 วินาทีจนเซิร์ฟเวอร์ตอบ 2xx (สูงสุด 2 นาที) แล้วคืนผลล่าสุด */
async function waitUntilReady(p) {
  const started = Date.now()
  let last = null
  let announced = false
  for (;;) {
    try {
      last = await fetch(ORIGIN + p, { signal: AbortSignal.timeout(15000) })
      if (last.ok) {
        if (announced) console.log(`  [OK] เซิร์ฟเวอร์พร้อมแล้ว (รอ ${Math.round((Date.now() - started) / 1000)} วินาที)`)
        return last
      }
    } catch (e) {
      last = { ok: false, status: e.message }
    }
    if (Date.now() - started >= READY_TIMEOUT_MS) return last
    if (!announced) { console.log(`  [..] เซิร์ฟเวอร์ตอบ ${last.status} — กำลังรอให้ระบบเริ่มทำงานหลังอัปโหลด`); announced = true }
    await sleep(READY_INTERVAL_MS)
  }
}

async function main() {
  if (!live) {
    console.log('[*] ตรวจไฟล์ PWA ในโปรเจกต์')
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'frontend/public/manifest.webmanifest'), 'utf8'))
    checkManifest(manifest, 'manifest')

    for (const icon of manifest.icons || []) {
      const rel = String(icon.src).replace(APP, '')
      if (!icon.src.startsWith(APP)) fail(`icon ${icon.src} ต้องขึ้นต้นด้วย ${APP}`)
      else if (!fs.existsSync(path.join(root, 'frontend/public', rel))) fail(`ไม่พบไฟล์ icon: public/${rel}`)
    }
    for (const size of ['192x192', '512x512']) {
      if (!(manifest.icons || []).some((i) => i.sizes === size)) fail(`manifest ไม่มี icon ขนาด ${size}`)
    }

    const vite = fs.readFileSync(path.join(root, 'frontend/vite.config.ts'), 'utf8')
    if (vite.includes(`'${APP}'`)) ok(`vite base = ${APP}`)
    else fail(`vite.config.ts ต้องมี base ${APP} ตอน build`)

    const sw = fs.readFileSync(path.join(root, 'frontend/public/sw.js'), 'utf8')
    if (sw.includes(`'${CACHE_PREFIX}'`) && sw.includes('startsWith(CACHE_PREFIX)')) ok(`sw.js ใช้ prefix ${CACHE_PREFIX}`)
    else fail(`sw.js ต้องใช้ cache prefix ${CACHE_PREFIX} และลบเฉพาะที่ขึ้นต้นด้วย prefix`)

    const html = fs.readFileSync(path.join(root, 'frontend/index.html'), 'utf8')
    if (html.includes(`register('${APP}sw.js'`)) ok(`ลงทะเบียน service worker ที่ ${APP}sw.js`)
    else fail(`index.html ต้องลงทะเบียน service worker ที่ ${APP}sw.js`)
  } else {
    console.log(`[*] ตรวจ manifest บนเซิร์ฟเวอร์จริง (${ORIGIN})`)
    const get = async (p) => {
      const res = await fetch(ORIGIN + p, { signal: AbortSignal.timeout(15000) })
      return res
    }
    // หลังอัปโหลด เซิร์ฟเวอร์ต้อง restart ระบบก่อน (ช่วงนั้นตอบ 502/503/504) จึงรอจนพร้อมแล้วค่อยตรวจ ไม่ถือว่าล้มเหลวทันที
    const mine = await waitUntilReady(APP + 'manifest.webmanifest')
    if (!mine.ok) { fail(`${APP}manifest.webmanifest ตอบ ${mine.status}`) } else {
      const m = await mine.json()
      const myId = checkManifest(m, 'manifest (live)')
      for (const icon of m.icons || []) {
        const r = await get(new URL(icon.src, ORIGIN + APP).pathname)
        if (r.status !== 200) fail(`icon ${icon.src} ตอบ ${r.status}`)
      }
      const sw = await get(APP + 'sw.js')
      if (sw.status !== 200) fail(`${APP}sw.js ตอบ ${sw.status}`)

      for (const other of OTHERS) {
        try {
          const r = await get(other + 'manifest.webmanifest')
          if (!r.ok) { warn(`${other} manifest ตอบ ${r.status} (ข้าม)`); continue }
          const om = await r.json()
          const oid = resolveId(om.id, other + 'manifest.webmanifest')
          const oscope = resolveId(om.scope, other + 'manifest.webmanifest')
          if (oid === myId) fail(`id ชนกับ ${other} (${oid})`)
          if (oid === '/' || oscope === '/') warn(`${other} ใช้ id/scope เป็น "/" — แจ้งเจ้าของระบบนั้น (ไม่แก้ให้)`)
          if (oscope.startsWith(APP) || APP.startsWith(oscope)) warn(`scope ซ้อนกับ ${other} (${oscope})`)
          else ok(`ไม่ชนกับ ${other} (id ${oid}, scope ${oscope})`)
        } catch (e) {
          warn(`เปิด manifest ของ ${other} ไม่ได้: ${e.message}`)
        }
      }
    }
  }

  console.log(errors.length ? `\n[X] พบปัญหา ${errors.length} รายการ` : '\n[+] ตรวจ PWA ผ่านทั้งหมด')
  process.exit(errors.length ? 1 : 0)
}

main().catch((e) => { console.error('[ERROR]', e.message); process.exit(live ? 0 : 1) })
