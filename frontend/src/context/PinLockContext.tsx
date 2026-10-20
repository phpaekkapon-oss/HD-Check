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
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'

type UnlockResult = { success: boolean; error?: string; forceLogout?: boolean }

export const MAX_LOCK_MINUTES = 15
export const MAX_LOCK_MS = MAX_LOCK_MINUTES * 60 * 1000

interface PinLockContextType {
  readonly isLocked: boolean
  readonly lockedAt: number | null
  readonly maxLockMinutes: number
  readonly hasPin: boolean
  readonly pinEnabled: boolean
  readonly pinLength: number
  readonly autoLockMinutes: number
  readonly isEnforced: boolean
  /** Hospital enforces PIN lock and this user has no PIN yet: must set one before using the app */
  readonly pinSetupRequired: boolean
  readonly lockNow: () => void
  readonly unlockWithPin: (pin: string) => Promise<UnlockResult>
  readonly unlockWithPassword: (password: string) => Promise<UnlockResult>
  readonly setupPin: (pin: string, autoLockMinutes?: number) => Promise<{ success: boolean; error?: string }>
  readonly disablePin: () => Promise<{ success: boolean; error?: string }>
  readonly updatePinSettings: (pinEnabled: boolean, autoLockMinutes: number) => Promise<{ success: boolean; error?: string }>
}

const PinLockContext = createContext<PinLockContextType | null>(null)

/** Remove the lock flag and lockedAt timestamp from sessionStorage. */
export const clearStoredPinLock = () => {
  try {
    sessionStorage.removeItem('smarthoscheck_pin_locked')
    sessionStorage.removeItem('smarthoscheck_locked_at')
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

// Keeps every open tab in step: lock / unlock / user activity
type TabMessage = 'lock' | 'unlock' | 'activity'
const openChannel = (): BroadcastChannel | null => {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('hd-check-screen-lock')
  } catch {
    return null
  }
}

const postJson = async (path: string, body?: unknown) => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && data.success !== false, data }
}

export const PinLockProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { user, updateUser, isAuthenticated, serverLocked, logout } = useAuth()

  const [isLocked, setIsLocked] = useState(false)
  const [lockedAt, setLockedAt] = useState<number | null>(() => {
    try {
      const saved = sessionStorage.getItem('smarthoscheck_locked_at')
      return saved ? Number(saved) : null
    } catch {
      return null
    }
  })
  const lockedAtRef = useRef<number | null>(lockedAt)
  useEffect(() => {
    lockedAtRef.current = lockedAt
  }, [lockedAt])

  // Server answered 428 (policy switched on after this tab loaded)
  const [serverRequiresPin, setServerRequiresPin] = useState(false)
  const queryClient = useQueryClient()

  const hasPin = Boolean(user?.has_pin)
  const isEnforced = Boolean(user?.enforce_pin_lock)
  // If hospital enforces PIN, it's effectively active even if user didn't explicitly toggle it, provided they have a PIN
  const pinEnabled = Boolean((user?.pin_enabled || isEnforced) && hasPin)
  const pinLength = Number(user?.pin_length || 6)
  const autoLockMinutes = Number(user?.auto_lock_minutes ?? user?.default_auto_lock_minutes ?? 5)
  const pinSetupRequired = Boolean(isAuthenticated && !hasPin && (isEnforced || serverRequiresPin))

  const lastActivityRef = useRef<number>(Date.now())
  const lastBroadcastRef = useRef<number>(0)
  const channelRef = useRef<BroadcastChannel | null>(null)

  const broadcast = (msg: TabMessage) => channelRef.current?.postMessage(msg)

  // Session was locked before this tab loaded (refresh / new tab)
  useEffect(() => {
    if (serverLocked) {
      setIsLocked(true)
      const now = Date.now()
      if (!lockedAtRef.current) {
        setLockedAt(now)
        lockedAtRef.current = now
        try {
          sessionStorage.setItem('smarthoscheck_locked_at', String(now))
        } catch {}
      }
    }
  }, [serverLocked])

  // Any API answering 423 means the server-side session is locked (e.g. locked from another device)
  useEffect(() => {
    const original = window.fetch
    window.fetch = async (...args) => {
      const res = await original(...args)
      if (res.status === 423) {
        setIsLocked(true)
        if (!lockedAtRef.current) {
          const now = Date.now()
          setLockedAt(now)
          lockedAtRef.current = now
          try {
            sessionStorage.setItem('smarthoscheck_locked_at', String(now))
          } catch {}
        }
      }
      if (res.status === 428) setServerRequiresPin(true)
      return res
    }
    return () => {
      window.fetch = original
    }
  }, [])

  useEffect(() => {
    const channel = openChannel()
    channelRef.current = channel
    if (!channel) return
    channel.onmessage = (e: MessageEvent<TabMessage>) => {
      if (e.data === 'lock') {
        setIsLocked(true)
        const now = Date.now()
        if (!lockedAtRef.current) {
          setLockedAt(now)
          lockedAtRef.current = now
        }
      }
      if (e.data === 'unlock') {
        setIsLocked(false)
        setLockedAt(null)
        lockedAtRef.current = null
        clearStoredPinLock()
      }
      if (e.data === 'unlock' || e.data === 'activity') lastActivityRef.current = Date.now()
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [])

  const lockNow = useCallback(() => {
    if (!isAuthenticated || !hasPin) return
    const now = Date.now()
    setIsLocked(true)
    setLockedAt(now)
    lockedAtRef.current = now
    try {
      sessionStorage.setItem('smarthoscheck_locked_at', String(now))
    } catch {}
    channelRef.current?.postMessage('lock')
    // Server lock is what actually blocks data; the overlay is only the UI for it
    void postJson('/api/auth/lock')
      .then((res) => {
        if (res.ok && res.data?.lockedAt) {
          const sTime = Number(res.data.lockedAt)
          setLockedAt(sTime)
          lockedAtRef.current = sTime
          try {
            sessionStorage.setItem('smarthoscheck_locked_at', String(sTime))
          } catch {}
        }
      })
      .catch(() => {})
  }, [isAuthenticated, hasPin])

  const finishUnlock = (ok: boolean, data: { error?: string; forceLogout?: boolean }, fallback: string): UnlockResult => {
    if (data.forceLogout) {
      clearStoredPinLock()
      setIsLocked(false)
      setLockedAt(null)
      lockedAtRef.current = null
      logout(data.error || 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ด้วยรหัสผ่าน')
      return { success: false, forceLogout: true, error: data.error }
    }
    if (!ok) return { success: false, error: data.error || fallback }
    clearStoredPinLock()
    setIsLocked(false)
    setLockedAt(null)
    lockedAtRef.current = null
    lastActivityRef.current = Date.now()
    broadcast('unlock')
    void queryClient.invalidateQueries()
    return { success: true }
  }

  const unlockWithPin = async (pin: string): Promise<UnlockResult> => {
    if (!user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้' }
    try {
      const { ok, data } = await postJson('/api/auth/pin/verify', { pin })
      return finishUnlock(ok, data, 'รหัส PIN ไม่ถูกต้อง')
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  const unlockWithPassword = async (password: string): Promise<UnlockResult> => {
    if (!user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้' }
    try {
      const { ok, data } = await postJson('/api/auth/unlock-password', { password })
      return finishUnlock(ok, data, 'รหัสผ่าน HOSxP ไม่ถูกต้อง')
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  const setupPin = async (pin: string, minutes = autoLockMinutes): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้' }
    try {
      const { ok, data } = await postJson('/api/auth/pin/setup', { pin, autoLockMinutes: minutes })
      if (!ok) return { success: false, error: data.error || 'ตั้งรหัส PIN ไม่สำเร็จ' }
      updateUser({
        ...user,
        has_pin: true,
        pin_enabled: true,
        pin_length: data.pin_length ?? pin.length,
        auto_lock_minutes: data.auto_lock_minutes ?? minutes,
      })
      setServerRequiresPin(false)
      void queryClient.invalidateQueries()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  const disablePin = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้' }
    try {
      const { ok, data } = await postJson('/api/auth/pin/disable')
      if (!ok) return { success: false, error: data.error || 'ปิด PIN ไม่สำเร็จ' }
      setIsLocked(false)
      updateUser({ ...user, has_pin: false, pin_enabled: false })
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  const updatePinSettings = async (enabled: boolean, minutes: number): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'ไม่พบข้อมูลผู้ใช้' }
    try {
      const { ok, data } = await postJson('/api/auth/pin/settings', { pinEnabled: enabled, autoLockMinutes: minutes })
      if (!ok) return { success: false, error: data.error || 'บันทึกการตั้งค่าไม่สำเร็จ' }
      updateUser({ ...user, pin_enabled: data.pin_enabled ?? enabled, auto_lock_minutes: data.auto_lock_minutes ?? minutes })
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  // Logged out: drop the overlay
  useEffect(() => {
    if (!isAuthenticated) setIsLocked(false)
  }, [isAuthenticated])

  // Activity detector & inactivity auto-lock (activity in any tab counts)
  useEffect(() => {
    if (!isAuthenticated || !pinEnabled || autoLockMinutes <= 0) return

    const handleUserActivity = () => {
      const now = Date.now()
      lastActivityRef.current = now
      if (now - lastBroadcastRef.current > 15_000) {
        lastBroadcastRef.current = now
        channelRef.current?.postMessage('activity')
      }
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

    const events = ['mousemove', 'mousedown', 'touchstart', 'scroll']
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }))
    window.addEventListener('keydown', handleKeyDown)

    const intervalId = window.setInterval(() => {
      const now = Date.now()

      // 1. If screen is LOCKED: check if locked duration >= 15 minutes -> Auto-logout!
      if (isLocked) {
        const lockTime = lockedAtRef.current || now
        if (now - lockTime >= MAX_LOCK_MS) {
          clearStoredPinLock()
          setIsLocked(false)
          setLockedAt(null)
          lockedAtRef.current = null
          logout('หน้าจอถูกล็อกเกิน 15 นาที ระบบออกจากระบบอัตโนมัติเพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่ด้วยรหัสผ่าน')
          broadcast('unlock')
        }
        return
      }

      // 2. If screen is NOT locked: check user inactivity
      const idleMs = now - lastActivityRef.current
      if (pinEnabled && autoLockMinutes > 0) {
        if (idleMs >= autoLockMinutes * 60 * 1000) {
          lockNow()
        }
      } else {
        // No PIN enabled: auto-logout when idle for 15 minutes
        if (idleMs >= MAX_LOCK_MS) {
          logout('ไม่มีการใช้งานเกิน 15 นาที ระบบออกจากระบบอัตโนมัติเพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่ด้วยรหัสผ่าน')
        }
      }
    }, 1000)

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity))
      window.removeEventListener('keydown', handleKeyDown)
      window.clearInterval(intervalId)
    }
  }, [isAuthenticated, pinEnabled, autoLockMinutes, isLocked, lockNow, logout])

  return (
    <PinLockContext.Provider
      value={{
        isLocked,
        lockedAt,
        maxLockMinutes: MAX_LOCK_MINUTES,
        hasPin,
        pinEnabled,
        pinLength,
        autoLockMinutes,
        isEnforced,
        pinSetupRequired,
        lockNow,
        unlockWithPin,
        unlockWithPassword,
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
