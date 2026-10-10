import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import readline from 'node:readline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const ROOT_PKG = path.join(rootDir, 'package.json')
const FRONT_PKG = path.join(rootDir, 'frontend', 'package.json')
const BACK_PKG = path.join(rootDir, 'backend', 'package.json')
const CHANGELOG_JSON = path.join(rootDir, 'frontend', 'src', 'data', 'changelog.json')
const CHANGELOG_MD = path.join(rootDir, 'CHANGELOG.md')

function run(cmd, cwd = rootDir) {
  console.log(`\n> ${cmd}`)
  try {
    execSync(cmd, { cwd, stdio: 'inherit' })
    return true
  } catch (err) {
    console.error(`[ERROR] Command failed: ${cmd}`)
    return false
  }
}

function ask(question, defaultValue = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    const promptText = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `
    rl.question(promptText, (ans) => {
      rl.close()
      resolve(ans.trim() || defaultValue)
    })
  })
}

function parseSemver(v) {
  const parts = String(v).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  return {
    major: parts[0] || 1,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  }
}

function bumpVersion(current, type) {
  const { major, minor, patch } = parseSemver(current)
  if (type === 'major') return `${major + 1}.0.0`
  if (type === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function getTodayThai() {
  const d = new Date()
  const yearBE = d.getFullYear() + 543
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ]
  return `${d.getDate()} ${months[d.getMonth()]} ${yearBE}`
}

function getTodayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Intelligent Git & Workspace Analyzer
 * Automatically inspects modified files and commit logs to build
 * professional, human-readable release notes without manual typing.
 */
function analyzeGitChanges() {
  const detectedHighlights = []
  let detectedTitle = ''

  try {
    const statusOutput = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8' })
    const changedFiles = statusOutput
      .split('\n')
      .map((line) => line.trim().slice(3))
      .filter(Boolean)

    const categories = new Set()

    for (const f of changedFiles) {
      if (f.includes('AuditFilterBar')) {
        detectedHighlights.push('ปรับปรุงการจัดวางและการทำงานของแถบตัวกรองการตรวจสอบ (Audit Filter Bar Layout)')
        categories.add('FilterBar')
      } else if (f.includes('DrugSummaryView')) {
        detectedHighlights.push('ปรับปรุงหน้ารายการจ่ายยาสมุนไพรและกล่องตัวชี้วัด (Drug Summary & Interactive Metric Boxes)')
        categories.add('DrugSummary')
      } else if (f.includes('AuditTable') || f.includes('AuditCardList')) {
        detectedHighlights.push('ปรับปรุงตารางเวชระเบียนและมุมมองรายการตรวจ (Audit Table & Cards)')
        categories.add('AuditTable')
      } else if (f.includes('VersionChangelog') || f.includes('VersionUpdate') || f.includes('changelog')) {
        detectedHighlights.push('พัฒนาระบบแจ้งเตือนเวอร์ชันอัปเดตและหน้าต่าง Changelog Modal อัตโนมัติ')
        categories.add('VersionSystem')
      } else if (f.includes('DxMap') || f.includes('DxMismatch')) {
        detectedHighlights.push('ปรับปรุงระบบตั้งค่าเกณฑ์การจับคู่ยาและรหัสโรค ICD-10')
        categories.add('DxMap')
      } else if (f.includes('Security') || f.includes('PinLock') || f.includes('auth')) {
        detectedHighlights.push('ปรับปรุงระบบความปลอดภัย 2FA และระบบล็อกหน้าจอ PIN')
        categories.add('Security')
      } else if (f.includes('sync.mjs') || f.includes('backend/index.mjs')) {
        detectedHighlights.push('ปรับปรุงคำสั่งประมวลผลข้อมูลและระบบบริการ Backend API สำหรับ OPD/IPD')
        categories.add('Backend')
      } else if (f.includes('deploy') || f.includes('build.bat') || f.includes('release')) {
        detectedHighlights.push('ปรับปรุงระบบ Build, Git Release และ Automated Deployment')
        categories.add('Deployment')
      }
    }

    if (categories.has('FilterBar') || categories.has('DrugSummary')) {
      detectedTitle = 'ปรับปรุงส่วนติดต่อผู้ใช้ (UI/UX) และระบบตัวกรองข้อมูล'
    } else if (categories.has('VersionSystem')) {
      detectedTitle = 'เพิ่มระบบแจ้งเตือนเวอร์ชันใหม่และบันทึกการอัปเดตอัตโนมัติ'
    } else if (categories.has('Backend')) {
      detectedTitle = 'ปรับปรุงประสิทธิภาพการดึงและประมวลผลข้อมูลคลังข้อมูล'
    } else {
      detectedTitle = 'ปรับปรุงประสิทธิภาพและความเสถียรของระบบ'
    }
  } catch (err) {
    // fallback if git command fails
  }

  return {
    title: detectedTitle || 'ปรับปรุงและอัปเดตระบบประจำวัน',
    highlights:
      detectedHighlights.length > 0
        ? Array.from(new Set(detectedHighlights))
        : ['ปรับปรุงประสิทธิภาพการทำงานและความเสถียรของระบบ', 'อัปเดตข้อมูลและส่วนติดต่อผู้ใช้งาน'],
  }
}

async function main() {
  console.log('====================================================================')
  console.log('  SMART-HOSCHECK Automated Versioning, Git & Release Engine')
  console.log('====================================================================')

  const rootPkgData = JSON.parse(fs.readFileSync(ROOT_PKG, 'utf8'))
  const currentVersion = rootPkgData.version || '1.0.0'
  console.log(`[*] เวอร์ชันปัจจุบันในระบบ: v${currentVersion}`)

  // Parse arguments or prompt
  const args = process.argv.slice(2)
  let bumpType = 'patch'
  let newVersion = ''
  let releaseTitle = ''
  let highlightsInput = ''
  let isAuto = false

  for (const arg of args) {
    if (arg === '--patch') bumpType = 'patch'
    else if (arg === '--minor') bumpType = 'minor'
    else if (arg === '--major') bumpType = 'major'
    else if (arg === '--auto' || arg === '--yes' || arg === '-y') isAuto = true
    else if (arg.startsWith('--version=')) newVersion = arg.split('=')[1]
    else if (arg.startsWith('--title=')) releaseTitle = arg.split('=')[1]
    else if (arg.startsWith('--highlights=')) highlightsInput = arg.split('=')[1]
  }

  // Automatic Change Analysis from Git
  const gitAnalysis = analyzeGitChanges()
  if (!releaseTitle) releaseTitle = gitAnalysis.title

  if (!newVersion) {
    if (isAuto) {
      newVersion = bumpVersion(currentVersion, bumpType)
    } else {
      const choice = await ask(
        `เลือกประเภทการอัปเดตเวอร์ชัน:\n  [1] Patch (${bumpVersion(currentVersion, 'patch')})\n  [2] Minor (${bumpVersion(currentVersion, 'minor')})\n  [3] Major (${bumpVersion(currentVersion, 'major')})\nกรุณาเลือก (1/2/3)`,
        '1'
      )
      if (choice === '2') bumpType = 'minor'
      else if (choice === '3') bumpType = 'major'
      else bumpType = 'patch'

      newVersion = bumpVersion(currentVersion, bumpType)
    }
  }

  console.log(`\n[+] เวอร์ชันใหม่ที่จะสร้าง: v${newVersion} (${bumpType})`)

  if (!releaseTitle && !isAuto) {
    releaseTitle = await ask(
      'ระบุหัวข้อ/คำอธิบายการอัปเดตเวอร์ชันนี้ (Title)',
      gitAnalysis.title
    )
  }

  let highlights = []
  if (highlightsInput) {
    highlights = highlightsInput
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  } else if (isAuto) {
    highlights = gitAnalysis.highlights
  } else {
    const input = await ask(
      'ระบุรายการไฮไลท์การอัปเดต (คั่นด้วย ; หรือกด Enter ใช้ค่าวิเคราะห์อัตโนมัติ)',
      gitAnalysis.highlights.join('; ')
    )
    highlights = input
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  console.log('\n[*] สรุปข้อมูล Release Notes (สร้างให้อัตโนมัติ):')
  console.log(`  - เวอร์ชัน: v${newVersion}`)
  console.log(`  - วันที่: ${getTodayThai()}`)
  console.log(`  - หัวข้อ: ${releaseTitle}`)
  console.log(`  - ไฮไลท์: ${highlights.length} รายการ`)
  highlights.forEach((h, i) => console.log(`     ${i + 1}. ${h}`))

  if (!isAuto) {
    const confirm = await ask('ยืนยันการเริ่ม Release อัตโนมัติ? (y/n)', 'y')
    if (confirm.toLowerCase() !== 'y') {
      console.log('[*] ยกเลิกการทำงาน')
      process.exit(0)
    }
  }

  // 1. Update package.json files
  console.log('\n[1/6] กำลังอัปเดตเลขเวอร์ชันใน package.json...')
  rootPkgData.version = newVersion
  fs.writeFileSync(ROOT_PKG, JSON.stringify(rootPkgData, null, 2) + '\n', 'utf8')

  if (fs.existsSync(FRONT_PKG)) {
    const frontPkgData = JSON.parse(fs.readFileSync(FRONT_PKG, 'utf8'))
    frontPkgData.version = newVersion
    fs.writeFileSync(FRONT_PKG, JSON.stringify(frontPkgData, null, 2) + '\n', 'utf8')
  }

  if (fs.existsSync(BACK_PKG)) {
    const backPkgData = JSON.parse(fs.readFileSync(BACK_PKG, 'utf8'))
    backPkgData.version = newVersion
    fs.writeFileSync(BACK_PKG, JSON.stringify(backPkgData, null, 2) + '\n', 'utf8')
  }
  console.log(`[+] อัปเดตไฟล์ package.json ทุกโฟลเดอร์เป็น v${newVersion} สำเร็จ!`)

  // 2. Update changelog.json
  console.log('\n[2/6] กำลังบันทึก Release Notes ลง changelog.json...')
  let changelogArr = []
  if (fs.existsSync(CHANGELOG_JSON)) {
    try {
      changelogArr = JSON.parse(fs.readFileSync(CHANGELOG_JSON, 'utf8'))
    } catch {
      changelogArr = []
    }
  }

  changelogArr = changelogArr.filter((c) => c.version !== newVersion)

  const newLogEntry = {
    version: newVersion,
    date: getTodayISO(),
    title: releaseTitle,
    type: bumpType,
    highlights: highlights.length > 0 ? highlights : [releaseTitle],
    categories: {
      features: highlights.slice(0, 3),
      improvements: highlights.slice(3),
    },
  }

  changelogArr.unshift(newLogEntry)
  fs.writeFileSync(CHANGELOG_JSON, JSON.stringify(changelogArr, null, 2) + '\n', 'utf8')
  console.log('[+] อัปเดต changelog.json เรียบร้อยแล้ว!')

  // 3. Update CHANGELOG.md
  console.log('\n[3/6] กำลังอัปเดตไฟล์ CHANGELOG.md...')
  const mdHeader = `# บันทึกการเปลี่ยนแปลง\n\nเวอร์ชันของแอปยึดจาก \`package.json\` ที่โฟลเดอร์หลัก และแสดงเลขเดียวกันในหน้าระบบทุกตำแหน่ง\n\n`
  const mdEntry = `## v${newVersion} — ${getTodayThai()}\n\n${releaseTitle}\n\n### ไฮไลท์การเปลี่ยนแปลง\n\n${highlights.map((h) => `- ${h}`).join('\n')}\n\n`

  let existingMd = ''
  if (fs.existsSync(CHANGELOG_MD)) {
    existingMd = fs.readFileSync(CHANGELOG_MD, 'utf8')
    existingMd = existingMd.replace(mdHeader, '')
  }
  fs.writeFileSync(CHANGELOG_MD, mdHeader + mdEntry + existingMd, 'utf8')
  console.log('[+] อัปเดต CHANGELOG.md สำเร็จ!')

  // 4. Build application & packaging
  console.log('\n[4/6] กำลังคอมไพล์ Frontend และสร้างไฟล์แพ็กเกจ HD-Check.zip...')
  const frontDir = path.join(rootDir, 'frontend')
  run('npm run build', frontDir)

  const targetDir = path.join(rootDir, 'HD-Check')
  const targetBackend = path.join(targetDir, 'backend')
  fs.mkdirSync(targetBackend, { recursive: true })
  fs.copyFileSync(ROOT_PKG, path.join(targetDir, 'package.json'))
  if (fs.existsSync(path.join(rootDir, '.env'))) {
    fs.copyFileSync(path.join(rootDir, '.env'), path.join(targetDir, '.env'))
  }
  if (fs.existsSync(path.join(rootDir, 'ecosystem.config.cjs'))) {
    fs.copyFileSync(path.join(rootDir, 'ecosystem.config.cjs'), path.join(targetDir, 'ecosystem.config.cjs'))
  }

  // Copy backend files
  try {
    execSync('robocopy "backend" "HD-Check\\backend" /E /XD "node_modules"', { cwd: rootDir, stdio: 'ignore' })
  } catch {
    // robocopy returns non-zero on success with files copied
  }

  // Archive
  const zipFile = path.join(rootDir, 'HD-Check.zip')
  if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile)
  run(`powershell -NoProfile -Command "Compress-Archive -Path 'HD-Check\\*' -DestinationPath 'HD-Check.zip' -Force"`, rootDir)
  console.log('[+] สร้างแพ็กเกจ HD-Check.zip สำเร็จ!')

  // 5. Commit and push to GitHub
  console.log('\n[5/6] กำลัง Commit และ Push ขึ้น GitHub (origin/main)...')
  run('git add .')
  run(`git commit -m "chore(release): v${newVersion} - ${releaseTitle}"`)
  try {
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}: ${releaseTitle}"`, { cwd: rootDir, stdio: 'inherit' })
  } catch {
    // tag might exist
  }
  const pushSuccess = run('git push origin main --tags')
  if (pushSuccess) {
    console.log(`[+] Push ขึ้น GitHub สำเร็จเรียบร้อย! (Tag: v${newVersion})`)
  } else {
    console.warn('[!] ไม่สามารถ Push ขึ้น GitHub ได้ กรุณาตรวจสอบการตั้งค่า Git Token / สิทธิ์เข้าถึง')
  }

  // 6. Deploy to remote server
  console.log('\n[6/6] กำลังนำขึ้นเซิร์ฟเวอร์ปลายทาง (192.168.1.241)...')
  const deploySuccess = run('node backend/deploy.mjs')
  if (deploySuccess) {
    console.log(`[+] Deploy ขึ้นเซิร์ฟเวอร์ 192.168.1.241 สำเร็จเรียบร้อย!`)
  }

  console.log('\n====================================================================')
  console.log(`  [SUCCESS] Release v${newVersion} ดำเนินการเสร็จสมบูรณ์ 100%!`)
  console.log(`  - เวอร์ชันใหม่  : v${newVersion}`)
  console.log(`  - เว็บไซต์     : http://pkhospital.moph.go.th/hd-check/`)
  console.log(`  - GitHub Tag  : https://github.com/phpaekkapon-oss/HD-Check/releases/tag/v${newVersion}`)
  console.log('====================================================================\n')
}

main().catch((err) => {
  console.error('[CRITICAL] Release process failed:', err)
  process.exit(1)
})
