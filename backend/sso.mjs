/**
 * เข้าสู่ระบบด้วย ThaiD (DOPA) / Provider ID (MOPH) — OAuth 2.0 Authorization Code (+PKCE ถ้าเปิด)
 * พอร์ตจาก HRMS (lib/sso.ts) ให้เข้ากับ HD-Check: ผู้ใช้มาจาก HOSxP opduser โดยตรง + session แบบ HttpOnly cookie
 *
 * - ค่าตั้งเก็บใน dw_hd_check_system_settings (sso_thaid / sso_providerid) — Client Secret เข้ารหัส AES-256-GCM ไม่ส่งกลับหน้าเว็บ
 * - จับคู่ผู้ใช้ด้วยเลขบัตร: ตารางผูก (ผูกด้วยมือ/ผูกอัตโนมัติครั้งก่อน) ก่อน แล้วค่อยหา opduser.cid ใน HOSxP
 * - โหมด off / demo (แสดงปุ่มตัวอย่าง) / live (ต้องค่าครบ + URL https)
 */
import crypto from 'node:crypto'

export const SSO_PROVIDERS = ['thaid', 'providerid']
export const SSO_LABEL = { thaid: 'ThaiD', providerid: 'Provider ID' }
export const isSsoProvider = (p) => SSO_PROVIDERS.includes(p)

/** ค่าเริ่มต้น — ต้องตรวจกับเอกสารที่หน่วยงานให้มาตอนลงทะเบียนอีกครั้ง */
const DEFAULTS = {
  thaid: {
    mode: 'off',
    client_id: '',
    authorize_url: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/',
    token_url: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/',
    userinfo_url: '',
    scope: 'pid name',
    cid_claim: 'pid',
    use_pkce: false,
    public_base: '',
  },
  providerid: {
    mode: 'off',
    client_id: '',
    authorize_url: '',
    token_url: '',
    userinfo_url: '',
    scope: '',
    cid_claim: 'cid',
    use_pkce: false,
    public_base: '',
  },
}

export async function initSsoTables(dwPool) {
  await dwPool.query(`
    CREATE TABLE IF NOT EXISTS dw_hd_check_user_sso_identities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      loginname VARCHAR(50) NOT NULL,
      provider VARCHAR(20) NOT NULL,
      provider_subject VARCHAR(255) NULL,
      cid_hash CHAR(64) NULL,
      status VARCHAR(10) NOT NULL DEFAULT 'active',
      link_method VARCHAR(10) NOT NULL DEFAULT 'auto',
      linked_by VARCHAR(200) NULL,
      linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMP NULL,
      login_count INT NOT NULL DEFAULT 0,
      note VARCHAR(255) NULL,
      UNIQUE KEY uq_login_provider (loginname, provider),
      INDEX idx_provider_cid (provider, cid_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=tis620
  `)
}

/* ───────── คีย์เข้ารหัส: SSO_KEY ใน .env (แนะนำ) ไม่งั้นสุ่มครั้งแรกแล้วเก็บไว้ ───────── */
let keyPromise = null
function getKey(dwPool) {
  if (process.env.SSO_KEY) return Promise.resolve(crypto.createHash('sha256').update(process.env.SSO_KEY).digest())
  keyPromise ??= (async () => {
    const [[row]] = await dwPool.query("SELECT setting_value FROM dw_hd_check_system_settings WHERE setting_key = 'sso_server_key'")
    let raw = row?.setting_value
    if (!raw) {
      raw = crypto.randomBytes(32).toString('hex')
      await dwPool.query(
        "INSERT IGNORE INTO dw_hd_check_system_settings (setting_key, setting_value) VALUES ('sso_server_key', ?)",
        [raw]
      )
      const [[again]] = await dwPool.query("SELECT setting_value FROM dw_hd_check_system_settings WHERE setting_key = 'sso_server_key'")
      raw = again.setting_value
    }
    return crypto.createHash('sha256').update(raw).digest()
  })().catch((err) => {
    keyPromise = null
    throw err
  })
  return keyPromise
}

async function encryptSecret(dwPool, plain) {
  const key = await getKey(dwPool)
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}
async function decryptSecret(dwPool, blob) {
  const key = await getKey(dwPool)
  const [iv, tag, enc] = blob.split('.').map((p) => Buffer.from(p, 'base64'))
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}

/** เลขบัตร 13 หลัก (รับเลขไทย/ขีด) หรือ null */
export function normalizeCid(cid) {
  const d = String(cid ?? '')
    .replace(/[๐-๙]/g, (x) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(x)))
    .replace(/\D/g, '')
  return d.length === 13 ? d : null
}
/** hash เลขบัตร — เก็บในตารางผูกแทนเลขจริง */
export async function cidHash(dwPool, cid) {
  const d = normalizeCid(cid)
  if (!d) return null
  const key = await getKey(dwPool)
  return crypto.createHmac('sha256', key).update(`cid:${d}`).digest('hex')
}

/* ───────── ค่าตั้ง ───────── */
export async function getSsoConfig(dwPool, p) {
  const base = { ...DEFAULTS[p], client_secret_enc: null }
  try {
    const [[row]] = await dwPool.query('SELECT setting_value FROM dw_hd_check_system_settings WHERE setting_key = ?', [`sso_${p}`])
    const v = JSON.parse(String(row?.setting_value || '{}'))
    const mode = ['off', 'demo', 'live'].includes(v.mode) ? v.mode : 'off'
    return { ...base, ...v, mode, use_pkce: Boolean(v.use_pkce) }
  } catch {
    return base
  }
}

export async function saveSsoConfig(dwPool, p, patch) {
  const cur = await getSsoConfig(dwPool, p)
  const next = {
    ...cur,
    mode: patch.mode ?? cur.mode,
    client_id: patch.client_id ?? cur.client_id,
    authorize_url: patch.authorize_url ?? cur.authorize_url,
    token_url: patch.token_url ?? cur.token_url,
    userinfo_url: patch.userinfo_url ?? cur.userinfo_url,
    scope: patch.scope ?? cur.scope,
    cid_claim: patch.cid_claim ?? cur.cid_claim,
    use_pkce: patch.use_pkce ?? cur.use_pkce,
    public_base: String(patch.public_base ?? cur.public_base).replace(/\/+$/, ''),
    // เว้นว่าง = คงรหัสเดิม
    client_secret_enc: patch.client_secret ? await encryptSecret(dwPool, patch.client_secret) : cur.client_secret_enc,
  }
  await dwPool.query(
    `INSERT INTO dw_hd_check_system_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [`sso_${p}`, JSON.stringify(next)]
  )
  return next
}

/** สิ่งที่ยังขาด (ว่าง = พร้อมใช้จริง) */
export function missingFields(c) {
  const m = []
  // ใช้งานจริงต้อง https — SSO_ALLOW_HTTP=1 ใช้ทดสอบกับผู้ให้บริการจำลองบนเครื่องเท่านั้น
  const urlOk = (u) => (process.env.SSO_ALLOW_HTTP === '1' ? /^https?:\/\//.test(u) : /^https:\/\//.test(u))
  if (!c.client_id) m.push('Client ID')
  if (!c.client_secret_enc) m.push('Client Secret')
  if (!urlOk(c.authorize_url)) m.push('Authorization URL (https)')
  if (!urlOk(c.token_url)) m.push('Token URL (https)')
  if (!/^https?:\/\//.test(c.public_base)) m.push('URL หน้าเว็บของระบบ')
  if (!c.cid_claim) m.push('ชื่อฟิลด์เลขบัตร')
  return m
}
export const callbackUrl = (c, p) => `${c.public_base}/api/auth/sso/${p}/callback`
export const isLive = (c) => c.mode === 'live' && missingFields(c).length === 0

/* ───────── state / PKCE (หน่วยความจำ อายุ 10 นาที) ───────── */
const pending = new Map()
function sweep() {
  const now = Date.now()
  for (const [k, v] of pending) if (now - v.at > 10 * 60_000) pending.delete(k)
}

export function buildAuthorizeUrl(p, c) {
  sweep()
  const state = crypto.randomBytes(24).toString('base64url')
  const verifier = crypto.randomBytes(48).toString('base64url')
  pending.set(state, { p, verifier, at: Date.now() })
  const u = new URL(c.authorize_url)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', c.client_id)
  u.searchParams.set('redirect_uri', callbackUrl(c, p))
  if (c.scope) u.searchParams.set('scope', c.scope)
  u.searchParams.set('state', state)
  if (c.use_pkce) {
    u.searchParams.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url'))
    u.searchParams.set('code_challenge_method', 'S256')
  }
  return u.toString()
}

export function takeState(state, p) {
  sweep()
  const v = pending.get(state)
  pending.delete(state)
  return v && v.p === p ? { verifier: v.verifier } : null
}

const pick = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

/** แลก code → token → ข้อมูลผู้ใช้ → เลขบัตร */
export async function exchangeCode(dwPool, p, c, code, verifier) {
  const secret = c.client_secret_enc ? await decryptSecret(dwPool, c.client_secret_enc) : ''
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(c, p),
    client_id: c.client_id,
    client_secret: secret,
  })
  if (c.use_pkce) body.set('code_verifier', verifier)
  const basic = Buffer.from(`${c.client_id}:${secret}`).toString('base64')
  const tr = await fetch(c.token_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', Authorization: `Basic ${basic}` },
    body,
    signal: AbortSignal.timeout(15000),
  })
  const tok = await tr.json().catch(() => ({}))
  if (!tr.ok) throw new Error(`แลกรหัสไม่สำเร็จ (${tr.status}) ${tok.error_description || tok.error || ''}`.trim())

  // ข้อมูลผู้ใช้: ฟิลด์ใน token response → id_token (ได้ตรงจากผู้ให้บริการผ่าน TLS) → userinfo
  let claims = { ...tok }
  if (typeof tok.id_token === 'string') {
    try {
      claims = { ...claims, ...JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url').toString('utf8')) }
    } catch {
      /* ไม่ใช่ JWT */
    }
  }
  if (c.userinfo_url && tok.access_token) {
    const ur = await fetch(c.userinfo_url, {
      headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json', 'client-id': c.client_id },
      signal: AbortSignal.timeout(15000),
    })
    if (ur.ok) claims = { ...claims, ...(await ur.json().catch(() => ({}))) }
  }
  const cid = pick(claims, c.cid_claim)
  const name = pick(claims, 'name') || pick(claims, 'given_name') || pick(claims, 'data.name_th') || null
  const sub = pick(claims, 'sub')
  return {
    subject: sub != null ? String(sub) : null,
    cid: cid != null ? String(cid) : null,
    name: name ? String(name) : null,
    raw_keys: Object.keys(claims).filter((k) => !/token|secret/i.test(k)),
  }
}

/**
 * หา loginname จากเลขบัตร
 * 1) ตารางผูก (ผูกด้วยมือ / เคยเข้าด้วย SSO) — ใช้ loginname เดิมเสมอ
 * 2) opduser.cid ใน HOSxP (เฉพาะบัญชีที่ไม่ถูกระงับ) — ถ้ามีหลายบัญชี เลือกบัญชีที่เข้าระบบนี้ล่าสุด
 * คืน { loginname, status } หรือ { error }
 */
export async function findLoginByCid(hosPool, dwPool, p, cid) {
  const d = normalizeCid(cid)
  if (!d) return { error: 'เลขบัตรประชาชนที่ได้รับไม่ถูกต้อง' }
  const h = await cidHash(dwPool, d)
  const [[linked]] = await dwPool.query(
    'SELECT loginname, status FROM dw_hd_check_user_sso_identities WHERE provider = ? AND cid_hash = ? LIMIT 1',
    [p, h]
  )
  if (linked) return { loginname: linked.loginname, status: linked.status }

  const [rows] = await hosPool.query(
    "SELECT loginname FROM opduser WHERE cid = ? AND (account_disable IS NULL OR account_disable <> 'Y')",
    [d]
  )
  if (rows.length === 0) return { error: 'notfound' }
  if (rows.length === 1) return { loginname: rows[0].loginname, status: 'active' }

  // คนเดียวมีหลายบัญชีใน HOSxP — ใช้บัญชีที่เคยเข้าระบบนี้ล่าสุด ถ้าไม่เคยเลยให้ผู้ดูแลผูกด้วยมือ
  const logins = rows.map((r) => r.loginname)
  const [[recent]] = await dwPool.query(
    `SELECT loginname FROM dw_hd_check_user_2fa
     WHERE loginname IN (?) AND last_login_at IS NOT NULL ORDER BY last_login_at DESC LIMIT 1`,
    [logins]
  )
  if (recent) return { loginname: recent.loginname, status: 'active' }
  return { error: 'ambiguous', logins }
}

/** บันทึกการเข้าระบบผ่าน SSO (ผูกอัตโนมัติครั้งแรก) */
export async function touchIdentity(dwPool, loginname, p, cid, subject) {
  await dwPool.query(
    `INSERT INTO dw_hd_check_user_sso_identities (loginname, provider, provider_subject, cid_hash, link_method, linked_by, last_login_at, login_count)
     VALUES (?, ?, ?, ?, 'auto', 'ระบบ (เข้าระบบครั้งแรก)', NOW(), 1)
     ON DUPLICATE KEY UPDATE provider_subject = COALESCE(VALUES(provider_subject), provider_subject),
       cid_hash = COALESCE(cid_hash, VALUES(cid_hash)), last_login_at = NOW(), login_count = login_count + 1`,
    [loginname, p, subject, await cidHash(dwPool, cid)]
  )
}

export async function listIdentities(dwPool, p) {
  const [rows] = await dwPool.query(
    `SELECT i.id, i.loginname, u.name, i.status, i.link_method, i.linked_by, i.note, i.login_count,
            DATE_FORMAT(i.linked_at, '%Y-%m-%dT%H:%i:%s') AS linked_at,
            DATE_FORMAT(i.last_login_at, '%Y-%m-%dT%H:%i:%s') AS last_login_at
     FROM dw_hd_check_user_sso_identities i
     LEFT JOIN dw_hd_check_user_2fa u ON u.loginname = i.loginname
     WHERE i.provider = ?
     ORDER BY i.last_login_at IS NULL, i.last_login_at DESC, i.linked_at DESC LIMIT 1000`,
    [p]
  )
  return rows
}

/** ผูกด้วยมือ (เลขบัตรใน HOSxP ผิด/ว่าง/ซ้ำหลายบัญชี) — เก็บเฉพาะ hash */
export async function linkManual(dwPool, loginname, p, cid, by, note) {
  const h = await cidHash(dwPool, cid)
  if (!h) throw new Error('เลขบัตรประชาชนต้องมี 13 หลัก')
  const [[dup]] = await dwPool.query(
    'SELECT loginname FROM dw_hd_check_user_sso_identities WHERE provider = ? AND cid_hash = ? AND loginname <> ? LIMIT 1',
    [p, h, loginname]
  )
  if (dup) throw new Error(`เลขบัตรนี้ผูกกับผู้ใช้ ${dup.loginname} อยู่แล้ว`)
  await dwPool.query(
    `INSERT INTO dw_hd_check_user_sso_identities (loginname, provider, cid_hash, status, link_method, linked_by, note)
     VALUES (?, ?, ?, 'active', 'manual', ?, ?)
     ON DUPLICATE KEY UPDATE cid_hash = VALUES(cid_hash), status = 'active', link_method = 'manual',
       linked_by = VALUES(linked_by), linked_at = NOW(), note = VALUES(note)`,
    [loginname, p, h, by, note]
  )
}
