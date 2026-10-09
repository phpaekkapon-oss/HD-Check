import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, LoginResult, TotpSetupData } from '@/types/auth.types'

interface AuthContextType {
  readonly user: User | null
  readonly isAuthenticated: boolean
  readonly isLoading: boolean
  readonly login: (loginname: string, password: string) => Promise<LoginResult>
  readonly verify2FA: (tempToken: string, code: string) => Promise<{ success: boolean; user?: User; error?: string }>
  readonly init2FASetup: (loginname: string, tempToken?: string) => Promise<TotpSetupData>
  readonly confirm2FASetup: (
    loginname: string,
    secret: string,
    code: string,
    userDetails?: Partial<User>,
    tempToken?: string
  ) => Promise<{ success: boolean; backupCodes?: string[]; error?: string }>
  readonly disable2FA: (loginname: string) => Promise<{ success: boolean; error?: string }>
  readonly logout: () => void
  readonly updateUser: (u: User) => void
  readonly uploadAvatar: (base64Image: string, mimeType?: string) => Promise<{ success: boolean; avatarUrl?: string; error?: string }>
  readonly deleteAvatar: () => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY_USER = 'smarthoscheck_auth_user_v1'
const STORAGE_KEY_TOKEN = 'smarthoscheck_auth_token_v1'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Remove legacy browser-stored bearer tokens and restore the HttpOnly cookie session.
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_USER)
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.success && data.user) setUser(data.user) })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // Automatically refresh profile on load to ensure latest position and details
  useEffect(() => {
    if (!user?.loginname) return
    const controller = new AbortController()

    fetch(`/api/auth/profile?loginname=${encodeURIComponent(user.loginname)}`, {
      signal: controller.signal,
      credentials: 'same-origin',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.profile) {
          setUser((prev) => {
            if (!prev) return null
            const updated = {
              ...prev,
              name: data.profile.name || prev.name,
              groupname: data.profile.groupname || prev.groupname,
              position: data.profile.position || prev.position,
              entryposition: data.profile.entryposition || prev.entryposition,
            }
            return updated
          })
        }
      })
      .catch(() => {})

    return () => controller.abort()
  }, [user?.loginname])

  const login = async (loginname: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ loginname, password }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'เข้าสู่ระบบไม่สำเร็จ' }
      }

      if (data.require2fa) {
        return {
          success: true,
          require2fa: true,
          setupRequired: data.setupRequired,
          tempToken: data.tempToken,
          user: data.user,
        }
      }

      setUser(data.user)
      return { success: true, user: data.user }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  const verify2FA = async (tempToken: string, code: string) => {
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ tempToken, code }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'รหัส 2FA ไม่ถูกต้อง' }
      }

      setUser(data.user)
      return { success: true, user: data.user }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  const init2FASetup = async (loginname: string, tempToken?: string): Promise<TotpSetupData> => {
    const res = await fetch('/api/auth/setup-2fa/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ loginname, tempToken }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'ไม่สามารถสร้างคีย์ 2FA ได้')
    }
    return data
  }

  const confirm2FASetup = async (
    loginname: string,
    secret: string,
    code: string,
    userDetails?: Partial<User>,
    tempToken?: string
  ) => {
    try {
      const res = await fetch('/api/auth/setup-2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ loginname, secret, code, userDetails, tempToken }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'ยืนยันรหัส 2FA ไม่ถูกต้อง' }
      }
      if (user) {
        setUser({ ...user, two_factor_enabled: true })
      }
      return { success: true, backupCodes: data.backupCodes }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  const disable2FA = async (loginname: string) => {
    try {
      const res = await fetch('/api/auth/disable-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ loginname }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'ปิด 2FA ไม่สำเร็จ' }
      }
      if (user) {
        setUser({ ...user, two_factor_enabled: false })
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
    setUser(null)
    localStorage.removeItem(STORAGE_KEY_USER)
    localStorage.removeItem(STORAGE_KEY_TOKEN)
  }

  const updateUser = (u: User) => {
    setUser(u)
  }

  const uploadAvatar = async (base64Image: string, mimeType?: string) => {
    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ image: base64Image, mimeType }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'บันทึกรูปโปรไฟล์ไม่สำเร็จ' }
      }
      if (user) {
        setUser({ ...user, avatar_url: data.avatarUrl })
      }
      return { success: true, avatarUrl: data.avatarUrl }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  const deleteAvatar = async () => {
    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'ลบรูปโปรไฟล์ไม่สำเร็จ' }
      }
      if (user) {
        setUser({ ...user, avatar_url: null })
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        verify2FA,
        init2FASetup,
        confirm2FASetup,
        disable2FA,
        logout,
        updateUser,
        uploadAvatar,
        deleteAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
