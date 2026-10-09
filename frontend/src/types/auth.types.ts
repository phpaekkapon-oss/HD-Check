export interface User {
  readonly loginname: string
  readonly name: string
  readonly doctorcode: string | null
  readonly groupname: string
  readonly position?: string
  readonly entryposition?: string
  readonly user_type: 'opduser' | 'doctor'
  readonly two_factor_enabled: boolean
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
}

export interface User2FAAdminItem {
  readonly loginname: string
  readonly name: string
  readonly groupname: string
  readonly position?: string
  readonly entryposition?: string
  readonly user_type: string
  readonly account_disable: boolean
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

  // Named admin logins
  if (login === 'admin' || login === 'adminpk' || login === 'aekkapon') return true

  // HOSxP admin groups
  if (group.includes('admin') || group.includes('administrator') || group.includes('ผู้ดูแลระบบ')) return true

  // IT & Computer positions
  if (pos.includes('คอมพิวเตอร์') || pos.includes('สารสนเทศ') || pos.includes('it') || pos.includes('โปรแกรมเมอร์')) return true

  return false
}
