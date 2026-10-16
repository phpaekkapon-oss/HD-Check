import express from 'express'
import mysql from 'mysql2/promise'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOS_DB_BASE, DW_DB_BASE, HOS_DB, DW_DB, API_PORT, AUTO_SYNC_MINUTES, DATE_RE, HERB_DRUG_FILTER, SYNC_ENABLED, normalizeIcdCode } from './config.mjs'
import { syncHerbalData, fetchDrugSummary, buildHerbFilter } from './sync.mjs'
import { HEALTH_MED_AUDIT_SQL, evaluateHealthMedAudit } from './healthmed.mjs'
import { evaluate } from './audit-rules.mjs'
import {
  initDispensingRulesTable,
  getDispensingRules,
  saveDispensingRule,
  toggleDispensingRule,
  deleteDispensingRule,
  matchesPttype,
} from './dispensing-rules.mjs'
import {
  initAuthTables,
  authenticateHosUser,
  verify2FALogin,
  init2FASetup,
  confirm2FASetup,
  disable2FA,
  get2FAPolicy,
  set2FAPolicy,
  listAllUsers2FA,
  resetUser2FA,
  setupUserPin,
  verifyUserPin,
  disableUserPin,
  updatePinSettings,
  getPinPolicy,
  setPinPolicy,
  resetUserPin,
  verifySession,
  verifyTempSession,
  logoutSession,
  parsePosition,
  getUserAvatar,
  saveUserAvatar,
  deleteUserAvatar,
  getUserAvatarUrl,
  generateToken,
  saveSession,
  getAuthenticatedUserByLoginname,
  getPinState,
  PIN_MAX_FAILS,
} from './auth.mjs'
import {
  SSO_PROVIDERS,
  SSO_LABEL,
  isSsoProvider,
  initSsoTables,
  getSsoConfig,
  saveSsoConfig,
  missingFields,
  callbackUrl,
  isLive,
  buildAuthorizeUrl,
  takeState,
  exchangeCode,
  findLoginByCid,
  touchIdentity,
  listIdentities,
  linkManual,
} from './sso.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const possibleDistPaths = [
  path.resolve(__dirname, '../HD-Check'),
  path.resolve(__dirname, '../dist'),
  path.resolve(__dirname, '..'),
]
const distPath = possibleDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html'))) || possibleDistPaths[0]

let appVersion = '1.0.0'
try {
  const pkgPath = path.join(__dirname, 'package.json')
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    appVersion = pkg.version || '1.0.0'
  }
} catch {
  // ignore
}

// After an uncaught exception the process state is undefined; exit so PM2 (autorestart) starts
// a clean one instead of serving from a half-broken process. Unhandled rejections are only logged.
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception:', err?.stack || err?.message || err)
  setTimeout(() => process.exit(1), 200).unref()
})
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled rejection:', reason)
})

const makePool = (base, database) => {
  const pool = mysql.createPool({ ...base, database, connectionLimit: 8, waitForConnections: true })
  pool.on('error', (err) => {
    console.error(`[mysql pool error: ${database}]`, err?.message || err)
  })
  pool.pool.on('connection', (c) => c.query('SET NAMES tis620'))
  return pool
}
const dwPool = makePool(DW_DB_BASE, DW_DB)
const hosPool = makePool(HOS_DB_BASE, HOS_DB)

let activeHerbCache = []
let activeHerbCacheAt = 0
let latestHerbVisitCache = null
let latestHerbVisitCacheAt = 0
async function getActiveHerbalDrugs() {
  if (Date.now() - activeHerbCacheAt < 30_000) return activeHerbCache
  const [mapRows] = await dwPool.query('SELECT icode FROM dw_hd_check_drug_dx_map').catch((err) => {
    // Falls back to the built-in drug filter, but say so: custom drugs would silently vanish otherwise
    console.error('[HERB CACHE] Could not read dw_hd_check_drug_dx_map, using built-in filter only:', err?.message)
    return [[]]
  })
  const customIcodes = mapRows.map((r) => String(r.icode)).filter(Boolean)
  const filter = buildHerbFilter(customIcodes)
  const [rows] = await hosPool.query(
    `SELECT d.icode, d.name FROM drugitems d WHERE ${filter} ORDER BY d.name, d.icode`
  )
  activeHerbCache = rows.map((row) => ({ icode: String(row.icode), drug_name: row.name ?? String(row.icode) }))
  activeHerbCacheAt = Date.now()
  return activeHerbCache
}

async function getLatestActiveHerbVisitDate(activeCodes) {
  if (activeCodes.length === 0) {
    latestHerbVisitCache = null
    latestHerbVisitCacheAt = Date.now()
    return null
  }
  if (Date.now() - latestHerbVisitCacheAt < 30_000) return latestHerbVisitCache
  const [[row]] = await hosPool.query(
    "SELECT DATE_FORMAT(MAX(op.vstdate), '%Y-%m-%d') AS latest_visit_date FROM opitemrece op WHERE op.icode IN (?)",
    [activeCodes]
  )
  latestHerbVisitCache = row?.latest_visit_date ?? null
  latestHerbVisitCacheAt = Date.now()
  return latestHerbVisitCache
}

const app = express()
const SESSION_COOKIE = 'hd_check_session'
const SESSION_MAX_AGE = 8 * 60 * 60

app.disable('x-powered-by')
// Behind IIS/nginx every request arrives from the proxy's IP; set TRUST_PROXY (e.g. "1" or
// "loopback") so req.ip is the real client, otherwise one user's failed logins lock out everyone.
if (process.env.TRUST_PROXY) {
  const tp = process.env.TRUST_PROXY
  app.set('trust proxy', /^\d+$/.test(tp) ? Number(tp) : tp === 'true' ? true : tp)
}
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
  }
  if (req.path.startsWith('/api') && !req.path.startsWith('/api/auth/avatar')) res.setHeader('Cache-Control', 'no-store')
  next()
})
// Only the avatar upload carries a large (base64) body; keep every other route small.
const jsonAvatar = express.json({ limit: '3mb' })
const jsonDefault = express.json({ limit: '100kb' })
app.use((req, res, next) => (req.path === '/api/auth/avatar' ? jsonAvatar : jsonDefault)(req, res, next))

function readCookie(req, name) {
  const cookies = String(req.headers.cookie ?? '').split(';')
  const entry = cookies.find((cookie) => cookie.trim().startsWith(`${name}=`))
  if (!entry) return ''
  try {
    return decodeURIComponent(entry.trim().slice(name.length + 1))
  } catch {
    return ''
  }
}

async function getSession(req) {
  return await verifySession(readCookie(req, SESSION_COOKIE), dwPool)
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}${secure}`)
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`)
}

function isAdminUser(user) {
  if (!user) return false
  if (user.admin_enabled === true || Number(user.admin_enabled) === 1) return true
  const login = String(user.loginname ?? '').toLowerCase().trim()
  const group = String(user.groupname ?? '').toLowerCase().trim()
  const pos = String(user.position || user.entryposition || '').toLowerCase().trim()

  // Named admin logins
  if (login === 'admin' || login === 'adminpk' || login === 'aekkapon') return true

  // HOSxP admin groups (admin, administrator, ผู้ดูแลระบบ, it)
  if (group.includes('admin') || group.includes('administrator') || group.includes('ผู้ดูแลระบบ') || group.includes('it')) return true

  // IT & Computer positions
  if (pos.includes('คอมพิวเตอร์') || pos.includes('สารสนเทศ') || pos.includes('it') || pos.includes('โปรแกรมเมอร์')) return true

  return false
}

// PIN state per user, cached briefly so the "PIN required" check doesn't hit the DB on every request
const pinStateCache = new Map()
async function cachedPinState(loginname) {
  const hit = pinStateCache.get(loginname)
  if (hit && Date.now() - hit.at < 30_000) return hit.state
  const state = await getPinState(dwPool, loginname)
  pinStateCache.set(loginname, { state, at: Date.now() })
  return state
}
const invalidatePinState = (loginname) => (loginname ? pinStateCache.delete(loginname) : pinStateCache.clear())

function requireSession(req, res, next) {
  getSession(req)
    .then(async (session) => {
      if (!session) return res.status(401).json({ success: false, error: 'กรุณาเข้าสู่ระบบใหม่' })
      // Screen lock is enforced here, not only in the browser: no data while locked
      if (session.locked) return res.status(423).json({ success: false, locked: true, error: 'หน้าจอถูกล็อก กรุณาปลดล็อกด้วยรหัส PIN' })
      // Hospital enforces PIN lock: no data until this user has set a PIN (account routes stay open so they can)
      if (!req.path.startsWith('/api/auth/')) {
        const pin = await cachedPinState(session.user.loginname)
        if (pin.enforce_pin_lock && !pin.has_pin) {
          return res.status(428).json({ success: false, pinSetupRequired: true, error: 'โรงพยาบาลบังคับใช้ PIN Lock กรุณาตั้งรหัส PIN ก่อนใช้งาน' })
        }
      }
      req.authSession = session
      req.authUser = session.user
      next()
    })
    .catch((err) => {
      console.error('[AUTH Middleware Error]', err)
      res.status(401).json({ success: false, error: 'กรุณาเข้าสู่ระบบใหม่' })
    })
}

function requireAdmin(req, res, next) {
  return requireSession(req, res, () => {
    if (!isAdminUser(req.authUser)) return res.status(403).json({ success: false, error: 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ' })
    next()
  })
}

function canManageHerbDx(user) {
  if (!user) return false
  if (isAdminUser(user)) return true
  const group = String(user.groupname ?? '').toLowerCase().trim()
  const pos = String(user.position || user.entryposition || '').toLowerCase().trim()

  // Thai Traditional Medicine staff (แพทย์แผนไทย, นักการแพทย์แผนไทย, แพทย์แผนไทยประยุกต์, แผนไทย)
  if (
    pos.includes('แพทย์แผนไทย') ||
    pos.includes('แผนไทย') ||
    pos.includes('การแพทย์ทางเลือก') ||
    group.includes('แพทย์แผนไทย') ||
    group.includes('แผนไทย') ||
    group.includes('การแพทย์ทางเลือก')
  ) {
    return true
  }

  // Pharmacy staff
  if (pos.includes('เภสัช') || group.includes('เภสัช')) {
    return true
  }

  return false
}

function requireHerbDxManager(req, res, next) {
  return requireSession(req, res, () => {
    if (!canManageHerbDx(req.authUser)) {
      return res.status(403).json({
        success: false,
        error: 'คุณไม่มีสิทธิ์แก้ไขหรือเพิ่มเกณฑ์ ICD-10 (จำกัดเฉพาะผู้ดูแลระบบ, เจ้าหน้าที่การแพทย์แผนไทย หรือเภสัชกร)',
      })
    }
    next()
  })
}

function canManageLogin(user, loginname) {
  return String(user?.loginname ?? '').toLowerCase() === String(loginname ?? '').trim().toLowerCase() || isAdminUser(user)
}

const fail = (res, err, code = err?.status ?? 500) => {
  console.error('[API]', err?.message ?? err)
  return res.status(code).json({ success: false, error: code >= 500 ? 'ระบบขัดข้อง กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ' : err?.message ?? 'คำขอไม่ถูกต้อง' })
}

const currentMonthRange = () => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const last = new Date(y, m, 0).getDate()
  return { startDate: `${y}-${pad(m)}-01`, endDate: `${y}-${pad(m)}-${pad(last)}` }
}

const readRange = (q) => {
  const def = currentMonthRange()
  const startDate = isValidDate(q.startDate) ? q.startDate : def.startDate
  const endDate = isValidDate(q.endDate) ? q.endDate : def.endDate
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000
  if (days < 0) throw badRequest('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด')
  if (days >= MAX_RANGE_DAYS) throw badRequest(`ช่วงวันที่ต้องไม่เกิน ${MAX_RANGE_DAYS} วัน (1 ปีงบประมาณ)`)
  return { startDate, endDate }
}
// One fiscal year (incl. leap years). Longer ranges pull every row into memory and the browser.
const MAX_RANGE_DAYS = 366
// DATE_RE alone accepts '2026-13-45'; round-trip through Date to reject impossible dates
const isValidDate = (v) => {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}
const badRequest = (message) => Object.assign(new Error(message), { status: 400 })

/* ---------------- Audit rule ---------------- */
async function loadDxMap() {
  const [rows] = await dwPool.query('SELECT icode, dx_prefixes, min_qty FROM dw_hd_check_drug_dx_map')
  const map = new Map()
  const minQtyMap = new Map()
  for (const r of rows) {
    map.set(
      r.icode,
      String(r.dx_prefixes ?? '')
        .split(',')
        .map(normalizeIcdCode)
        .filter(Boolean)
    )
    minQtyMap.set(r.icode, Number(r.min_qty ?? 0))
  }
  return { dxMap: map, minQtyMap }
}


/* ---------------- Sync state ---------------- */
let syncInFlight = null
async function runSync(startDate, endDate, trigger) {
  if (syncInFlight) {
    const err = new Error('กำลังดึงข้อมูลจาก HOSxP อยู่ กรุณารอสักครู่')
    err.status = 409
    throw err
  }
  syncInFlight = syncHerbalData(startDate, endDate, trigger)
  try {
    return await syncInFlight
  } finally {
    syncInFlight = null
  }
}

/* ---------------- Routes ---------------- */
app.get('/api/status', requireSession, async (_req, res) => {
  try {
    const activeHerbs = await getActiveHerbalDrugs()
    const activeCodes = activeHerbs.map((drug) => drug.icode)
    let prescriptionTotal = 0
    let latestVisitDate = null
    if (activeCodes.length > 0) {
      const [[p]] = await dwPool.query(
        'SELECT COUNT(*) AS total FROM dw_hd_check_prescriptions WHERE drug_icode IN (?) AND drug_qty > 0',
        [activeCodes]
      )
      prescriptionTotal = Number(p.total)
      const [[warehouseLatest]] = await dwPool.query(
        "SELECT DATE_FORMAT(MAX(visit_date), '%Y-%m-%d') AS latest_visit_date FROM dw_hd_check_prescriptions WHERE drug_icode IN (?)",
        [activeCodes]
      )
      latestVisitDate = warehouseLatest?.latest_visit_date ?? await getLatestActiveHerbVisitDate(activeCodes)
    }
    const [[last]] = await dwPool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS at, status, message, trigger_type,
              DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date
       FROM dw_hd_check_sync_log ORDER BY id DESC LIMIT 1`
    )
    res.json({
      status: 'online',
      appVersion,
      host: `${DW_DB_BASE.host}:${DW_DB_BASE.port}`,
      database: DW_DB,
      totalPrescriptions: prescriptionTotal,
      totalDrugs: activeHerbs.length,
      latestVisitDate,
      lastSync: last ?? null,
      isSyncing: Boolean(syncInFlight),
      syncEnabled: SYNC_ENABLED,
      autoSyncMinutes: AUTO_SYNC_MINUTES,
    })
  } catch (err) {
    fail(res, err)
  }
})

app.get('/api/version', (_req, res) => {
  res.json({
    success: true,
    version: appVersion,
    timestamp: Date.now(),
  })
})

app.post('/api/sync', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = readRange(req.body ?? {})
    res.json(await runSync(startDate, endDate, 'MANUAL'))
  } catch (err) {
    fail(res, err, err.status ?? 500)
  }
})

app.get('/api/prescriptions', requireSession, async (req, res) => {
  try {
    const { startDate, endDate } = readRange(req.query)
    const hn = typeof req.query.hn === 'string' ? req.query.hn.trim() : ''
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const result = typeof req.query.result === 'string' ? req.query.result : 'ALL'

    let sql = `
      SELECT id, vn, DATE_FORMAT(visit_date, '%Y-%m-%d') AS visit_date, TIME_FORMAT(visit_time, '%H:%i:%s') AS visit_time,
             hn, patient_name, pttype_name, drug_icode, drug_name, drug_qty, COALESCE(drug_units, '') AS drug_units, department_name,
             main_pdx, pdx, dx0, dx1, dx2, dx3, dx4, dx5, doctor_code, doctor_name
      FROM dw_hd_check_prescriptions
      WHERE visit_date BETWEEN ? AND ?
        AND drug_qty > 0`
    const params = [startDate, endDate]
    const activeHerbs = await getActiveHerbalDrugs()
    if (activeHerbs.length === 0) {
      return res.json({ success: true, data: [], kpi: { total: 0, pass: 0, fail: 0, noDx: 0, noMap: 0, passRate: 0, totalQty: 0, uniquePatients: 0 }, meta: { total: 0, startDate, endDate } })
    }
    sql += ' AND drug_icode IN (?)'
    params.push(activeHerbs.map((drug) => drug.icode))
    if (hn) {
      sql += ' AND hn LIKE ?'
      params.push(`%${hn}%`)
    }
    if (search) {
      sql += ` AND (patient_name LIKE ? OR drug_name LIKE ? OR doctor_name LIKE ? OR department_name LIKE ?
                    OR pdx LIKE ? OR dx0 LIKE ? OR dx1 LIKE ? OR dx2 LIKE ?)`
      const s = `%${search}%`
      params.push(s, s, s, s, `${search}%`, `${search}%`, `${search}%`, `${search}%`)
    }
    sql += ' ORDER BY visit_date DESC, visit_time DESC, id ASC'

    const [rows] = await dwPool.query(sql, params)
    const { dxMap, minQtyMap } = await loadDxMap()

    // ตรวจสอบเงื่อนไขรอบการจ่ายยาสมุนไพรและสิทธิการรักษาที่ตั้งค่าไว้
    let activeDispensingRules = []
    try {
      activeDispensingRules = await getDispensingRules(dwPool, true)
    } catch {
      activeDispensingRules = []
    }

    // หาแถวที่เข้าข่ายเงื่อนไขรอบการจ่ายยา
    const candidateRows = []
    for (const r of rows) {
      for (const rule of activeDispensingRules) {
        const isDrug =
          (rule.drug_icode && String(r.drug_icode) === String(rule.drug_icode)) ||
          (rule.drug_name && r.drug_name && r.drug_name.includes(rule.drug_name))
        if (isDrug && matchesPttype(r.pttype_name, r.pttype, rule.pttype_filter)) {
          candidateRows.push({ row: r, rule })
          break
        }
      }
    }

    const candidateHns = [...new Set(candidateRows.map((c) => c.row.hn).filter(Boolean))]
    const candidateIcodes = [...new Set(candidateRows.map((c) => c.rule.drug_icode).filter(Boolean))]
    const historyByKey = new Map()

    if (candidateHns.length > 0 && candidateIcodes.length > 0) {
      const [historyRows] = await dwPool.query(
        `SELECT hn, drug_icode, drug_name, DATE_FORMAT(visit_date, '%Y-%m-%d') AS visit_date, TIME_FORMAT(visit_time, '%H:%i:%s') AS visit_time, id, vn, drug_qty
         FROM dw_hd_check_prescriptions
         WHERE hn IN (?)
           AND drug_icode IN (?)
           AND drug_qty > 0
         ORDER BY hn, drug_icode, visit_date ASC, id ASC`,
        [candidateHns, candidateIcodes]
      )
      for (const h of historyRows) {
        const key = `${h.hn}__${h.drug_icode}`
        if (!historyByKey.has(key)) historyByKey.set(key, [])
        historyByKey.get(key).push(h)
      }
    }

    const evaluated = rows.map((r) => {
      let interval_fail = false
      let interval_prev_date = null
      let interval_days_diff = null
      let interval_rule_info = null

      const matchedRule = activeDispensingRules.find((rule) => {
        const isDrug =
          (rule.drug_icode && String(r.drug_icode) === String(rule.drug_icode)) ||
          (rule.drug_name && r.drug_name && r.drug_name.includes(rule.drug_name))
        return isDrug && matchesPttype(r.pttype_name, r.pttype, rule.pttype_filter)
      })

      if (matchedRule) {
        const key = `${r.hn}__${matchedRule.drug_icode}`
        const hist = historyByKey.get(key) || []
        const prevList = hist.filter((h) => {
          if (h.id === r.id) return false
          if (h.visit_date < r.visit_date) return true
          if (h.visit_date === r.visit_date && (h.id < r.id || (h.visit_time && r.visit_time && h.visit_time < r.visit_time))) return true
          return false
        })
        if (prevList.length > 0) {
          const lastPrev = prevList[prevList.length - 1]
          const currD = new Date(r.visit_date + 'T00:00:00')
          const prevD = new Date(lastPrev.visit_date + 'T00:00:00')
          const diffDays = Math.round((currD.getTime() - prevD.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays < matchedRule.min_interval_days) {
            interval_fail = true
            interval_prev_date = lastPrev.visit_date
            interval_days_diff = diffDays
            interval_rule_info = {
              drug_name: matchedRule.drug_name,
              pttype_label: matchedRule.pttype_name_label,
              min_days: matchedRule.min_interval_days,
            }
          }
        }
      }

      const isCinnamon = r.drug_icode === '1490024' || (r.drug_name && r.drug_name.includes('ยาธาตุอบเชย'))
      const rowWithInfo = {
        ...r,
        drug_qty: Number(r.drug_qty),
        interval_fail,
        interval_prev_date,
        interval_days_diff,
        interval_rule_info,
        cinnamon_interval_fail: isCinnamon ? interval_fail : false,
        cinnamon_prev_date: isCinnamon ? interval_prev_date : null,
        cinnamon_days_diff: isCinnamon ? interval_days_diff : null,
      }

      return {
        ...rowWithInfo,
        ...evaluate(rowWithInfo, dxMap, minQtyMap),
      }
    })

    const count = (k) => evaluated.filter((r) => r.audit_result === k).length
    const kpi = {
      total: evaluated.length,
      pass: count('PASS'),
      fail: count('FAIL'),
      noDx: count('NO_DX'),
      noMap: count('NO_MAP'),
      totalQty: evaluated.reduce((s, r) => s + r.drug_qty, 0),
      uniquePatients: new Set(evaluated.map((r) => r.hn)).size,
    }
    kpi.passRate = kpi.total ? Math.round((kpi.pass / kpi.total) * 1000) / 10 : 0

    const filtered =
      result === 'ALL'
        ? evaluated
        : result === 'PROBLEM'
          ? evaluated.filter((r) => r.audit_result !== 'PASS')
          : evaluated.filter((r) => r.audit_result === result)

    res.json({ success: true, data: filtered, kpi, meta: { total: filtered.length, startDate, endDate } })
  } catch (err) {
    fail(res, err)
  }
})

app.get('/api/healthmed/audit', requireSession, async (req, res) => {
  try {
    const { startDate, endDate } = readRange(req.query)
    const resultFilter = String(req.query.result ?? 'ALL').toUpperCase()
    const search = String(req.query.search ?? '').trim()

    // 1. ดึงรายการ visit ที่มีค่าบริการ/หัตถการแพทย์แผนไทย (ไม่รวมรายการยา)
    const [rows] = await hosPool.query(HEALTH_MED_AUDIT_SQL, [startDate, endDate])

    // 2. ดึงรหัสหัตถการ ICD-10-TM ทั้งหมดในช่วงวันที่จาก health_med_service_operation
    const [ops] = await hosPool.query(`
      SELECT hms.vn, hmoi.icd10tm, hmoi.health_med_operation_item_name
      FROM health_med_service hms
      JOIN health_med_service_operation hso ON hso.health_med_service_id = hms.health_med_service_id
      JOIN health_med_operation_item hmoi ON hmoi.health_med_operation_item_id = hso.health_med_operation_item_id
      WHERE hms.service_date BETWEEN ? AND ?
    `, [startDate, endDate])

    const opsByVn = new Map()
    for (const op of ops) {
      if (!opsByVn.has(op.vn)) opsByVn.set(op.vn, [])
      opsByVn.get(op.vn).push({
        code: op.icd10tm,
        name: op.health_med_operation_item_name,
      })
    }

    // 3. กรองเฉพาะเคสที่มีรหัสหัตถการ (health_med_service_operation) หรือมีรายการค่าบริการแพทย์แผนไทย (nondrugitems)
    // ตัดเคสที่ไม่มีทั้งหัตถการและค่าบริการออก (เนื่องจากเป็นเคสรับยาสมุนไพรอย่างเดียว ซึ่งตรวจสอบในเมนูตรวจสอบการจ่ายยาสมุนไพร)
    const validRows = rows.filter((r) => {
      const ops = opsByVn.get(r.vn) || []
      const hasOps = ops.length > 0
      const hasServices = Boolean(r.service_items_raw && r.service_items_raw.trim())
      return hasOps || hasServices
    })

    // 4. ดึงวันคลอดจากระบบงานบัญชี 2 (person_anc) เฉพาะผู้ป่วยที่เป็นเคสบริบาลหลังคลอด
    const postpartumRows = validRows.filter((r) => {
      const dxs = [r.pdx, r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5]
      const ops = opsByVn.get(r.vn) || []
      const hasU506 = dxs.includes('U506')
      const hasPostpartumOp = ops.some((o) => String(o.code).startsWith('900-77'))
      const hasPostpartumService = Number(r.count_58220 ?? 0) > 0 || Number(r.count_58131 ?? 0) > 0
      return hasU506 || hasPostpartumOp || hasPostpartumService
    })

    const postpartumHns = [...new Set(postpartumRows.map((r) => r.hn).filter(Boolean))]
    const laborDateByHn = new Map()
    if (postpartumHns.length > 0) {
      const [ancRows] = await hosPool.query(`
        SELECT p.patient_hn, MAX(pa.labor_date) AS labor_date
        FROM person p
        JOIN person_anc pa ON pa.person_id = p.person_id
        WHERE p.patient_hn IN (${postpartumHns.map(() => '?').join(',')})
          AND pa.labor_date IS NOT NULL
        GROUP BY p.patient_hn
      `, postpartumHns)
      for (const r of ancRows) {
        laborDateByHn.set(r.patient_hn, r.labor_date)
      }
    }

    // 5. ผูกข้อมูลหัตถการและวันคลอด และประเมินผลเกณฑ์แพทย์แผนไทย 5 ข้อ
    const evaluated = validRows.map((r) => {
      const operations = opsByVn.get(r.vn) || []
      const operation_codes = operations.map((o) => o.code).filter(Boolean)
      const dxs = [r.pdx, r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5]
      const isPostpartumCase =
        dxs.includes('U506') ||
        operations.some((o) => String(o.code).startsWith('900-77')) ||
        Number(r.count_58220 ?? 0) > 0 ||
        Number(r.count_58131 ?? 0) > 0
      const labor_date = isPostpartumCase ? (laborDateByHn.get(r.hn) || null) : null
      const fullRow = {
        ...r,
        operations,
        operation_codes,
        labor_date,
      }
      return {
        ...fullRow,
        ...evaluateHealthMedAudit(fullRow),
      }
    })

    const filtered = evaluated.filter((r) => {
      if (resultFilter === 'PROBLEM' && r.audit_result === 'PASS') return false
      if (['PASS', 'FAIL'].includes(resultFilter) && r.audit_result !== resultFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const opCodesText = r.operation_codes?.join(' ') ?? ''
        const laborText = r.labor_date ?? ''
        const text = `${r.hn} ${r.patient_name} ${r.doctor_name} ${r.pdx} ${r.dx0} ${r.dx1} ${r.pttype_name} ${r.audit_reason} ${opCodesText} ${laborText}`.toLowerCase()
        if (!text.includes(s)) return false
      }
      return true
    })

    const kpi = {
      total: evaluated.length,
      pass: evaluated.filter((r) => r.audit_result === 'PASS').length,
      fail: evaluated.filter((r) => r.audit_result === 'FAIL').length,
      duplicateFail: evaluated.filter((r) => r.failures?.some((f) => f.includes('ซ้ำ'))).length,
      kneeFail: evaluated.filter((r) => r.failures?.some((f) => f.includes('เข่า'))).length,
      postpartumFail: evaluated.filter((r) => r.failures?.some((f) => f.includes('หลังคลอด') || f.includes('วันคลอด'))).length,
      muscleFail: evaluated.filter((r) => r.failures?.some((f) => f.includes('กล้ามเนื้อ') || f.includes('รหัส M'))).length,
      epFail: evaluated.filter((r) => r.failures?.some((f) => f.includes('EP'))).length,
    }
    kpi.passRate = kpi.total ? Math.round((kpi.pass / kpi.total) * 1000) / 10 : 0

    res.json({ success: true, data: filtered, kpi, meta: { total: filtered.length, startDate, endDate } })
  } catch (err) {
    fail(res, err)
  }
})

// AI Cache to avoid redundant external API calls
const aiAdvisorCache = new Map()

function generateRuleBasedAdvice({ failures, age_y, pdx, dxList, ops, labor_date }) {
  const failList = failures || []
  const hosxpActions = []
  const cautions = []
  let summary = 'พบรายการเวชระเบียนยังไม่เป็นไปตามเกณฑ์มาตรฐานการแพทย์แผนไทย'

  if (failList.some((f) => f.includes('พอกเข่า') || f.includes('เข่า'))) {
    summary = 'เคสข้อเข่าเสื่อม/พอกเข่า (M179 + U5753) ไม่ครบตามเงื่อนไข สปสช.'
    if (Number(age_y || 0) < 40) {
      cautions.push(`ผู้ป่วยอายุ ${age_y} ปี (ไม่ถึงเกณฑ์ขั้นต่ำ 40 ปีบริบูรณ์) ไม่สามารถเบิกชดเชยค่าบริการพอกเข่าได้`)
    }
    hosxpActions.push('เปิดระบบงานแพทย์แผนไทยใน HOSxP แล้วลงรหัสหัตถการ ICD-10-TM ให้ครบทั้ง 4 รหัส ได้แก่ 872-78-11, 873-78-11, 874-78-11, 873-78-35')
  }

  if (failList.some((f) => f.includes('หลังคลอด') || f.includes('วันคลอด'))) {
    summary = 'เคสบริบาลหญิงหลังคลอด (M6260 + U506) ข้อมูลหัตถการหรือวันคลอดยังไม่ครบถ้วน'
    if (!labor_date) {
      hosxpActions.push('บันทึกข้อมูลการคลอดบุตรในระบบงานบัญชี 2 (งานอนามัยแม่และเด็ก/หญิงตั้งครรภ์และหลังคลอด) เพื่อให้มีวันคลอดเชื่อมโยง')
    }
    hosxpActions.push('ลงรหัสหัตถการบริบาลหลังคลอดให้ครบ 5 รหัส (900-77-12, 900-77-13, 900-77-14, 900-77-16, 900-77-30)')
    cautions.push('การเบิกชดเชยบริบาลหญิงหลังคลอดต้องอยู่ในช่วงระยะเวลาหลังคลอดตามเกณฑ์ สปสช. เท่านั้น')
  }

  if (failList.some((f) => f.includes('กล้ามเนื้อ') || f.includes('รหัส M'))) {
    summary = 'การวินิจฉัยโรคกล้ามเนื้อ (รหัส M...) ขาดรหัสแพทย์แผนไทย (รหัส U...) หรือขาดหัตถการ'
    hosxpActions.push('ตรวจสอบการลงรหัสโรคหลัก/โรคร่วม ให้มีทั้งรหัสโรคกล้ามเนื้อ (M...) คู่กับรหัสแพทย์แผนไทย (U...)')
    hosxpActions.push('บันทึกรหัสหัตถการบำบัดรักษา เช่น 872-78-11, 873-78-11, 874-78-11, 873-78-35, 900-78-11, 900-78-20, 900-78-00 หรือรายการค่านวด/ประคบ')
  }

  if (failList.some((f) => f.includes('ซ้ำ'))) {
    summary = 'ตรวจพบการลงค่าบริการซ้ำซ้อนในวันเดียวกัน'
    hosxpActions.push('เปิดใบสั่งค่าบริการใน HOSxP และยกเลิกรายการค่าบริการที่ซ้ำกัน (เช่น นวดและประคบ 58130 มากกว่า 1 ครั้ง)')
  }

  if (failList.some((f) => f.includes('EP'))) {
    summary = 'พบรหัสปิดสิทธิ (EP...) ในผู้ป่วยสิทธิประกันสุขภาพ (UC)'
    cautions.push('รหัส EP เป็นรหัสปิดสิทธิ จะส่งผลให้ สปสช. ปฏิเสธการจ่ายเงินชดเชย (Denial)')
    hosxpActions.push('ตรวจสอบการเลือกสิทธิการรักษาและยกเลิกรหัสปิดสิทธิที่ไม่ถูกต้องใน HOSxP')
  }

  if (hosxpActions.length === 0) {
    hosxpActions.push('ตรวจสอบความถูกต้องของการลงรหัสวินิจฉัยและรหัสหัตถการใน HOSxP ให้สอดคล้องกัน')
  }
  if (cautions.length === 0) {
    cautions.push('ตรวจสอบให้แน่ใจว่าได้ทำการบันทึกข้อมูลและส่งออกข้อมูล e-Claim อย่างถูกต้องครบถ้วน')
  }

  return {
    summary,
    hosxpAction: hosxpActions.join('\n- '),
    caution: cautions.join('\n- '),
  }
}

app.post('/api/healthmed/ai-advisor', requireSession, async (req, res) => {
  try {
    const {
      vn,
      hn,
      patient_name,
      age_y,
      pttype_name,
      pdx,
      dx0,
      dx1,
      dx2,
      dx3,
      dx4,
      dx5,
      service_items_raw,
      operation_codes,
      labor_date,
      failures,
      audit_reason,
    } = req.body || {}

    if (vn && aiAdvisorCache.has(vn)) {
      return res.json({ success: true, advice: aiAdvisorCache.get(vn), source: 'cache' })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    const dxList = [pdx, dx0, dx1, dx2, dx3, dx4, dx5].filter(Boolean).join(', ')
    const ops = (operation_codes || []).join(', ') || 'ไม่มี'
    const failReasons = (failures && failures.length > 0) ? failures.join('\n- ') : (audit_reason || 'ไม่ระบุ')

    let advice = null

    if (geminiKey) {
      const candidateModels = [
        process.env.GEMINI_MODEL,
        'gemini-flash-lite-latest',
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash-lite',
      ].filter(Boolean)

      const prompt = `คุณคือ AI ผู้เชี่ยวชาญการตรวจสอบเวชระเบียนและการเบิกจ่ายกองทุนการแพทย์แผนไทย (สปสช.) สำหรับโรงพยาบาล
กรณีผู้ป่วย:
- ชื่อ: ${patient_name || 'ผู้รับบริการ'} (HN: ${hn || '-'}, อายุ: ${age_y || '-'} ปี)
- สิทธิการรักษา: ${pttype_name || 'ไม่ระบุ'}
- รหัสการวินิจฉัย: PDX=${pdx || '-'}, รหัสร่วม=${dxList}
- รายการค่าบริการ: ${service_items_raw || '-'}
- รหัสหัตถการ (ICD-10-TM): ${ops}
- วันคลอดบุตรในระบบงานบัญชี 2: ${labor_date || 'ไม่มี'}

ผลการ Audit: ไม่ผ่านเกณฑ์ เนื่องจาก:
- ${failReasons}

จงให้คำแนะนำแก่เจ้าหน้าที่/แพทย์แผนไทยอย่างกระชับ ชัดเจน และตรงจุด ตอบเป็น JSON:
{
  "summary": "สรุปสาเหตุที่ไม่ผ่านสั้นๆ 1-2 ประโยค",
  "hosxpAction": "ขั้นตอนสิ่งที่ต้องเข้าไปแก้ไขในระบบ HOSxP ระบุรหัสโรคหรือรหัสหัตถการ ICD-10-TM ที่ต้องลงให้ชัดเจน (เขียนเป็นข้อๆ)",
  "caution": "ข้อควรระวังในการเบิกชดเชยค่าบริการ"
}`

      for (const model of candidateModels) {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 9000)
          const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          })
          clearTimeout(timer)
          if (apiRes.ok) {
            const json = await apiRes.json()
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) {
              advice = JSON.parse(text)
              advice.aiModel = `Google Gemini (${model})`
              break
            }
          }
        } catch {
          // try next model
        }
      }
    }

    if (!advice) {
      advice = generateRuleBasedAdvice({ failures, age_y, pdx, dxList, ops, labor_date })
      advice.aiModel = 'Smart Rule Engine (AI Offline Mode)'
    }

    if (vn && advice) {
      aiAdvisorCache.set(vn, advice)
      if (aiAdvisorCache.size > 500) {
        const firstKey = aiAdvisorCache.keys().next().value
        aiAdvisorCache.delete(firstKey)
      }
    }

    res.json({ success: true, advice, source: geminiKey ? 'gemini-ai' : 'rule-engine' })
  } catch (err) {
    fail(res, err)
  }
})

// General AI Smart Copilot Chat Endpoint
app.post('/api/ai/chat', requireSession, async (req, res) => {
  try {
    const { message, history } = req.body || {}
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุข้อความคำถาม' })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    const query = message.trim()

    // Smart Offline Knowledge Base Fallback
    const getOfflineAnswer = (q) => {
      const lower = q.toLowerCase()
      if (lower.includes('พอกเข่า') || lower.includes('m179') || lower.includes('u5753')) {
        return `### 🌿 เกณฑ์การเบิกชดเชยหัตถการพอกเข่า (สปสช.)
1. **เกณฑ์อายุ**: ผู้ป่วยต้องมีอายุตั้งแต่ **40 ปีบริบูรณ์ขึ้นไป**
2. **รหัสการวินิจฉัย (ICD-10)**:
   - รหัสโรคหลัก (PDX/DX): **M179** (Gonarthrosis, unspecified) คู่กับ **U5753** (โรคลมจับโปงแห้งเข่า)
3. **รหัสหัตถการ ICD-10-TM** (ต้องลงให้ครบ 4 รหัส):
   - **872-78-11** (การตรวจร่างกายทางแพทย์แผนไทย)
   - **873-78-11** (การวินิจฉัยทางแพทย์แผนไทย)
   - **874-78-11** (การวางแผนการรักษา)
   - **873-78-35** (การรักษาด้วยการพอกยา/พอกเข่า)
4. **ข้อควรระวัง**: ห้ามลงรหัสปิดสิทธิ (EP) และต้องมีบันทึกประเมินอาการก่อน-หลังการรักษาใน HOSxP`
      }
      if (lower.includes('หลังคลอด') || lower.includes('u506') || lower.includes('m6260')) {
        return `### 🤱 เกณฑ์การบริบาลหญิงหลังคลอด (สปสช.)
1. **เงื่อนไขเวลา**: ต้องเป็นหญิงหลังคลอดบุตรในช่วงระยะเวลาที่กำหนด (บันทึกในระบบงานบัญชี 2 มีวันคลอดเชื่อมโยง)
2. **รหัสโรค**: **M6260** หรือกลุ่มโรคหลังคลอด ร่วมกับ **U506** (การดูแลมารดาหลังคลอด)
3. **รหัสหัตถการ ICD-10-TM (5 รหัส)**:
   - **900-77-12** (การประคบสมุนไพร)
   - **900-77-13** (การนวดฟื้นฟูสภาพ)
   - **900-77-14** (การทับหม้อเกลือ)
   - **900-77-16** (การอบไอน้ำสมุนไพร)
   - **900-77-30** (การให้คำแนะนำการปฏิบัติตัว)
4. **ข้อควรระวัง**: ตรวจสอบวันคลอดบุตรในระบบงานบัญชี 2 ให้ตรงกับข้อเท็จจริง`
      }
      if (lower.includes('ep') || lower.includes('ปิดสิทธิ')) {
        return `### ⚠️ รหัสปิดสิทธิ (EP) คืออะไร และแก้ไขอย่างไร?
- **รหัส EP...** คือรหัสที่ใช้ปิดสิทธิการเบิกจ่าย หรือระบุเงื่อนไขพิเศษที่ไม่สามารถเบิกเงินชดเชยจากกองทุน สปสช. (UC) ได้
- **สาเหตุที่ติด Denial**: หากผู้ป่วยเป็นสิทธิบัตรทอง (UC) แล้วมีรหัส EP แนบมา e-Claim จะปฏิเสธการจ่ายทันที
- **วิธีแก้ไขใน HOSxP**:
  1. เปิดหน้าจอลงทะเบียน/บันทึกการตรวจผู้ป่วยนอก
  2. ตรวจสอบแท็บการเลือกสิทธิการรักษา
  3. นำรหัสปิดสิทธิ EP ที่ไม่ถูกต้องออก หรือเลือกสิทธิให้ตรงกับกองทุนที่ต้องการเบิก`
      }
      if (lower.includes('34 รายการ') || lower.includes('สมุนไพร') || lower.includes('ยา')) {
        return `### 💊 ยาสมุนไพร 34 รายการในระบบหลักประกันสุขภาพ
- รายการยาสมุนไพรที่ สปสช. สนับสนุนงบประมาณเพิ่มเติม เช่น ขมิ้นชัน, ฟ้าทะลายโจร, ไพล, เถาวัลย์เปรียง, มะขามป้อม, ยาหอมนวโกฐ, ธาตุบรรจบ ฯลฯ
- **การบันทึกใน HOSxP**:
  1. สั่งยาผ่านหน้าจอห้องตรวจแพทย์/ห้องยาตามรหัส icode ที่กำหนด
  2. ตรวจสอบการ Map รหัสยามาตรฐาน 24 หลัก (TMT)
  3. ตรวจสอบรายการในเมนู **"ตรวจสอบการสั่งยา"** ของระบบ SMART-HOSCHECK เพื่อเช็คความครบถ้วน`
      }
      if (lower.includes('เอกพล') || lower.includes('ติดต่อ') || lower.includes('it') || lower.includes('257')) {
        return `### 📞 ช่องทางติดต่อผู้พัฒนาระบบ SMART-HOSCHECK
- **ผู้พัฒนา**: นายเอกพล อันคำวงศ์ (นักวิชาการคอมพิวเตอร์ปฏิบัติการ)
- **กลุ่มงาน**: สุขภาพดิจิทัล (งานเทคโนโลยีสารสนเทศ) โรงพยาบาลพังโคน
- **โทรศัพท์ภายใน**: ต่อ **257**
- ยินดีช่วยเหลือและรับข้อเสนอแนะในการพัฒนาระบบครับ!`
      }
      return `สวัสดีครับ! ผมคือ **AI Smart Copilot** ผู้ช่วยอัจฉริยะประจำระบบ SMART-HOSCHECK โรงพยาบาลพังโคน 

ผมสามารถช่วยท่านในเรื่อง:
- 🌿 **เกณฑ์การเบิกจ่ายแพทย์แผนไทย สปสช.**: พอกเข่า (M179), บริบาลหญิงหลังคลอด (U506), นวด/ประคบ
- 💻 **การลงบันทึกใน HOSxP**: การลงรหัสหัตถการ ICD-10-TM, รหัสโรค และการแก้ไขรหัสปิดสิทธิ (EP)
- 💊 **การตรวจสอบยาสมุนไพร 34 รายการ**
- 📊 **แนวทางการแก้ไขเวชระเบียนที่ไม่ผ่านเกณฑ์ Audit**

💡 *ท่านสามารถพิมพ์ถามคำถาม เช่น "เกณฑ์พอกเข่าต้องอายุเท่าไหร่" หรือ "รหัส EP แก้อย่างไร" ได้เลยครับ*`
    }

    let replyText = null
    let modelUsed = null

    if (geminiKey) {
      const candidateModels = [
        process.env.GEMINI_MODEL,
        'gemini-flash-lite-latest',
        'gemini-3.8-flash',
        'gemini-flash-latest',
      ].filter(Boolean)

      const systemInstruction = `คุณคือ AI Smart Copilot ผู้ช่วยผู้เชี่ยวชาญการแพทย์แผนไทยและระบบเวชระเบียน HOSxP ประจำโรงพยาบาลพังโคน จังหวัดสกลนคร (ระบบ SMART-HOSCHECK พัฒนาโดยคุณเอกพล อันคำวงศ์ งานไอที โทร 257)
บทบาทของคุณ:
1. ตอบคำถามเกี่ยวกับเกณฑ์การตรวจประเมินเวชระเบียน (Audit) และการเบิกชดเชยค่าบริการทางการแพทย์แผนไทย กองทุน สปสช. (e-Claim)
2. แนะนำรหัสการวินิจฉัย ICD-10 สากล (กลุ่ม M...) และรหัสแพทย์แผนไทย ICD-10-TM (กลุ่ม U50-U77 เช่น U506 หญิงหลังคลอด, U5753 ปวดเข่า)
3. แนะนำรหัสหัตถการ ICD-10-TM เช่น พอกเข่า (872-78-11, 873-78-11, 874-78-11, 873-78-35), หลังคลอด (900-77-12 ถึง 900-77-30)
4. ช่วยแนะนำวิธีลงข้อมูลและแก้ไขในระบบ HOSxP เช่น การแก้รหัสปิดสิทธิ EP, การสั่งยา 34 รายการ
5. ตอบเป็นภาษาไทยที่สุภาพ เป็นมิตร กระชับ เข้าใจง่าย และใช้ Markdown จัดรูปแบบ (bullet, ตัวหนา, หัวข้อ)`

      // Format conversation contents
      const contents = []
      if (Array.isArray(history) && history.length > 0) {
        for (const item of history.slice(-6)) {
          if (item.role && item.content) {
            contents.push({
              role: item.role === 'user' ? 'user' : 'model',
              parts: [{ text: String(item.content) }],
            })
          }
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: query }],
      })

      for (const model of candidateModels) {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 12000)
          const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents,
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
              },
            }),
          })
          clearTimeout(timer)
          if (apiRes.ok) {
            const data = await apiRes.json()
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (text && text.trim()) {
              replyText = text.trim()
              modelUsed = `Google Gemini (${model})`
              break
            }
          }
        } catch {
          // try next model
        }
      }
    }

    if (!replyText) {
      replyText = getOfflineAnswer(query)
      modelUsed = 'SMART-HOSCHECK Rule Engine (Offline Mode)'
    }

    res.json({
      success: true,
      reply: replyText,
      model: modelUsed,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    fail(res, err)
  }
})

app.get('/api/drugs', requireSession, async (req, res) => {
  try {
    const { startDate, endDate } = readRange(req.query)
    const activeHerbs = await getActiveHerbalDrugs()
    const activeCodes = activeHerbs.map((drug) => drug.icode)

    // The backup HOSxP can lag behind the primary source. Prefer a successful
    // non-empty snapshot for this exact date range when one is already stored.
    // The drug summary table is a latest-sync snapshot, so only use it when the
    // sync log confirms that it was populated for the requested range.
    if (activeCodes.length > 0) {
      // dw_hd_check_drugs is overwritten by every sync, so it only describes this
      // range when the most recent successful sync was for exactly this range.
      const [[latest]] = await dwPool.query(
        `SELECT DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
                total_prescriptions, message
         FROM dw_hd_check_sync_log
         WHERE status = 'SUCCESS'
         ORDER BY id DESC LIMIT 1`
      )
      const snapshot =
        latest &&
        latest.start_date === startDate &&
        latest.end_date === endDate &&
        Number(latest.total_prescriptions) > 0 &&
        !String(latest.message ?? '').startsWith('Preserved ')
      if (snapshot) {
        const [warehouseData] = await dwPool.query(
          `SELECT icode, name, COALESCE(units, '') AS units, opd_qty, ipd_qty, unitcost, total_qty, total_cost, nhso_adp_code
           FROM dw_hd_check_drugs WHERE icode IN (?)
           ORDER BY total_qty DESC, name ASC`,
          [activeCodes]
        )
        if (warehouseData.some((row) => Number(row.total_qty) > 0)) {
          return res.json({
            success: true,
            data: warehouseData,
            meta: { total: warehouseData.length, startDate, endDate, source: 'warehouse_snapshot' },
          })
        }
      }
    }

    const data = await fetchDrugSummary(hosPool, startDate, endDate, activeCodes)
    res.json({ success: true, data, meta: { total: data.length, startDate, endDate, source: 'hosxp' } })
  } catch (err) {
    fail(res, err)
  }
})

app.get('/api/dx-map', requireSession, async (_req, res) => {
  try {
    const activeHerbs = await getActiveHerbalDrugs()
    const [mappedRows] = await dwPool.query(
      `SELECT icode, drug_name, COALESCE(dx_prefixes, '') AS dx_prefixes,
              COALESCE(min_qty, 0) AS min_qty,
              COALESCE(indication, '') AS indication,
              COALESCE(DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s'), '') AS updated_at
       FROM dw_hd_check_drug_dx_map`
    )
    const mapByCode = new Map(mappedRows.map((row) => [String(row.icode), row]))
    const allDrugsMap = new Map()
    for (const h of activeHerbs) {
      allDrugsMap.set(h.icode, { icode: h.icode, drug_name: h.drug_name })
    }
    for (const m of mappedRows) {
      if (!allDrugsMap.has(m.icode)) {
        allDrugsMap.set(m.icode, { icode: m.icode, drug_name: m.drug_name || m.icode })
      }
    }
    const rows = Array.from(allDrugsMap.values()).map((drug) => {
      const mapped = mapByCode.get(drug.icode)
      return {
        icode: drug.icode,
        drug_name: mapped?.drug_name || drug.drug_name,
        dx_prefixes: mapped?.dx_prefixes ?? '',
        min_qty: Number(mapped?.min_qty ?? 0),
        indication: mapped?.indication ?? '',
        updated_at: mapped?.updated_at ?? '',
      }
    }).sort((a, b) => a.drug_name.localeCompare(b.drug_name, 'th'))
    res.json({ success: true, data: rows })
  } catch (err) {
    fail(res, err)
  }
})

app.get('/api/dx-map/search-drugs', requireHerbDxManager, async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim()
    if (!q) return res.json({ success: true, data: [] })
    const [rows] = await hosPool.query(
      `SELECT d.icode, d.name, d.units
       FROM drugitems d
       WHERE d.istatus = 'Y'
         AND (d.name LIKE ? OR d.icode LIKE ?)
       ORDER BY d.name
       LIMIT 30`,
      [`%${q}%`, `%${q}%`]
    )
    res.json({
      success: true,
      data: rows.map((r) => ({ icode: String(r.icode), name: r.name ?? String(r.icode), units: r.units ?? '' })),
    })
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/dx-map/:icode/preview', requireHerbDxManager, async (req, res) => {
  try {
    const icode = String(req.params.icode ?? '').trim()
    const prefixes = String(req.body?.dx_prefixes ?? '')
      .split(/[ ,\s]+/)
      .map(normalizeIcdCode)
      .filter((s) => /^[A-Z][0-9A-Z]{0,5}$/.test(s))
    const periodDays = Number(req.body?.periodDays ?? 90)
    if (!icode) return res.status(400).json({ success: false, error: 'ไม่พบรหัสยา' })
    const activeHerbs = await getActiveHerbalDrugs()
    const isHerb = activeHerbs.some((drug) => drug.icode === icode)
    if (!isHerb) {
      const [hosRows] = await hosPool.query('SELECT icode FROM drugitems WHERE icode = ? LIMIT 1', [icode])
      if (!hosRows.length) return res.status(404).json({ success: false, error: 'ไม่พบรหัสยานี้ในฐานข้อมูล HOSxP' })
    }
    if (![30, 90, 365, 0].includes(periodDays)) {
      return res.status(400).json({ success: false, error: 'ช่วงเวลาทดลองไม่ถูกต้อง' })
    }

    const params = [icode]
    const dateFilter = periodDays > 0 ? ' AND visit_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)' : ''
    if (periodDays > 0) params.push(periodDays)
    const [rows] = await dwPool.query(
      `SELECT pdx, dx0, dx1, dx2, dx3, dx4, dx5
       FROM dw_hd_check_prescriptions
       WHERE drug_icode = ? AND drug_qty > 0${dateFilter}`,
      params
    )

    const [mapRows] = await dwPool.query('SELECT min_qty FROM dw_hd_check_drug_dx_map WHERE icode = ? LIMIT 1', [icode])
    const currentMinQty = mapRows[0]?.min_qty ? Number(mapRows[0].min_qty) : 0
    const proposedMinQty = req.body?.min_qty !== undefined ? Math.max(0, parseInt(req.body.min_qty, 10) || 0) : currentMinQty
    const proposedMap = new Map([[icode, [...new Set(prefixes)]]])
    const proposedMinQtyMap = new Map([[icode, proposedMinQty]])
    const totals = { pass: 0, fail: 0, noDx: 0, noMap: 0 }
    const codeCounts = new Map()
    for (const row of rows) {
      const result = evaluate({ ...row, drug_icode: icode }, proposedMap, proposedMinQtyMap)
      if (result.audit_result === 'PASS') totals.pass += 1
      else if (result.audit_result === 'FAIL') totals.fail += 1
      else if (result.audit_result === 'NO_DX') totals.noDx += 1
      else totals.noMap += 1

      const uniqueDx = [...new Set([row.pdx, row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5]
      .map(normalizeIcdCode)
        .filter(Boolean))]
      for (const code of uniqueDx) {
        codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1)
      }
    }

    const frequentDx = [...codeCounts.entries()]
      .map(([code, count]) => ({
        code,
        count,
        matches: prefixes.some((prefix) => code.startsWith(normalizeIcdCode(prefix))),
      }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
      .slice(0, 12)

    res.json({ success: true, icode, periodDays, min_qty: proposedMinQty, total: rows.length, ...totals, frequentDx })
  } catch (err) {
    fail(res, err)
  }
})

app.put('/api/dx-map/:icode', requireHerbDxManager, async (req, res) => {
  try {
    const { icode } = req.params
    const [hosDrugs] = await hosPool.query('SELECT icode, name FROM drugitems WHERE icode = ? LIMIT 1', [icode])
    let drugName = String(req.body?.drug_name ?? '').trim()
    if (!drugName && hosDrugs.length) {
      drugName = hosDrugs[0].name
    }
    if (!hosDrugs.length) {
      const [dwDrugs] = await dwPool.query('SELECT drug_name FROM dw_hd_check_drug_dx_map WHERE icode = ? LIMIT 1', [icode])
      if (!dwDrugs.length) return res.status(404).json({ success: false, error: 'ไม่พบรหัสยานี้ในฐานข้อมูล HOSxP (drugitems)' })
      drugName = drugName || dwDrugs[0].drug_name || String(icode)
    }
    const prefixes = String(req.body?.dx_prefixes ?? '')
      .split(/[,\s]+/)
      .map(normalizeIcdCode)
      .filter((s) => /^[A-Z][0-9A-Z]{0,5}$/.test(s))
    const min_qty = Math.max(0, parseInt(req.body?.min_qty ?? 0, 10) || 0)
    const indication = String(req.body?.indication ?? '').slice(0, 255)
    await dwPool.query(
      `INSERT INTO dw_hd_check_drug_dx_map (icode, drug_name, dx_prefixes, min_qty, indication) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE drug_name = COALESCE(VALUES(drug_name), drug_name), dx_prefixes = VALUES(dx_prefixes), min_qty = VALUES(min_qty), indication = VALUES(indication)`,
      [icode, drugName, [...new Set(prefixes)].join(','), min_qty, indication]
    )
    activeHerbCacheAt = 0 // Invalidate herbal drugs cache so new drug shows up everywhere immediately
    res.json({ success: true, icode, drug_name: drugName, dx_prefixes: [...new Set(prefixes)].join(','), min_qty, indication })
  } catch (err) {
    fail(res, err)
  }
})

/* ---------------- Dispensing Interval & Benefit Rules ---------------- */
app.get('/api/dispensing-rules', requireSession, async (_req, res) => {
  try {
    const rules = await getDispensingRules(dwPool, false)
    res.json({ success: true, data: rules })
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/dispensing-rules', requireHerbDxManager, async (req, res) => {
  try {
    const result = await saveDispensingRule(dwPool, req.body)
    res.json(result)
  } catch (err) {
    fail(res, err)
  }
})

app.put('/api/dispensing-rules/:id/toggle', requireHerbDxManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const isActive = Boolean(req.body?.is_active)
    const result = await toggleDispensingRule(dwPool, id, isActive)
    res.json(result)
  } catch (err) {
    fail(res, err)
  }
})

app.delete('/api/dispensing-rules/:id', requireHerbDxManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const result = await deleteDispensingRule(dwPool, id)
    res.json(result)
  } catch (err) {
    fail(res, err)
  }
})

/* ---------------- ThaiD / Provider ID (OAuth 2.0) ----------------
 *   GET  /api/public/sso-providers     ปุ่มบนหน้าเข้าสู่ระบบ (demo หรือ live ที่ค่าครบ)
 *   GET  /api/auth/sso/:p/start        → ไปหน้า ThaiD/Provider ID
 *   GET  /api/auth/sso/:p/callback     ← ผู้ให้บริการส่งกลับ → ตั้ง cookie session → กลับหน้าแรก
 *   ผู้ดูแล: /api/admin/sso ...
 */
app.get('/api/public/sso-providers', async (_req, res) => {
  try {
    const data = []
    for (const p of SSO_PROVIDERS) {
      const c = await getSsoConfig(dwPool, p)
      if (c.mode === 'demo') data.push({ key: p, label: SSO_LABEL[p], demo: true })
      else if (isLive(c)) data.push({ key: p, label: SSO_LABEL[p], demo: false })
    }
    res.json({ success: true, data })
  } catch (err) {
    fail(res, err)
  }
})

app.get('/api/auth/sso/:p/start', async (req, res) => {
  const p = req.params.p
  if (!isSsoProvider(p)) return res.status(404).send('ไม่รู้จักผู้ให้บริการ')
  const c = await getSsoConfig(dwPool, p)
  if (!isLive(c)) return res.status(404).send(`ยังไม่เปิดใช้การเข้าสู่ระบบด้วย ${SSO_LABEL[p]}`)
  res.redirect(302, buildAuthorizeUrl(p, c))
})

app.get('/api/auth/sso/:p/callback', async (req, res) => {
  const p = req.params.p
  if (!isSsoProvider(p)) return res.status(404).send('ไม่รู้จักผู้ให้บริการ')
  const c = await getSsoConfig(dwPool, p)
  const back = (msg) => res.redirect(302, `${c.public_base || ''}/?sso_error=${encodeURIComponent(msg)}`)
  if (!isLive(c)) return back(`ปิดใช้การเข้าสู่ระบบด้วย ${SSO_LABEL[p]}`)
  if (req.query.error) return back(`${SSO_LABEL[p]}: ${String(req.query.error_description || req.query.error)}`)
  const st = takeState(String(req.query.state || ''), p)
  if (!st || !req.query.code) return back('คำขอหมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่')
  try {
    const info = await exchangeCode(dwPool, p, c, String(req.query.code), st.verifier)
    if (!info.cid) {
      console.error(`[SSO] ${p}: ไม่พบฟิลด์เลขบัตร "${c.cid_claim}" — ฟิลด์ที่ได้:`, info.raw_keys.join(','))
      return back(`ไม่พบเลขบัตรประชาชนจาก ${SSO_LABEL[p]} กรุณาให้ผู้ดูแลตรวจชื่อฟิลด์ในหน้าตั้งค่า`)
    }
    const found = await findLoginByCid(hosPool, dwPool, p, info.cid)
    if (found.error === 'ambiguous') {
      return back(`เลขบัตรนี้มีหลายบัญชีใน HOSxP (${found.logins.join(', ')}) กรุณาให้ผู้ดูแลผูกบัญชีที่ต้องการในหน้าตั้งค่า ${SSO_LABEL[p]}`)
    }
    if (found.error) return back(`บัญชี ${SSO_LABEL[p]} นี้ไม่ตรงกับผู้ใช้ HOSxP ที่ใช้งานได้ กรุณาตรวจเลขบัตรใน HOSxP หรือให้ผู้ดูแลผูกบัญชี`)
    if (found.status === 'disabled') return back(`บัญชีนี้ถูกปิดการเข้าระบบด้วย ${SSO_LABEL[p]} กรุณาใช้ชื่อผู้ใช้และรหัสผ่านแทน`)
    const user = await getAuthenticatedUserByLoginname(hosPool, dwPool, found.loginname)
    if (!user) return back('บัญชีนี้ถูกระงับหรือไม่พบใน HOSxP กรุณาติดต่อผู้ดูแลระบบ')

    // ThaiD / Provider ID ยืนยันตัวตนระดับสูงแล้ว จึงไม่ถาม 2FA ของระบบซ้ำ (เหมือน HRMS)
    const token = generateToken()
    await saveSession(dwPool, token, { user, loginAt: new Date().toISOString(), loginMethod: p, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 })
    await touchIdentity(dwPool, user.loginname, p, info.cid, info.subject).catch((e) => console.error('[SSO] identity:', e.message))
    await dwPool.query('UPDATE dw_hd_check_user_2fa SET last_login_at = NOW() WHERE loginname = ?', [user.loginname]).catch(() => {})
    console.log(`[SSO] ${user.loginname} เข้าสู่ระบบด้วย ${SSO_LABEL[p]}`)
    setSessionCookie(res, token)
    return res.redirect(302, `${c.public_base}/`)
  } catch (err) {
    console.error(`[SSO] ${p} callback error:`, err.message)
    return back(`เข้าสู่ระบบด้วย ${SSO_LABEL[p]} ไม่สำเร็จ: ${err.message}`)
  }
})

app.get('/api/admin/sso', requireAdmin, async (req, res) => {
  try {
    const data = {}
    for (const p of SSO_PROVIDERS) {
      const c = await getSsoConfig(dwPool, p)
      const { client_secret_enc, ...safe } = c
      data[p] = { ...safe, has_secret: Boolean(client_secret_enc), missing: missingFields(c), callback_url: c.public_base ? callbackUrl(c, p) : '' }
    }
    const [[linked]] = await dwPool.query('SELECT COUNT(DISTINCT loginname) AS n FROM dw_hd_check_user_sso_identities')
    res.json({ success: true, data, linked_users: Number(linked.n), suggested_base: `${req.protocol}://${req.headers.host}` })
  } catch (err) {
    fail(res, err)
  }
})

app.put('/api/admin/sso/:p', requireAdmin, async (req, res) => {
  const p = req.params.p
  if (!isSsoProvider(p)) return res.status(404).json({ success: false, error: 'ไม่รู้จักผู้ให้บริการ' })
  const b = req.body ?? {}
  const str = (v) => (v === undefined ? undefined : String(v).trim())
  for (const k of ['authorize_url', 'token_url', 'userinfo_url', 'public_base']) {
    const v = str(b[k])
    if (v && !/^https?:\/\/[^\s]+$/.test(v)) return res.status(400).json({ success: false, error: `${k} ต้องเป็น URL ที่ขึ้นต้นด้วย http(s)://` })
  }
  try {
    const next = await saveSsoConfig(dwPool, p, {
      mode: ['off', 'demo', 'live'].includes(b.mode) ? b.mode : undefined,
      client_id: str(b.client_id),
      client_secret: b.client_secret ? String(b.client_secret) : undefined,
      authorize_url: str(b.authorize_url),
      token_url: str(b.token_url),
      userinfo_url: str(b.userinfo_url),
      scope: str(b.scope),
      cid_claim: str(b.cid_claim),
      use_pkce: b.use_pkce === undefined ? undefined : Boolean(b.use_pkce),
      public_base: str(b.public_base),
    })
    console.log(`[SSO] ${req.authUser.loginname} ตั้งค่า ${SSO_LABEL[p]}: ${next.mode}${b.client_secret ? ' (เปลี่ยน Secret)' : ''}`)
    const missing = missingFields(next)
    res.json({ success: true, mode: next.mode, active: next.mode === 'live' && missing.length === 0, missing })
  } catch (err) {
    fail(res, err)
  }
})

/** ตรวจว่าเซิร์ฟเวอร์ติดต่อปลายทางได้ (ไม่ส่งรหัสลับ) */
app.post('/api/admin/sso/:p/check', requireAdmin, async (req, res) => {
  const p = req.params.p
  if (!isSsoProvider(p)) return res.status(404).json({ success: false, error: 'ไม่รู้จักผู้ให้บริการ' })
  const c = await getSsoConfig(dwPool, p)
  const results = []
  for (const [name, url] of [['Authorization URL', c.authorize_url], ['Token URL', c.token_url]]) {
    if (!url) {
      results.push({ name, ok: false, detail: 'ยังไม่ได้กรอก' })
      continue
    }
    try {
      const r = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000) })
      results.push({ name, ok: r.status < 500, detail: `ติดต่อได้ (HTTP ${r.status})` })
    } catch (e) {
      results.push({ name, ok: false, detail: `ติดต่อไม่ได้: ${e.cause?.code || e.message}` })
    }
  }
  res.json({ success: true, missing: missingFields(c), results })
})

app.get('/api/admin/sso/:p/identities', requireAdmin, async (req, res) => {
  const p = req.params.p
  if (!isSsoProvider(p)) return res.status(404).json({ success: false, error: 'ไม่รู้จักผู้ให้บริการ' })
  try {
    res.json({ success: true, data: await listIdentities(dwPool, p) })
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/admin/sso/:p/identities', requireAdmin, async (req, res) => {
  const p = req.params.p
  const loginname = String(req.body?.loginname || '').trim()
  if (!isSsoProvider(p) || !loginname) return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบ' })
  try {
    const [rows] = await hosPool.query('SELECT loginname FROM opduser WHERE loginname = ? LIMIT 1', [loginname])
    if (!rows.length) return res.status(404).json({ success: false, error: 'ไม่พบผู้ใช้นี้ใน HOSxP (opduser)' })
    await linkManual(dwPool, rows[0].loginname, p, String(req.body?.cid || ''), req.authUser.name || req.authUser.loginname, String(req.body?.note || '').slice(0, 255) || null)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

app.put('/api/admin/sso/identities/:id', requireAdmin, async (req, res) => {
  try {
    const status = req.body?.status === 'disabled' ? 'disabled' : 'active'
    const [r] = await dwPool.query('UPDATE dw_hd_check_user_sso_identities SET status = ? WHERE id = ?', [status, Number(req.params.id)])
    if (!r.affectedRows) return res.status(404).json({ success: false, error: 'ไม่พบรายการ' })
    res.json({ success: true })
  } catch (err) {
    fail(res, err)
  }
})

app.delete('/api/admin/sso/identities/:id', requireAdmin, async (req, res) => {
  try {
    const [r] = await dwPool.query('DELETE FROM dw_hd_check_user_sso_identities WHERE id = ?', [Number(req.params.id)])
    if (!r.affectedRows) return res.status(404).json({ success: false, error: 'ไม่พบรายการ' })
    res.json({ success: true })
  } catch (err) {
    fail(res, err)
  }
})

/* ---------------- Auth & 2FA Management Endpoints ---------------- */
// Failed logins are counted per client IP and per account: the IP limit slows one machine
// guessing many accounts, the account limit slows many machines guessing one account.
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_PER_IP = 20
const LOGIN_MAX_PER_ACCOUNT = 8
const loginAttempts = new Map()
const loginKeys = (req) => {
  const keys = [`ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`]
  const login = String(req.body?.loginname ?? '').trim().toLowerCase()
  if (login) keys.push(`user:${login}`)
  return keys
}
const loginLimitOf = (key) => (key.startsWith('ip:') ? LOGIN_MAX_PER_IP : LOGIN_MAX_PER_ACCOUNT)
app.post('/api/auth/login', async (req, res) => {
  const now = Date.now()
  for (const [key, entry] of loginAttempts) {
    if (now - entry.startedAt >= LOGIN_WINDOW_MS) loginAttempts.delete(key)
  }
  const keys = loginKeys(req)
  if (loginAttempts.size >= 10000 && !keys.every((k) => loginAttempts.has(k))) {
    return res.status(503).json({ success: false, error: 'ระบบเข้าสู่ระบบไม่พร้อมใช้งานชั่วคราว' })
  }
  if (keys.some((k) => (loginAttempts.get(k)?.count ?? 0) >= loginLimitOf(k))) {
    return res.status(429).json({ success: false, error: 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' })
  }
  for (const k of keys) {
    if (!loginAttempts.has(k)) loginAttempts.set(k, { startedAt: now, count: 0 })
    loginAttempts.get(k).count += 1
  }
  try {
    const { loginname, password } = req.body ?? {}
    const result = await authenticateHosUser(hosPool, dwPool, loginname, password)
    if (result.token) {
      setSessionCookie(res, result.token)
      delete result.token
    }
    // Wrong credentials throw; reaching here means the password was right (even if 2FA is pending)
    for (const k of keys) loginAttempts.delete(k)
    res.json(result)
  } catch (err) {
    console.error('[AUTH] Login request failed:', err.code || err.name)
    const invalidCredentials = err.code === 'AUTH_INVALID_CREDENTIALS'
    const accountDisabled = err.code === 'AUTH_ACCOUNT_DISABLED'
    const missingCredentials = String(err.message || '').includes('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน')
    const status = invalidCredentials ? 401 : accountDisabled ? 403 : missingCredentials ? 400 : 503
    res.status(status).json({
      success: false,
      error: invalidCredentials
        ? 'ชื่อผู้ใช้หรือรหัสผ่าน Passweb ไม่ถูกต้อง'
        : accountDisabled
          ? err.message
          : missingCredentials
            ? err.message
            : 'ระบบตรวจสอบบัญชี HOSxP/Passweb ขัดข้อง กรุณาตรวจสอบหน้าต่าง Backend',
    })
  }
})

if (process.env.NODE_ENV !== 'production' && (!process.env.HOS_DB_USER || !process.env.HOS_DB_PASSWORD)) {
  console.warn('[SECURITY] HOSxP is using the shared DB_USER credentials. Configure a dedicated SELECT-only HOS_DB_USER/HOS_DB_PASSWORD before production use.')
}

app.post('/api/auth/verify-2fa', async (req, res) => {
  try {
    const { tempToken, code } = req.body ?? {}
    if (!tempToken || !code) {
      return res.status(400).json({ success: false, error: 'กรุณากรอกรหัส 2FA 6 หลัก' })
    }
    const result = await verify2FALogin(dwPool, tempToken, code)
    setSessionCookie(res, result.token)
    delete result.token
    res.json(result)
  } catch (err) {
    res.status(401).json({ success: false, error: err.message || 'รหัส 2FA ไม่ถูกต้องหรือเซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' })
  }
})

app.post('/api/auth/setup-2fa/init', async (req, res) => {
  try {
    const { loginname } = req.body ?? {}
    if (!loginname) return res.status(400).json({ success: false, error: 'ระบุ loginname' })
    const activeSession = await getSession(req)
    const tempSession = verifyTempSession(req.body?.tempToken)
    const isSelf = activeSession && String(activeSession.user.loginname).toLowerCase() === String(loginname).trim().toLowerCase()
    const isFirstSetup = tempSession?.mode === 'setup_required' &&
      String(tempSession.user.loginname).toLowerCase() === String(loginname).trim().toLowerCase()
    if (!isSelf && !isFirstSetup) return res.status(401).json({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนตั้งค่า 2FA' })
    const result = await init2FASetup(loginname)
    res.json(result)
  } catch (err) {
    res.status(400).json({ success: false, error: 'เริ่มตั้งค่า 2FA ไม่สำเร็จ' })
  }
})

app.post('/api/auth/setup-2fa/confirm', async (req, res) => {
  try {
    const { loginname, secret, code } = req.body ?? {}
    if (!loginname || !secret || !code) {
      return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' })
    }
    const activeSession = await getSession(req)
    const tempSession = verifyTempSession(req.body?.tempToken)
    const isSelf = activeSession && String(activeSession.user.loginname).toLowerCase() === String(loginname).trim().toLowerCase()
    const isFirstSetup = tempSession?.mode === 'setup_required' &&
      String(tempSession.user.loginname).toLowerCase() === String(loginname).trim().toLowerCase()
    if (!isSelf && !isFirstSetup) return res.status(401).json({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนยืนยันการตั้งค่า 2FA' })
    const trustedUser = activeSession?.user ?? tempSession.user
    const result = await confirm2FASetup(dwPool, loginname, trustedUser, secret, code)
    res.json(result)
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

app.post('/api/auth/disable-2fa', async (req, res) => {
  try {
    const { loginname } = req.body ?? {}
    if (!loginname) return res.status(400).json({ success: false, error: 'ระบุ loginname' })
    const session = await getSession(req)
    if (!session || !canManageLogin(session.user, loginname)) {
      return res.status(session ? 403 : 401).json({ success: false, error: 'ไม่มีสิทธิ์จัดการ 2FA ของบัญชีนี้' })
    }
    const result = await disable2FA(dwPool, loginname)
    res.json(result)
  } catch (err) {
    res.status(400).json({ success: false, error: 'ปิด 2FA ไม่สำเร็จ' })
  }
})

app.post('/api/auth/logout', async (req, res) => {
  await logoutSession(readCookie(req, SESSION_COOKIE), dwPool)
  clearSessionCookie(res)
  res.json({ success: true })
})

app.get('/api/auth/me', async (req, res) => {
  const session = await getSession(req)
  if (!session) {
    return res.json({ success: false, user: null })
  }
  const avatarUrl = await getUserAvatarUrl(dwPool, session.user.loginname)
  session.user.avatar_url = avatarUrl
  // The session keeps a login-time snapshot; PIN settings may have changed since
  const pinState = await getPinState(dwPool, session.user.loginname).catch(() => ({}))
  res.json({ success: true, user: { ...session.user, ...pinState }, locked: Boolean(session.locked) })
})

/* ---------------- Screen lock (server-side) ----------------
 * Lock state lives on the session so a new tab, a refresh, or a direct API call
 * cannot get past it. Unlock needs the PIN (max PIN_MAX_FAILS wrong tries, then the
 * session ends) or the user's HOSxP password.
 */
async function updateSession(req, session, patch) {
  Object.assign(session, patch)
  await saveSession(dwPool, readCookie(req, SESSION_COOKIE), session)
}

async function failUnlock(req, res, session, message) {
  const fails = Number(session.pinFails || 0) + 1
  if (fails >= PIN_MAX_FAILS) {
    console.warn(`[LOCK] ${session.user.loginname}: unlock failed ${fails} times, session ended`)
    await logoutSession(readCookie(req, SESSION_COOKIE), dwPool)
    clearSessionCookie(res)
    return res.status(401).json({
      success: false,
      forceLogout: true,
      error: `ใส่รหัสผิด ${PIN_MAX_FAILS} ครั้ง ระบบออกจากระบบให้เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่ด้วยรหัสผ่าน`,
    })
  }
  await updateSession(req, session, { pinFails: fails })
  return res.status(401).json({ success: false, attemptsLeft: PIN_MAX_FAILS - fails, error: `${message} (เหลืออีก ${PIN_MAX_FAILS - fails} ครั้ง)` })
}

app.post('/api/auth/lock', async (req, res) => {
  const session = await getSession(req)
  if (!session) return res.status(401).json({ success: false, error: 'กรุณาเข้าสู่ระบบใหม่' })
  const pinState = await getPinState(dwPool, session.user.loginname)
  if (!pinState.has_pin) return res.status(400).json({ success: false, error: 'กรุณาตั้งรหัส PIN ก่อนใช้การล็อกหน้าจอ' })
  if (!session.locked) await updateSession(req, session, { locked: true, pinFails: 0 })
  res.json({ success: true, locked: true })
})

app.post('/api/auth/unlock-password', async (req, res) => {
  const session = await getSession(req)
  if (!session) return res.status(401).json({ success: false, error: 'กรุณาเข้าสู่ระบบใหม่' })
  const password = String(req.body?.password ?? '')
  if (!password) return res.status(400).json({ success: false, error: 'กรุณากรอกรหัสผ่าน' })
  try {
    const result = await authenticateHosUser(hosPool, dwPool, session.user.loginname, password)
    // Only the password check matters here; discard any new session it created
    if (result.token) await logoutSession(result.token, dwPool)
  } catch (err) {
    if (err.code === 'AUTH_INVALID_CREDENTIALS') return failUnlock(req, res, session, 'รหัสผ่าน HOSxP ไม่ถูกต้อง')
    return res.status(err.code === 'AUTH_ACCOUNT_DISABLED' ? 403 : 503).json({ success: false, error: err.message })
  }
  await updateSession(req, session, { locked: false, pinFails: 0 })
  res.json({ success: true, message: 'ปลดล็อกหน้าจอสำเร็จ' })
})

app.get('/api/auth/profile', requireSession, async (req, res) => {
  try {
    const loginname = String(req.query.loginname || req.headers['x-user-login'] || '').trim()
    if (!loginname) return res.status(400).json({ success: false, error: 'Missing loginname' })
    if (!canManageLogin(req.authUser, loginname)) return res.status(403).json({ success: false, error: 'ไม่มีสิทธิ์ดูข้อมูลบัญชีนี้' })

    let profile = null

    // 1) Try HOSxP opduser
    try {
      const [rows] = await hosPool.query(
        `SELECT loginname, name, doctorcode, groupname, entryposition, departmentposition, account_disable
         FROM opduser WHERE loginname = ? LIMIT 1`,
        [loginname]
      )
      if (rows.length > 0) {
        const row = rows[0]
        const { position, entryposition } = parsePosition(row)
        profile = {
          loginname: row.loginname,
          name: row.name,
          doctorcode: row.doctorcode,
          groupname: row.groupname ?? 'เจ้าหน้าที่ HOSxP',
          position,
          entryposition,
        }
      }
    } catch (_) {}

    // 2) Try HOSxP doctor if not found in opduser
    if (!profile) {
      try {
        const [docRows] = await hosPool.query(
          `SELECT code, name FROM doctor WHERE code = ? LIMIT 1`,
          [loginname]
        )
        if (docRows.length > 0) {
          profile = {
            loginname: docRows[0].code,
            name: docRows[0].name,
            doctorcode: docRows[0].code,
            groupname: 'แพทย์ / แพทย์แผนไทย',
            position: 'แพทย์ / แพทย์แผนไทย',
            entryposition: null,
          }
        }
      } catch (_) {}
    }

    // 3) Try DW fallback if offline
    if (!profile) {
      try {
        const [dwRows] = await dwPool.query(
          `SELECT loginname, name, groupname, position, entryposition FROM dw_hd_check_user_2fa WHERE loginname = ? LIMIT 1`,
          [loginname]
        )
        if (dwRows.length > 0) {
          const row = dwRows[0]
          profile = {
            loginname: row.loginname,
            name: row.name,
            groupname: row.groupname,
            position: row.position || row.groupname,
            entryposition: row.entryposition,
          }
        }
      } catch (_) {}
    }

    if (!profile) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Cache position into DW
    if (profile.position) {
      dwPool.query(
        `UPDATE dw_hd_check_user_2fa SET position = ?, entryposition = ? WHERE loginname = ?`,
        [profile.position, profile.entryposition || null, profile.loginname]
      ).catch(() => {})
    }

    res.json({ success: true, profile })
  } catch (err) {
    fail(res, err)
  }
})

/* ---------------- User Avatar Management (BLOB) ---------------- */
// Only formats the cropper produces; checked by file signature, never by the client's claim,
// because the stored mime type is served back as Content-Type (text/html or SVG would be XSS).
const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const sniffImageMime = (buf) => {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

app.get('/api/auth/avatar/:loginname', async (req, res) => {
  try {
    // Any signed-in session may load avatars (also while screen-locked); anonymous visitors may not
    if (!(await getSession(req))) return res.status(401).send('Unauthorized')
    const loginname = String(req.params.loginname ?? '').trim()
    if (!loginname) return res.status(400).send('Missing loginname')
    const avatar = await getUserAvatar(dwPool, loginname)
    if (!avatar || !avatar.image_blob) {
      return res.status(404).send('Avatar not found')
    }
    // Re-sniff on the way out too, so avatars stored before this check can't be served as HTML/SVG
    const mime = sniffImageMime(avatar.image_blob)
    if (!mime) return res.status(404).send('Avatar not found')
    res.setHeader('Content-Type', mime)
    res.setHeader('Cache-Control', 'private, max-age=86400')
    res.setHeader('Content-Length', avatar.image_blob.length)
    res.send(avatar.image_blob)
  } catch (err) {
    console.error('[AVATAR GET]', err?.message)
    res.status(500).send('Error loading avatar')
  }
})

app.post('/api/auth/avatar', requireSession, async (req, res) => {
  try {
    const { image, targetLogin } = req.body ?? {}
    if (!image) {
      return res.status(400).json({ success: false, error: 'กรุณาเลือกไฟล์รูปภาพ' })
    }

    const loginname = (targetLogin && isAdminUser(req.authUser))
      ? String(targetLogin).trim()
      : req.authUser.loginname

    // Strip an optional data-URL prefix; its declared type is ignored
    const cleanBase64 = String(image).trim().replace(/^data:[^,]*;base64,/, '')
    const buffer = Buffer.from(cleanBase64, 'base64')
    if (buffer.length > AVATAR_MAX_BYTES) {
      return res.status(400).json({ success: false, error: 'ขนาดรูปภาพเกิน 2 MB กรุณาเลือกรูปขนาดเล็กลง' })
    }
    const detectedMime = sniffImageMime(buffer)
    if (!detectedMime) {
      return res.status(400).json({ success: false, error: 'รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG หรือ WebP' })
    }

    await saveUserAvatar(dwPool, loginname, buffer, detectedMime)
    const newAvatarUrl = `/api/auth/avatar/${encodeURIComponent(loginname)}?t=${Date.now()}`

    if (loginname === req.authUser.loginname) {
      req.authUser.avatar_url = newAvatarUrl
      const session = req.authSession || await getSession(req)
      if (session) session.user.avatar_url = newAvatarUrl
    }

    res.json({
      success: true,
      avatarUrl: newAvatarUrl,
      message: 'บันทึกรูปโปรไฟล์เรียบร้อยแล้ว',
    })
  } catch (err) {
    fail(res, err)
  }
})

const handleDeleteAvatarRoute = async (req, res) => {
  try {
    const paramLogin = req.params?.loginname
    const loginname = (paramLogin && isAdminUser(req.authUser))
      ? String(paramLogin).trim()
      : req.authUser.loginname

    await deleteUserAvatar(dwPool, loginname)

    if (loginname === req.authUser.loginname) {
      req.authUser.avatar_url = null
      const session = req.authSession || await getSession(req)
      if (session) session.user.avatar_url = null
    }

    res.json({ success: true, message: 'ลบรูปโปรไฟล์เรียบร้อยแล้ว' })
  } catch (err) {
    fail(res, err)
  }
}

app.delete('/api/auth/avatar', requireSession, handleDeleteAvatarRoute)
app.delete('/api/auth/avatar/:loginname', requireSession, handleDeleteAvatarRoute)

/* ---------------- Hospital 2FA Policy & Admin Management ---------------- */
app.get('/api/admin/2fa-policy', requireAdmin, async (_req, res) => {
  try {
    res.json(await get2FAPolicy(dwPool))
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/admin/2fa-policy', requireAdmin, async (req, res) => {
  try {
    const { enforce_2fa } = req.body ?? {}
    res.json(await set2FAPolicy(dwPool, enforce_2fa))
  } catch (err) {
    fail(res, err)
  }
})

app.get('/api/admin/users-2fa', requireAdmin, async (_req, res) => {
  try {
    const users = await listAllUsers2FA(hosPool, dwPool)
    res.json({ success: true, data: users })
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/admin/users/:loginname/admin-role', requireAdmin, async (req, res) => {
  try {
    const loginname = String(req.params.loginname ?? '').trim()
    const enabled = req.body?.enabled
    if (!loginname || typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'ระบุผู้ใช้และสถานะ Admin ให้ถูกต้อง' })
    }
    if (!enabled && loginname.toLowerCase() === String(req.authUser.loginname ?? '').toLowerCase()) {
      return res.status(400).json({ success: false, error: 'ไม่สามารถถอดสิทธิ์ Admin ของบัญชีที่กำลังใช้งานอยู่ได้' })
    }
    const [users] = await hosPool.query(
      'SELECT loginname, name, groupname FROM opduser WHERE loginname = ? LIMIT 1',
      [loginname]
    )
    if (!users.length) return res.status(404).json({ success: false, error: 'ไม่พบบัญชีนี้ใน HOSxP' })
    const target = users[0]
    await dwPool.query(
      `INSERT INTO dw_hd_check_user_2fa (loginname, name, user_type, groupname, admin_enabled)
       VALUES (?, ?, 'opduser', ?, ?)
       ON DUPLICATE KEY UPDATE admin_enabled = VALUES(admin_enabled), name = VALUES(name), groupname = VALUES(groupname)`,
      [target.loginname, target.name || target.loginname, target.groupname || null, enabled ? 1 : 0]
    )
    res.json({ success: true, loginname: target.loginname, admin_enabled: enabled })
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/admin/users/:loginname/account-status', requireAdmin, async (req, res) => {
  try {
    const loginname = String(req.params.loginname ?? '').trim()
    const disabled = req.body?.disabled
    if (!loginname || typeof disabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'ระบุผู้ใช้และสถานะบัญชีให้ถูกต้อง' })
    }
    if (loginname.toLowerCase() === String(req.authUser.loginname ?? '').toLowerCase() && disabled) {
      return res.status(400).json({ success: false, error: 'ไม่สามารถปิดบัญชีของผู้ดูแลที่กำลังใช้งานอยู่ได้' })
    }
    const [result] = await hosPool.query(
      'UPDATE opduser SET account_disable = ? WHERE loginname = ?',
      [disabled ? 'Y' : 'N', loginname]
    )
    if (!result.affectedRows) return res.status(404).json({ success: false, error: 'ไม่พบบัญชีนี้ใน HOSxP' })
    res.json({ success: true, loginname, disabled, message: disabled ? 'ปิดบัญชี HOSxP แล้ว' : 'เปิดบัญชี HOSxP แล้ว' })
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/admin/reset-user-2fa', requireAdmin, async (req, res) => {
  try {
    const { loginname } = req.body ?? {}
    if (!loginname) return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อผู้ใช้ที่ต้องการรีเซ็ต' })
    res.json(await resetUser2FA(dwPool, loginname))
  } catch (err) {
    fail(res, err)
  }
})

/* ---------------- PIN Lock & Inactivity Auto-Lock Endpoints ---------------- */
app.post('/api/auth/pin/setup', requireSession, async (req, res) => {
  try {
    const { pin, autoLockMinutes } = req.body ?? {}
    if (!pin) return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' })
    const result = await setupUserPin(dwPool, req.authUser.loginname, pin, autoLockMinutes)
    invalidatePinState(req.authUser.loginname)
    res.json(result)
  } catch (err) {
    fail(res, err, 400)
  }
})

app.post('/api/auth/pin/verify', async (req, res) => {
  try {
    const { pin } = req.body ?? {}
    if (!pin) return res.status(400).json({ success: false, error: 'กรุณากรอกรหัส PIN' })

    // A PIN only unlocks an existing session. It must never create one: a 4–8 digit
    // PIN is far weaker than password + 2FA, so an expired session means log in again.
    const session = await getSession(req)
    if (!session?.user) {
      return res.status(401).json({ success: false, forceLogout: true, error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ด้วยรหัสผ่าน' })
    }

    try {
      await verifyUserPin(dwPool, session.user.loginname, pin)
    } catch (err) {
      return failUnlock(req, res, session, err.message)
    }
    await updateSession(req, session, { locked: false, pinFails: 0 })
    res.json({ success: true, message: 'ปลดล็อกหน้าจอสำเร็จ' })
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/auth/pin/disable', requireSession, async (req, res) => {
  try {
    const result = await disableUserPin(dwPool, req.authUser.loginname)
    invalidatePinState(req.authUser.loginname)
    res.json(result)
  } catch (err) {
    fail(res, err, 400)
  }
})

app.post('/api/auth/pin/settings', requireSession, async (req, res) => {
  try {
    const { pinEnabled, autoLockMinutes } = req.body ?? {}
    const result = await updatePinSettings(dwPool, req.authUser.loginname, pinEnabled, autoLockMinutes)
    invalidatePinState(req.authUser.loginname)
    res.json(result)
  } catch (err) {
    fail(res, err, 400)
  }
})

app.get('/api/admin/pin-policy', requireAdmin, async (_req, res) => {
  try {
    res.json(await getPinPolicy(dwPool))
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/admin/pin-policy', requireAdmin, async (req, res) => {
  try {
    const { enforce_pin_lock, default_auto_lock_minutes } = req.body ?? {}
    const result = await setPinPolicy(dwPool, enforce_pin_lock, default_auto_lock_minutes)
    invalidatePinState()
    res.json(result)
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/admin/reset-user-pin', requireAdmin, async (req, res) => {
  try {
    const { loginname } = req.body ?? {}
    if (!loginname) return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อผู้ใช้' })
    const result = await resetUserPin(dwPool, loginname)
    invalidatePinState(loginname)
    res.json(result)
  } catch (err) {
    fail(res, err)
  }
})

/* ---------------- Serve Production Frontend ---------------- */
app.use(express.static(distPath))
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next()
    })
  }
  next()
})

/* ---------------- Boot ---------------- */
// The DB host can be briefly unreachable at startup (LAN/VPN); retry instead of exiting,
// because `node --watch` only restarts on file changes.
for (let attempt = 1; ; attempt++) {
  try {
    await initAuthTables(dwPool)
    await initSsoTables(dwPool)
    await initDispensingRulesTable(dwPool)
    break
  } catch (err) {
    const delaySec = Math.min(5 * attempt, 30)
    console.error(`[ERROR] Authentication database is not ready: ${err.message} (retry #${attempt} in ${delaySec}s)`)
    await new Promise((resolve) => setTimeout(resolve, delaySec * 1000))
  }
}

app.listen(API_PORT, '0.0.0.0', () => {
  console.log(`HerbDx API → http://0.0.0.0:${API_PORT}  (HOSxP ${HOS_DB_BASE.host}/${HOS_DB} → ${DW_DB})`)
})

if (SYNC_ENABLED && AUTO_SYNC_MINUTES > 0) {
  let isAutoSyncing = false
  const autoSync = async () => {
    if (isAutoSyncing) return
    isAutoSyncing = true
    const { startDate, endDate } = currentMonthRange()
    try {
      const r = await syncHerbalData(startDate, endDate, 'AUTO')
      if (r.preservedExisting) {
        console.warn(`[auto-sync] ${startDate}..${endDate}: source returned 0 rows; preserved existing warehouse data`)
      } else if (r.skipped) {
        console.info(`[auto-sync] ${startDate}..${endDate}: skipped because another application instance is syncing`)
      } else {
        console.log(`[auto-sync] ${startDate}..${endDate}: ${r.totalPrescriptions} rows, ${r.totalDrugs} drugs (${r.durationMs} ms)`)
      }
    } catch (err) {
      console.error('[auto-sync] failed:', err.message)
    } finally {
      isAutoSyncing = false
    }
  }
  setTimeout(autoSync, 2000)
  setInterval(autoSync, AUTO_SYNC_MINUTES * 60 * 1000)
}
