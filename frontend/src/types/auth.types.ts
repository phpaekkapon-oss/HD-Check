export interface User {
  readonly loginname: string
  readonly name: string
  readonly doctorcode: string | null
  readonly groupname: string
  readonly position?: string
  readonly entryposition?: string
  readonly user_type: 'opduser' | 'doctor'
  readonly two_factor_enabled: boolean
  readonly admin_enabled?: boolean
  readonly thaimed_admin_enabled?: boolean
  readonly has_pin?: boolean
  readonly pin_enabled?: boolean
  readonly pin_length?: number
  readonly auto_lock_minutes?: number
  readonly enforce_pin_lock?: boolean
  readonly default_auto_lock_minutes?: number
  readonly avatar_url?: string | null
}

export interface LoginResult {
  readonly success: boolean
  readonly require2fa?: boolean
  readonly setupRequired?: boolean
  readonly tempToken?: string
  readonly user?: User
  readonly error?: string
}

export interface TotpSetupData {
  readonly success: boolean
  readonly loginname?: string
  readonly secret: string
  readonly otpAuthUrl: string
  readonly qrUrl: string
  readonly expiresAt: number
}

export interface User2FAAdminItem {
  readonly loginname: string
  readonly name: string
  readonly groupname: string
  readonly position?: string
  readonly entryposition?: string
  readonly user_type: string
  readonly account_disable: boolean
  readonly admin_enabled: boolean
  readonly thaimed_admin_enabled?: boolean
  readonly role_override?: string | null
  readonly effective_role?: 'it' | 'thaimed' | 'doctor' | 'pharmacist' | 'general'
  readonly two_factor_enabled: boolean
  readonly has_pin?: boolean
  readonly pin_enabled?: boolean
  readonly pin_length?: number
  readonly auto_lock_minutes?: number
  readonly last_login_at: string | null
}

export interface PinPolicy {
  readonly enforce_pin_lock: 'Y' | 'N'
  readonly default_auto_lock_minutes: number
}

/** Check if user has administrative or IT privileges */
export function isAdminUser(user?: Partial<User> | null): boolean {
  if (!user) return false
  const login = (user.loginname || '').toLowerCase()
  const group = (user.groupname || '').toLowerCase()
  const pos = (user.position || user.entryposition || '').toLowerCase()

  // ผู้ดูแลระบบ HD-Check = งาน IT เท่านั้น (ต้องตรงกับ isAdminUser ใน backend/index.mjs)
  // ไม่นับกลุ่ม HOSxP "ผู้ดูแลระบบ_ระดับที่_2/3" และไม่จับคำว่า "it" ในชื่อกลุ่ม/ตำแหน่ง
  if (user.admin_enabled === true || Number(user.admin_enabled) === 1) return true
  if (login === 'aekkapon') return true
  if (group === 'admin' || group === 'administrator') return true
  if (pos.includes('คอมพิวเตอร์') || pos.includes('สารสนเทศ') || pos.includes('โปรแกรมเมอร์')) return true

  return false
}

/** เห็นการ์ดมูลค่าบริการแผนไทย: IT/ผู้ดูแลระบบ หรือผู้ดูแลแผนไทยที่ IT เปิดสวิตช์ให้ (ต้องตรงกับ canViewThaiMedValue ใน backend) */
export function canViewThaiMedValue(user?: Partial<User> | null): boolean {
  if (!user) return false
  return isAdminUser(user) || user.thaimed_admin_enabled === true || Number(user.thaimed_admin_enabled) === 1
}

/** Check if user has permission to manage herbal drug ICD-10 criteria (Admin/IT, Thai Traditional Medicine, Pharmacist) */
export function canManageHerbDx(user?: Partial<User> | null): boolean {
  if (!user) return false
  if (isAdminUser(user)) return true

  const group = (user.groupname || '').toLowerCase()
  const pos = (user.position || user.entryposition || '').toLowerCase()

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

  // Pharmacy staff (เภสัชกร, เภสัชกรรม)
  if (pos.includes('เภสัช') || group.includes('เภสัช')) {
    return true
  }

  return false
}
