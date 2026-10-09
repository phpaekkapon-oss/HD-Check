import { useState, useEffect, useCallback, type FC } from 'react'
import {
  Lock,
  KeyRound,
  ShieldAlert,
  Loader2,
  Delete,
  LogOut,
  Leaf,
} from 'lucide-react'
import { usePinLock } from '@/context/PinLockContext'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

export const LockScreenOverlay: FC = () => {
  const { isLocked, unlockWithPin, pinLength } = usePinLock()
  const { user, logout, login } = useAuth()
  const { accent } = useTheme()

  // Dynamic PIN length (defaults to 6 if not specified, or 4 if configured as 4)
  const targetLength = Math.max(4, Math.min(8, Number(user?.pin_length || pinLength || 6)))

  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isShaking, setIsShaking] = useState(false)

  // Forgot PIN fallback state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [hosPassword, setHosPassword] = useState('')
  const [passError, setPassError] = useState<string | null>(null)
  const [isVerifyingPass, setIsVerifyingPass] = useState(false)

  const triggerErrorShake = (msg: string) => {
    setError(msg)
    setIsShaking(true)
    setTimeout(() => {
      setIsShaking(false)
      setPin('')
    }, 600)
  }

  // Handle PIN unlock
  const handleUnlock = useCallback(async (currentPin: string) => {
    if (currentPin.length < 4) return
    setIsSubmitting(true)
    setError(null)

    const res = await unlockWithPin(currentPin)
    setIsSubmitting(false)

    if (!res.success) {
      triggerErrorShake(res.error || 'รหัส PIN ไม่ถูกต้อง')
    } else {
      setPin('')
    }
  }, [unlockWithPin])

  // Keypad click handler
  const handleKeyClick = (val: string) => {
    if (isSubmitting) return
    setError(null)
    if (val === 'clear') {
      setPin('')
    } else if (val === 'backspace') {
      setPin((prev) => prev.slice(0, -1))
    } else {
      if (pin.length < targetLength) {
        const next = pin + val
        setPin(next)
        if (next.length === targetLength) {
          // Auto submit when reaching the configured PIN length
          handleUnlock(next)
        }
      }
    }
  }

  // Physical keyboard support
  useEffect(() => {
    if (!isLocked || showPasswordModal) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        handleKeyClick(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleKeyClick('backspace')
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        handleKeyClick('clear')
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (pin.length >= 4) {
          handleUnlock(pin)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLocked, pin, showPasswordModal, handleUnlock])

  // Reset when locked changes
  useEffect(() => {
    if (isLocked) {
      setPin('')
      setError(null)
      setShowPasswordModal(false)
    }
  }, [isLocked])

  // Fallback: Unlock with HOSxP Password
  const handlePasswordUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !hosPassword.trim()) return
    setIsVerifyingPass(true)
    setPassError(null)

    const res = await login(user.loginname, hosPassword.trim())
    setIsVerifyingPass(false)

    if (res.success) {
      // Unlocked
      setShowPasswordModal(false)
      setHosPassword('')
      // clear lock
      sessionStorage.removeItem('smarthoscheck_pin_locked')
      window.location.reload()
    } else {
      setPassError(res.error || 'รหัสผ่าน HOSxP ไม่ถูกต้อง')
    }
  }

  if (!isLocked) return null

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace']

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-4 select-none animate-in fade-in duration-300">
      {/* Background radial gradient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] opacity-25 pointer-events-none"
        style={{ backgroundColor: accent.hex }}
      />

      <div
        className={cn(
          'relative w-full max-w-sm rounded-3xl bg-slate-900/90 border border-white/10 p-6 md:p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center transition-transform',
          isShaking && 'animate-shake'
        )}
      >
        {/* Hospital Brand & Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 mb-5">
          <Leaf className="size-3.5 text-emerald-400" />
          <span>SMART-HOSCHECK • คุ้มครองข้อมูลเวชระเบียน</span>
        </div>

        {/* Lock Icon Badge */}
        <div className="relative mb-4">
          <div
            className="grid place-items-center size-16 rounded-2xl shadow-xl transition-all"
            style={{
              backgroundColor: `${accent.hex}20`,
              border: `1.5px solid ${accent.hex}50`,
            }}
          >
            <Lock className="size-8" style={{ color: accent.hex }} />
          </div>
          <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-amber-500 border-2 border-slate-900 grid place-items-center">
            <ShieldAlert className="size-3 text-slate-950" />
          </div>
        </div>

        {/* Staff Identity */}
        <h2 className="text-lg font-bold text-white tracking-tight">{user?.name || 'ผู้ใช้งาน HOSxP'}</h2>
        <p className="text-xs text-teal-300 mt-0.5 font-medium">
          {user?.position || user?.entryposition || user?.groupname || 'เจ้าหน้าที่โรงพยาบาล'}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
          @{user?.loginname} {user?.groupname && user?.position && user.position !== user.groupname ? `• กลุ่ม ${user.groupname}` : ''}
        </p>

        <p className="text-xs text-slate-300 mt-3 font-semibold">
          หน้าจอถูกล็อก กรุณากรอกรหัส PIN เพื่อปลดล็อกเข้าใช้งาน
        </p>

        {/* PIN Indicators (Matches user's PIN length: 4 or 6 dots) */}
        <div className="flex items-center gap-3 my-6">
          {Array.from({ length: targetLength }).map((_, idx) => {
            const isFilled = pin.length > idx
            return (
              <div
                key={idx}
                className={cn(
                  'size-3.5 rounded-full transition-all duration-200 border',
                  isFilled
                    ? 'scale-110 shadow-lg'
                    : 'bg-white/10 border-white/20'
                )}
                style={
                  isFilled
                    ? {
                        backgroundColor: accent.hex,
                        borderColor: accent.hex,
                        boxShadow: `0 0 12px ${accent.hex}80`,
                      }
                    : undefined
                }
              />
            )
          })}
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="flex flex-col items-center gap-1.5 mb-3 animate-in fade-in">
            <div className="text-xs text-rose-400 font-bold flex items-center gap-1">
              <ShieldAlert className="size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
            {(error.includes('เข้าสู่ระบบ') || error.includes('เซสชัน')) && (
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('smarthoscheck_pin_locked')
                  logout()
                }}
                className="mt-1 px-3 py-1 text-xs rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <LogOut className="size-3" />
                คลิกเพื่อเข้าสู่ระบบใหม่
              </button>
            )}
          </div>
        )}

        {/* PIN Keypad Grid */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] mb-6">
          {keys.map((k) => {
            if (k === 'clear') {
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleKeyClick('clear')}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-12 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:hover:bg-white/5 text-xs font-bold text-slate-300 transition-all flex items-center justify-center cursor-pointer"
                >
                  ล้าง (C)
                </button>
              )
            }
            if (k === 'backspace') {
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleKeyClick('backspace')}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-12 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:hover:bg-white/5 text-slate-300 transition-all flex items-center justify-center cursor-pointer"
                >
                  <Delete className="size-5" />
                </button>
              )
            }
            return (
              <button
                key={k}
                type="button"
                onClick={() => handleKeyClick(k)}
                disabled={isSubmitting}
                className="h-12 rounded-2xl bg-white/5 hover:bg-white/15 active:scale-95 text-lg font-bold text-white transition-all flex items-center justify-center border border-white/5 hover:border-white/20 shadow-sm cursor-pointer"
              >
                {k}
              </button>
            )
          })}
        </div>

        {/* Submitting Spinner */}
        {isSubmitting && (
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium mb-4 animate-in fade-in">
            <Loader2 className="size-4 animate-spin text-emerald-400" />
            <span>กำลังตรวจสอบรหัส PIN...</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="w-full flex items-center justify-between pt-4 border-t border-slate-700/80 text-xs">
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <KeyRound className="size-3.5 text-amber-400" />
            <span>ลืมรหัส PIN?</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="text-rose-400 hover:text-rose-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <LogOut className="size-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>

      {/* Forgot PIN / Unlock with HOSxP Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700/90 p-6 shadow-2xl text-left animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="grid place-items-center size-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shadow-md"
              >
                <KeyRound className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ปลดล็อกด้วยรหัสผ่าน HOSxP</h3>
                <p className="text-xs text-slate-300 font-medium">สำหรับกรณีลืมรหัส PIN</p>
              </div>
            </div>

            <form onSubmit={handlePasswordUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  รหัสผ่าน HOSxP ของ @{user?.loginname}
                </label>
                <input
                  type="password"
                  value={hosPassword}
                  onChange={(e) => setHosPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน HOSxP..."
                  autoFocus
                  required
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 shadow-inner"
                />
              </div>

              {passError && (
                <p className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 px-3 py-1.5 rounded-lg font-medium">{passError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPass || !hosPassword.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isVerifyingPass && <Loader2 className="size-3.5 animate-spin" />}
                  <span>ยืนยันปลดล็อก</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
