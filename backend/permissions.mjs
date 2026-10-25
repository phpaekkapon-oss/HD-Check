// สิทธิ์การเข้าถึงเมนูตามกลุ่มผู้ใช้ (IT ตั้งค่าได้คนเดียว)
// ค่าเริ่มต้นเท่ากับพฤติกรรมเดิม: ทุกกลุ่มเห็นทุกเมนู ยกเว้น SQL Query

/** กลุ่มที่ IT ติ๊กสิทธิ์ได้ ('it' เห็นทุกเมนูเสมอ จึงไม่อยู่ในตาราง) */
export const ROLES = [
  { id: 'thaimed', label: 'แพทย์แผนไทย', desc: 'ตำแหน่ง/กลุ่มมีคำว่า แผนไทย หรือ การแพทย์ทางเลือก' },
  { id: 'doctor', label: 'แพทย์', desc: 'กลุ่ม doctor ใน HOSxP: แพทย์ ทันตแพทย์ กายภาพบำบัด เทคนิคการแพทย์ รังสี ฯลฯ (ยกเว้นแพทย์แผนไทย)' },
  { id: 'pharmacist', label: 'เภสัชกร', desc: 'ตำแหน่ง/กลุ่มมีคำว่า เภสัช' },
  { id: 'general', label: 'ผู้ใช้ทั่วไป', desc: 'ผู้ใช้ HOSxP อื่นทั้งหมด' },
]

/** เมนูที่กำหนดสิทธิ์ได้ ('dashboard' เปิดให้ทุกคนเสมอ เพราะเป็นหน้าแรกหลังล็อกอิน) */
export const MENUS = [
  { id: 'audit', label: 'ตรวจสอบการจ่ายยาสมุนไพร' },
  { id: 'healthmed', label: 'ตรวจหัตถการแผนไทย' },
  { id: 'claims', label: 'ตรวจการเบิก สปสช.' },
  { id: 'drugs', label: 'รายการจ่ายยาสมุนไพร' },
  { id: 'mapping', label: 'ตรวจรหัสยาและ ICD-10' },
  { id: 'dxwriteback', label: 'ทบทวนรหัสโรค (DX)' },
  { id: 'dxmap', label: 'ตั้งค่ายา ↔ ICD-10' },
  { id: 'sql', label: 'SQL Query' },
]
export const ALWAYS_ALLOWED = ['dashboard']

const ROLE_IDS = ROLES.map((r) => r.id)
const MENU_IDS = MENUS.map((m) => m.id)

export function defaultPermissions() {
  const perms = {}
  for (const r of ROLE_IDS) {
    perms[r] = {}
    for (const m of MENU_IDS) perms[r][m] = m !== 'sql'
  }
  return perms
}

/** รวมค่าที่บันทึกไว้กับค่าเริ่มต้น และทิ้งกลุ่ม/เมนูที่ไม่รู้จัก */
export function normalizePermissions(raw) {
  const base = defaultPermissions()
  if (!raw || typeof raw !== 'object') return base
  for (const r of ROLE_IDS) {
    const row = raw[r]
    if (!row || typeof row !== 'object') continue
    for (const m of MENU_IDS) if (typeof row[m] === 'boolean') base[r][m] = row[m]
  }
  return base
}

/** บทบาทที่ IT กำหนดรายคนได้ (ทับการจัดกลุ่มอัตโนมัติ) */
export const ROLE_OVERRIDES = ['it', 'thaimed', 'doctor', 'pharmacist', 'general']
export const validRoleOverride = (v) => (ROLE_OVERRIDES.includes(String(v)) ? String(v) : null)

/** กลุ่มของผู้ใช้: บทบาทที่ IT กำหนดเอง > isAdmin (IT) > แพทย์แผนไทย > แพทย์ (กลุ่ม doctor) > เภสัชกร > ทั่วไป */
export function resolveRole(user, isAdmin) {
  if (!user) return 'general'
  const override = validRoleOverride(user.role_override)
  if (override) return override
  if (isAdmin) return 'it'
  const group = String(user.groupname ?? '').toLowerCase()
  const pos = String(user.position || user.entryposition || '').toLowerCase()
  const has = (k) => group.includes(k) || pos.includes(k)
  if (has('แผนไทย') || has('การแพทย์ทางเลือก')) return 'thaimed'
  if (group.trim() === 'doctor') return 'doctor'
  if (has('เภสัช')) return 'pharmacist'
  return 'general'
}

/** เห็นการ์ดมูลค่าบริการแผนไทย: IT/ผู้ดูแลระบบ หรือผู้ดูแลแผนไทยที่ IT เปิดสวิตช์ให้รายคน (ไม่ผูกกับกลุ่มงาน) */
export function canViewThaiMedValue(user, isAdmin) {
  if (!user) return false
  return Boolean(isAdmin) || user.thaimed_admin_enabled === true || Number(user.thaimed_admin_enabled) === 1
}

/** รายการเมนูที่กลุ่มนี้เข้าได้ */
export function allowedMenus(perms, role) {
  if (role === 'it') return [...ALWAYS_ALLOWED, ...MENU_IDS]
  const row = perms[role] ?? {}
  return [...ALWAYS_ALLOWED, ...MENU_IDS.filter((m) => row[m])]
}

export function canAccessMenu(perms, role, menuId) {
  return allowedMenus(perms, role).includes(menuId)
}

const SETTING_KEY = 'menu_permissions'

export async function getMenuPermissions(dwPool) {
  try {
    const [rows] = await dwPool.query('SELECT setting_value FROM dw_hd_check_system_settings WHERE setting_key = ? LIMIT 1', [SETTING_KEY])
    return normalizePermissions(rows[0]?.setting_value ? JSON.parse(rows[0].setting_value) : null)
  } catch (err) {
    console.error('[MENU PERMISSIONS] read failed:', err?.message)
    return defaultPermissions()
  }
}

export async function saveMenuPermissions(dwPool, raw) {
  const perms = normalizePermissions(raw)
  await dwPool.query(
    `INSERT INTO dw_hd_check_system_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
    [SETTING_KEY, JSON.stringify(perms)]
  )
  return perms
}
