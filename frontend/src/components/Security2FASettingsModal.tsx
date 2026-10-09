import { useState, useEffect, useMemo, type FC } from 'react'
import {
  ShieldCheck,
  Smartphone,
  KeyRound,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  Copy,
  Users,
  Search,
  Lock,
  Loader2,
  CheckCircle2,
  Info,
  Clock,
  Shield,
  Camera,
  Trash2,
  User as UserIcon,
  Sparkles,
  Monitor,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePinLock } from '@/context/PinLockContext'
import { isAdminUser, type TotpSetupData, type User2FAAdminItem, type PinPolicy } from '@/types/auth.types'
import { cn } from '@/lib/utils'

interface Security2FASettingsModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly initialTab?: 'my_profile' | 'my_2fa' | 'my_pin' | 'admin_policy'
}

const lockIntervals = [
  { minutes: 1, label: '1 นาที', hint: '⚡ สูงสุด (จุดบริการคนไข้หนาแน่น)' },
  { minutes: 3, label: '3 นาที', hint: '🛡️ แนะนำ (จุดตรวจ OPD / ห้องยา)' },
  { minutes: 5, label: '5 นาที', hint: '⭐ มาตรฐานสากล (เวชระเบียนทั่วไป)' },
  { minutes: 10, label: '10 นาที', hint: '🏢 ปานกลาง (ห้องทำงานส่วนตัว)' },
  { minutes: 15, label: '15 นาที', hint: '☕ นานสุด' },
]

export const Security2FASettingsModal: FC<Security2FASettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'my_profile',
}) => {
  const { user, init2FASetup, confirm2FASetup, disable2FA, uploadAvatar, deleteAvatar } = useAuth()
  const isAdmin = isAdminUser(user)
  const {
    hasPin,
    pinEnabled,
    autoLockMinutes,
    isEnforced: isPinEnforced,
    lockNow,
    setupPin,
    disablePin,
    updatePinSettings,
  } = usePinLock()

  const [activeTab, setActiveTab] = useState<'my_profile' | 'my_2fa' | 'my_pin' | 'admin_policy'>(() => {
    if (initialTab === 'admin_policy' && !isAdmin) return 'my_profile'
    return initialTab
  })

  useEffect(() => {
    if (isOpen) {
      if (initialTab === 'admin_policy' && !isAdmin) {
        setActiveTab('my_profile')
      } else {
        setActiveTab(initialTab)
      }
    }
  }, [isOpen, initialTab, isAdmin])

  // Profile Avatar states
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [selectedAvatarBase64, setSelectedAvatarBase64] = useState<string | null>(null)
  const [isAvatarProcessing, setIsAvatarProcessing] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null)

  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const size = 512
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas context error'))
          const minDim = Math.min(img.width, img.height)
          const sx = (img.width - minDim) / 2
          const sy = (img.height - minDim) / 2
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
          const base64 = canvas.toDataURL('image/jpeg', 0.9)
          resolve(base64)
        }
        img.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการโหลดไฟล์'))
      reader.readAsDataURL(file)
    })
  }

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('กรุณาเลือกไฟล์รูปภาพ (JPEG, PNG, WebP)')
      return
    }
    setAvatarError(null)
    setAvatarSuccess(null)
    setIsAvatarProcessing(true)
    try {
      const base64 = await processImageFile(file)
      setSelectedAvatarBase64(base64)
      setAvatarPreviewUrl(base64)
    } catch (err) {
      setAvatarError((err as Error).message || 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ')
    } finally {
      setIsAvatarProcessing(false)
    }
  }

  const handleSaveAvatar = async () => {
    if (!selectedAvatarBase64) return
    setIsAvatarProcessing(true)
    setAvatarError(null)
    setAvatarSuccess(null)
    const res = await uploadAvatar(selectedAvatarBase64, 'image/jpeg')
    setIsAvatarProcessing(false)
    if (!res.success) {
      setAvatarError(res.error || 'บันทึกรูปภาพไม่สำเร็จ')
    } else {
      setAvatarSuccess('บันทึกรูปโปรไฟล์เรียบร้อยแล้ว!')
      setSelectedAvatarBase64(null)
      setTimeout(() => setAvatarSuccess(null), 4000)
    }
  }

  const handleDeleteAvatar = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรูปภาพประจำตัว?')) return
    setIsAvatarProcessing(true)
    setAvatarError(null)
    setAvatarSuccess(null)
    const res = await deleteAvatar()
    setIsAvatarProcessing(false)
    if (!res.success) {
      setAvatarError(res.error || 'ลบรูปภาพไม่สำเร็จ')
    } else {
      setAvatarPreviewUrl(null)
      setSelectedAvatarBase64(null)
      setAvatarSuccess('ลบรูปภาพประจำตัวเรียบร้อยแล้ว')
      setTimeout(() => setAvatarSuccess(null), 4000)
    }
  }

  // My 2FA states
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [myError, setMyError] = useState<string | null>(null)
  const [mySuccess, setMySuccess] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedBackup, setCopiedBackup] = useState(false)

  // My PIN states
  const [pinInput, setPinInput] = useState('')
  const [confirmPinInput, setConfirmPinInput] = useState('')
  const [selectedMinutes, setSelectedMinutes] = useState<number>(autoLockMinutes || 5)
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSuccess, setPinSuccess] = useState<string | null>(null)

  // Admin Policy states
  const [enforcePolicy, setEnforcePolicy] = useState<'Y' | 'N'>('N')
  const [enforcePinPolicy, setEnforcePinPolicy] = useState<'Y' | 'N'>('N')
  const [defaultHospitalMinutes, setDefaultHospitalMinutes] = useState<number>(5)
  const [policyLoading, setPolicyLoading] = useState(false)
  const [pinPolicyLoading, setPinPolicyLoading] = useState(false)
  const [usersList, setUsersList] = useState<User2FAAdminItem[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [resettingUser, setResettingUser] = useState<string | null>(null)
  const [resettingPinUser, setResettingPinUser] = useState<string | null>(null)
  const [adminNotice, setAdminNotice] = useState<string | null>(null)

  const copyToClipboard = async (text: string, type: 'key' | 'backup') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'key') {
        setCopiedKey(true)
        setTimeout(() => setCopiedKey(false), 2000)
      } else {
        setCopiedBackup(true)
        setTimeout(() => setCopiedBackup(false), 2000)
      }
    } catch (_) {}
  }

  const fetchPolicy = async () => {
    try {
      const res = await fetch('/api/admin/2fa-policy')
      const data = await res.json()
      if (data.enforce_2fa) setEnforcePolicy(data.enforce_2fa)
    } catch (_) {}
  }

  const fetchPinPolicy = async () => {
    try {
      const res = await fetch('/api/admin/pin-policy')
      const data: PinPolicy = await res.json()
      if (data.enforce_pin_lock) setEnforcePinPolicy(data.enforce_pin_lock)
      if (data.default_auto_lock_minutes) setDefaultHospitalMinutes(data.default_auto_lock_minutes)
    } catch (_) {}
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users-2fa')
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setUsersList(data.data)
      }
    } catch (_) {
    } finally {
      setUsersLoading(false)
    }
  }

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      if (isAdmin) {
        fetchPolicy()
        fetchPinPolicy()
        fetchUsers()
      }
      setMyError(null)
      setMySuccess(null)
      setPinError(null)
      setPinSuccess(null)
      setIsSettingUp(false)
      setSelectedMinutes(autoLockMinutes || 5)
      setPinInput('')
      setConfirmPinInput('')
    }
  }, [isOpen, autoLockMinutes, isAdmin])

  // ESC key to close modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Toggle Hospital 2FA Policy
  const handleTogglePolicy = async () => {
    const nextVal = enforcePolicy === 'Y' ? 'N' : 'Y'
    setPolicyLoading(true)
    try {
      const res = await fetch('/api/admin/2fa-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enforce_2fa: nextVal }),
      })
      const data = await res.json()
      if (data.success) {
        setEnforcePolicy(nextVal)
        setAdminNotice(
          nextVal === 'Y'
            ? 'บันทึกนโยบายแล้ว: บังคับใช้ 2FA สำหรับทุกคนในโรงพยาบาล'
            : 'บันทึกนโยบายแล้ว: เปลี่ยนเป็นโหมดไม่บังคับ 2FA (ตามความสมัครใจ)'
        )
        setTimeout(() => setAdminNotice(null), 5000)
      }
    } catch (err) {
      setAdminNotice(`เกิดข้อผิดพลาด: ${(err as Error).message}`)
    } finally {
      setPolicyLoading(false)
    }
  }

  // Toggle Hospital PIN Policy
  const handleTogglePinPolicy = async () => {
    const nextVal = enforcePinPolicy === 'Y' ? 'N' : 'Y'
    setPinPolicyLoading(true)
    try {
      const res = await fetch('/api/admin/pin-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enforce_pin_lock: nextVal,
          default_auto_lock_minutes: defaultHospitalMinutes,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEnforcePinPolicy(nextVal)
        setAdminNotice(
          nextVal === 'Y'
            ? `บันทึกนโยบายแล้ว: บังคับใช้ PIN Auto-Lock ทุกคน (ตั้งเวลา ${defaultHospitalMinutes} นาที)`
            : 'บันทึกนโยบายแล้ว: เปลี่ยนเป็นโหมดไม่บังคับ PIN Lock'
        )
        setTimeout(() => setAdminNotice(null), 5000)
      }
    } catch (err) {
      setAdminNotice(`เกิดข้อผิดพลาด: ${(err as Error).message}`)
    } finally {
      setPinPolicyLoading(false)
    }
  }

  // Save Hospital Default Minutes
  const handleSaveHospitalDefaultMinutes = async (minutes: number) => {
    setDefaultHospitalMinutes(minutes)
    try {
      await fetch('/api/admin/pin-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enforce_pin_lock: enforcePinPolicy,
          default_auto_lock_minutes: minutes,
        }),
      })
      setAdminNotice(`อัปเดตระยะเวลาล็อกอัตโนมัติกลางเป็น ${minutes} นาทีแล้ว`)
      setTimeout(() => setAdminNotice(null), 4000)
    } catch (_) {}
  }

  // 2FA Handlers
  const handleStartSetup = async () => {
    if (!user) return
    setMyError(null)
    setIsSettingUp(true)
    try {
      const data = await init2FASetup(user.loginname)
      setSetupData(data)
    } catch (err) {
      setMyError((err as Error).message)
      setIsSettingUp(false)
    }
  }

  const handleConfirmSetup = async (codeOverride?: string) => {
    const targetCode = (codeOverride ?? verifyCode).trim()
    if (!user || !setupData || !targetCode) return
    setMyError(null)
    try {
      const res = await confirm2FASetup(user.loginname, setupData.secret, targetCode, user)
      if (!res.success) {
        setMyError(res.error || 'รหัสไม่ถูกต้อง')
        return
      }
      setBackupCodes(res.backupCodes || [])
      setMySuccess('เปิดใช้งาน 2FA สำเร็จเรียบร้อยแล้ว!')
      setIsSettingUp(false)
      fetchUsers()
    } catch (err) {
      setMyError((err as Error).message)
    }
  }

  const handleDisable2FA = async () => {
    if (!user) return
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการปิดการใช้งานการยืนยัน 2 ขั้นตอน (2FA)?')) return
    setMyError(null)
    try {
      const res = await disable2FA(user.loginname)
      if (!res.success) {
        setMyError(res.error || 'ไม่สามารถปิดได้')
        return
      }
      setMySuccess('ปิดการใช้งาน 2FA เรียบร้อยแล้ว')
      setSetupData(null)
      fetchUsers()
    } catch (err) {
      setMyError((err as Error).message)
    }
  }

  // PIN Handlers
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinError(null)
    setPinSuccess(null)

    if (pinInput.length < 4 || pinInput.length > 8) {
      setPinError('รหัส PIN ต้องมีความยาว 4 - 8 หลัก')
      return
    }
    if (!/^\d+$/.test(pinInput)) {
      setPinError('รหัส PIN ต้องประกอบด้วยตัวเลขเท่านั้น')
      return
    }
    if (pinInput !== confirmPinInput) {
      setPinError('รหัส PIN ทั้งสองช่องไม่ตรงกัน')
      return
    }

    setPinLoading(true)
    const res = await setupPin(pinInput, selectedMinutes)
    setPinLoading(false)

    if (!res.success) {
      setPinError(res.error || 'ตั้งรหัส PIN ไม่สำเร็จ')
    } else {
      setPinSuccess('ตั้งรหัส PIN และบันทึกระยะเวลาล็อกหน้าจอสำเร็จแล้ว!')
      setPinInput('')
      setConfirmPinInput('')
      fetchUsers()
    }
  }

  const handleDisablePinLock = async () => {
    if (!confirm('คุณต้องการปิดการใช้งานระบบ PIN Lock หรือไม่?')) return
    setPinLoading(true)
    const res = await disablePin()
    setPinLoading(false)
    if (!res.success) {
      setPinError(res.error || 'ปิด PIN ไม่สำเร็จ')
    } else {
      setPinSuccess('ปิดการใช้งานระบบ PIN Lock เรียบร้อยแล้ว')
      fetchUsers()
    }
  }

  const handleUpdateAutoLockTime = async (minutes: number) => {
    setSelectedMinutes(minutes)
    if (hasPin) {
      await updatePinSettings(pinEnabled, minutes)
      setPinSuccess(`ปรับระยะเวลาล็อกอัตโนมัติเป็น ${minutes} นาทีแล้ว`)
      setTimeout(() => setPinSuccess(null), 3000)
    }
  }

  // Admin Reset User 2FA
  const handleResetUser2FA = async (targetLogin: string) => {
    if (!confirm(`ยืนยันการรีเซ็ต 2FA ให้กับผู้ใช้ "${targetLogin}" หรือไม่? ผู้ใช้จะต้องเริ่มสแกน QR ใหม่`)) return
    setResettingUser(targetLogin)
    try {
      const res = await fetch('/api/admin/reset-user-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginname: targetLogin }),
      })
      const data = await res.json()
      if (data.success) {
        setAdminNotice(`รีเซ็ต 2FA ให้ผู้ใช้ ${targetLogin} สำเร็จแล้ว`)
        fetchUsers()
        setTimeout(() => setAdminNotice(null), 5000)
      } else {
        setAdminNotice(`ข้อผิดพลาด: ${data.error}`)
      }
    } catch (err) {
      setAdminNotice(`ข้อผิดพลาด: ${(err as Error).message}`)
    } finally {
      setResettingUser(null)
    }
  }

  // Admin Reset User PIN
  const handleResetUserPin = async (targetLogin: string) => {
    if (!confirm(`ยืนยันการรีเซ็ตรหัส PIN ให้กับผู้ใช้ "${targetLogin}" หรือไม่?`)) return
    setResettingPinUser(targetLogin)
    try {
      const res = await fetch('/api/admin/reset-user-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginname: targetLogin }),
      })
      const data = await res.json()
      if (data.success) {
        setAdminNotice(`รีเซ็ตรหัส PIN ให้ผู้ใช้ ${targetLogin} เรียบร้อยแล้ว`)
        fetchUsers()
        setTimeout(() => setAdminNotice(null), 5000)
      } else {
        setAdminNotice(`ข้อผิดพลาด: ${data.error}`)
      }
    } catch (err) {
      setAdminNotice(`ข้อผิดพลาด: ${(err as Error).message}`)
    } finally {
      setResettingPinUser(null)
    }
  }

  // Filtered users for staff directory
  const filteredUsers = useMemo(() => {
    const list = Array.isArray(usersList) ? usersList : []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (u) =>
        (u?.loginname && u.loginname.toLowerCase().includes(q)) ||
        (u?.name && u.name.toLowerCase().includes(q)) ||
        (u?.groupname && u.groupname.toLowerCase().includes(q))
    )
  }, [usersList, searchQuery])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 flex flex-col z-10 overflow-hidden text-white animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800/80 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="grid place-items-center size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 shadow-sm shrink-0">
              <ShieldCheck className="size-5.5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                ศูนย์ตั้งค่าความปลอดภัย
              </h2>
              <p className="text-xs text-slate-400 font-normal mt-0.5">
                ยืนยันตัวตน 2FA • PIN ล็อกหน้าจอ • นโยบายคุ้มครองข้อมูลผู้ป่วย
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modern Segmented Tab Bar */}
        <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/50 shrink-0">
          <div className="flex p-1 rounded-xl bg-slate-950 border border-slate-800/80 gap-1 overflow-x-auto">
            {/* Tab: Profile */}
            <button
              type="button"
              onClick={() => setActiveTab('my_profile')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'my_profile'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              )}
            >
              <UserIcon className={cn('size-3.5', activeTab === 'my_profile' ? 'text-teal-400' : 'text-slate-400')} />
              <span>โปรไฟล์</span>
            </button>

            {/* Tab 1: 2FA */}
            <button
              type="button"
              onClick={() => setActiveTab('my_2fa')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'my_2fa'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              )}
            >
              <Smartphone className={cn('size-3.5', activeTab === 'my_2fa' ? 'text-emerald-400' : 'text-slate-400')} />
              <span>2FA ของฉัน</span>
              {user?.two_factor_enabled && (
                <span className="size-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            {/* Tab 2: PIN Lock */}
            <button
              type="button"
              onClick={() => setActiveTab('my_pin')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'my_pin'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              )}
            >
              <Lock className={cn('size-3.5', activeTab === 'my_pin' ? 'text-teal-400' : 'text-slate-400')} />
              <span>รหัส PIN & ล็อกอัตโนมัติ</span>
              {hasPin && (
                <span className="size-1.5 rounded-full bg-teal-400" />
              )}
            </button>

            {/* Tab 3: Admin Policy (Admin / IT only) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin_policy')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap',
                  activeTab === 'admin_policy'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                )}
              >
                <Users className={cn('size-3.5', activeTab === 'admin_policy' ? 'text-amber-400' : 'text-slate-400')} />
                <span>นโยบายโรงพยาบาล</span>
                {(enforcePolicy === 'Y' || enforcePinPolicy === 'Y') && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    บังคับใช้
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* ========================================================= */}
          {/* TAB: PROFILE PHOTO                                        */}
          {/* ========================================================= */}
          {activeTab === 'my_profile' && (
            <div className="space-y-5">
              {avatarError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium flex items-center gap-2 shadow-xs">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span>{avatarError}</span>
                </div>
              )}
              {avatarSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium flex items-center gap-2 shadow-xs">
                  <Check className="size-4 shrink-0 text-emerald-400" />
                  <span>{avatarSuccess}</span>
                </div>
              )}

              {/* Profile Card matching Hospital UI */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col sm:flex-row items-center sm:items-start gap-5 shadow-lg">
                <div className="relative group shrink-0">
                  <div className="size-24 sm:size-26 rounded-full overflow-hidden border-2 border-teal-500/40 bg-gradient-to-br from-blue-700/40 via-teal-700/30 to-slate-900 grid place-items-center shadow-xl">
                    {(avatarPreviewUrl || user?.avatar_url) ? (
                      <img
                        src={avatarPreviewUrl || user?.avatar_url || ''}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserIcon className="size-12 text-slate-400" />
                    )}
                  </div>
                  <label
                    htmlFor="avatar-modal-input"
                    className="absolute bottom-0 right-0 size-8 sm:size-8.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg grid place-items-center cursor-pointer transition-transform hover:scale-110 border-2 border-slate-900"
                    title="คลิกเพื่อเลือกรูปภาพประจำตัว"
                  >
                    <Camera className="size-4" />
                  </label>
                  <input
                    id="avatar-modal-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleAvatarFileSelect}
                  />
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {user?.name || 'นายเอกพล อันคำวงค์'}
                  </h3>
                  <div className="text-xs text-teal-400 font-medium">
                    {user?.position || user?.entryposition || user?.groupname || 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ'}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    @{user?.loginname} • สิทธิ์ {user?.groupname || 'ผู้ดูแลระบบ (IT)'}
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
                        user?.two_factor_enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      )}
                    >
                      <ShieldCheck className="size-3.5" />
                      {user?.two_factor_enabled ? '2FA: เปิดใช้งาน' : '2FA: ยังไม่เปิด'}
                    </span>

                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
                        hasPin && pinEnabled
                          ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      )}
                    >
                      <Lock className="size-3.5" />
                      {hasPin && pinEnabled ? `PIN: เปิดใช้งาน - ${autoLockMinutes} น.` : hasPin ? 'PIN: ปิดชั่วคราว' : 'PIN: ยังไม่ตั้ง'}
                    </span>

                    {user?.avatar_url && (
                      <button
                        type="button"
                        onClick={handleDeleteAvatar}
                        disabled={isAvatarProcessing}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/25 transition cursor-pointer"
                        title="ลบรูปภาพประจำตัว"
                      >
                        <Trash2 className="size-3" />
                        <span>ลบรูป</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons if new image chosen */}
              {selectedAvatarBase64 && (
                <div className="p-3.5 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-between gap-3 animate-fade-in shadow-md">
                  <div className="text-xs text-purple-200 flex items-center gap-2">
                    <Sparkles className="size-4 text-purple-400 shrink-0" />
                    <span>เลือกรูปภาพเรียบร้อยแล้ว กดปุ่ม <strong>บันทึกรูปโปรไฟล์</strong> เพื่อจัดเก็บลงฐานข้อมูล</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAvatarBase64(null)
                        setAvatarPreviewUrl(null)
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAvatar}
                      disabled={isAvatarProcessing}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md transition cursor-pointer disabled:opacity-50"
                    >
                      {isAvatarProcessing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      <span>บันทึกรูปโปรไฟล์</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Read-only notice */}
              <div className="text-[11.5px] text-slate-400 px-1 select-none">
                ชื่อ ตำแหน่ง และรหัสผ่านมาจาก HOSxP — แก้ไขที่ HOSxP (ระบบนี้อ่านอย่างเดียว ไม่แตะตาราง opduser / doctor)
              </div>

              {/* Active Device Box */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5 shadow-sm">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>อุปกรณ์ที่เข้าระบบอยู่ (1)</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                  <div className="flex items-center gap-3">
                    <Monitor className="size-5 text-slate-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>Chrome • Windows</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          เครื่องนี้
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {window.location.hostname} • เข้าระบบวันนี้
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: MY 2FA                                             */}
          {/* ========================================================= */}
          {activeTab === 'my_2fa' && (
            <div className="space-y-5">
              {myError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium flex items-center gap-2 shadow-xs">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span>{myError}</span>
                </div>
              )}
              {mySuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium flex items-center gap-2 shadow-xs">
                  <Check className="size-4 shrink-0 text-emerald-400" />
                  <span>{mySuccess}</span>
                </div>
              )}

              {/* Status Banner */}
              <div
                className={cn(
                  'rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-xs',
                  user?.two_factor_enabled
                    ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-100'
                    : 'bg-slate-900/60 border-slate-800 text-slate-200'
                )}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={cn(
                      'grid place-items-center size-11 rounded-xl shrink-0 shadow-xs',
                      user?.two_factor_enabled
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800/80 text-slate-300 border border-slate-700/60'
                    )}
                  >
                    <Smartphone className="size-5.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">
                        สถานะ 2FA: {user?.two_factor_enabled ? 'เปิดใช้งานแล้ว (Protected)' : 'ยังไม่ได้เปิดใช้งาน'}
                      </h3>
                      {user?.two_factor_enabled && (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {user?.two_factor_enabled
                        ? 'บัญชีของคุณได้รับการปกป้องด้วยรหัสผ่านแบบ 2 ขั้นตอน (Google/Microsoft Authenticator) เรียบร้อยแล้ว'
                        : 'เพิ่มความปลอดภัยให้บัญชีของคุณด้วยการยืนยันผ่านแอปพลิเคชัน Google Authenticator หรือ Microsoft Authenticator'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {user?.two_factor_enabled ? (
                    <button
                      type="button"
                      onClick={handleDisable2FA}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                    >
                      ปิดการใช้งาน 2FA
                    </button>
                  ) : (
                    !isSettingUp && (
                      <button
                        type="button"
                        onClick={handleStartSetup}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/40 active:scale-95 transition-all cursor-pointer"
                      >
                        เริ่มตั้งค่า 2FA ทันที
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* 2FA Setup Flow */}
              {isSettingUp && setupData && (
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <KeyRound className="size-4 text-emerald-400" />
                      <span>ขั้นตอนการผูก 2FA กับสมาร์ตโฟน</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsSettingUp(false)}
                      className="text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="flex flex-col items-center p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
                      <p className="text-xs font-medium text-slate-300 mb-3">1. สแกน QR Code ด้วย Authenticator App</p>
                      <div className="p-3 bg-white rounded-xl shadow-md">
                        <img src={setupData.qrUrl} alt="2FA QR Code" className="size-44" />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-3 font-normal">Google Authenticator • Microsoft Authenticator</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-slate-300 mb-1.5">หรือกรอกรหัสลับด้วยตนเอง (Manual Key):</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs font-semibold text-emerald-400 break-all select-all">
                            {setupData.secret}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(setupData.secret, 'key')}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer"
                            title="คัดลอกรหัสลับ"
                          >
                            {copiedKey ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          2. กรอกรหัส 6 หลักจากแอปพลิเคชันเพื่อยืนยัน:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={verifyCode}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                              setVerifyCode(digits)
                              if (digits.length === 6) {
                                handleConfirmSetup(digits)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleConfirmSetup()
                              }
                            }}
                            placeholder="000000"
                            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono text-xl font-bold tracking-widest text-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmSetup()}
                            disabled={verifyCode.length !== 6}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-50 transition cursor-pointer shadow-sm active:scale-95"
                          >
                            เปิดใช้งาน
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency Backup Codes Card */}
              {backupCodes.length > 0 && (
                <div className="rounded-2xl bg-amber-950/20 border border-amber-500/25 p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                      <Shield className="size-4" />
                      <span>รหัสกู้คืนฉุกเฉิน (Emergency Backup Codes)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition border border-amber-500/25 cursor-pointer"
                    >
                      {copiedBackup ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      <span>{copiedBackup ? 'คัดลอกแล้ว' : 'คัดลอกทั้งหมด'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-normal">
                    โปรดบันทึกรหัสชุดนี้ไว้ในที่ปลอดภัย ใช้สำหรับเข้าสู่ระบบเมื่อไม่สามารถดูรหัสจากโทรศัพท์ได้ (แต่ละรหัสใช้ได้ครั้งเดียว)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {backupCodes.map((c, i) => (
                      <div key={i} className="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/20 font-mono font-bold text-center text-xs text-amber-300 shadow-inner">
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: MY PIN & INACTIVITY AUTO-LOCK                     */}
          {/* ========================================================= */}
          {activeTab === 'my_pin' && (
            <div className="space-y-5">
              {pinError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium flex items-center gap-2 shadow-xs">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span>{pinError}</span>
                </div>
              )}
              {pinSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium flex items-center gap-2 shadow-xs">
                  <Check className="size-4 shrink-0 text-emerald-400" />
                  <span>{pinSuccess}</span>
                </div>
              )}

              {/* Status & Quick Lock Banner */}
              <div
                className={cn(
                  'rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-xs',
                  hasPin && pinEnabled
                    ? 'bg-teal-950/20 border-teal-500/30 text-teal-100'
                    : 'bg-slate-900/60 border-slate-800 text-slate-200'
                )}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={cn(
                      'grid place-items-center size-11 rounded-xl shrink-0 shadow-xs',
                      hasPin && pinEnabled
                        ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                        : 'bg-slate-800/80 text-slate-300 border border-slate-700/60'
                    )}
                  >
                    <Lock className="size-5.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">
                        ระบบล็อกหน้าจอด้วย PIN:{' '}
                        {hasPin && pinEnabled
                          ? `เปิดใช้งานแล้ว (${selectedMinutes} นาที)`
                          : hasPin
                          ? 'มีรหัส PIN แล้ว (ปิดชั่วคราว)'
                          : 'ยังไม่ได้ตั้งรหัส PIN'}
                      </h3>
                      {hasPin && pinEnabled && (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                          Active
                        </span>
                      )}
                      {isPinEnforced && (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          รพ. บังคับใช้
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      เมื่อไม่มีการขยับเมาส์หรือแป้นพิมพ์ครบ {selectedMinutes} นาที หน้าจอจะล็อกอัตโนมัติและเบลอข้อมูลผู้ป่วยทันทีเพื่อคุ้มครองข้อมูลเวชระเบียน (PDPA)
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {hasPin && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        setTimeout(lockNow, 150)
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-450 text-slate-950 transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                      title="กดล็อกหน้าจอเพื่อทดสอบ"
                    >
                      <Lock className="size-3.5" />
                      <span>ล็อกทันที (Ctrl+L)</span>
                    </button>
                  )}
                  {hasPin && !isPinEnforced && (
                    <button
                      type="button"
                      onClick={handleDisablePinLock}
                      disabled={pinLoading}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                    >
                      ปิดการใช้ PIN
                    </button>
                  )}
                </div>
              </div>

              {/* Inactivity Timer Selector Card */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    ระยะเวลาล็อกหน้าจออัตโนมัติเมื่อไม่ได้ใช้งาน (Auto-Lock Inactivity Time)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {lockIntervals.map((item) => {
                    const isSelected = selectedMinutes === item.minutes
                    return (
                      <button
                        key={item.minutes}
                        type="button"
                        onClick={() => handleUpdateAutoLockTime(item.minutes)}
                        className={cn(
                          'p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5',
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-xs ring-1 ring-emerald-500/20'
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800/40 hover:border-slate-700'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white">{item.label}</span>
                          {isSelected && <CheckCircle2 className="size-4 text-emerald-400" />}
                        </div>
                        <span className={cn('text-xs leading-tight', isSelected ? 'text-emerald-300/90 font-medium' : 'text-slate-400')}>
                          {item.hint}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                    <Info className="size-4 text-amber-400" />
                    <span>คำแนะนำมาตรฐานสากล (Clinical Workflow Security):</span>
                  </div>
                  <p className="leading-relaxed">
                    • <strong className="text-white">3 - 5 นาที:</strong> เหมาะสมที่สุดสำหรับโรงพยาบาล จุดจ่ายยา และห้องตรวจคนไข้ (ไม่รบกวนแพทย์ตอนตรวจ และป้องกันคนไข้แอบดูจอ)
                  </p>
                  <p className="leading-relaxed">
                    • <strong className="text-white">คีย์ลัดด่วน:</strong> สามารถกด <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono font-medium text-amber-200">Ctrl + L</kbd> หรือ <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono font-medium text-amber-200">Alt + L</kbd> เพื่อล็อกหน้าจอทันทีก่อนลุกจากโต๊ะได้ทุกเมื่อ
                  </p>
                </div>
              </div>

              {/* Set / Change PIN Form */}
              <form onSubmit={handleSavePin} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    {hasPin ? 'เปลี่ยนรหัส PIN ใหม่ (Change PIN)' : 'ตั้งรหัส PIN ใหม่ (Setup PIN)'}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      รหัส PIN ใหม่ (ตัวเลข 4-8 หลัก)
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="เช่น 1234 หรือ 987654"
                      required
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white font-mono text-center tracking-widest text-lg font-bold placeholder:text-slate-500 placeholder:text-xs placeholder:tracking-normal placeholder:font-sans focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 shadow-inner transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      ยืนยันรหัส PIN อีกครั้ง
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="ยืนยันรหัส PIN อีกครั้ง..."
                      required
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white font-mono text-center tracking-widest text-lg font-bold placeholder:text-slate-500 placeholder:text-xs placeholder:tracking-normal placeholder:font-sans focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 shadow-inner transition"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="submit"
                    disabled={pinLoading || pinInput.length < 4 || pinInput !== confirmPinInput}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-50 transition cursor-pointer shadow-md shadow-emerald-950/40 active:scale-95 disabled:active:scale-100 flex items-center gap-2"
                  >
                    {pinLoading && <Loader2 className="size-4 animate-spin" />}
                    <span>{hasPin ? 'บันทึกรหัส PIN ใหม่' : 'เปิดใช้งาน PIN Lock'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: ADMIN HOSPITAL POLICY & USER DIRECTORY             */}
          {/* ========================================================= */}
          {activeTab === 'admin_policy' && isAdmin && (
            <div className="space-y-5">
              {adminNotice && (
                <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-200 text-xs font-medium flex items-center gap-2 animate-in fade-in shadow-xs">
                  <Info className="size-4 shrink-0 text-teal-400" />
                  <span>{adminNotice}</span>
                </div>
              )}

              {/* Policy Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Policy 1: 2FA Enforcement */}
                <div
                  className={cn(
                    'rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all shadow-xs',
                    enforcePolicy === 'Y'
                      ? 'bg-amber-950/20 border-amber-500/35'
                      : 'bg-slate-900/60 border-slate-800'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={cn(
                          'grid place-items-center size-10 rounded-xl shrink-0 shadow-xs border',
                          enforcePolicy === 'Y'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                            : 'bg-slate-800/80 border-slate-700/60 text-slate-400'
                        )}
                      >
                        <Smartphone className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white">บังคับใช้ 2FA ทั้งโรงพยาบาล</h3>
                          {enforcePolicy === 'Y' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Enforced
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {enforcePolicy === 'Y'
                            ? 'เจ้าหน้าที่ทุกคนต้องตั้งค่าและยืนยันรหัส OTP 2FA ก่อนเข้าสู่ระบบเวชระเบียน'
                            : 'ให้เจ้าหน้าที่แต่ละท่านเลือกเปิดหรือปิดใช้งาน 2FA ได้ตามความสะดวก'}
                        </p>
                      </div>
                    </div>

                    {/* Modern Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enforcePolicy === 'Y'}
                      disabled={policyLoading}
                      onClick={handleTogglePolicy}
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 mt-0.5',
                        enforcePolicy === 'Y' ? 'bg-amber-500' : 'bg-slate-800'
                      )}
                      title={enforcePolicy === 'Y' ? 'คลิกเพื่อปิดโหมดบังคับ' : 'คลิกเพื่อเปิดโหมดบังคับ'}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                          enforcePolicy === 'Y' ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Policy 2: PIN Auto-Lock Enforcement */}
                <div
                  className={cn(
                    'rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all shadow-xs',
                    enforcePinPolicy === 'Y'
                      ? 'bg-amber-950/20 border-amber-500/35'
                      : 'bg-slate-900/60 border-slate-800'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={cn(
                          'grid place-items-center size-10 rounded-xl shrink-0 shadow-xs border',
                          enforcePinPolicy === 'Y'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                            : 'bg-slate-800/80 border-slate-700/60 text-slate-400'
                        )}
                      >
                        <Lock className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white">บังคับใช้ PIN Auto-Lock ทุกคน</h3>
                          {enforcePinPolicy === 'Y' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Enforced ({defaultHospitalMinutes}น.)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {enforcePinPolicy === 'Y'
                            ? `ทุกเครื่องจะถูกล็อกหน้าจออัตโนมัติเมื่อไม่ขยับเมาส์ครบ ${defaultHospitalMinutes} นาที`
                            : 'ให้ผู้ใช้แต่ละท่านกำหนดระยะเวลาล็อกหน้าจอและเปิด-ปิด PIN เอง'}
                        </p>
                      </div>
                    </div>

                    {/* Modern Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enforcePinPolicy === 'Y'}
                      disabled={pinPolicyLoading}
                      onClick={handleTogglePinPolicy}
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 mt-0.5',
                        enforcePinPolicy === 'Y' ? 'bg-amber-500' : 'bg-slate-800'
                      )}
                      title={enforcePinPolicy === 'Y' ? 'คลิกเพื่อปิดโหมดบังคับ' : 'คลิกเพื่อเปิดโหมดบังคับ'}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                          enforcePinPolicy === 'Y' ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>

                  {enforcePinPolicy === 'Y' && (
                    <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between gap-2">
                      <span className="text-xs text-amber-200/90 font-medium">ระยะเวลาล็อกกลางของโรงพยาบาล:</span>
                      <select
                        value={defaultHospitalMinutes}
                        onChange={(e) => handleSaveHospitalDefaultMinutes(Number(e.target.value))}
                        className="h-8.5 px-3 rounded-lg bg-slate-950 border border-amber-500/30 text-xs font-bold text-amber-300 shadow-inner focus:border-amber-400 focus:outline-hidden cursor-pointer"
                      >
                        <option value={1}>1 นาที (จุดบริการหนาแน่น)</option>
                        <option value={3}>3 นาที (ห้องตรวจ/ห้องยา)</option>
                        <option value={5}>5 นาที (มาตรฐานสากล)</option>
                        <option value={10}>10 นาที (สำนักงาน)</option>
                        <option value={15}>15 นาที</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff Directory Table */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="grid place-items-center size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 shrink-0">
                      <Users className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">รายชื่อบุคลากรและสถานะความปลอดภัย</span>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-800/80 text-emerald-400 border border-slate-700/60 font-mono">
                      {filteredUsers.length.toLocaleString()} คน
                    </span>
                  </div>

                  {/* Search Bar with Clear Button */}
                  <div className="relative w-full sm:w-72">
                    <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาชื่อ, username, ตำแหน่ง…"
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/15 transition shadow-inner"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-md hover:bg-slate-800 transition cursor-pointer"
                        title="ล้างคำค้นหา"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table Container */}
                <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/60 shadow-sm">
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                      <thead className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="py-3 px-4 w-[120px] whitespace-nowrap">Username</th>
                          <th className="py-3 px-4 min-w-[200px] whitespace-nowrap">ชื่อ-นามสกุล</th>
                          <th className="py-3 px-4 min-w-[140px] whitespace-nowrap">กลุ่มงาน/ตำแหน่ง</th>
                          <th className="py-3 px-3 text-center w-[110px] whitespace-nowrap">2FA</th>
                          <th className="py-3 px-3 text-center w-[130px] whitespace-nowrap">PIN Lock</th>
                          <th className="py-3 px-4 text-right w-[140px] whitespace-nowrap">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {usersLoading ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              <Loader2 className="size-5 animate-spin mx-auto mb-2 text-emerald-400" />
                              กำลังโหลดรายชื่อผู้ใช้จาก HOSxP…
                            </td>
                          </tr>
                        ) : filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                              {searchQuery ? `ไม่พบรายชื่อที่ตรงกับ "${searchQuery}"` : 'ไม่พบข้อมูลบุคลากร'}
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((u) => (
                            <tr key={u.loginname} className="hover:bg-slate-800/35 transition-colors h-11">
                              <td className="py-2 px-4 font-mono font-semibold text-emerald-400 tracking-wide text-xs whitespace-nowrap align-middle">
                                {u.loginname}
                              </td>
                              <td className="py-2 px-4 font-medium text-slate-100 text-xs whitespace-nowrap align-middle">
                                {u.name}
                              </td>
                              <td className="py-2 px-4 text-slate-300 text-xs whitespace-nowrap align-middle">
                                <div className="font-medium text-slate-200" title={u.entryposition || u.position || ''}>
                                  {u.position || u.entryposition || u.groupname || '-'}
                                </div>
                                {u.position && u.groupname && u.position !== u.groupname && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    สิทธิ์: {u.groupname}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center align-middle">
                                {u.two_factor_enabled ? (
                                  <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 whitespace-nowrap">
                                    <Check className="size-3" /> เปิด
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-900/80 text-slate-400 border border-slate-800 whitespace-nowrap">
                                    ยังไม่เปิด
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center align-middle">
                                {u.has_pin ? (
                                  <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/25 whitespace-nowrap">
                                    <Lock className="size-3" /> มี PIN ({u.auto_lock_minutes ?? 5}น.)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-900/80 text-slate-400 border border-slate-800 whitespace-nowrap">
                                    ไม่มี
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-4 text-right align-middle">
                                {u.two_factor_enabled || u.has_pin ? (
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    {u.two_factor_enabled && (
                                      <button
                                        type="button"
                                        disabled={resettingUser === u.loginname}
                                        onClick={() => handleResetUser2FA(u.loginname)}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
                                        title="รีเซ็ต 2FA เมื่อผู้ใช้ทำโทรศัพท์หาย"
                                      >
                                        {resettingUser === u.loginname ? (
                                          <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                          <RotateCcw className="size-3" />
                                        )}
                                        <span>รีเซ็ต 2FA</span>
                                      </button>
                                    )}

                                    {u.has_pin && (
                                      <button
                                        type="button"
                                        disabled={resettingPinUser === u.loginname}
                                        onClick={() => handleResetUserPin(u.loginname)}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
                                        title="รีเซ็ต PIN เมื่อลืมรหัส"
                                      >
                                        {resettingPinUser === u.loginname ? (
                                          <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                          <KeyRound className="size-3" />
                                        )}
                                        <span>รีเซ็ต PIN</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-600 text-xs select-none pr-2">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950 shrink-0 text-xs">
          <div className="text-slate-400 font-normal">
            PIN/2FA เก็บในฐาน dw_hd-check เท่านั้น — ไม่แตะฐาน HOSxP
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition cursor-pointer shadow-sm"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
