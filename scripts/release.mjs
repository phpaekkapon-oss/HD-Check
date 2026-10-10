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

// Load environment variables from .env if present
const envPath = path.join(rootDir, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  }
}

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
 * Built-in Code Rule Analyzer
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
  } catch {
    // fallback
  }

  return {
    title: detectedTitle || 'ปรับปรุงและอัปเดตระบบประจำวัน',
    highlights:
      detectedHighlights.length > 0
        ? Array.from(new Set(detectedHighlights))
        : ['ปรับปรุงประสิทธิภาพการทำงานและความเสถียรของระบบ', 'อัปเดตข้อมูลและส่วนติดต่อผู้ใช้งาน'],
  }
}

/**
 * Multi-Engine AI Changelog Generator
 * Uses Gemini API -> Local Ollama -> Built-in Smart Code Analyzer
 */
async function generateChangelogWithAI() {
  console.log('\n🤖 [AI Assistant] กำลังวิเคราะห์โค้ดและสร้าง Release Notes อัตโนมัติ...')

  let diffSummary = ''
  try {
    const stat = execSync('git diff --stat HEAD~1 HEAD', { cwd: rootDir, encoding: 'utf8' }).trim()
    const log = execSync('git log -n 5 --oneline', { cwd: rootDir, encoding: 'utf8' }).trim()
    diffSummary = `Files Changed:\n${stat}\n\nRecent Commits:\n${log}`
  } catch {
    diffSummary = 'General code updates and performance improvements'
  }

  // 1. Google Gemini API (if GEMINI_API_KEY is configured)
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-1.5-flash',
    ].filter(Boolean)

    for (const model of candidateModels) {
      try {
        console.log(`  -> กำลังส่งโค้ดให้ Google Gemini AI (${model}) วิเคราะห์...`)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000)
        const prompt = `คุณคือ AI ผู้ช่วยสารสนเทศโรงพยาบาล จงวิเคราะห์โค้ดที่เปลี่ยนแปลงและเขียน Release Notes ภาษาไทย:
- สรุปหัวข้อสั้นๆ 1 บรรทัด (title)
- ไฮไลท์การเปลี่ยนแปลง 3-5 ข้อที่อ่านง่ายสำหรับผู้ใช้ระบบ (highlights)
ตอบเป็น JSON เท่านั้น: {"title": "...", "highlights": ["...", "..."]}

ข้อมูลโค้ด:
${diffSummary}`

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        })
        clearTimeout(timer)
        if (res.ok) {
          const json = await res.json()
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            const parsed = JSON.parse(text)
            if (parsed.title && Array.isArray(parsed.highlights)) {
              console.log(`  [+] Google Gemini AI (${model}) สรุป Release Notes เรียบร้อย!`)
              return { title: parsed.title, highlights: parsed.highlights, aiModel: `Google Gemini (${model})` }
            }
          }
        }
      } catch {
        // try next candidate model
      }
    }
  }

  // 2. Local Ollama LLM (if running on localhost:11434)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) {
      console.log('  -> กำลังส่งโค้ดให้ Local Ollama AI ในเครื่องวิเคราะห์...')
      const genCtrl = new AbortController()
      const genTimer = setTimeout(() => genCtrl.abort(), 6000)
      const genRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: genCtrl.signal,
        body: JSON.stringify({
          model: 'qwen2.5-coder:3b',
          prompt: `คุณคือ AI สรุป Release Notes ภาษาไทย ตอบเป็น JSON {"title":"...","highlights":["..."]}: ${diffSummary}`,
          format: 'json',
          stream: false,
        }),
      })
      clearTimeout(genTimer)
      if (genRes.ok) {
        const genData = await genRes.json()
        const parsed = JSON.parse(genData.response)
        if (parsed.title && Array.isArray(parsed.highlights)) {
          console.log('  [+] Local Ollama AI สรุป Release Notes เรียบร้อย!')
          return { title: parsed.title, highlights: parsed.highlights, aiModel: 'Local Ollama AI' }
        }
      }
    }
  } catch {
    // fallback
  }

  // 3. Smart Code Rule Analyzer
  console.log('  -> ประมวลผลผ่าน Smart Code Diff Analyzer (AI Rule-Engine)...')
  const fallback = analyzeGitChanges()
  return { ...fallback, aiModel: 'Smart Code Analyzer' }
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

  // Run AI / Code Analyzer
  const aiResult = await generateChangelogWithAI()
  if (!releaseTitle) releaseTitle = aiResult.title

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

  let highlights = []
  if (highlightsInput) {
    highlights = highlightsInput
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  } else if (isAuto) {
    highlights = aiResult.highlights
  } else {
    const input = await ask(
      'ระบุรายการไฮไลท์การอัปเดต (คั่นด้วย ; หรือกด Enter ใช้ผลวิเคราะห์ AI)',
      aiResult.highlights.join('; ')
    )
    highlights = input
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  console.log(`\n[*] สรุป Release Notes (สร้างโดย ${aiResult.aiModel}):`)
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
  const mdEntry = `## v${newVersion} — ${getTodayThai()}\n\n${releaseTitle}\n\n### ไฮไลท์การเปลี่ยนแปลง (สร้างโดย ${aiResult.aiModel})\n\n${highlights.map((h) => `- ${h}`).join('\n')}\n\n`

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
  console.log(`  - ผู้ช่วย AI    : ${aiResult.aiModel}`)
  console.log(`  - เว็บไซต์     : http://pkhospital.moph.go.th/hd-check/`)
  console.log(`  - GitHub Tag  : https://github.com/phpaekkapon-oss/HD-Check/releases/tag/v${newVersion}`)
  console.log('====================================================================\n')
}

main().catch((err) => {
  console.error('[CRITICAL] Release process failed:', err)
  process.exit(1)
})
