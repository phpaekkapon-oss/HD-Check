import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'hdcheck.privacyMode'

interface PrivacyContextValue {
  /** true = ปกปิดชื่อและ HN ผู้รับบริการบนหน้าจอ (ใช้ตอนแคปหน้าจอ) */
  readonly hidden: boolean
  readonly toggle: () => void
}

const PrivacyContext = createContext<PrivacyContextValue | undefined>(undefined)

const readStored = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function PrivacyProvider({ children }: { readonly children: ReactNode }) {
  const [hidden, setHidden] = useState<boolean>(readStored)

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // เก็บค่าไม่ได้ (เช่น private window) ก็ยังใช้งานได้ในรอบนี้
      }
      return next
    })
  }, [])

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle])
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider')
  return ctx
}
