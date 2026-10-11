import { useState, type FC, type FormEvent } from 'react'
import { KeyRound, Leaf, Loader2, LogOut, ShieldCheck } from 'lucide-react'
import { usePinLock } from '@/context/PinLockContext'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

const MINUTE_CHOICES = [1, 3, 5, 10, 15, 30, 60]

const pinProblem = (pin: string): string | null => {
  if (!/^\d{4,8}$/.test(pin)) return 'รหัส PIN ต้องเป็นตัวเลข 4–8 หลัก'
  if (/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) {
    return 'รหัส PIN เดาง่ายเกินไป (เช่น 1111, 1234)'
  }
  return null
}

/**
 * Shown when the hospital enforces PIN lock and the signed-in user has no PIN yet.
 * It cannot be dismissed: the server also refuses data (HTTP 428) until a PIN exists.
 */
export const PinSetupRequiredOverlay: FC = () => {
  const { pinSetupRequired, setupPin } = usePinLock()
  const { user, logout } = useAuth()
  const { accent } = useTheme()

  const maxMinutes = Number(user?.default_auto_lock_minutes || 5)
  const choices = MINUTE_CHOICES.filter((m) => m <= maxMinutes)
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [minutes, setMinutes] = useState(maxMinutes)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!pinSetupRequired) return null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = pinProblem(pin)
    if (problem) return setError(problem)
    if (pin !== confirm) return setError('รหัส PIN ทั้ง 2 ช่องไม่ตรงกัน')
    setSaving(true)
    setError(null)
    const res = await setupPin(pin, minutes)
    setSaving(false)
    if (!res.success) setError(res.error || 'ตั้งรหัส PIN ไม่สำเร็จ')
  }

  const input =
    'w-full h-12 px-4 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white text-center text-xl tracking-[0.4em] font-mono placeholder:tracking-normal placeholder:text-sm placeholder:font-sans placeholder-slate-500 focus:outline-hidden focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-setup-title"
      className="fixed inset-0 z-[9998] flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-2xl p-3 sm:p-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] opacity-25 pointer-events-none"
        style={{ backgroundColor: accent.hex }}
      />
      <form
        onSubmit={onSubmit}
        className="relative my-auto w-full max-w-sm rounded-2xl bg-slate-900/85 border border-white/15 ring-1 ring-white/10 p-5 sm:p-8 shadow-2xl text-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/15 text-xs text-slate-200 mb-5">
          <Leaf className="size-3.5 text-emerald-400" />
          <span>SMART-HOSCHECK • โรงพยาบาลพังโคน</span>
        </div>

        <div
          className="mx-auto mb-4 grid place-items-center size-16 rounded-2xl"
          style={{ backgroundColor: `${accent.hex}20`, border: `1.5px solid ${accent.hex}50` }}
        >
          <KeyRound className="size-8" style={{ color: accent.hex }} />
        </div>
        <h2 id="pin-setup-title" className="text-lg font-bold text-white">ตั้งรหัส PIN ล็อกหน้าจอ</h2>
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          สวัสดีคุณ <b className="text-white">{user?.name || user?.loginname}</b> · โรงพยาบาลบังคับใช้ PIN Lock
          เพื่อคุ้มครองข้อมูลผู้ป่วย (PDPA) กรุณาตั้งรหัส PIN ก่อนเริ่มใช้งาน
        </p>

        <div className="mt-5 space-y-3 text-left">
          <label className="block">
            <span className="text-xs font-semibold text-slate-300">รหัส PIN ใหม่ (ตัวเลข 4–8 หลัก)</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              autoFocus
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="เช่น 6 หลัก"
              className={`${input} mt-1`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-300">ยืนยันรหัส PIN อีกครั้ง</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="กรอกซ้ำให้ตรงกัน"
              className={`${input} mt-1`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-300">ล็อกหน้าจออัตโนมัติเมื่อไม่ใช้งาน</span>
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="mt-1 w-full h-11 px-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white text-sm focus:outline-hidden focus:border-teal-400"
            >
              {(choices.length ? choices : [maxMinutes]).map((m) => (
                <option key={m} value={m}>
                  {m} นาที{m === maxMinutes ? ' (ค่าของโรงพยาบาล)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-3 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-left">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || pin.length < 4 || confirm.length < 4}
          className="mt-5 w-full min-h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-98 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: `linear-gradient(135deg, ${accent.hex} 0%, ${accent.titleBarHex} 100%)`, boxShadow: `0 4px 18px ${accent.glow}` }}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          <span>{saving ? 'กำลังบันทึก…' : 'ตั้งรหัส PIN และเริ่มใช้งาน'}</span>
        </button>

        <div className="mt-3 pt-2 border-t border-white/10 flex justify-center">
          <button
            type="button"
            onClick={logout}
            className="min-h-10 text-xs text-rose-400 hover:text-rose-300 inline-flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <LogOut className="size-3.5" />
            ออกจากระบบ
          </button>
        </div>
      </form>
    </div>
  )
}
