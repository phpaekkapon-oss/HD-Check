import express from 'express'
import mysql from 'mysql2/promise'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOS_DB_BASE, DW_DB_BASE, HOS_DB, DW_DB, API_PORT, AUTO_SYNC_MINUTES, DATE_RE } from './config.mjs'
import { syncHerbalData, fetchDrugSummary } from './sync.mjs'
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
} from './auth.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const possibleDistPaths = [
  path.resolve(__dirname, '../HD-Check'),
  path.resolve(__dirname, '../dist'),
  path.resolve(__dirname, '..'),
]
const distPath = possibleDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html'))) || possibleDistPaths[0]

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception:', err?.message || err)
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

const app = express()
const SESSION_COOKIE = 'hd_check_session'
const SESSION_MAX_AGE = 8 * 60 * 60

app.disable('x-powered-by')
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
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store')
  next()
})
app.use(express.json({ limit: '50kb' }))

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

function getSession(req) {
  return verifySession(readCookie(req, SESSION_COOKIE))
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
  const group = String(user?.groupname ?? '').toLowerCase()
  return group.includes('administrator') || group.includes('ผู้ดูแลระบบ')
}

function requireSession(req, res, next) {
  const session = getSession(req)
  if (!session) return res.status(401).json({ success: false, error: 'กรุณาเข้าสู่ระบบใหม่' })
  req.authSession = session
  req.authUser = session.user
  next()
}

function requireAdmin(req, res, next) {
  return requireSession(req, res, () => {
    if (!isAdminUser(req.authUser)) return res.status(403).json({ success: false, error: 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ' })
    next()
  })
}

function canManageLogin(user, loginname) {
  return String(user?.loginname ?? '').toLowerCase() === String(loginname ?? '').trim().toLowerCase() || isAdminUser(user)
}

const fail = (res, err, code = 500) => {
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
  const startDate = typeof q.startDate === 'string' && DATE_RE.test(q.startDate) ? q.startDate : def.startDate
  const endDate = typeof q.endDate === 'string' && DATE_RE.test(q.endDate) ? q.endDate : def.endDate
  return { startDate, endDate }
}

/* ---------------- Audit rule ---------------- */
async function loadDxMap() {
  const [rows] = await dwPool.query('SELECT icode, dx_prefixes FROM dw_hd_check_drug_dx_map')
  const map = new Map()
  for (const r of rows) {
    map.set(
      r.icode,
      String(r.dx_prefixes ?? '')
        .split(',')
        .map((s) => s.trim().toUpperCase().replace('.', ''))
        .filter(Boolean)
    )
  }
  return map
}

function evaluate(row, dxMap) {
  const dxList = [row.pdx, row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5]
    .map((v) => String(v ?? '').trim().toUpperCase())
    .filter(Boolean)
  const unique = [...new Set(dxList)]
  if (unique.length === 0) {
    return { audit_result: 'NO_DX', matched_dx: [], allowed_dx: [], audit_reason: 'ไม่มีรหัสวินิจฉัย (PDX/DX ว่าง)' }
  }
  const allowed = dxMap.get(row.drug_icode) ?? []
  const matched = unique.filter((dx) => dx.startsWith('U') || allowed.some((p) => dx.startsWith(p)))
  if (matched.length > 0) {
    return { audit_result: 'PASS', matched_dx: matched, allowed_dx: allowed, audit_reason: 'รหัสวินิจฉัยสอดคล้องกับข้อบ่งใช้ยา' }
  }
  if (allowed.length === 0) {
    return { audit_result: 'NO_MAP', matched_dx: [], allowed_dx: [], audit_reason: 'ยังไม่ได้กำหนด ICD ที่ใช้คู่กับยานี้' }
  }
  return {
    audit_result: 'FAIL',
    matched_dx: [],
    allowed_dx: allowed,
    audit_reason: `DX ไม่ตรงข้อบ่งใช้ (ต้องเป็น ${allowed.join(', ')} หรือ U-code)`,
  }
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
    const [[p]] = await dwPool.query('SELECT COUNT(*) AS total FROM dw_hd_check_prescriptions')
    const [[d]] = await dwPool.query('SELECT COUNT(*) AS total FROM dw_hd_check_drugs')
    const [[last]] = await dwPool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS at, status, message, trigger_type,
              DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date
       FROM dw_hd_check_sync_log ORDER BY id DESC LIMIT 1`
    )
    res.json({
      status: 'online',
      host: `${DW_DB_BASE.host}:${DW_DB_BASE.port}`,
      database: DW_DB,
      totalPrescriptions: Number(p.total),
      totalDrugs: Number(d.total),
      lastSync: last ?? null,
      isSyncing: Boolean(syncInFlight),
      autoSyncMinutes: AUTO_SYNC_MINUTES,
    })
  } catch (err) {
    fail(res, err)
  }
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
             hn, patient_name, pttype_name, drug_icode, drug_name, drug_qty, department_name,
             main_pdx, pdx, dx0, dx1, dx2, dx3, dx4, dx5, doctor_code, doctor_name
      FROM dw_hd_check_prescriptions
      WHERE visit_date BETWEEN ? AND ?`
    const params = [startDate, endDate]
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
    const dxMap = await loadDxMap()
    const evaluated = rows.map((r) => ({ ...r, drug_qty: Number(r.drug_qty), ...evaluate(r, dxMap) }))

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

app.get('/api/drugs', requireSession, async (req, res) => {
  try {
    const { startDate, endDate } = readRange(req.query)
    const data = await fetchDrugSummary(hosPool, startDate, endDate)
    res.json({ success: true, data, meta: { total: data.length, startDate, endDate } })
  } catch (err) {
    fail(res, err)
  }
})

app.get('/api/dx-map', requireSession, async (_req, res) => {
  try {
    const [rows] = await dwPool.query(
      `SELECT m.icode, COALESCE(d.name, m.drug_name, m.icode) AS drug_name, m.dx_prefixes, m.indication,
              DATE_FORMAT(m.updated_at, '%Y-%m-%dT%H:%i:%s') AS updated_at
       FROM dw_hd_check_drug_dx_map m
       LEFT JOIN dw_hd_check_drugs d ON d.icode = m.icode
       ORDER BY drug_name`
    )
    res.json({ success: true, data: rows })
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/dx-map/:icode/preview', requireAdmin, async (req, res) => {
  try {
    const icode = String(req.params.icode ?? '').trim()
    const prefixes = String(req.body?.dx_prefixes ?? '')
      .split(/[ ,\s]+/)
      .map((s) => s.trim().toUpperCase().replace('.', ''))
      .filter((s) => /^[A-Z][0-9A-Z]{0,5}$/.test(s))
    const periodDays = Number(req.body?.periodDays ?? 90)
    if (!icode) return res.status(400).json({ success: false, error: 'ไม่พบรหัสยา' })
    if (![30, 90, 365, 0].includes(periodDays)) {
      return res.status(400).json({ success: false, error: 'ช่วงเวลาทดลองไม่ถูกต้อง' })
    }

    const params = [icode]
    const dateFilter = periodDays > 0 ? ' AND visit_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)' : ''
    if (periodDays > 0) params.push(periodDays)
    const [rows] = await dwPool.query(
      `SELECT pdx, dx0, dx1, dx2, dx3, dx4, dx5
       FROM dw_hd_check_prescriptions
       WHERE drug_icode = ?${dateFilter}`,
      params
    )

    const proposedMap = new Map([[icode, [...new Set(prefixes)]]])
    const totals = { pass: 0, fail: 0, noDx: 0, noMap: 0 }
    const codeCounts = new Map()
    for (const row of rows) {
      const result = evaluate({ ...row, drug_icode: icode }, proposedMap)
      if (result.audit_result === 'PASS') totals.pass += 1
      else if (result.audit_result === 'FAIL') totals.fail += 1
      else if (result.audit_result === 'NO_DX') totals.noDx += 1
      else totals.noMap += 1

      const uniqueDx = [...new Set([row.pdx, row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5]
        .map((value) => String(value ?? '').trim().toUpperCase())
        .filter(Boolean))]
      for (const code of uniqueDx) {
        codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1)
      }
    }

    const frequentDx = [...codeCounts.entries()]
      .map(([code, count]) => ({
        code,
        count,
        matches: code.startsWith('U') || prefixes.some((prefix) => code.startsWith(prefix)),
      }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
      .slice(0, 12)

    res.json({ success: true, icode, periodDays, total: rows.length, ...totals, frequentDx })
  } catch (err) {
    fail(res, err)
  }
})

app.put('/api/dx-map/:icode', requireAdmin, async (req, res) => {
  try {
    const { icode } = req.params
    const prefixes = String(req.body?.dx_prefixes ?? '')
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase().replace('.', ''))
      .filter((s) => /^[A-Z][0-9A-Z]{0,5}$/.test(s))
    const indication = String(req.body?.indication ?? '').slice(0, 255)
    await dwPool.query(
      `INSERT INTO dw_hd_check_drug_dx_map (icode, dx_prefixes, indication) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE dx_prefixes = VALUES(dx_prefixes), indication = VALUES(indication)`,
      [icode, [...new Set(prefixes)].join(','), indication]
    )
    res.json({ success: true, icode, dx_prefixes: [...new Set(prefixes)].join(','), indication })
  } catch (err) {
    fail(res, err)
  }
})

/* ---------------- Auth & 2FA Management Endpoints ---------------- */
const loginAttempts = new Map()
app.post('/api/auth/login', async (req, res) => {
  const ip = req.socket.remoteAddress ?? 'unknown'
  const now = Date.now()
  for (const [address, entry] of loginAttempts) {
    if (now - entry.startedAt >= 15 * 60 * 1000) loginAttempts.delete(address)
  }
  if (loginAttempts.size >= 5000 && !loginAttempts.has(ip)) {
    return res.status(503).json({ success: false, error: 'ระบบเข้าสู่ระบบไม่พร้อมใช้งานชั่วคราว' })
  }
  const recent = loginAttempts.get(ip)
  if (recent && now - recent.startedAt < 15 * 60 * 1000 && recent.count >= 8) {
    return res.status(429).json({ success: false, error: 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' })
  }
  if (!recent || now - recent.startedAt >= 15 * 60 * 1000) loginAttempts.set(ip, { startedAt: now, count: 0 })
  const attempts = loginAttempts.get(ip)
  attempts.count += 1
  try {
    const { loginname, password } = req.body ?? {}
    const result = await authenticateHosUser(hosPool, dwPool, loginname, password)
    if (result.token) {
      setSessionCookie(res, result.token)
      delete result.token
      loginAttempts.delete(ip)
    }
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
    res.status(401).json({ success: false, error: 'รหัส 2FA ไม่ถูกต้องหรือเซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' })
  }
})

app.post('/api/auth/setup-2fa/init', async (req, res) => {
  try {
    const { loginname } = req.body ?? {}
    if (!loginname) return res.status(400).json({ success: false, error: 'ระบุ loginname' })
    const activeSession = getSession(req)
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
    const activeSession = getSession(req)
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
    const session = getSession(req)
    if (!session || !canManageLogin(session.user, loginname)) {
      return res.status(session ? 403 : 401).json({ success: false, error: 'ไม่มีสิทธิ์จัดการ 2FA ของบัญชีนี้' })
    }
    const result = await disable2FA(dwPool, loginname)
    res.json(result)
  } catch (err) {
    res.status(400).json({ success: false, error: 'ปิด 2FA ไม่สำเร็จ' })
  }
})

app.post('/api/auth/logout', (req, res) => {
  logoutSession(readCookie(req, SESSION_COOKIE))
  clearSessionCookie(res)
  res.json({ success: true })
})

app.get('/api/auth/me', (req, res) => {
  const session = getSession(req)
  if (!session) {
    return res.json({ success: false, user: null })
  }
  res.json({ success: true, user: session.user })
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
    res.json(await setupUserPin(dwPool, req.authUser.loginname, pin, autoLockMinutes))
  } catch (err) {
    fail(res, err, 400)
  }
})

app.post('/api/auth/pin/verify', requireSession, async (req, res) => {
  try {
    const { pin } = req.body ?? {}
    if (!pin) return res.status(400).json({ success: false, error: 'กรุณากรอกรหัส PIN' })
    res.json(await verifyUserPin(dwPool, req.authUser.loginname, pin))
  } catch (err) {
    fail(res, err, 401)
  }
})

app.post('/api/auth/pin/disable', requireSession, async (req, res) => {
  try {
    res.json(await disableUserPin(dwPool, req.authUser.loginname))
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/auth/pin/settings', requireSession, async (req, res) => {
  try {
    const { pinEnabled, autoLockMinutes } = req.body ?? {}
    res.json(await updatePinSettings(dwPool, req.authUser.loginname, pinEnabled, autoLockMinutes))
  } catch (err) {
    fail(res, err)
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
    res.json(await setPinPolicy(dwPool, enforce_pin_lock, default_auto_lock_minutes))
  } catch (err) {
    fail(res, err)
  }
})

app.post('/api/admin/reset-user-pin', requireAdmin, async (req, res) => {
  try {
    const { loginname } = req.body ?? {}
    if (!loginname) return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อผู้ใช้' })
    res.json(await resetUserPin(dwPool, loginname))
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
try {
  await initAuthTables(dwPool)
} catch (err) {
  console.error(`[ERROR] Authentication database is not ready: ${err.message}`)
  process.exit(1)
}

app.listen(API_PORT, '0.0.0.0', () => {
  console.log(`HerbDx API → http://0.0.0.0:${API_PORT}  (HOSxP ${HOS_DB_BASE.host}/${HOS_DB} → ${DW_DB})`)
})

if (AUTO_SYNC_MINUTES > 0) {
  let isAutoSyncing = false
  const autoSync = async () => {
    if (isAutoSyncing) return
    isAutoSyncing = true
    const { startDate, endDate } = currentMonthRange()
    try {
      const r = await syncHerbalData(startDate, endDate, 'AUTO')
      console.log(`[auto-sync] ${startDate}..${endDate}: ${r.totalPrescriptions} rows, ${r.totalDrugs} drugs (${r.durationMs} ms)`)
    } catch (err) {
      console.error('[auto-sync] failed:', err.message)
    } finally {
      isAutoSyncing = false
    }
  }
  setTimeout(autoSync, 2000)
  setInterval(autoSync, AUTO_SYNC_MINUTES * 60 * 1000)
}
