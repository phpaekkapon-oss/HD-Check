import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type FC,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'

interface PinLockContextType {
  readonly isLocked: boolean
  readonly hasPin: boolean
  readonly pinEnabled: boolean
  readonly pinLength: number
  readonly autoLockMinutes: number
  readonly isEnforced: boolean
  readonly lockNow: () => void
  readonly unlockWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>
  readonly setupPin: (pin: string, autoLockMinutes?: number) => Promise<{ success: boolean; error?: string }>
  readonly disablePin: () => Promise<{ success: boolean; error?: string }>
  readonly updatePinSettings: (pinEnabled: boolean, autoLockMinutes: number) => Promise<{ success: boolean; error?: string }>
}

const PinLockContext = createContext<PinLockContextType | null>(null)

const STORAGE_LOCK_KEY = 'smarthoscheck_pin_locked'

export const PinLockProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { user, updateUser, isAuthenticated } = useAuth()

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return sessionStorage.getItem(STORAGE_LOCK_KEY) === 'true'
  })

  // User PIN configs from user object
  const hasPin = Boolean(user?.has_pin)
  const isEnforced = Boolean(user?.enforce_pin_lock)
  // If hospital enforces PIN, it's effectively active even if user didn't explicitly toggle it, provided they have a PIN
  const pinEnabled = Boolean((user?.pin_enabled || isEnforced) && hasPin)
  const pinLength = Number(user?.pin_length || 6)
  const autoLockMinutes = Number(user?.auto_lock_minutes ?? user?.default_auto_lock_minutes ?? 5)

  const lastActivityRef = useRef<number>(Date.now())

  // Lock screen immediately
  const lockNow = useCallback(() => {
    if (!isAuthenticated || !hasPin) return
    setIsLocked(true)
    sessionStorage.setItem(STORAGE_LOCK_KEY, 'true')
  }, [isAuthenticated, hasPin])

  // Unlock with PIN
  const unlockWithPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้' }
    try {
      const res = await fetch('/api/auth/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginname: user.loginname, pin }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'รหัส PIN ไม่ถูกต้อง' }
      }

      setIsLocked(false)
      sessionStorage.removeItem(STORAGE_LOCK_KEY)
      lastActivityRef.current = Date.now()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  // Setup PIN
  const setupPin = async (pin: string, minutes = autoLockMinutes): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้' }
    try {
      const res = await fetch('/api/auth/pin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginname: user.loginname, pin, autoLockMinutes: minutes }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'ตั้งรหัส PIN ไม่สำเร็จ' }
      }

      updateUser({
        ...user,
        has_pin: true,
        pin_enabled: true,
        pin_length: pin.length,
        auto_lock_minutes: minutes,
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  // Disable PIN
  const disablePin = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้' }
    try {
      const res = await fetch('/api/auth/pin/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginname: user.loginname }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'ปิด PIN ไม่สำเร็จ' }
      }

      setIsLocked(false)
      sessionStorage.removeItem(STORAGE_LOCK_KEY)
      updateUser({
        ...user,
        has_pin: false,
        pin_enabled: false,
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  // Update Settings
  const updatePinSettings = async (
    enabled: boolean,
    minutes: number
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้' }
    try {
      const res = await fetch('/api/auth/pin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginname: user.loginname,
          pinEnabled: enabled,
          autoLockMinutes: minutes,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'บันทึกการตั้งค่าไม่สำเร็จ' }
      }

      updateUser({
        ...user,
        pin_enabled: enabled,
        auto_lock_minutes: minutes,
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  // Activity Detector & Inactivity Auto-Lock Loop
  useEffect(() => {
    if (!isAuthenticated || !pinEnabled || autoLockMinutes <= 0) return

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // Keyboard shortcut: Ctrl + L or Alt + L to lock instantly
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.altKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        lockNow()
      } else {
        handleUserActivity()
      }
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }))
    window.addEventListener('keydown', handleKeyDown)

    // Check interval every 5 seconds
    const intervalId = window.setInterval(() => {
      if (isLocked) return
      const idleTime = Date.now() - lastActivityRef.current
      const lockThresholdMs = autoLockMinutes * 60 * 1000

      if (idleTime >= lockThresholdMs) {
        lockNow()
      }
    }, 5000)

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity))
      window.removeEventListener('keydown', handleKeyDown)
      window.clearInterval(intervalId)
    }
  }, [isAuthenticated, pinEnabled, autoLockMinutes, isLocked, lockNow])

  return (
    <PinLockContext.Provider
      value={{
        isLocked,
        hasPin,
        pinEnabled,
        pinLength,
        autoLockMinutes,
        isEnforced,
        lockNow,
        unlockWithPin,
        setupPin,
        disablePin,
        updatePinSettings,
      }}
    >
      {children}
    </PinLockContext.Provider>
  )
}

export const usePinLock = () => {
  const context = useContext(PinLockContext)
  if (!context) throw new Error('usePinLock must be used within a PinLockProvider')
  return context
}
