import { useState, type FC, type FormEvent } from 'react'
import {
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
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import type { TotpSetupData } from '@/types/auth.types'

export const LoginPage: FC = () => {
  const { login, verify2FA, init2FASetup, confirm2FASetup } = useAuth()
  const { accent } = useTheme()

  const [step, setStep] = useState<'login' | 'verify_2fa' | 'setup_2fa' | 'backup_codes'>('login')
  const [loginname, setLoginname] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [isBackupMode, setIsBackupMode] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [tempUser, setTempUser] = useState<{ loginname: string; name: string; groupname: string } | null>(null)

  // 2FA Setup state
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null)
  const [setupVerifyCode, setSetupVerifyCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedBackup, setCopiedBackup] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="border-b border-white/10 pb-3 mb-2">
                <div className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="size-4 text-emerald-400" />
                  เข้าสู่ระบบด้วยบัญชี HOSxP
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  ชื่อผู้ใช้งาน HOSxP (Username)
                </label>
                <div className="relative">
                  <User className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={loginname}
                    onChange={(e) => setLoginname(e.target.value)}
                    placeholder="เช่น admin, doctor, phar"
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-400 text-sm focus:outline-hidden focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <KeyRound className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-400 text-sm focus:outline-hidden focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition shadow-inner"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-98 transition cursor-pointer mt-2 disabled:opacity-50"
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

              <div className="pt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                <span>รองรับการยืนยันตัวตนแบบ 2 ขั้นตอน (2FA) ตามมาตรฐานกระทรวงฯ</span>
              </div>
            </form>
          )}

          {/* STEP 2: 2FA VERIFY STEP */}
          {step === 'verify_2fa' && (
            <form onSubmit={handleVerify2FASubmit} className="space-y-4 animate-fade-in">
              <div className="border-b border-white/10 pb-3 mb-2 text-center">
                <div className="inline-grid place-items-center size-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-2">
                  <Smartphone className="size-6" />
                </div>
                <h2 className="text-base font-bold text-white">
                  ยืนยันตัวตน 2 ขั้นตอน (2FA)
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  สวัสดีคุณ <strong className="text-white">{tempUser?.name || loginname}</strong> ({tempUser?.groupname})
                </p>
                <p className="text-[11.5px] text-slate-400 mt-0.5">
                  {isBackupMode
                    ? 'กรุณากรอกรหัสกู้คืนฉุกเฉิน (Backup Code 8 หลัก)'
                    : 'เปิดแอป Google Authenticator แล้วกรอกรหัส 6 หลัก'}
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span className="flex-1">
                    {error}
                    {error.includes('หมดอายุ') && (
                      <button
                        type="button"
                        onClick={() => {
                          setStep('login')
                          setError(null)
                        }}
                        className="underline font-bold text-white hover:text-amber-300 ml-1 cursor-pointer"
                      >
                        (คลิกเพื่อเข้าสู่ระบบใหม่)
                      </button>
                    )}
                  </span>
                </div>
              )}

              <div>
                <input
                  type="text"
                  inputMode={isBackupMode ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  maxLength={isBackupMode ? 9 : 6}
                  autoFocus
                  disabled={isSubmitting}
                  value={otpCode}
                  onChange={(e) => {
                    const rawVal = e.target.value
                    if (isBackupMode) {
                      setOtpCode(rawVal.toUpperCase())
                    } else {
                      const digits = rawVal.replace(/\D/g, '').slice(0, 6)
                      setOtpCode(digits)
                      if (digits.length === 6 && !isSubmitting) {
                        handleVerify2FASubmit(undefined, digits)
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleVerify2FASubmit()
                    }
                  }}
                  placeholder={isBackupMode ? 'เช่น A8F2-9X1B' : '000000'}
                  className="w-full text-center tracking-[0.35em] font-mono text-2xl font-bold py-3 rounded-xl bg-white/[0.06] border border-white/15 text-white placeholder-slate-600 focus:outline-hidden focus:border-white/30 focus:ring-2 focus:ring-white/15 transition disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-98 transition cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${accent.hex} 0%, ${accent.titleBarHex} 100%)`,
                  boxShadow: `0 4px 18px ${accent.glow}`,
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>กำลังตรวจสอบรหัส…</span>
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    <span>ยืนยันรหัสเข้าใช้งาน</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsBackupMode(!isBackupMode)
                    setOtpCode('')
                    setError(null)
                  }}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {isBackupMode ? '← ใช้รหัสจาก Authenticator' : 'ทำโทรศัพท์หาย? ใช้รหัสกู้คืนฉุกเฉิน'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('login')
                    setError(null)
                  }}
                  className="text-slate-400 hover:text-amber-400 transition cursor-pointer"
                >
                  ← กลับไปหน้า Login
                </button>
              </div>
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
                  กรุณาใช้แอป <strong>Google Authenticator</strong> หรือ <strong>Microsoft Authenticator</strong> บนมือถือสแกน QR Code ด้านล่าง
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              {/* QR Code Card */}
              <div className="bg-white p-3 rounded-2xl mx-auto w-48 h-48 flex items-center justify-center shadow-md">
                <img
                  src={setupData.qrUrl}
                  alt="2FA QR Code"
                  className="w-full h-full object-contain"
                />
              </div>

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
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                  กรอกรหัส 6 หลักจากแอปเพื่อยืนยันการเปิดใช้งาน:
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  disabled={isSubmitting}
                  value={setupVerifyCode}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setSetupVerifyCode(digits)
                    if (digits.length === 6 && !isSubmitting) {
                      handleSetupConfirmSubmit(undefined, digits)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSetupConfirmSubmit()
                    }
                  }}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.35em] font-mono text-2xl font-bold py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white placeholder-slate-600 focus:outline-hidden focus:border-white/30 focus:ring-2 focus:ring-white/15 transition disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
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
