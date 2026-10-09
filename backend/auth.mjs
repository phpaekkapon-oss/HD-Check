import crypto from 'node:crypto'
import {
  generateBase32Secret,
  generateTOTP,
  verifyTOTP,
  generateBackupCodes,
  generateOtpAuthUrl,
} from './totp.mjs'
import { getQrCodeSvgUrl } from './qrcode.mjs'

// Simple secure session token storage in-memory + db verified
const activeSessions = new Map()
const tempSessions = new Map() // For 2FA verification step (expires in 5 mins)
const pending2FASetups = new Map()
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

export async function initAuthTables(dwPool) {
  await Promise.all([
    dwPool.query(`
      CREATE TABLE IF NOT EXISTS dw_hd_check_system_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=tis620
    `),
    dwPool.query(`
      CREATE TABLE IF NOT EXISTS dw_hd_check_user_2fa (
        loginname VARCHAR(50) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        user_type VARCHAR(20) NOT NULL DEFAULT 'opduser',
        groupname VARCHAR(100) NULL,
        two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0,
        totp_secret VARCHAR(64) NULL,
        backup_codes TEXT NULL,
        pin_hash VARCHAR(64) NULL,
        pin_enabled TINYINT(1) NOT NULL DEFAULT 0,
        auto_lock_minutes INT NOT NULL DEFAULT 5,
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=tis620
    `),
    dwPool.query(`
      CREATE TABLE IF NOT EXISTS dw_hd_check_user_avatar (
        loginname VARCHAR(50) PRIMARY KEY,
        image_blob MEDIUMBLOB NOT NULL,
        mime_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
        image_size INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=tis620
    `),
    dwPool.query(`
      INSERT IGNORE INTO dw_hd_check_system_settings (setting_key, setting_value)
      VALUES 
        ('enforce_2fa', 'N'),
        ('enforce_pin_lock', 'N'),
        ('default_auto_lock_minutes', '5')
    `),
  ])

  // Safe migration for existing installations
  try {
    await dwPool.query(`ALTER TABLE dw_hd_check_user_2fa ADD COLUMN pin_hash VARCHAR(64) NULL`)
  } catch (_) {}
  try {
    await dwPool.query(`ALTER TABLE dw_hd_check_user_2fa ADD COLUMN pin_salt VARCHAR(32) NULL`)
  } catch (_) {}
  try {
    await dwPool.query(`ALTER TABLE dw_hd_check_user_2fa ADD COLUMN pin_enabled TINYINT(1) NOT NULL DEFAULT 0`)
  } catch (_) {}
  try {
    await dwPool.query(`ALTER TABLE dw_hd_check_user_2fa ADD COLUMN auto_lock_minutes INT NOT NULL DEFAULT 5`)
  } catch (_) {}
  try {
    await dwPool.query(`ALTER TABLE dw_hd_check_user_2fa ADD COLUMN pin_length INT NOT NULL DEFAULT 6`)
  } catch (_) {}
  try {
    await dwPool.query(`ALTER TABLE dw_hd_check_user_2fa ADD COLUMN position VARCHAR(150) NULL`)
  } catch (_) {}
  try {
    await dwPool.query(`ALTER TABLE dw_hd_check_user_2fa ADD COLUMN entryposition VARCHAR(150) NULL`)
  } catch (_) {}
}

/** Helper to clean and format Thai civil/hospital job position */
export function parsePosition(row) {
  if (!row) return { position: null, entryposition: null }
  const entry = row.entryposition ? String(row.entryposition).trim() : null
  const dept = row.departmentposition ? String(row.departmentposition).trim() : null
  const raw = entry || dept || ''
  // Clean prefix "ตำแหน่ง " if present, e.g. "ตำแหน่ง นักวิชาการคอมพิวเตอร์ปฎิบัติการ" -> "นักวิชาการคอมพิวเตอร์ปฎิบัติการ"
  const cleaned = raw.replace(/^ตำแหน่ง\s*/i, '').trim()
  const position = cleaned || raw || row.groupname || 'เจ้าหน้าที่ HOSxP'
  return { position, entryposition: entry }
}

/** Check password against HOSxP password fields (plain text or MD5). */
function verifyHosPassword(plainPassword, storedHash) {
  if (!storedHash) return false
  const cleanStored = String(storedHash).trim()
  if (plainPassword === cleanStored) return true

  // HOSxP MD5 (both lower and uppercase hex)
  const md5Lower = crypto.createHash('md5').update(plainPassword).digest('hex')
  const md5Upper = md5Lower.toUpperCase()

  return cleanStored === md5Lower || cleanStored === md5Upper
}

/**
 * Login user via HOSxP opduser or doctor tables
 */
export async function authenticateHosUser(hosPool, dwPool, loginname, password) {
  const cleanLogin = String(loginname ?? '').trim()
  // Do not trim passwords: spaces may be part of the user's actual password.
  const cleanPass = String(password ?? '')

  if (!cleanLogin || !cleanPass) {
    throw new Error('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน')
  }

  let user = null

  // 1) Try HOSxP opduser table
  try {
    const [opdRows] = await hosPool.query(
      `SELECT loginname, name, doctorcode, password, passweb, 
              groupname, account_disable, entryposition, departmentposition
       FROM opduser
       WHERE loginname = ?
       LIMIT 1`,
      [cleanLogin]
    )

    if (opdRows.length > 0) {
      const row = opdRows[0]
      if (row.account_disable === 'Y') {
        const error = new Error('บัญชีผู้ใช้นี้ถูกระงับการใช้งานใน HOSxP')
        error.code = 'AUTH_ACCOUNT_DISABLED'
        throw error
      }

      // Some HOSxP installations expose the legacy password_text column,
      // while others do not. Query it separately so a missing optional column
      // cannot make the whole login query fail.
      let passwordText = null
      try {
        const [passwordRows] = await hosPool.query(
          `SELECT password_text FROM opduser WHERE loginname = ? LIMIT 1`,
          [cleanLogin]
        )
        passwordText = passwordRows[0]?.password_text ?? null
      } catch (err) {
        if (!['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(err.code)) throw err
      }

      const passMatched =
        verifyHosPassword(cleanPass, row.password) ||
        verifyHosPassword(cleanPass, row.passweb) ||
        verifyHosPassword(cleanPass, passwordText)

      if (passMatched) {
        const { position, entryposition } = parsePosition(row)
        user = {
          loginname: row.loginname,
          name: row.name,
          doctorcode: row.doctorcode ?? null,
          groupname: row.groupname ?? 'เจ้าหน้าที่ HOSxP',
          position,
          entryposition,
          user_type: 'opduser',
        }
      }
    }
  } catch (err) {
    if (err.code === 'AUTH_ACCOUNT_DISABLED') throw err
    // Fail closed when HOSxP is unavailable; do not disguise a database outage
    // as invalid credentials or silently fall back to a weaker login source.
    console.error('[AUTH] HOSxP login lookup failed:', err.code || err.name)
    throw new Error('ไม่สามารถตรวจสอบบัญชี HOSxP ได้ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล')
  }

  if (!user) {
    const error = new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง (ตรวจสอบข้อมูลใน HOSxP)')
    error.code = 'AUTH_INVALID_CREDENTIALS'
    throw error
  }

  // Check System Policies (2FA & PIN Lock)
  const [sysSettings] = await dwPool.query(
    `SELECT setting_key, setting_value FROM dw_hd_check_system_settings 
     WHERE setting_key IN ('enforce_2fa', 'enforce_pin_lock', 'default_auto_lock_minutes')`
  )
  const settingsMap = {}
  for (const s of sysSettings) settingsMap[s.setting_key] = s.setting_value
  const is2faEnforced = settingsMap.enforce_2fa === 'Y'
  const isPinEnforced = settingsMap.enforce_pin_lock === 'Y'
  const defaultAutoLock = Number(settingsMap.default_auto_lock_minutes || 5)

  const [user2faRows] = await dwPool.query(
    `SELECT two_factor_enabled, totp_secret, backup_codes, pin_hash, pin_enabled, pin_length, auto_lock_minutes 
     FROM dw_hd_check_user_2fa WHERE loginname = ? LIMIT 1`,
    [user.loginname]
  )

  const user2fa = user2faRows[0] ?? null
  const is2faActive = Boolean(user2fa && user2fa.two_factor_enabled === 1 && user2fa.totp_secret)
  const hasPin = Boolean(user2fa && user2fa.pin_hash)
  const pinEnabled = Boolean(user2fa && user2fa.pin_enabled === 1 && user2fa.pin_hash)
  const pinLength = Number(user2fa?.pin_length || 6)
  const autoLockMinutes = Number(user2fa?.auto_lock_minutes ?? defaultAutoLock)

  // Determine if 2FA verification or first-time setup is required
  if (is2faActive) {
    // Requires 2FA OTP verification
    const tempToken = generateToken()
    tempSessions.set(tempToken, {
      user,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
      mode: 'verify',
    })
    return {
      success: true,
      require2fa: true,
      setupRequired: false,
      tempToken,
      user: {
        loginname: user.loginname,
        name: user.name,
        groupname: user.groupname,
        position: user.position,
        entryposition: user.entryposition,
      },
    }
  }

  if (is2faEnforced) {
    // Hospital enforces 2FA for all users, but user hasn't set it up yet!
    const tempToken = generateToken()
    tempSessions.set(tempToken, {
      user,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      mode: 'setup_required',
    })
    return {
      success: true,
      require2fa: true,
      setupRequired: true,
      tempToken,
      user: {
        loginname: user.loginname,
        name: user.name,
        groupname: user.groupname,
        position: user.position,
        entryposition: user.entryposition,
      },
    }
  }

  // 2FA not required - Issue full session token
  const token = generateToken()
  const avatarUrl = await getUserAvatarUrl(dwPool, user.loginname)
  const authenticatedUser = {
    ...user,
    avatar_url: avatarUrl,
    two_factor_enabled: false,
    has_pin: hasPin,
    pin_enabled: pinEnabled,
    pin_length: pinLength,
    auto_lock_minutes: autoLockMinutes,
    enforce_pin_lock: isPinEnforced,
    default_auto_lock_minutes: defaultAutoLock,
  }
  activeSessions.set(token, { user: authenticatedUser, loginAt: new Date().toISOString(), expiresAt: Date.now() + SESSION_TTL_MS })

  // Record login timestamp in dw_hd_check_user_2fa
  await dwPool.query(
    `INSERT INTO dw_hd_check_user_2fa (loginname, name, user_type, groupname, position, entryposition, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE 
       name = VALUES(name), 
       groupname = VALUES(groupname), 
       position = VALUES(position), 
       entryposition = VALUES(entryposition), 
       last_login_at = NOW()`,
    [user.loginname, user.name, user.user_type, user.groupname, user.position || null, user.entryposition || null]
  )

  return {
    success: true,
    require2fa: false,
    token,
    user: authenticatedUser,
  }
}

/**
 * Verify 2FA code during login
 */
export async function verify2FALogin(dwPool, tempToken, code) {
  const session = tempSessions.get(tempToken)
  if (!session || Date.now() > session.expiresAt) {
    if (session) tempSessions.delete(tempToken)
    throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง')
  }
  if (session.attempts >= 5) {
    tempSessions.delete(tempToken)
    throw new Error('ยืนยันไม่สำเร็จหลายครั้ง กรุณาเข้าสู่ระบบใหม่')
  }

  const cleanCode = String(code ?? '').trim()
  const { user } = session

  const [rows] = await dwPool.query(
    `SELECT totp_secret, backup_codes, pin_hash, pin_enabled, pin_length, auto_lock_minutes FROM dw_hd_check_user_2fa WHERE loginname = ? LIMIT 1`,
    [user.loginname]
  )
  if (rows.length === 0 || !rows[0].totp_secret) {
    throw new Error('ไม่พบข้อมูล 2FA สำหรับผู้ใช้นี้')
  }

  const { totp_secret, backup_codes } = rows[0]

  // 1) Verify TOTP 6-digit code
  const isTotpValid = verifyTOTP(cleanCode, totp_secret)

  // 2) Or verify Backup Recovery Code
  let usedBackupCode = false
  if (!isTotpValid && backup_codes) {
    try {
      const codeList = JSON.parse(backup_codes)
      const index = codeList.indexOf(cleanCode.toUpperCase())
      if (index !== -1) {
        usedBackupCode = true
        // Remove used backup code
        codeList.splice(index, 1)
        await dwPool.query(
          `UPDATE dw_hd_check_user_2fa SET backup_codes = ? WHERE loginname = ?`,
          [JSON.stringify(codeList), user.loginname]
        )
      }
    } catch (_) {}
  }

  if (!isTotpValid && !usedBackupCode) {
    session.attempts += 1
    if (session.attempts >= 5) tempSessions.delete(tempToken)
    throw new Error('รหัส 2FA หรือรหัสกู้คืนไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
  }

  // Verified!
  tempSessions.delete(tempToken)
  const token = generateToken()

  await dwPool.query(
    `UPDATE dw_hd_check_user_2fa SET last_login_at = NOW() WHERE loginname = ?`,
    [user.loginname]
  )

  const [extraSettings] = await dwPool.query(
    `SELECT setting_key, setting_value FROM dw_hd_check_system_settings 
     WHERE setting_key IN ('enforce_pin_lock', 'default_auto_lock_minutes')`
  )
  const pinPolicyMap = {}
  for (const s of extraSettings) pinPolicyMap[s.setting_key] = s.setting_value

  const avatarUrl = await getUserAvatarUrl(dwPool, user.loginname)
  const authenticatedUser = {
    ...user,
    avatar_url: avatarUrl,
    two_factor_enabled: true,
    has_pin: Boolean(rows[0]?.pin_hash),
    pin_enabled: Boolean(rows[0]?.pin_enabled === 1 && rows[0]?.pin_hash),
    pin_length: Number(rows[0]?.pin_length || 6),
    auto_lock_minutes: Number(rows[0]?.auto_lock_minutes ?? pinPolicyMap.default_auto_lock_minutes ?? 5),
    enforce_pin_lock: pinPolicyMap.enforce_pin_lock === 'Y',
    default_auto_lock_minutes: Number(pinPolicyMap.default_auto_lock_minutes || 5),
  }
  activeSessions.set(token, { user: authenticatedUser, loginAt: new Date().toISOString(), expiresAt: Date.now() + SESSION_TTL_MS })

  return {
    success: true,
    token,
    usedBackupCode,
    user: authenticatedUser,
  }
}

/**
 * Start 2FA Setup (Generate Secret Key & QR Code)
 */
export async function init2FASetup(loginname) {
  const cleanLogin = String(loginname ?? '').trim()
  if (!cleanLogin) throw new Error('ไม่พบชื่อผู้ใช้สำหรับตั้งค่า 2FA')
  const secret = generateBase32Secret(20)
  pending2FASetups.set(cleanLogin, { secret, expiresAt: Date.now() + 5 * 60 * 1000 })
  const otpAuthUrl = generateOtpAuthUrl(cleanLogin, secret)
  const qrUrl = getQrCodeSvgUrl(otpAuthUrl)

  return {
    success: true,
    loginname: cleanLogin,
    secret,
    otpAuthUrl,
    qrUrl,
  }
}

/**
 * Confirm 2FA Setup with a 6-digit code
 */
export async function confirm2FASetup(dwPool, loginname, userDetails, secret, verifyCode) {
  const cleanLogin = String(loginname ?? '').trim()
  const pending = pending2FASetups.get(cleanLogin)
  if (!pending || Date.now() > pending.expiresAt || pending.secret !== secret) {
    pending2FASetups.delete(cleanLogin)
    throw new Error('คำขอตั้งค่า 2FA หมดอายุหรือไม่ตรงกับเซสชัน กรุณาเริ่มตั้งค่าใหม่')
  }
  const cleanCode = String(verifyCode ?? '').trim()
  if (!verifyTOTP(cleanCode, secret)) {
    throw new Error('รหัสยืนยัน 6 หลักไม่ถูกต้อง ตรวจสอบเวลาในโทรศัพท์หรือลองกรอกใหม่อีกครั้ง')
  }

  const backupCodes = generateBackupCodes(5)

  await dwPool.query(
    `INSERT INTO dw_hd_check_user_2fa (loginname, name, user_type, groupname, two_factor_enabled, totp_secret, backup_codes, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       two_factor_enabled = 1,
       totp_secret = VALUES(totp_secret),
       backup_codes = VALUES(backup_codes),
       updated_at = NOW()`,
    [
      cleanLogin,
      userDetails.name ?? cleanLogin,
      userDetails.user_type ?? 'opduser',
      userDetails.groupname ?? null,
      secret,
      JSON.stringify(backupCodes),
    ]
  )

  pending2FASetups.delete(cleanLogin)

  return {
    success: true,
    two_factor_enabled: true,
    backupCodes,
    message: 'เปิดใช้งาน 2FA สำเร็จเรียบร้อยแล้ว',
  }
}

/**
 * Disable 2FA for a user
 */
export async function disable2FA(dwPool, loginname) {
  await dwPool.query(
    `UPDATE dw_hd_check_user_2fa
     SET two_factor_enabled = 0, totp_secret = NULL, backup_codes = NULL, updated_at = NOW()
     WHERE loginname = ?`,
    [loginname]
  )
  return {
    success: true,
    two_factor_enabled: false,
    message: 'ปิดการใช้งาน 2FA สำเร็จ',
  }
}

/**
 * Admin: Get 2FA Policy
 */
export async function get2FAPolicy(dwPool) {
  const [rows] = await dwPool.query(
    `SELECT setting_value FROM dw_hd_check_system_settings WHERE setting_key = 'enforce_2fa' LIMIT 1`
  )
  return {
    enforce_2fa: rows.length > 0 ? rows[0].setting_value : 'N',
  }
}

/**
 * Admin: Set 2FA Policy ('Y' or 'N')
 */
export async function set2FAPolicy(dwPool, enforce) {
  const val = enforce === 'Y' ? 'Y' : 'N'
  await dwPool.query(
    `INSERT INTO dw_hd_check_system_settings (setting_key, setting_value, updated_at)
     VALUES ('enforce_2fa', ?, NOW())
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
    [val]
  )
  return {
    success: true,
    enforce_2fa: val,
    message: val === 'Y' ? 'เปิดโหมดบังคับ 2FA สำหรับทุกคนแล้ว' : 'เปลี่ยนเป็นโหมดไม่บังคับ 2FA แล้ว',
  }
}

/**
 * Admin: List all HOSxP users with their 2FA status
 */
export async function listAllUsers2FA(hosPool, dwPool) {
  let hosUsers = []

  try {
    const [opdRows] = await hosPool.query(
      `SELECT loginname, name, doctorcode, groupname, account_disable, entryposition, departmentposition
       FROM opduser
       ORDER BY loginname ASC`
    )
    hosUsers = opdRows.map((r) => {
      const { position, entryposition } = parsePosition(r)
      return {
        loginname: r.loginname,
        name: r.name,
        doctorcode: r.doctorcode,
        groupname: r.groupname ?? 'เจ้าหน้าที่ HOSxP',
        position,
        entryposition,
        user_type: 'opduser',
        account_disable: r.account_disable === 'Y',
      }
    })
  } catch (err) {
    console.warn('[AUTH] Cannot query opduser for list, using dw list:', err.message)
  }

  // Get 2FA and PIN state from DW_DB
  const [faRows] = await dwPool.query(
    `SELECT loginname, name, user_type, groupname, position, entryposition, two_factor_enabled, pin_hash, pin_enabled, pin_length, auto_lock_minutes, last_login_at, updated_at
     FROM dw_hd_check_user_2fa`
  )
  const faMap = new Map()
  for (const r of faRows) {
    faMap.set(r.loginname, r)
  }

  // Merge
  const merged = []
  const seen = new Set()

  for (const u of hosUsers) {
    seen.add(u.loginname)
    const fa = faMap.get(u.loginname)
    merged.push({
      loginname: u.loginname,
      name: u.name,
      groupname: u.groupname,
      position: u.position || fa?.position || u.groupname,
      entryposition: u.entryposition || fa?.entryposition || null,
      user_type: u.user_type,
      account_disable: u.account_disable,
      two_factor_enabled: Boolean(fa && fa.two_factor_enabled === 1),
      has_pin: Boolean(fa?.pin_hash),
      pin_enabled: Boolean(fa && fa.pin_enabled === 1 && fa.pin_hash),
      pin_length: fa?.pin_length ?? (fa?.pin_hash ? 6 : null),
      auto_lock_minutes: fa?.auto_lock_minutes ?? 5,
      last_login_at: fa?.last_login_at ?? null,
    })
  }

  // Add any user that exists in DW but not in HOSxP
  for (const [loginname, fa] of faMap.entries()) {
    if (!seen.has(loginname)) {
      merged.push({
        loginname: fa.loginname,
        name: fa.name,
        groupname: fa.groupname ?? 'ผู้ใช้ระบบ',
        position: fa.position ?? fa.groupname ?? 'ผู้ใช้ระบบ',
        entryposition: fa.entryposition ?? null,
        user_type: fa.user_type,
        account_disable: false,
        two_factor_enabled: Boolean(fa.two_factor_enabled === 1),
        has_pin: Boolean(fa.pin_hash),
        pin_enabled: Boolean(fa.pin_enabled === 1 && fa.pin_hash),
        pin_length: fa?.pin_length ?? (fa?.pin_hash ? 6 : null),
        auto_lock_minutes: fa.auto_lock_minutes ?? 5,
        last_login_at: fa.last_login_at ?? null,
      })
    }
  }

  return merged
}

/**
 * Admin: Reset 2FA for a user (when phone lost / locked out)
 */
export async function resetUser2FA(dwPool, targetLoginname) {
  await dwPool.query(
    `UPDATE dw_hd_check_user_2fa
     SET two_factor_enabled = 0, totp_secret = NULL, backup_codes = NULL, updated_at = NOW()
     WHERE loginname = ?`,
    [targetLoginname]
  )
  return {
    success: true,
    loginname: targetLoginname,
    message: `รีเซ็ต 2FA สำหรับผู้ใช้ ${targetLoginname} เรียบร้อยแล้ว ผู้ใช้สามารถล็อกอินและผูกใหม่ได้ทันที`,
  }
}

/* =========================================================================
   PIN Lock & Inactivity Auto-Lock Functions
   ========================================================================= */

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pin).trim(), salt, 32).toString('hex')
  return { salt, hash }
}

/**
 * Setup or change PIN for a user
 */
export async function setupUserPin(dwPool, loginname, pin, autoLockMinutes = 5) {
  const cleanPin = String(pin ?? '').trim()
  if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 8 || !/^\d+$/.test(cleanPin)) {
    throw new Error('รหัส PIN ต้องเป็นตัวเลข 4-8 หลักเท่านั้น')
  }

  const { salt, hash: pHash } = hashPin(cleanPin)
  const lockMinutes = Number(autoLockMinutes) || 5
  const pinLength = cleanPin.length

  await dwPool.query(
    `INSERT INTO dw_hd_check_user_2fa (loginname, name, pin_hash, pin_salt, pin_enabled, pin_length, auto_lock_minutes, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE pin_hash = VALUES(pin_hash), pin_salt = VALUES(pin_salt), pin_enabled = 1, pin_length = VALUES(pin_length), auto_lock_minutes = VALUES(auto_lock_minutes), updated_at = NOW()`,
    [loginname, loginname, pHash, salt, pinLength, lockMinutes]
  )

  return {
    success: true,
    has_pin: true,
    pin_enabled: true,
    pin_length: pinLength,
    auto_lock_minutes: lockMinutes,
    message: 'ตั้งรหัส PIN และเปิดใช้งานระบบล็อกหน้าจอเรียบร้อยแล้ว',
  }
}

/**
 * Verify PIN to unlock screen
 */
export async function verifyUserPin(dwPool, loginname, pin) {
  const cleanPin = String(pin ?? '').trim()
  const [rows] = await dwPool.query(
    `SELECT pin_hash, pin_salt, pin_enabled FROM dw_hd_check_user_2fa WHERE loginname = ? LIMIT 1`,
    [loginname]
  )

  if (rows.length === 0 || !rows[0].pin_hash || rows[0].pin_enabled !== 1) {
    throw new Error('ผู้ใช้นี้ยังไม่ได้ตั้งรหัส PIN หรือปิดการใช้งาน PIN อยู่')
  }

  const { pin_hash: expected, pin_salt: salt } = rows[0]
  let matches = false
  if (salt) {
    const incoming = Buffer.from(hashPin(cleanPin, salt).hash, 'hex')
    const expectedBuffer = Buffer.from(expected, 'hex')
    matches = incoming.length === expectedBuffer.length && crypto.timingSafeEqual(incoming, expectedBuffer)
  } else {
    // Migrate the legacy unsalted hash after a successful PIN check.
    const legacy = crypto.createHash('sha256').update(`SMART_HOS_PIN_${cleanPin}`).digest('hex')
    const legacyBuffer = Buffer.from(legacy, 'hex')
    const expectedLegacyBuffer = Buffer.from(expected, 'hex')
    matches = legacyBuffer.length === expectedLegacyBuffer.length &&
      crypto.timingSafeEqual(legacyBuffer, expectedLegacyBuffer)
    if (matches) {
      const upgraded = hashPin(cleanPin)
      await dwPool.query(
        `UPDATE dw_hd_check_user_2fa SET pin_hash = ?, pin_salt = ? WHERE loginname = ?`,
        [upgraded.hash, upgraded.salt, loginname]
      )
    }
  }

  if (!matches) {
    throw new Error('รหัส PIN ไม่ถูกต้อง')
  }

  return {
    success: true,
    message: 'ปลดล็อกหน้าจอสำเร็จ',
  }
}

/**
 * Disable PIN Lock
 */
export async function disableUserPin(dwPool, loginname) {
  await dwPool.query(
    `UPDATE dw_hd_check_user_2fa
     SET pin_enabled = 0, pin_hash = NULL, updated_at = NOW()
     WHERE loginname = ?`,
    [loginname]
  )
  return {
    success: true,
    has_pin: false,
    pin_enabled: false,
    message: 'ปิดการใช้งาน PIN Lock สำเร็จ',
  }
}

/**
 * Update user PIN Auto-Lock settings (enable/disable, minutes)
 */
export async function updatePinSettings(dwPool, loginname, pinEnabled, autoLockMinutes) {
  const enabledVal = pinEnabled ? 1 : 0
  const minutesVal = Number(autoLockMinutes) || 5

  await dwPool.query(
    `UPDATE dw_hd_check_user_2fa
     SET pin_enabled = ?, auto_lock_minutes = ?, updated_at = NOW()
     WHERE loginname = ?`,
    [enabledVal, minutesVal, loginname]
  )

  return {
    success: true,
    pin_enabled: Boolean(enabledVal),
    auto_lock_minutes: minutesVal,
  }
}

/**
 * Admin: Get Hospital PIN & Auto-Lock Policy
 */
export async function getPinPolicy(dwPool) {
  const [rows] = await dwPool.query(
    `SELECT setting_key, setting_value FROM dw_hd_check_system_settings 
     WHERE setting_key IN ('enforce_pin_lock', 'default_auto_lock_minutes')`
  )
  const map = {}
  for (const r of rows) map[r.setting_key] = r.setting_value

  return {
    enforce_pin_lock: map.enforce_pin_lock === 'Y' ? 'Y' : 'N',
    default_auto_lock_minutes: Number(map.default_auto_lock_minutes || 5),
  }
}

/**
 * Admin: Set Hospital PIN & Auto-Lock Policy
 */
export async function setPinPolicy(dwPool, enforce, defaultMinutes = 5) {
  const enforceVal = enforce === 'Y' ? 'Y' : 'N'
  const minutesVal = String(Number(defaultMinutes) || 5)

  await Promise.all([
    dwPool.query(
      `INSERT INTO dw_hd_check_system_settings (setting_key, setting_value, updated_at)
       VALUES ('enforce_pin_lock', ?, NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [enforceVal]
    ),
    dwPool.query(
      `INSERT INTO dw_hd_check_system_settings (setting_key, setting_value, updated_at)
       VALUES ('default_auto_lock_minutes', ?, NOW())
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
      [minutesVal]
    ),
  ])

  return {
    success: true,
    enforce_pin_lock: enforceVal,
    default_auto_lock_minutes: Number(minutesVal),
    message: enforceVal === 'Y'
      ? `เปิดโหมดบังคับใช้ PIN Lock ทุกคนแล้ว (ตั้งค่าเวลาอัตโนมัติ ${minutesVal} นาที)`
      : 'เปลี่ยนเป็นโหมดไม่บังคับ PIN Lock แล้ว',
  }
}

/**
 * Admin: Reset PIN for a user
 */
export async function resetUserPin(dwPool, targetLoginname) {
  await dwPool.query(
    `UPDATE dw_hd_check_user_2fa
     SET pin_enabled = 0, pin_hash = NULL, updated_at = NOW()
     WHERE loginname = ?`,
    [targetLoginname]
  )
  return {
    success: true,
    loginname: targetLoginname,
    message: `รีเซ็ตรหัส PIN ของผู้ใช้ ${targetLoginname} สำเร็จแล้ว`,
  }
}

/**
 * Verify session token middleware helper
 */
export function verifySession(token) {
  if (!token) return null
  const session = activeSessions.get(token)
  if (!session) return null
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token)
    return null
  }
  return session
}

export function verifyTempSession(token) {
  if (!token) return null
  const session = tempSessions.get(token)
  if (!session) return null
  if (Date.now() > session.expiresAt) {
    tempSessions.delete(token)
    return null
  }
  return session
}

export function logoutSession(token) {
  if (token) activeSessions.delete(token)
  return { success: true }
}

/**
 * Avatar Storage & Retrieval (Stored as MEDIUMBLOB in MySQL)
 */
export async function getUserAvatar(dwPool, loginname) {
  const [rows] = await dwPool.query(
    `SELECT image_blob, mime_type, image_size, updated_at FROM dw_hd_check_user_avatar WHERE loginname = ? LIMIT 1`,
    [loginname]
  )
  if (rows.length === 0) return null
  return rows[0]
}

export async function saveUserAvatar(dwPool, loginname, buffer, mimeType = 'image/jpeg') {
  await dwPool.query(
    `INSERT INTO dw_hd_check_user_avatar (loginname, image_blob, mime_type, image_size, updated_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       image_blob = VALUES(image_blob),
       mime_type = VALUES(mime_type),
       image_size = VALUES(image_size),
       updated_at = NOW()`,
    [loginname, buffer, mimeType, buffer.length]
  )
  return { success: true, size: buffer.length }
}

export async function deleteUserAvatar(dwPool, loginname) {
  await dwPool.query(
    `DELETE FROM dw_hd_check_user_avatar WHERE loginname = ?`,
    [loginname]
  )
  return { success: true }
}

export async function getUserAvatarUrl(dwPool, loginname) {
  try {
    const [rows] = await dwPool.query(
      `SELECT updated_at FROM dw_hd_check_user_avatar WHERE loginname = ? LIMIT 1`,
      [loginname]
    )
    if (rows.length === 0) return null
    const timestamp = new Date(rows[0].updated_at).getTime()
    return `/api/auth/avatar/${encodeURIComponent(loginname)}?t=${timestamp}`
  } catch (_) {
    return null
  }
}

