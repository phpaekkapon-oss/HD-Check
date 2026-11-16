// ตัวควบคุมการ Release & Deploy แบบครบวงจร (เรียกจาก deploy.bat)
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { c, banner, step, line } from './ui.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://pkhospital.moph.go.th/hd-check/'
const readVersion = () => JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
const runNode = (args) => spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '1' } }).status ?? 1

const startedAt = Date.now()
const before = readVersion()

banner('SMART-HOSCHECK  •  ระบบ Release & Deploy อัตโนมัติ', [
  ['เวอร์ชันปัจจุบัน', `v${before}`],
  ['GitHub', 'origin/main (บันทึกเวอร์ชันและ Tag)'],
  ['ปลายทาง', SITE],
])

step(1, 3, 'ตรวจสอบการตั้งค่า PWA ก่อนเริ่ม')
if (runNode(['scripts/check-pwa.mjs']) !== 0) {
  console.log('\n' + c.red(c.bold('✖ การตั้งค่า PWA ไม่ถูกต้อง — ยกเลิกการ Release (ยังไม่มีการเปลี่ยนแปลงใดๆ)')))
  process.exit(1)
}

step(2, 3, 'ขึ้นเวอร์ชัน • บันทึกลง GitHub • Build • อัปโหลดขึ้นเซิร์ฟเวอร์')
const rel = runNode(['scripts/release.mjs', '--auto', ...process.argv.slice(2)])
if (rel !== 0) {
  banner('✖ Release ไม่สำเร็จ', [['รหัสผิดพลาด', String(rel)], ['คำแนะนำ', 'ดูข้อความด้านบน แล้วรันใหม่อีกครั้ง']], c.red)
  process.exit(rel)
}

step(3, 3, 'ตรวจสอบระบบจริงหลังอัปโหลด')
const liveOk = runNode(['scripts/check-pwa.mjs', '--live']) === 0

const after = readVersion()
const secs = Math.round((Date.now() - startedAt) / 1000)
banner(
  liveOk ? '✔ เสร็จสมบูรณ์ — พร้อมใช้งานแล้ว' : '⚠ อัปโหลดแล้ว แต่ตรวจ PWA จริงพบปัญหา',
  [
    ['เวอร์ชัน', before === after ? `v${after} (ไม่เปลี่ยน)` : `v${before}  →  v${after}`],
    ['GitHub Tag', `https://github.com/phpaekkapon-oss/HD-Check/releases/tag/v${after}`],
    ['เว็บไซต์', SITE],
    ['ใช้เวลา', `${secs} วินาที`],
  ],
  liveOk ? c.green : c.yellow,
)
if (liveOk) {
  console.log(c.dim('  หมายเหตุ: ผู้ใช้ที่เคยติดตั้งแอปไว้ ให้ Clear site data แล้วกด Ctrl+Shift+R'))
}
console.log(line('━') + '\n')
process.exit(liveOk ? 0 : 1)
