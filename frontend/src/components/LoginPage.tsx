import { useEffect, useState, type FC, type FormEvent } from 'react'
import {
  BadgeCheck,
  Fingerprint,
  Info,
  X,
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Leaf,
  Building2,
  Smartphone,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { OtpInput } from '@/components/OtpInput'
import type { TotpSetupData } from '@/types/auth.types'

type SsoKey = 'thaid' | 'providerid'
interface SsoProviderButton {
  readonly key: SsoKey
  readonly label: string
  readonly demo: boolean
}
const SSO_META: Record<SsoKey, { icon: typeof Fingerprint; tone: string; iconColor: string; org: string; how: string }> = {
  thaid: { icon: Fingerprint, tone: 'from-indigo-500 to-blue-700', iconColor: 'text-white', org: 'กรมการปกครอง (DOPA)', how: 'แอป ThaiD บนมือถือ' },
  providerid: { icon: BadgeCheck, tone: 'from-emerald-600 to-teal-800', iconColor: 'text-white', org: 'กระทรวงสาธารณสุข (MOPH)', how: ' Provider ID ของบุคลากรสาธารณสุข' },
}

const VERIFY_TTL_MS = 5 * 60 * 1000
const LOGIN_INPUT_CLASS =
  'w-full h-12 pl-10 pr-4 rounded-xl border border-white/12 bg-white/[0.04] text-[15px] text-white placeholder-slate-500 transition focus:border-violet-400 focus:bg-white/[0.07] focus:outline-hidden focus:ring-4 focus:ring-violet-500/20'

export const LoginPage: FC = () => {
  const { login, verify2FA, init2FASetup, confirm2FASetup } = useAuth()
  const { accent } = useTheme()

  const [step, setStep] = useState<'login' | 'verify_2fa' | 'setup_2fa' | 'backup_codes'>('login')
  const [loginname, setLoginname] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [isBackupMode, setIsBackupMode] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [tempUser, setTempUser] = useState<{ loginname: string; name: string; groupname: string; position?: string; entryposition?: string } | null>(null)

  // 2FA Setup state
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null)
  const [setupVerifyCode, setSetupVerifyCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedBackup, setCopiedBackup] = useState(false)

  // The SSO callback redirects back with ?sso_error=… when sign-in fails
  const [error, setError] = useState<string | null>(() => new URLSearchParams(window.location.search).get('sso_error'))
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Mirrors the backend's 5-minute temp session so the user knows when to restart
  const [verifyExpiresAt, setVerifyExpiresAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (step !== 'verify_2fa' && step !== 'setup_2fa') return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [step])
  const verifySecondsLeft = Math.max(0, Math.ceil((verifyExpiresAt - now) / 1000))
  const verifyExpired = step === 'verify_2fa' && verifyExpiresAt > 0 && verifySecondsLeft === 0
  const setupSecondsLeft = setupData ? Math.max(0, Math.ceil((setupData.expiresAt - now) / 1000)) : 0
  const setupExpired = step === 'setup_2fa' && Boolean(setupData) && setupSecondsLeft === 0
  const otpComplete = isBackupMode ? otpCode.replace(/[^0-9A-Z]/g, '').length >= 8 : otpCode.length === 6

  // รูปโปรไฟล์บนหน้ายืนยัน 2FA (ยืนยันสิทธิ์ด้วย tempToken ของขั้นรหัสผ่าน)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!tempToken || (step !== 'verify_2fa' && step !== 'setup_2fa')) return
    let objectUrl: string | null = null
    let cancelled = false
    fetch('/api/auth/2fa/avatar', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken }),
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setAvatarSrc(objectUrl)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setAvatarSrc(null)
    }
  }, [tempToken, step])

  // ตัวอักษรย่อ: ตัดคำนำหน้าและสระหน้า (เ แ โ ใ ไ) เช่น "นายเอกพล" -> "อ"
  const displayName = tempUser?.name || loginname
  const initial = displayName.replace(/^(นางสาว|นาง|นาย|น\.ส\.|ดร\.|พญ\.|นพ\.|พท\.|ภก\.|ภญ\.)\s*/, '').replace(/^[เแโใไ]+/, '').trim().charAt(0) || '?'

  // ThaiD / Provider ID buttons (configured by admin; demo = preview only)
  const [ssoProviders, setSsoProviders] = useState<readonly SsoProviderButton[]>([])
  const [ssoDemo, setSsoDemo] = useState<SsoProviderButton | null>(null)

  useEffect(() => {
    // Drop ?sso_error=… (already shown via the initial error state) so a refresh doesn't repeat it
    const params = new URLSearchParams(window.location.search)
    if (params.has('sso_error')) {
      params.delete('sso_error')
      const qs = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
    }
    fetch('/api/public/sso-providers', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.success) setSsoProviders(data.data) })
      .catch(() => {})
  }, [])

  // Step 1: Login with HOSxP Username & Password
  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!loginname.trim() || !password) {
      setError('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const res = await login(loginname.trim(), password)
      if (!res.success) {
        setError(res.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
        return
      }

      if (res.require2fa) {
        setTempToken(res.tempToken || '')
        setTempUser(res.user || { loginname, name: loginname, groupname: 'ผู้ใช้' })

        if (res.setupRequired) {
          // Hospital enforces 2FA but user hasn't set it up yet!
          const initRes = await init2FASetup(res.user?.loginname || loginname, res.tempToken)
          setSetupData(initRes)
          setStep('setup_2fa')
        } else {
          // User already has 2FA enabled, verify code
          setVerifyExpiresAt(Date.now() + VERIFY_TTL_MS)
          setStep('verify_2fa')
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Step 2: Verify 6-digit TOTP Code
  const handleVerify2FASubmit = async (e?: FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault()
    if (isSubmitting) return

    const targetCode = (codeOverride ?? otpCode).trim()
    if (!targetCode) {
      setError(isBackupMode ? 'กรุณากรอกรหัสกู้คืนฉุกเฉิน' : 'กรุณากรอกรหัส 6 หลักจาก Authenticator')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const res = await verify2FA(tempToken, targetCode)
      if (!res.success) {
        setError(res.error || 'รหัส 2FA หรือรหัสกู้คืนไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
        if (!isBackupMode) setOtpCode('')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Step 3: First-time 2FA Setup Confirmation
  const handleSetupConfirmSubmit = async (e?: FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault()
    if (isSubmitting) return
    if (setupExpired) {
      setError('คีย์ตั้งค่า 2FA หมดอายุแล้ว กรุณาเริ่มเข้าสู่ระบบและตั้งค่าใหม่')
      return
    }

    const targetCode = (codeOverride ?? setupVerifyCode).trim()
    if (!targetCode || !setupData) {
      setError('กรุณากรอกรหัส 6 หลักจากแอป Authenticator')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const targetUser = setupData.loginname || loginname
      const res = await confirm2FASetup(
        targetUser,
        setupData.secret,
        targetCode,
        tempUser ? { name: tempUser.name, groupname: tempUser.groupname } : undefined,
        tempToken
      )
      if (!res.success) {
        setError(res.error || 'รหัส 6 หลักไม่ถูกต้อง')
        setSetupVerifyCode('')
        return
      }

      setBackupCodes(res.backupCodes || [])
      setStep('backup_codes')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Step 4: Finish setup and enter app
  const handleFinishSetup = async () => {
    if (tempToken) {
      // Complete login using temp token
      await verify2FA(tempToken, setupVerifyCode)
    } else {
      setStep('login')
    }
  }

  const copyToClipboard = (text: string, isBackup = false) => {
    navigator.clipboard.writeText(text)
    if (isBackup) {
      setCopiedBackup(true)
      setTimeout(() => setCopiedBackup(false), 2500)
    } else {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2500)
    }
  }

  return (
    <div className="min-h-dvh w-full flex items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 relative overflow-x-clip select-none">
      {/* Dynamic Background Atmosphere Glow */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[850px] h-[700px] rounded-full blur-[140px] pointer-events-none opacity-40"
        style={{ backgroundColor: accent.hex }}
      />
      <div
        className="absolute -bottom-40 -left-20 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none opacity-30 bg-teal-500"
      />
      <div
        className="absolute -bottom-20 -right-20 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none opacity-30 bg-indigo-500"
      />

      {/* Main Glass Card */}
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Hospital Brand Badge Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/15 text-xs text-slate-200 font-mono shadow-xs mb-3">
            <Building2 className="size-3.5 text-emerald-400" />
            <span>โรงพยาบาลพังโคน • แพทย์แผนไทย</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div
              className="grid place-items-center size-12 rounded-2xl shadow-lg shrink-0"
              style={{
                background: `linear-gradient(135deg, ${accent.hex} 0%, ${accent.darkText} 100%)`,
                boxShadow: `0 8px 24px ${accent.glow}`,
              }}
            >
              <Leaf className="size-6 text-white stroke-[2.3]" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
                SMART-HOSCHECK
              </h1>
              <p className="text-xs text-slate-300 font-medium">
                ระบบตรวจสอบการจ่ายยาสมุนไพร (HOSxP)
              </p>
            </div>
          </div>
        </div>

        {/* Form Container Card */}
        <div className="rounded-2xl bg-slate-900/85 backdrop-blur-2xl border border-white/15 p-4 sm:p-8 shadow-2xl relative ring-1 ring-white/10">
          {/* STEP 1: HOSxP LOGIN FORM */}
          {step === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-bold tracking-tight text-white">เข้าสู่ระบบ</h2>
                <p className="mt-1.5 text-sm text-slate-400">ใช้ชื่อผู้ใช้และรหัสผ่านเดียวกับ HOSxP</p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="login-username" className="mb-2 block text-sm font-medium text-slate-300">
                  ชื่อผู้ใช้
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={loginname}
                    onChange={(e) => setLoginname(e.target.value)}
                    placeholder="ชื่อผู้ใช้ HOSxP"
                    autoFocus
                    className={LOGIN_INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-slate-300">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                    onBlur={() => setCapsLock(false)}
                    placeholder="รหัสผ่าน"
                    className={`${LOGIN_INPUT_CLASS} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    aria-pressed={showPassword}
                    className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {capsLock && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-300">
                    <AlertCircle className="size-3.5" /> เปิด Caps Lock อยู่
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${accent.hex} 0%, ${accent.titleBarHex} 100%)`,
                  boxShadow: `0 4px 18px ${accent.glow}`,
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>กำลังตรวจสอบสิทธิ์…</span>
                  </>
                ) : (
                  <>
                    <span>เข้าสู่ระบบ</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              {ssoProviders.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 my-3">
                    <span className="h-px flex-1 bg-white/10" />
                    หรือเข้าสู่ระบบด้วย
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {ssoProviders.map((sp) => {
                      const meta = SSO_META[sp.key]
                      const Icon = meta.icon
                      return (
                        <button
                          key={sp.key}
                          type="button"
                          onClick={() => {
                            if (sp.demo) setSsoDemo(sp)
                            else window.location.href = `/api/auth/sso/${sp.key}/start`
                          }}
                          className={'relative min-h-12 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/15 hover:border-white/25 text-slate-100 text-sm font-semibold flex items-center justify-center gap-2.5 active:scale-98 transition cursor-pointer'}
                        >
                          <span className={`size-7 grid place-items-center rounded-lg bg-gradient-to-br ${meta.tone} shadow-sm`}>
                            <Icon className={`size-4 ${meta.iconColor}`} />
                          </span>
                          <span className="whitespace-nowrap">{sp.label}</span>
                          {sp.demo && (
                            <span className="hidden sm:inline rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-px text-[10px] font-semibold text-amber-300">
                              ทดลอง
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                <span>รองรับการยืนยันตัวตนแบบ 2 ขั้นตอน (2FA) ตามมาตรฐานกระทรวงฯ</span>
              </div>
            </form>
          )}

          {ssoDemo && (
            <div className="absolute inset-0 z-20 rounded-2xl bg-slate-950/90 backdrop-blur-sm p-5 sm:p-8 flex flex-col justify-center animate-fade-in">
              <button
                type="button"
                onClick={() => setSsoDemo(null)}
                className="absolute top-3 right-3 size-10 grid place-items-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="ปิด"
              >
                <X className="size-5" />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <span className={`size-11 grid place-items-center rounded-xl bg-gradient-to-br ${SSO_META[ssoDemo.key].tone}`}>
                  {(() => {
                    const Icon = SSO_META[ssoDemo.key].icon
                    return <Icon className={`size-6 ${SSO_META[ssoDemo.key].iconColor}`} />
                  })()}
                </span>
                <div>
                  <p className="text-base font-bold text-white">เข้าสู่ระบบด้วย {ssoDemo.label}</p>
                  <p className="text-xs text-slate-400">{SSO_META[ssoDemo.key].org}</p>
                </div>
              </div>
              <div className="rounded-xl bg-amber-400/10 border border-amber-400/30 p-3 text-xs text-amber-200 leading-relaxed flex gap-2">
                <Info className="size-4 shrink-0 mt-0.5 text-amber-300" />
                <span>
                  นี่คือ <b>โหมดสาธิต (Demo)</b> ระบบยังไม่ได้เชื่อมต่อกับ {ssoDemo.label} จริง
                  เมื่อเปิดใช้งานจริง ปุ่มนี้จะพาไปยืนยันตัวตนด้วย{SSO_META[ssoDemo.key].how} แล้วเข้าสู่ระบบด้วยบัญชี HOSxP ที่ตรงกับเลขบัตรประชาชนของคุณ
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-3">ระหว่างนี้กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน HOSxP</p>
              <button
                type="button"
                onClick={() => setSsoDemo(null)}
                className="mt-4 min-h-11 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold cursor-pointer"
              >
                กลับไปเข้าสู่ระบบด้วยรหัสผ่าน
              </button>
            </div>
          )}

          {/* STEP 2: 2FA VERIFY STEP */}
          {step === 'verify_2fa' && (
            <form onSubmit={handleVerify2FASubmit} className="animate-fade-in">
              {/* Header */}
              <div className="text-center">
                <div className="relative mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/10 text-emerald-300 ring-1 ring-emerald-400/30">
                  {isBackupMode ? <KeyRound className="size-7" /> : <ShieldCheck className="size-7" />}
                  <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-slate-900 ring-2 ring-slate-900">
                    <Lock className="size-3.5 text-emerald-300" />
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {isBackupMode ? 'ใช้รหัสกู้คืนฉุกเฉิน' : 'ยืนยันตัวตนสองขั้นตอน'}
                </h2>
                <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-400">
                  {isBackupMode
                    ? 'กรอกรหัสกู้คืน 8 หลักที่ได้รับตอนเปิดใช้งาน 2FA (ใช้ได้ครั้งเดียว)'
                    : 'กรอกรหัส 6 หลักจากแอป Google หรือ Microsoft Authenticator'}
                </p>
              </div>

              {/* Signed-in account */}
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={`รูปโปรไฟล์ ${displayName}`}
                    className="size-11 shrink-0 rounded-full object-cover ring-2 ring-white/15"
                  />
                ) : (
                  <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-base font-bold text-white ring-2 ring-white/15">
                    {initial}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                  {(tempUser?.position || tempUser?.entryposition) && (
                    <div className="truncate text-xs text-slate-300">{tempUser?.position || tempUser?.entryposition}</div>
                  )}
                  <div className="truncate font-mono text-[11px] text-slate-500">
                    {tempUser?.loginname || loginname}
                    {tempUser?.groupname ? ` · ${tempUser.groupname}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('login')
                    setOtpCode('')
                    setError(null)
                  }}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white cursor-pointer"
                >
                  ไม่ใช่คุณ?
                </button>
              </div>

              {/* Code entry */}
              <div className="mt-6">
                {isBackupMode ? (
                  <input
                    type="text"
                    autoComplete="one-time-code"
                    maxLength={9}
                    autoFocus
                    aria-label="รหัสกู้คืนฉุกเฉิน"
                    disabled={isSubmitting || verifyExpired}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX"
                    className="w-full rounded-xl border border-white/12 bg-white/[0.04] py-3 text-center font-mono text-xl font-semibold tracking-[0.3em] text-white placeholder-slate-600 transition focus:border-violet-400 focus:bg-white/[0.08] focus:outline-hidden focus:ring-4 focus:ring-violet-500/20 disabled:opacity-50"
                  />
                ) : (
                  <OtpInput
                    value={otpCode}
                    onChange={(v) => {
                      setOtpCode(v)
                      if (error) setError(null)
                    }}
                    onComplete={(code) => {
                      if (!isSubmitting && !verifyExpired) handleVerify2FASubmit(undefined, code)
                    }}
                    autoFocus
                    invalid={Boolean(error)}
                    disabled={isSubmitting || verifyExpired}
                    label="รหัสยืนยัน 6 หลัก"
                  />
                )}

                {error && (
                  <p role="alert" className="mt-3 flex items-start justify-center gap-1.5 text-center text-sm text-rose-300">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{error}</span>
                  </p>
                )}
              </div>

              {/* Session timer */}
              {verifyExpiresAt > 0 && (
                <div className="mt-5">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${verifySecondsLeft <= 60 ? 'bg-amber-400' : 'bg-emerald-400/80'}`}
                      style={{ width: `${(verifySecondsLeft / (VERIFY_TTL_MS / 1000)) * 100}%` }}
                    />
                  </div>
                  <p className={`mt-2 text-center text-xs ${verifyExpired ? 'text-rose-300' : verifySecondsLeft <= 60 ? 'text-amber-300' : 'text-slate-500'}`}>
                    {verifyExpired
                      ? 'หมดเวลายืนยันตัวตน กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
                      : `ต้องยืนยันภายใน ${Math.floor(verifySecondsLeft / 60)}:${String(verifySecondsLeft % 60).padStart(2, '0')} นาที`}
                  </p>
                </div>
              )}

              {/* Primary action */}
              {verifyExpired ? (
                <button
                  type="button"
                  onClick={() => {
                    setStep('login')
                    setOtpCode('')
                    setError(null)
                  }}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] py-3 text-sm font-semibold text-white transition hover:bg-white/10 cursor-pointer"
                >
                  <ArrowRight className="size-4 rotate-180" />
                  กลับไปเข้าสู่ระบบใหม่
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || !otpComplete}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    background: `linear-gradient(135deg, ${accent.hex} 0%, ${accent.titleBarHex} 100%)`,
                    boxShadow: otpComplete ? `0 6px 20px ${accent.glow}` : 'none',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      กำลังตรวจสอบ…
                    </>
                  ) : (
                    <>
                      ยืนยันและเข้าสู่ระบบ
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              )}

              {/* Alternatives */}
              <div className="mt-6 flex items-center gap-3 text-xs text-slate-500">
                <span className="h-px flex-1 bg-white/10" />
                หรือ
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBackupMode(!isBackupMode)
                  setOtpCode('')
                  setError(null)
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white cursor-pointer"
              >
                {isBackupMode ? (
                  <>
                    <Smartphone className="size-4" />
                    ใช้รหัสจากแอป Authenticator
                  </>
                ) : (
                  <>
                    <KeyRound className="size-4" />
                    ไม่มีโทรศัพท์? ใช้รหัสกู้คืนฉุกเฉิน
                  </>
                )}
              </button>

              <p className="mt-5 flex items-center justify-center gap-1.5 border-t border-white/[0.06] pt-4 text-[11px] text-slate-500">
                <Lock className="size-3" />
                รหัสแต่ละชุดใช้ได้ครั้งเดียวและเปลี่ยนทุก 30 วินาที
              </p>
            </form>
          )}

          {/* STEP 3: 2FA FIRST-TIME SETUP WIZARD */}
          {step === 'setup_2fa' && setupData && (
            <form onSubmit={handleSetupConfirmSubmit} className="space-y-4 animate-fade-in">
              <div className="border-b border-white/10 pb-3 mb-2 text-center">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold mb-2">
                  <ShieldCheck className="size-3.5" />
                  <span>ระบบโรงพยาบาลบังคับใช้ 2FA</span>
                </div>
                <h2 className="text-base font-bold text-white">
                  ตั้งค่า 2FA ครั้งแรก (ผูก Authenticator)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  เปิดแอป <strong>Google Authenticator</strong> หรือ <strong>Microsoft Authenticator</strong> แล้วเลือกเพิ่มบัญชีด้วย QR Code (กล้อง iPhone ปกติสแกนรหัสชนิดนี้ไม่ได้)
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              {/* QR Code Card */}
              <div className="bg-white p-3 rounded-2xl mx-auto w-52 h-52 flex items-center justify-center shadow-md">
                <img
                  src={setupData.qrUrl}
                  alt="2FA QR Code"
                  className="w-full h-full object-contain"
                />
              </div>

              <p className={`text-center text-xs font-semibold ${setupExpired ? 'text-rose-300' : 'text-amber-300'}`}>
                {setupExpired
                  ? 'คีย์หมดอายุแล้ว กรุณายกเลิกแล้วเริ่มตั้งค่าใหม่'
                  : `คีย์ตั้งค่านี้หมดอายุใน ${Math.floor(setupSecondsLeft / 60)}:${String(setupSecondsLeft % 60).padStart(2, '0')}`}
              </p>

              {/* Secret Key manual input */}
              <div className="bg-white/[0.04] p-3 rounded-xl border border-white/10 text-xs space-y-1">
                <div className="text-slate-400 text-[11px] flex justify-between">
                  <span>หรือป้อนคีย์ลับด้วยตนเอง (Manual Key):</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(setupData.secret)}
                    className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey ? <Check className="size-3" /> : <Copy className="size-3" />}
                    <span>{copiedKey ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                  </button>
                </div>
                <div className="font-mono text-center text-white tracking-widest font-bold select-all bg-black/30 py-1.5 rounded-lg border border-white/5">
                  {setupData.secret}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2.5 text-center">
                  กรอกรหัส 6 หลักจากแอปเพื่อยืนยันการเปิดใช้งาน
                </label>
                <OtpInput
                  value={setupVerifyCode}
                  onChange={setSetupVerifyCode}
                  onComplete={(code) => {
                    if (!isSubmitting) handleSetupConfirmSubmit(undefined, code)
                  }}
                  autoFocus
                  invalid={Boolean(error)}
                  disabled={isSubmitting || setupExpired}
                  label="รหัสยืนยัน 6 หลัก"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || setupExpired}
                className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-98 transition cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${accent.hex} 0%, ${accent.titleBarHex} 100%)`,
                  boxShadow: `0 4px 18px ${accent.glow}`,
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>กำลังยืนยันคีย์…</span>
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    <span>ยืนยันและเปิดใช้งาน 2FA</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: EMERGENCY BACKUP CODES DISPLAY */}
          {step === 'backup_codes' && (
            <div className="space-y-4 animate-fade-in text-center">
              <div className="inline-grid place-items-center size-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto">
                <Check className="size-6 stroke-[2.5]" />
              </div>

              <h2 className="text-base font-bold text-white">
                ตั้งค่า 2FA สำเร็จเรียบร้อย!
              </h2>

              <p className="text-xs text-slate-300">
                โปรดบันทึก <strong>รหัสกู้คืนฉุกเฉิน (Backup Codes)</strong> เหล่านี้ไว้ในที่ปลอดภัย กรณีที่คุณทำโทรศัพท์หายหรือไม่สามารถรับรหัส OTP ได้:
              </p>

              <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-left space-y-1.5 font-mono text-xs">
                {backupCodes.map((code, idx) => (
                  <div key={code} className="flex justify-between items-center text-slate-300 py-0.5">
                    <span className="text-slate-500">#{idx + 1}</span>
                    <span className="font-bold tracking-widest text-emerald-300">{code}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(backupCodes.join('\n'), true)}
                className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-white/10 transition cursor-pointer"
              >
                {copiedBackup ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                <span>{copiedBackup ? 'คัดลอกรหัสทั้งหมดแล้ว' : 'คัดลอกรหัสทั้งหมด (Copy All)'}</span>
              </button>

              <button
                type="button"
                onClick={handleFinishSetup}
                className="w-full py-2.5 rounded-xl text-white font-bold text-sm shadow-lg active:scale-98 transition cursor-pointer mt-2"
                style={{
                  background: `linear-gradient(135deg, ${accent.hex} 0%, ${accent.titleBarHex} 100%)`,
                  boxShadow: `0 4px 18px ${accent.glow}`,
                }}
              >
                บันทึกแล้ว เข้าสู่โปรแกรม →
              </button>
            </div>
          )}
        </div>

        {/* Footer Credits */}
        <div className="mt-4 text-center text-xs text-slate-300/80 space-y-1">
          <div className="font-semibold text-white/90">
            SMART-HOSCHECK • โรงพยาบาลพังโคน จ.สกลนคร
          </div>
          <div className="text-[11.5px] text-slate-400">
            ผู้พัฒนา: <strong className="text-white font-semibold">นายเอกพล อันคำวงค์</strong> (นักวิชาการคอมพิวเตอร์ปฏิบัติการ)
          </div>
          <div className="text-[11px] text-slate-400">
            โทร. 257 IT กลุ่มงานสุขภาพดิจิทัล
          </div>
        </div>
      </div>
    </div>
  )
}
