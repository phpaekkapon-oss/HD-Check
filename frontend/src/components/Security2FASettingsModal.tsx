import { useState, useEffect, useMemo, useRef, type FC } from 'react'
import {
  ListChecks,
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
  Monitor,
  Cpu,
  Fingerprint,
  ExternalLink,
  RefreshCw,
  Database,
  Bell,
  ChevronDown,
  Activity,
  Pill,
  Bot,
  FileText,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePinLock } from '@/context/PinLockContext'
import { isAdminUser, type TotpSetupData, type User2FAAdminItem, type PinPolicy } from '@/types/auth.types'
import { cn } from '@/lib/utils'
import { PaginationBar } from '@/components/PaginationBar'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { usePagination } from '@/hooks/usePagination'
import { ProfileAvatarModal } from './ProfileAvatarModal'
import { SsoSettingsPanel } from './SsoSettingsPanel'
import { MenuPermissionsPanel } from './MenuPermissionsPanel'
import { ConfirmModal, type ConfirmModalProps } from './ConfirmModal'

interface Security2FASettingsModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly initialTab?: 'my_profile' | 'my_2fa' | 'my_pin' | 'admin_policy' | 'admin_system' | 'admin_sso' | 'admin_menus'
  readonly onOpenChangelog?: () => void
}

const lockIntervals = [
  { minutes: 1, label: '1 นาที', tag: 'ปลอดภัยสูงสุด', desc: 'จุดบริการคนไข้หนาแน่น' },
  { minutes: 3, label: '3 นาที', tag: 'แนะนำจุดตรวจ', desc: 'ห้องตรวจ OPD / ห้องยา' },
  { minutes: 5, label: '5 นาที', tag: 'มาตรฐานสากล', desc: 'เวชระเบียน / คลินิกทั่วไป' },
  { minutes: 10, label: '10 นาที', tag: 'งานธุรการ', desc: 'ห้องทำงานส่วนตัว' },
  { minutes: 15, label: '15 นาที', tag: 'สูงสุด (Auto-Logout)', desc: 'ดีดออกไปหน้า Login' },
]

export const Security2FASettingsModal: FC<Security2FASettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'my_profile',
  onOpenChangelog,
}) => {
  const { user, init2FASetup, confirm2FASetup, disable2FA, deleteAvatar } = useAuth()
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

  const [activeTab, setActiveTab] = useState<'my_profile' | 'my_2fa' | 'my_pin' | 'admin_policy' | 'admin_system' | 'admin_sso' | 'admin_menus'>(() => {
    if ((initialTab === 'admin_policy' || initialTab === 'admin_system' || initialTab === 'admin_sso' || initialTab === 'admin_menus') && !isAdmin) return 'my_profile'
    return initialTab
  })

  // Admin System Tab States
  const [sysStatus, setSysStatus] = useState<any>(null)
  const [isSysStatusLoading, setIsSysStatusLoading] = useState(false)
  const [isManualSyncing, setIsManualSyncing] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<{ text: string; isError?: boolean } | null>(null)
  const [notifyEnabled, setNotifyEnabled] = useState(() => {
    try {
      return localStorage.getItem('hd_check_notify_enabled') !== 'false'
    } catch {
      return true
    }
  })

  const fetchSysStatus = async () => {
    setIsSysStatusLoading(true)
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      setSysStatus(data)
    } catch (err) {
      console.error('Failed to fetch system status', err)
    } finally {
      setIsSysStatusLoading(false)
    }
  }

  const handleTriggerManualSync = async () => {
    setIsManualSyncing(true)
    setSyncFeedback(null)
    try {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const lastDay = new Date(y, Number(m), 0).getDate()
      const startDate = `${y}-${m}-01`
      const endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      })
      const data = await res.json()
      if (data.success !== false) {
        setSyncFeedback({ text: `ซิงค์ข้อมูล HOSxP สำเร็จ: ${data.totalPrescriptions ?? 0} รายการ (${data.durationMs ?? 0} ms)` })
        fetchSysStatus()
      } else {
        setSyncFeedback({ text: data.error || 'ซิงค์ข้อมูลไม่สำเร็จ', isError: true })
      }
    } catch (err) {
      setSyncFeedback({ text: `เกิดข้อผิดพลาด: ${(err as Error).message}`, isError: true })
    } finally {
      setIsManualSyncing(false)
    }
  }

  const handleToggleNotify = () => {
    const next = !notifyEnabled
    setNotifyEnabled(next)
    try {
      localStorage.setItem('hd_check_notify_enabled', String(next))
    } catch {}
  }

  // GitHub Version Check
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<{ isLatest: boolean; latestTag?: string; text: string } | null>(null)

  const handleCheckGitHubUpdates = async () => {
    setIsCheckingUpdate(true)
    try {
      const res = await fetch('https://api.github.com/repos/phpaekkapon-oss/HD-Check/releases/latest')
      if (res.ok) {
        const data = await res.json()
        const latestTag = data.tag_name || ''
        const cleanLatest = latestTag.replace(/^v/, '')
        const current = __APP_VERSION__.replace(/^v/, '')

        if (cleanLatest === current) {
          setUpdateStatus({
            isLatest: true,
            latestTag,
            text: `ระบบของคุณเป็นเวอร์ชันล่าสุดแล้ว (${latestTag})`,
          })
        } else {
          setUpdateStatus({
            isLatest: false,
            latestTag,
            text: `มีเวอร์ชันใหม่บน GitHub: ${latestTag} (ปัจจุบันใช้ v${current})`,
          })
        }
      }
    } catch {
      // offline / rate limit fallback
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const prevOpenRef = useRef(false)

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      if ((initialTab === 'admin_policy' || initialTab === 'admin_system' || initialTab === 'admin_sso' || initialTab === 'admin_menus') && !isAdmin) {
        setActiveTab('my_profile')
      } else {
        setActiveTab(initialTab)
        if (initialTab === 'admin_system') {
          fetchSysStatus()
          handleCheckGitHubUpdates()
        }
      }
      setSelectedMinutes(autoLockMinutes || 5)
    }
    prevOpenRef.current = isOpen
  }, [isOpen, initialTab, isAdmin, autoLockMinutes])

  useEffect(() => {
    if (autoLockMinutes) {
      setSelectedMinutes(autoLockMinutes)
    }
  }, [autoLockMinutes])

  // Persist open modal state and tab to sessionStorage so F5 refresh restores it
  useEffect(() => {
    if (isOpen) {
      try {
        sessionStorage.setItem('hd_check_security_modal_open', 'true')
        sessionStorage.setItem('hd_check_security_modal_tab', activeTab)
      } catch {}
    }
  }, [isOpen, activeTab])

  const handleModalClose = () => {
    try {
      sessionStorage.removeItem('hd_check_security_modal_open')
      sessionStorage.removeItem('hd_check_security_modal_tab')
    } catch {}
    onClose()
  }

  // Profile Avatar cropper modal state
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [cropperFile, setCropperFile] = useState<File | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null)

  // Professional Confirm Dialog State
  const [confirmConfig, setConfirmConfig] = useState<Omit<ConfirmModalProps, 'isOpen' | 'onClose'> | null>(null)
  const [isConfirmLoading, setIsConfirmLoading] = useState(false)

  const promptConfirm = (cfg: Omit<ConfirmModalProps, 'isOpen' | 'onClose' | 'isLoading'>) => {
    setConfirmConfig(cfg)
  }

  const handleExecuteModalConfirm = async () => {
    if (!confirmConfig) return
    setIsConfirmLoading(true)
    try {
      await confirmConfig.onConfirm()
      setConfirmConfig(null)
    } finally {
      setIsConfirmLoading(false)
    }
  }

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('กรุณาเลือกไฟล์รูปภาพ (JPEG, PNG, WebP)')
      return
    }
    setAvatarError(null)
    setCropperFile(file)
    setIsCropperOpen(true)
    if (e.target) e.target.value = ''
  }

  const handleDeleteAvatar = () => {
    promptConfirm({
      title: 'ยืนยันการลบรูปภาพประจำตัว',
      description: 'คุณแน่ใจหรือไม่ว่าต้องการลบรูปภาพประจำตัวของคุณ? ระบบจะเปลี่ยนกลับไปใช้ตัวอักษรย่อชื่อเริ่มต้น',
      confirmText: 'ลบรูปภาพ',
      variant: 'danger',
      icon: 'trash',
      onConfirm: async () => {
        setAvatarError(null)
        setAvatarSuccess(null)
        const res = await deleteAvatar()
        if (!res.success) {
          setAvatarError(res.error || 'ลบรูปภาพไม่สำเร็จ')
        } else {
          setAvatarSuccess('ลบรูปภาพประจำตัวเรียบร้อยแล้ว')
          setTimeout(() => setAvatarSuccess(null), 4000)
        }
      },
    })
  }

  // My 2FA states
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null)
  const [setupNow, setSetupNow] = useState(() => Date.now())
  const [verifyCode, setVerifyCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [myError, setMyError] = useState<string | null>(null)
  const [mySuccess, setMySuccess] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedBackup, setCopiedBackup] = useState(false)
  useEffect(() => {
    if (!isSettingUp || !setupData) return
    const id = window.setInterval(() => setSetupNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isSettingUp, setupData])
  const setupSecondsLeft = setupData ? Math.max(0, Math.ceil((setupData.expiresAt - setupNow) / 1000)) : 0
  const setupExpired = isSettingUp && Boolean(setupData) && setupSecondsLeft === 0

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
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false)
  const timeDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!timeDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(e.target as Node)) {
        setTimeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [timeDropdownOpen])

  const [policyLoading, setPolicyLoading] = useState(false)
  const [pinPolicyLoading, setPinPolicyLoading] = useState(false)
  const [usersList, setUsersList] = useState<User2FAAdminItem[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [resettingUser, setResettingUser] = useState<string | null>(null)
  const [resettingPinUser, setResettingPinUser] = useState<string | null>(null)
  const [updatingAccountUser, setUpdatingAccountUser] = useState<string | null>(null)
  const [updatingAdminUser, setUpdatingAdminUser] = useState<string | null>(null)
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
        handleModalClose()
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
      } else {
        setAdminNotice(data.error || 'ไม่สามารถบันทึกนโยบายได้')
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
      } else {
        setAdminNotice(data.error || 'ไม่สามารถบันทึกนโยบาย PIN ได้')
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
    if (setupExpired) {
      setMyError('คีย์ตั้งค่า 2FA หมดอายุแล้ว กรุณายกเลิกแล้วเริ่มตั้งค่าใหม่')
      return
    }
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

  const handleDisable2FA = () => {
    if (!user) return
    promptConfirm({
      title: 'ยืนยันปิดการใช้งาน 2FA',
      description: 'คุณแน่ใจหรือไม่ว่าต้องการปิดการใช้งานการยืนยัน 2 ขั้นตอน (2FA)?',
      detail: 'การปิด 2FA จะลดระดับความปลอดภัยของบัญชีคุณ และทำให้บัญชีมีความเสี่ยงต่อการถูกเข้าถึงโดยไม่ได้รับอนุญาต',
      confirmText: 'ปิดใช้งาน 2FA',
      variant: 'danger',
      icon: 'shield-alert',
      onConfirm: async () => {
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
      },
    })
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

  const handleDisablePinLock = () => {
    promptConfirm({
      title: 'ยืนยันปิดระบบ PIN Lock',
      description: 'คุณต้องการปิดการใช้งานระบบ PIN Lock ล็อกหน้าจอหรือไม่?',
      detail: 'ระบบจะไม่ล็อกหน้าจอและไม่ถามรหัส PIN เมื่อไม่มีการใช้งานตามระยะเวลาที่กำหนด',
      confirmText: 'ปิด PIN Lock',
      variant: 'warning',
      icon: 'key',
      onConfirm: async () => {
        setPinLoading(true)
        const res = await disablePin()
        setPinLoading(false)
        if (!res.success) {
          setPinError(res.error || 'ปิด PIN ไม่สำเร็จ')
        } else {
          setPinSuccess('ปิดการใช้งานระบบ PIN Lock เรียบร้อยแล้ว')
          fetchUsers()
        }
      },
    })
  }

  const handleUpdateAutoLockTime = async (minutes: number) => {
    setSelectedMinutes(minutes)
    if (hasPin) {
      const res = await updatePinSettings(pinEnabled, minutes)
      if (res.success) {
        setPinSuccess(`ปรับระยะเวลาล็อกอัตโนมัติเป็น ${minutes} นาทีแล้ว`)
        if (isAdmin) fetchUsers()
      } else {
        setPinError(res.error || 'ไม่สามารถบันทึกการตั้งค่าได้')
      }
      setTimeout(() => {
        setPinSuccess(null)
        setPinError(null)
      }, 3000)
    }
  }

  // Admin Reset User 2FA
  const handleResetUser2FA = (targetLogin: string) => {
    const targetUserItem = usersList.find((u) => u.loginname.toLowerCase() === targetLogin.toLowerCase())
    promptConfirm({
      title: 'รีเซ็ตการยืนยันตัวตน 2FA',
      description: `ยืนยันการรีเซ็ต 2FA ให้กับผู้ใช้ "${targetLogin}" หรือไม่?`,
      detail: 'ผู้ใช้จะต้องทำการสแกน QR Code เพื่อตั้งค่า 2FA ใหม่อีกครั้งในการเข้าสู่ระบบครั้งถัดไป',
      targetUser: {
        loginname: targetLogin,
        name: targetUserItem?.name,
        role: targetUserItem?.position || targetUserItem?.groupname,
      },
      confirmText: 'รีเซ็ต 2FA',
      variant: 'warning',
      icon: 'reset',
      onConfirm: async () => {
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
      },
    })
  }

  // Admin Reset User PIN
  const handleResetUserPin = (targetLogin: string) => {
    const targetUserItem = usersList.find((u) => u.loginname.toLowerCase() === targetLogin.toLowerCase())
    promptConfirm({
      title: 'รีเซ็ตรหัส PIN ล็อกหน้าจอ',
      description: `ยืนยันการรีเซ็ตรหัส PIN ให้กับผู้ใช้ "${targetLogin}" หรือไม่?`,
      detail: 'รหัส PIN เดิมจะถูกล้าง ผู้ใช้จะต้องตั้งค่า PIN ใหม่ในการใช้งานครั้งถัดไป',
      targetUser: {
        loginname: targetLogin,
        name: targetUserItem?.name,
        role: targetUserItem?.position || targetUserItem?.groupname,
      },
      confirmText: 'รีเซ็ต PIN',
      variant: 'warning',
      icon: 'key',
      onConfirm: async () => {
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
      },
    })
  }

  const handleToggleHosxpAccount = (targetLogin: string, disabled: boolean) => {
    const action = disabled ? 'ปิด' : 'เปิด'
    const targetUserItem = usersList.find((u) => u.loginname.toLowerCase() === targetLogin.toLowerCase())
    promptConfirm({
      title: `ยืนยัน${action}บัญชีผู้ใช้ HOSxP`,
      description: `คุณต้องการ${action}การใช้งานบัญชี "${targetLogin}" ใน HOSxP ใช่หรือไม่?`,
      detail: disabled
        ? 'ผู้ใช้นี้จะไม่สามารถเข้าสู่ระบบทั้ง HOSxP และ SMART-HOSCHECK ได้จนกว่าจะเปิดใช้งานอีกครั้ง'
        : 'ผู้ใช้จะสามารถกลับเข้าสู่ระบบ HOSxP และ SMART-HOSCHECK ได้ตามปกติ',
      targetUser: {
        loginname: targetLogin,
        name: targetUserItem?.name,
        role: targetUserItem?.position || targetUserItem?.groupname,
      },
      confirmText: `${action}บัญชี`,
      variant: disabled ? 'danger' : 'primary',
      icon: disabled ? 'user-x' : 'user-check',
      onConfirm: async () => {
        setUpdatingAccountUser(targetLogin)
        try {
          const res = await fetch(`/api/admin/users/${encodeURIComponent(targetLogin)}/account-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disabled }),
          })
          const data = await res.json()
          if (data.success) {
            setAdminNotice(`${action}บัญชี HOSxP ของ ${targetLogin} เรียบร้อยแล้ว`)
            await fetchUsers()
            setTimeout(() => setAdminNotice(null), 5000)
          } else {
            setAdminNotice(`ข้อผิดพลาด: ${data.error || 'เปลี่ยนสถานะบัญชีไม่สำเร็จ'}`)
          }
        } catch (err) {
          setAdminNotice(`ข้อผิดพลาด: ${(err as Error).message}`)
        } finally {
          setUpdatingAccountUser(null)
        }
      },
    })
  }

  const handleToggleAdmin = (targetLogin: string, enabled: boolean) => {
    const action = enabled ? 'กำหนด' : 'ถอด'
    const targetUserItem = usersList.find((u) => u.loginname.toLowerCase() === targetLogin.toLowerCase())
    promptConfirm({
      title: `ยืนยัน${action}สิทธิ์ Admin`,
      description: `ยืนยัน${action}สิทธิ์ผู้ดูแลระบบ (Admin) ของบัญชี "${targetLogin}" หรือไม่?`,
      detail: enabled
        ? 'ผู้ใช้นี้จะสามารถเข้าถึงและแก้ไขการตั้งค่าระบบ ความปลอดภัย และนโยบายระดับผู้ดูแลระบบได้ทั้งหมด'
        : 'หากกลุ่มงานหรือตำแหน่งใน HOSxP ของผู้ใช้นี้ยังเข้าเงื่อนไข Admin บัญชีอาจยังมีสิทธิ์ตามเงื่อนไขหลัก',
      targetUser: {
        loginname: targetLogin,
        name: targetUserItem?.name,
        role: targetUserItem?.position || targetUserItem?.groupname,
      },
      confirmText: enabled ? 'กำหนดสิทธิ์ Admin' : 'ถอดสิทธิ์ Admin',
      variant: enabled ? 'primary' : 'danger',
      icon: enabled ? 'shield-check' : 'shield-alert',
      onConfirm: async () => {
        setUpdatingAdminUser(targetLogin)
        try {
          const res = await fetch(`/api/admin/users/${encodeURIComponent(targetLogin)}/admin-role`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled }),
          })
          const data = await res.json()
          if (data.success) {
            setAdminNotice(`${action}สิทธิ์ Admin ให้ ${targetLogin} เรียบร้อยแล้ว ผู้ใช้ต้องออกจากระบบแล้วเข้าสู่ระบบใหม่`)
            await fetchUsers()
            setTimeout(() => setAdminNotice(null), 6000)
          } else {
            setAdminNotice(`ข้อผิดพลาด: ${data.error || 'เปลี่ยนสิทธิ์ Admin ไม่สำเร็จ'}`)
          }
        } catch (err) {
          setAdminNotice(`ข้อผิดพลาด: ${(err as Error).message}`)
        } finally {
          setUpdatingAdminUser(null)
        }
      },
    })
  }

  const handleToggleThaiMedAdmin = (targetLogin: string, enabled: boolean) => {
    const action = enabled ? 'กำหนด' : 'ถอด'
    const targetUserItem = usersList.find((u) => u.loginname.toLowerCase() === targetLogin.toLowerCase())
    promptConfirm({
      title: `ยืนยัน${action}สิทธิ์ผู้ดูแลแผนไทย`,
      description: `ยืนยัน${action}สิทธิ์ผู้ดูแลแผนไทยของบัญชี "${targetLogin}" หรือไม่?`,
      detail: enabled
        ? 'ผู้ใช้นี้จะเห็นการ์ดมูลค่าบริการแผนกแพทย์แผนไทย (ประมาณการ) บนหน้าแรก โดยไม่ได้สิทธิ์ผู้ดูแลระบบอื่น'
        : 'ผู้ใช้นี้จะไม่เห็นการ์ดมูลค่าบริการบนหน้าแรกอีก',
      targetUser: {
        loginname: targetLogin,
        name: targetUserItem?.name,
        role: targetUserItem?.position || targetUserItem?.groupname,
      },
      confirmText: enabled ? 'กำหนดสิทธิ์' : 'ถอดสิทธิ์',
      variant: enabled ? 'primary' : 'danger',
      icon: enabled ? 'shield-check' : 'shield-alert',
      onConfirm: async () => {
        setUpdatingAdminUser(targetLogin)
        try {
          const res = await fetch(`/api/admin/users/${encodeURIComponent(targetLogin)}/thaimed-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled }),
          })
          const data = await res.json()
          if (data.success) {
            setAdminNotice(`${action}สิทธิ์ผู้ดูแลแผนไทยให้ ${targetLogin} เรียบร้อยแล้ว ผู้ใช้ต้องออกจากระบบแล้วเข้าสู่ระบบใหม่`)
            await fetchUsers()
            setTimeout(() => setAdminNotice(null), 6000)
          } else {
            setAdminNotice(`ข้อผิดพลาด: ${data.error || 'เปลี่ยนสิทธิ์ผู้ดูแลแผนไทยไม่สำเร็จ'}`)
          }
        } catch (err) {
          setAdminNotice(`ข้อผิดพลาด: ${(err as Error).message}`)
        } finally {
          setUpdatingAdminUser(null)
        }
      },
    })
  }

  // Role categorization helpers
  const isUserAdmin = (u: User2FAAdminItem) => {
    return Boolean(u.admin_enabled || u.effective_role === 'it' || isAdminUser(u as any))
  }
  const isUserThaiMed = (u: User2FAAdminItem) => {
    if (isUserAdmin(u)) return false
    if (u.effective_role === 'thaimed') return true
    const pos = (u.position || u.entryposition || '').toLowerCase()
    const group = (u.groupname || '').toLowerCase()
    return (
      pos.includes('แพทย์แผนไทย') ||
      pos.includes('แผนไทย') ||
      pos.includes('การแพทย์ทางเลือก') ||
      group.includes('แพทย์แผนไทย') ||
      group.includes('แผนไทย') ||
      group.includes('การแพทย์ทางเลือก')
    )
  }
  const isUserPharmacist = (u: User2FAAdminItem) => {
    if (isUserAdmin(u) || isUserThaiMed(u)) return false
    if (u.effective_role === 'pharmacist') return true
    const pos = (u.position || u.entryposition || '').toLowerCase()
    const group = (u.groupname || '').toLowerCase()
    return pos.includes('เภสัช') || group.includes('เภสัช')
  }
  const isUserDoctor = (u: User2FAAdminItem) => {
    if (isUserAdmin(u) || isUserThaiMed(u) || isUserPharmacist(u)) return false
    if (u.effective_role === 'doctor') return true
    const pos = (u.position || u.entryposition || '').toLowerCase()
    const group = (u.groupname || '').toLowerCase()
    return pos.includes('แพทย์') || pos.includes('ทันต') || group.includes('doctor')
  }

  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'thaimed' | 'pharmacist' | 'doctor' | 'general' | 'disabled'>('all')
  const [selectedLogins, setSelectedLogins] = useState<Set<string>>(new Set())
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)

  // Real-time role breakdown counts
  const roleCounts = useMemo(() => {
    const list = Array.isArray(usersList) ? usersList : []
    let admin = 0
    let thaimed = 0
    let pharmacist = 0
    let doctor = 0
    let general = 0
    let disabled = 0

    for (const u of list) {
      if (u.account_disable) disabled++
      if (isUserAdmin(u)) {
        admin++
      } else if (isUserThaiMed(u)) {
        thaimed++
      } else if (isUserPharmacist(u)) {
        pharmacist++
      } else if (isUserDoctor(u)) {
        doctor++
      } else {
        general++
      }
    }
    return {
      all: list.length,
      admin,
      thaimed,
      pharmacist,
      doctor,
      general,
      disabled,
    }
  }, [usersList])

  // Filtered users for staff directory with role tabs & search
  const filteredUsers = useMemo(() => {
    const list = Array.isArray(usersList) ? usersList : []
    const q = searchQuery.trim().toLowerCase()
    return list.filter((u) => {
      // 1. Role filter
      if (roleFilter === 'admin' && !isUserAdmin(u)) return false
      if (roleFilter === 'thaimed' && !isUserThaiMed(u)) return false
      if (roleFilter === 'pharmacist' && !isUserPharmacist(u)) return false
      if (roleFilter === 'doctor' && !isUserDoctor(u)) return false
      if (roleFilter === 'general' && (isUserAdmin(u) || isUserThaiMed(u) || isUserPharmacist(u) || isUserDoctor(u))) return false
      if (roleFilter === 'disabled' && !u.account_disable) return false

      // 2. Text search
      if (!q) return true
      return (
        (u?.loginname && u.loginname.toLowerCase().includes(q)) ||
        (u?.name && u.name.toLowerCase().includes(q)) ||
        (u?.groupname && u.groupname.toLowerCase().includes(q)) ||
        (u?.position && u.position.toLowerCase().includes(q)) ||
        (u?.entryposition && u.entryposition.toLowerCase().includes(q))
      )
    })
  }, [usersList, searchQuery, roleFilter])
  const { pageRows: pagedUsers, barProps: usersBarProps } = usePagination(filteredUsers, 25)

  // Toggle select all visible
  const allVisibleSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedLogins.has(u.loginname))
  const handleToggleSelectAll = () => {
    setSelectedLogins((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        filteredUsers.forEach((u) => next.delete(u.loginname))
      } else {
        filteredUsers.forEach((u) => next.add(u.loginname))
      }
      return next
    })
  }

  const handleToggleSelectOne = (loginname: string) => {
    setSelectedLogins((prev) => {
      const next = new Set(prev)
      if (next.has(loginname)) next.delete(loginname)
      else next.add(loginname)
      return next
    })
  }

  // Batch toggle Admin role
  const handleBatchAdminRole = (enabled: boolean) => {
    if (selectedLogins.size === 0) return
    const action = enabled ? 'กำหนดสิทธิ์ Admin' : 'ถอดสิทธิ์ Admin'
    promptConfirm({
      title: `ยืนยัน${action}แบบกลุ่ม`,
      description: `ยืนยัน${action}ให้กับผู้ใช้ที่เลือกไว้จำนวน ${selectedLogins.size} คน หรือไม่?`,
      detail: enabled
        ? 'ผู้ใช้ทั้งหมดที่เลือกจะได้รับสิทธิ์ผู้ดูแลระบบ (Admin) สามารถเข้าถึงเครื่องมือจัดการระดับแอดมินได้'
        : 'ผู้ใช้ที่เลือกจะถูกเพิกถอนสิทธิ์ผู้ดูแลระบบ (ยกเว้นบัญชีที่คุณกำลังใช้งานอยู่เพื่อความปลอดภัย)',
      confirmText: `${action} (${selectedLogins.size} คน)`,
      variant: enabled ? 'primary' : 'danger',
      icon: enabled ? 'shield-check' : 'shield-alert',
      onConfirm: async () => {
        setIsBatchProcessing(true)
        let successCount = 0
        let failCount = 0

        for (const login of selectedLogins) {
          if (!enabled && login.toLowerCase() === String(user?.loginname ?? '').toLowerCase()) {
            continue
          }
          try {
            const res = await fetch(`/api/admin/users/${encodeURIComponent(login)}/admin-role`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ enabled }),
            })
            const data = await res.json()
            if (data.success) successCount++
            else failCount++
          } catch {
            failCount++
          }
        }

        setAdminNotice(`${action}สำเร็จ ${successCount} คน${failCount > 0 ? ` (ข้าม/ผิดพลาด ${failCount} คน)` : ''}`)
        setSelectedLogins(new Set())
        await fetchUsers()
        setIsBatchProcessing(false)
        setTimeout(() => setAdminNotice(null), 6000)
      },
    })
  }

  // มือถือ: เลื่อนแถบแท็บให้แท็บที่เลือกอยู่กลางจอเสมอ (ไม่ให้แท็บหลุดขอบ)
  const tabsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    tabsRef.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeTab, isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="fixed inset-0" onClick={handleModalClose} />
      {/* Modal Dialog */}
      <div className="sec-modal relative w-full max-w-3xl sm:max-w-4xl lg:max-w-6xl max-sm:h-dvh sm:h-[min(860px,90dvh)] bg-[var(--card-bg)] border border-[var(--card-border)] max-sm:rounded-none sm:rounded-2xl shadow-2xl shadow-black/40 flex flex-col z-10 overflow-hidden text-[var(--text-main)] animate-scale-in pb-[env(safe-area-inset-bottom,0px)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4.5 border-b border-white/[0.06] bg-[var(--card-header)] shrink-0">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className={cn(
              'grid place-items-center size-10 rounded-xl border shadow-sm shrink-0 transition-colors',
              activeTab === 'admin_system'
                ? 'bg-accent-soft border-accent-soft text-accent'
                : 'bg-accent-soft border-accent-soft text-accent'
            )}>
              {activeTab === 'admin_system' ? (
                <Cpu className="size-5.5 stroke-[2.2]" />
              ) : (
                <ShieldCheck className="size-5.5 stroke-[2.2]" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                {activeTab === 'admin_system'
                  ? 'ศูนย์จัดการระบบ & ควบคุมเวอร์ชัน (Admin Hub)'
                  : 'ศูนย์ตั้งค่าความปลอดภัย & จัดการบัญชี'}
              </h2>
              <p className="text-sm text-slate-400 font-normal mt-0.5">
                {activeTab === 'admin_system'
                  ? 'บริหารเวอร์ชัน • ระบบสรุป AI อัตโนมัติ • สถานะเซิร์ฟเวอร์ & ซิงค์ HOSxP'
                  : 'ยืนยันตัวตน 2FA • PIN ล็อกหน้าจอ • นโยบายคุ้มครองข้อมูลผู้ป่วย'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* เมนูหมวดด้านซ้าย (มือถือ: แถบเลื่อนแนวนอนด้านบน) + เนื้อหาเลื่อนในกรอบ — หน้าต่างสูงคงที่ ไม่ยืดหดตามแท็บ */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
          <nav
            aria-label="หมวดการตั้งค่า"
            className="shrink-0 border-b sm:border-b-0 sm:border-r border-white/[0.06] bg-[var(--card-header)] sm:w-52 lg:w-56 sm:overflow-y-auto"
          >
            <div ref={tabsRef} className="sec-tabs flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible p-2 sm:p-3 scrollbar-none">
              {(
                [
                  { group: 'บัญชีของฉัน' },
                  { id: 'my_profile', label: 'โปรไฟล์', icon: UserIcon },
                  { id: 'my_2fa', label: 'ยืนยันตัวตน 2FA', icon: Smartphone, dot: Boolean(user?.two_factor_enabled) },
                  { id: 'my_pin', label: 'PIN & ล็อกหน้าจอ', icon: Lock, dot: hasPin },
                  ...(isAdmin
                    ? [
                        { group: 'ผู้ดูแลระบบ' },
                        {
                          id: 'admin_policy',
                          label: 'ผู้ใช้ & นโยบาย',
                          icon: Users,
                          badge: enforcePolicy === 'Y' || enforcePinPolicy === 'Y' ? 'บังคับ' : undefined,
                          onOpen: () => {
                            fetchPolicy()
                            fetchPinPolicy()
                            fetchUsers()
                          },
                        },
                        { id: 'admin_menus', label: 'สิทธิ์เมนู', icon: ListChecks },
                        { id: 'admin_sso', label: 'ThaiD / SSO', icon: Fingerprint },
                        { id: 'admin_system', label: 'จัดการระบบ', icon: Cpu, badge: `v${__APP_VERSION__}`, onOpen: () => fetchSysStatus() },
                      ]
                    : []),
                ] as const
              ).map((item, i) => {
                if ('group' in item) {
                  return (
                    <div key={`g-${i}`} className={cn('hidden sm:block px-3 pb-1 text-xs font-medium text-slate-500', i > 0 && 'pt-4')}>
                      {item.group}
                    </div>
                  )
                }
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    data-tab-id={item.id}
                    onClick={() => {
                      setActiveTab(item.id as typeof activeTab)
                      if ('onOpen' in item && item.onOpen) item.onOpen()
                    }}
                    className={cn(
                      'group shrink-0 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap transition cursor-pointer sm:w-full',
                      isActive
                        ? 'bg-accent-soft text-white'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', isActive ? 'text-accent' : 'text-slate-500 group-hover:text-slate-300')} />
                    <span className="sm:flex-1">{item.label}</span>
                    {'dot' in item && item.dot && <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-label="เปิดใช้งาน" />}
                    {'badge' in item && item.badge && (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                          item.badge === 'บังคับ' ? 'bg-amber-500/15 text-amber-300' : 'bg-white/[0.06] text-slate-400'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </nav>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6 space-y-5">
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
                  <div
                    onClick={() => {
                      setCropperFile(null)
                      setIsCropperOpen(true)
                    }}
                    className="size-24 sm:size-26 rounded-full overflow-hidden border-2 border-teal-500/40 bg-gradient-to-br from-blue-700/40 via-teal-700/30 to-slate-900 grid place-items-center shadow-xl cursor-pointer hover:border-purple-400 transition"
                    title="คลิกเพื่อปรับตำแหน่ง / ซูมรูปโปรไฟล์"
                  >
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt="Profile Preview"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <UserIcon className="size-12 text-slate-400" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCropperFile(null)
                      setIsCropperOpen(true)
                    }}
                    className="absolute bottom-0 right-0 size-8 sm:size-8.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg grid place-items-center cursor-pointer transition-transform hover:scale-110 border-2 border-slate-900"
                    title="คลิกเพื่อเปลี่ยนรูปภาพประจำตัว (ปรับซูม/เลื่อนตำแหน่ง)"
                  >
                    <Camera className="size-4" />
                  </button>
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
                        <span className="px-1.5 py-0.2 rounded text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
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
                      <p className="text-xs font-medium text-slate-300 mb-3">1. เปิด Authenticator แล้วเลือกเพิ่มบัญชีด้วย QR Code (กล้อง iPhone ปกติใช้สแกนรหัสนี้ไม่ได้)</p>
                      <div className="p-3 bg-white rounded-xl shadow-md">
                        <img src={setupData.qrUrl} alt="2FA QR Code" className="size-48" />
                      </div>
                      <p className={cn('text-xs font-semibold mt-2', setupExpired ? 'text-rose-300' : 'text-amber-300')}>
                        {setupExpired
                          ? 'คีย์หมดอายุแล้ว กรุณายกเลิกแล้วเริ่มใหม่'
                          : `คีย์ตั้งค่านี้หมดอายุใน ${Math.floor(setupSecondsLeft / 60)}:${String(setupSecondsLeft % 60).padStart(2, '0')}`}
                      </p>
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
                            disabled={setupExpired}
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
                            disabled={verifyCode.length !== 6 || setupExpired}
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
                <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm flex items-center gap-2.5">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span>{pinError}</span>
                </div>
              )}
              {pinSuccess && (
                <div role="status" className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm flex items-center gap-2.5">
                  <Check className="size-4 shrink-0 text-emerald-400" />
                  <span>{pinSuccess}</span>
                </div>
              )}

              {/* Status hero */}
              <section className="relative overflow-hidden rounded-2xl border border-accent-soft p-5 sm:p-6" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-hex) 16%, transparent) 0%, transparent 70%)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                  <div className="relative shrink-0">
                    <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft border border-accent-soft text-accent">
                      <Lock className="size-7" />
                    </div>
                    <span
                      className={cn(
                        'absolute -bottom-1 -right-1 size-4 rounded-full ring-4 ring-slate-900 dark:ring-[var(--card-bg)]',
                        hasPin && pinEnabled ? 'bg-emerald-400' : hasPin ? 'bg-amber-400' : 'bg-slate-500'
                      )}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-white">ล็อกหน้าจอด้วย PIN</h3>
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                          hasPin && pinEnabled
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : hasPin
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-white/5 text-slate-300 border-white/10'
                        )}
                      >
                        {hasPin && pinEnabled ? 'เปิดใช้งาน' : hasPin ? 'ปิดชั่วคราว' : 'ยังไม่ได้ตั้ง PIN'}
                      </span>
                      {isPinEnforced && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          โรงพยาบาลบังคับใช้
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                      {hasPin && pinEnabled
                        ? `หน้าจอจะล็อกเองเมื่อไม่มีการใช้งาน ${selectedMinutes} นาที ปลดล็อกด้วย PIN ของคุณ`
                        : 'ตั้ง PIN เพื่อให้หน้าจอล็อกเองเมื่อคุณลุกจากเครื่อง ป้องกันผู้อื่นเห็นข้อมูลผู้ป่วย'}
                    </p>
                  </div>

                  {hasPin && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          setTimeout(lockNow, 150)
                        }}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-[0.98] cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, var(--accent-hex) 0%, color-mix(in srgb, var(--accent-hex) 70%, #000) 100%)', boxShadow: '0 6px 18px var(--accent-glow, transparent)' }}
                      >
                        <Lock className="size-4" />
                        ล็อกหน้าจอทันที
                        <kbd className="rounded-md bg-black/20 px-1.5 py-0.5 font-mono text-[11px] font-medium">Ctrl+L</kbd>
                      </button>
                      {!isPinEnforced && (
                        <button
                          type="button"
                          onClick={handleDisablePinLock}
                          disabled={pinLoading}
                          className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 cursor-pointer disabled:opacity-50"
                        >
                          ปิดการใช้ PIN
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Auto-lock time */}
              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="flex items-center gap-2 text-base font-semibold text-white">
                      <Clock className="size-4.5 text-accent" />
                      ล็อกอัตโนมัติเมื่อไม่ได้ใช้งาน
                    </h4>
                    <p className="mt-1 text-sm text-slate-400">เลือกระยะเวลาที่ไม่มีการใช้งานก่อนหน้าจอจะล็อก</p>
                  </div>
                  <span className="rounded-lg bg-accent-soft border border-accent-soft px-3 py-1 text-sm font-semibold text-accent">
                    {selectedMinutes} นาที
                  </span>
                </div>

                <div role="radiogroup" aria-label="ระยะเวลาล็อกอัตโนมัติ" className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {lockIntervals.map((item) => {
                    const isSelected = selectedMinutes === item.minutes
                    return (
                      <button
                        key={item.minutes}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleUpdateAutoLockTime(item.minutes)}
                        className={cn(
                          'group relative rounded-xl border p-3.5 text-left transition cursor-pointer',
                          isSelected
                            ? 'border-accent bg-accent-soft shadow-sm'
                            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn('text-lg font-bold tabular-nums', isSelected ? 'text-white' : 'text-slate-200')}>
                            {item.label}
                          </span>
                          <span
                            className={cn(
                              'grid size-5 place-items-center rounded-full border transition',
                              isSelected ? 'border-transparent bg-accent' : 'border-white/20 group-hover:border-white/35'
                            )}
                          >
                            {isSelected && <Check className="size-3 stroke-[3]" />}
                          </span>
                        </div>
                        <div className={cn('mt-2 text-xs font-semibold', isSelected ? 'text-accent' : 'text-slate-400')}>{item.tag}</div>
                        <p className="mt-0.5 text-xs leading-snug text-slate-400 line-clamp-2">{item.desc}</p>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <div className="flex items-start gap-2.5 rounded-xl bg-white/[0.03] px-3.5 py-3 text-sm">
                    <Info className="mt-0.5 size-4 shrink-0 text-accent" />
                    <p className="text-slate-300">
                      แนะนำ <strong className="text-white">3–5 นาที</strong> สำหรับจุดตรวจ OPD และห้องยา
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl bg-white/[0.03] px-3.5 py-3 text-sm">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-300" />
                    <p className="text-slate-300">
                      ล็อกค้างเกิน <strong className="text-amber-300">15 นาที</strong> ระบบจะออกจากระบบให้อัตโนมัติ
                    </p>
                  </div>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                  คีย์ลัดล็อกหน้าจอ
                  <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">Ctrl + L</kbd>
                  หรือ
                  <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">Alt + L</kbd>
                </p>
              </section>

              {/* Set / change PIN */}
              <form onSubmit={handleSavePin} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
                <h4 className="flex items-center gap-2 text-base font-semibold text-white">
                  <KeyRound className="size-4.5 text-accent" />
                  {hasPin ? 'เปลี่ยนรหัส PIN' : 'ตั้งรหัส PIN'}
                </h4>
                <p className="mt-1 text-sm text-slate-400">ตัวเลข 4–8 หลัก ใช้ปลดล็อกหน้าจอ ไม่ต้องเหมือนรหัสผ่าน HOSxP</p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pin-new" className="mb-2 block text-sm font-medium text-slate-300">
                      PIN ใหม่
                    </label>
                    <input
                      id="pin-new"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={8}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      required
                      className="w-full h-12 rounded-xl border border-white/12 bg-white/[0.04] px-4 text-center font-mono text-xl font-semibold tracking-[0.4em] text-white placeholder:tracking-[0.3em] placeholder:text-slate-600 transition focus:outline-hidden focus:border-accent focus:bg-white/[0.07]"
                    />
                    <p className={cn('mt-1.5 text-xs', pinInput.length > 0 && pinInput.length < 4 ? 'text-amber-300' : 'text-slate-500')}>
                      {pinInput.length > 0 ? `${pinInput.length} หลัก${pinInput.length < 4 ? ' (ต้องมีอย่างน้อย 4 หลัก)' : ''}` : 'อย่างน้อย 4 หลัก'}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="pin-confirm" className="mb-2 block text-sm font-medium text-slate-300">
                      ยืนยัน PIN อีกครั้ง
                    </label>
                    <input
                      id="pin-confirm"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={8}
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      required
                      className={cn(
                        'w-full h-12 rounded-xl border bg-white/[0.04] px-4 text-center font-mono text-xl font-semibold tracking-[0.4em] text-white placeholder:tracking-[0.3em] placeholder:text-slate-600 transition focus:outline-hidden focus:bg-white/[0.07]',
                        confirmPinInput && confirmPinInput !== pinInput ? 'border-rose-400/60 focus:border-rose-400' : 'border-white/12 focus:border-accent'
                      )}
                    />
                    {confirmPinInput.length > 0 && (
                      <p className={cn('mt-1.5 flex items-center gap-1 text-xs', confirmPinInput === pinInput ? 'text-emerald-300' : 'text-rose-300')}>
                        {confirmPinInput === pinInput ? <Check className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                        {confirmPinInput === pinInput ? 'PIN ตรงกัน' : 'PIN ไม่ตรงกัน'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-slate-500">
                    {hasPin ? 'PIN ใหม่มีผลทันทีหลังบันทึก' : 'หลังตั้ง PIN ระบบจะถาม PIN ทุกครั้งที่ปลดล็อกหน้าจอ'}
                  </span>
                  <button
                    type="submit"
                    disabled={pinLoading || pinInput.length < 4 || pinInput !== confirmPinInput}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    style={{ background: 'linear-gradient(135deg, var(--accent-hex) 0%, color-mix(in srgb, var(--accent-hex) 70%, #000) 100%)' }}
                  >
                    {pinLoading && <Loader2 className="size-4 animate-spin" />}
                    {hasPin ? 'บันทึก PIN ใหม่' : 'เปิดใช้งาน PIN'}
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
              <p className="text-xs text-slate-400">
                กำหนด Admin จะให้สิทธิ์จัดการระบบใน SMART-HOSCHECK แก่ผู้ใช้คนนั้น ผู้ใช้ต้องออกจากระบบแล้วเข้าสู่ระบบใหม่เพื่อให้สิทธิ์มีผล
              </p>

              {/* นโยบายโรงพยาบาล: การ์ดเดียว 2 แถว (กระชับ ให้พื้นที่กับรายชื่อบุคลากร) */}
              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.06]">
                {(
                  [
                    {
                      key: '2fa',
                      icon: Smartphone,
                      title: 'บังคับใช้ 2FA ทั้งโรงพยาบาล',
                      on: enforcePolicy === 'Y',
                      desc:
                        enforcePolicy === 'Y'
                          ? 'ทุกคนต้องยืนยันรหัส OTP จากแอปก่อนเข้าสู่ระบบ'
                          : 'แต่ละคนเลือกเปิดหรือปิด 2FA เอง',
                      loading: policyLoading,
                      toggle: handleTogglePolicy,
                    },
                    {
                      key: 'pin',
                      icon: Lock,
                      title: 'บังคับใช้ PIN ล็อกหน้าจอทุกคน',
                      on: enforcePinPolicy === 'Y',
                      desc:
                        enforcePinPolicy === 'Y'
                          ? 'ทุกเครื่องล็อกเองเมื่อไม่มีการใช้งานตามเวลาที่กำหนด'
                          : 'แต่ละคนตั้งเวลาล็อกและเปิด/ปิด PIN เอง',
                      loading: pinPolicyLoading,
                      toggle: handleTogglePinPolicy,
                    },
                  ] as const
                ).map((row) => (
                  <div key={row.key} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
                    <div className={cn('grid size-9 shrink-0 place-items-center rounded-lg', row.on ? 'bg-accent-soft text-accent' : 'bg-white/[0.05] text-slate-400')}>
                      <row.icon className="size-4.5" />
                    </div>
                    {/* basis 12rem: จอแคบให้ตัวควบคุมตกลงบรรทัดใหม่ ไม่บีบข้อความจนขึ้นทีละตัวอักษร */}
                    <div className="min-w-0 flex-1 basis-[12rem]">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{row.title}</h3>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            row.on ? 'bg-amber-500/15 text-amber-300' : 'bg-white/[0.06] text-slate-400'
                          )}
                        >
                          {row.on ? 'บังคับใช้' : 'ไม่บังคับ'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{row.desc}</p>
                    </div>

                    {row.key === 'pin' && enforcePinPolicy === 'Y' && (
                      <div className="relative flex items-center gap-2 text-xs text-slate-400" ref={timeDropdownRef}>
                        <span className="whitespace-nowrap">เวลาล็อก</span>
                        <button
                          type="button"
                          onClick={() => setTimeDropdownOpen((prev) => !prev)}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:bg-slate-800 transition shadow-inner cursor-pointer"
                        >
                          <Clock className="size-3.5 text-emerald-400" />
                          <span>
                            {[
                              { v: 1, l: '1 นาที' },
                              { v: 3, l: '3 นาที' },
                              { v: 5, l: '5 นาที (มาตรฐาน)' },
                              { v: 10, l: '10 นาที' },
                              { v: 15, l: '15 นาที' },
                            ].find((t) => t.v === defaultHospitalMinutes)?.l ?? `${defaultHospitalMinutes} นาที`}
                          </span>
                          <ChevronDown className={cn('size-3.5 text-slate-400 transition-transform duration-200', timeDropdownOpen && 'rotate-180')} />
                        </button>

                        {timeDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-slate-700/90 bg-slate-900/95 backdrop-blur-xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              เลือกระยะเวลาล็อกกลาง
                            </div>
                            {[
                              { v: 1, l: '1 นาที' },
                              { v: 3, l: '3 นาที' },
                              { v: 5, l: '5 นาที (มาตรฐาน)' },
                              { v: 10, l: '10 นาที' },
                              { v: 15, l: '15 นาที' },
                            ].map((opt) => {
                              const isSelected = opt.v === defaultHospitalMinutes
                              return (
                                <button
                                  key={opt.v}
                                  type="button"
                                  onClick={() => {
                                    handleSaveHospitalDefaultMinutes(opt.v)
                                    setTimeDropdownOpen(false)
                                  }}
                                  className={cn(
                                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer text-left',
                                    isSelected
                                      ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                                  )}
                                >
                                  <span>{opt.l}</span>
                                  {isSelected && <Check className="size-3.5 text-emerald-400" />}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.on}
                      aria-label={row.title}
                      disabled={row.loading}
                      onClick={row.toggle}
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
                        row.on ? 'bg-accent' : 'bg-white/[0.12]'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                          row.on ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                ))}
              </section>

              {/* Staff Directory Table */}
              <div className="space-y-3">
                {/* Search & Header bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="grid place-items-center size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 shrink-0">
                      <Users className="size-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">รายชื่อบุคลากรและจัดการสิทธิ์</span>
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-800/80 text-emerald-400 border border-slate-700/60 font-mono">
                      {filteredUsers.length.toLocaleString()} คน
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchUsers()}
                      disabled={usersLoading}
                      className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-400 hover:text-white transition cursor-pointer"
                      title="รีเฟรชรายชื่อ"
                    >
                      <RotateCcw className={cn("size-3", usersLoading && "animate-spin text-emerald-400")} />
                    </button>
                  </div>

                  {/* Search Bar with Clear Button */}
                  <div className="relative w-full sm:w-72">
                    <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาชื่อ, username, ตำแหน่ง…"
                      className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/15 transition shadow-inner"
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

                {/* Role Filter Tabs with Real-time Counters */}
                <div
                  className="flex flex-wrap items-center gap-1.5 pb-1 text-xs"
                  onWheel={(e) => {
                    if (e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                      e.currentTarget.scrollLeft += e.deltaY
                    }
                  }}
                >
                  {[
                    { id: 'all', label: 'ทั้งหมด', count: roleCounts.all, icon: Users, color: 'text-slate-300' },
                    { id: 'admin', label: 'ผู้ดูแลระบบ (Admin)', count: roleCounts.admin, icon: ShieldCheck, color: 'text-violet-400' },
                    { id: 'thaimed', label: 'แพทย์แผนไทย', count: roleCounts.thaimed, icon: Activity, color: 'text-emerald-400' },
                    { id: 'pharmacist', label: 'เภสัชกรรม', count: roleCounts.pharmacist, icon: Pill, color: 'text-sky-400' },
                    { id: 'doctor', label: 'แพทย์ / ทันตแพทย์', count: roleCounts.doctor, icon: UserIcon, color: 'text-indigo-400' },
                    { id: 'general', label: 'บุคลากรทั่วไป', count: roleCounts.general, icon: Users, color: 'text-slate-400' },
                    ...(roleCounts.disabled > 0 ? [{ id: 'disabled', label: 'ปิดใช้งานใน HOSxP', count: roleCounts.disabled, icon: AlertCircle, color: 'text-rose-400' }] : []),
                  ].map((tab) => {
                    const isActive = roleFilter === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setRoleFilter(tab.id as any)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs whitespace-nowrap transition cursor-pointer border',
                          isActive
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold shadow-xs'
                            : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06]'
                        )}
                      >
                        <tab.icon className={cn('size-3.5', isActive ? 'text-emerald-400' : tab.color)} />
                        <span>{tab.label}</span>
                        <span
                          className={cn(
                            'ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold',
                            isActive
                              ? 'bg-emerald-400/20 text-emerald-200'
                              : 'bg-white/[0.08] text-slate-400'
                          )}
                        >
                          {tab.count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Batch Action Toolbar when 1+ users selected */}
                {selectedLogins.size > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-violet-950/40 border border-violet-500/30 text-violet-200 text-xs animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">เลือกไว้ {selectedLogins.size} คน</span>
                      <span className="text-violet-300/80 hidden sm:inline">จากรายการที่แสดง</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBatchProcessing}
                        onClick={() => handleBatchAdminRole(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                      >
                        {isBatchProcessing ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                        <span>กำหนดเป็น Admin ทั้งหมด ({selectedLogins.size})</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBatchProcessing}
                        onClick={() => handleBatchAdminRole(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 transition cursor-pointer disabled:opacity-50"
                      >
                        {isBatchProcessing ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                        <span>ถอดสิทธิ์ Admin</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBatchProcessing}
                        onClick={() => setSelectedLogins(new Set())}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile card list (< md) */}
                <div className="md:hidden space-y-2">
                  {usersLoading ? (
                    <LoadingSkeleton rows={5} label="กำลังโหลดรายชื่อผู้ใช้จาก HOSxP" />
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400 font-medium">
                      {searchQuery ? `ไม่พบรายชื่อที่ตรงกับ "${searchQuery}"` : 'ไม่พบข้อมูลบุคลากรในหมวดนี้'}
                    </div>
                  ) : (
                    pagedUsers.map((u) => {
                      const uIsAdmin = isUserAdmin(u)
                      const uIsThaiMed = isUserThaiMed(u)
                      const uIsPharm = isUserPharmacist(u)
                      const uIsDoc = isUserDoctor(u)
                      const isSelf = u.loginname.toLowerCase() === String(user?.loginname ?? '').toLowerCase()

                      return (
                        <div key={u.loginname} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={selectedLogins.has(u.loginname)}
                                onChange={() => handleToggleSelectOne(u.loginname)}
                                className="mt-1 size-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 focus:outline-hidden cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-slate-100 text-sm truncate">{u.name}</div>
                                <div className="text-xs text-slate-400 truncate">
                                  {u.position || u.entryposition || u.groupname || '-'}
                                </div>
                              </div>
                            </div>
                            <span className="font-mono font-semibold text-emerald-400 text-xs shrink-0">{u.loginname}</span>
                          </div>

                          {/* Role Badge & Admin Switch */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                            <div className="flex items-center gap-1.5">
                              {uIsAdmin ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                                  <ShieldCheck className="size-3 text-amber-400" />
                                  <span>Admin</span>
                                </span>
                              ) : uIsThaiMed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  <Activity className="size-3 text-emerald-400" />
                                  <span>แผนไทย</span>
                                </span>
                              ) : uIsPharm ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                  <Pill className="size-3 text-sky-400" />
                                  <span>เภสัชกรรม</span>
                                </span>
                              ) : uIsDoc ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                  <UserIcon className="size-3 text-indigo-400" />
                                  <span>แพทย์</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10.5px] text-slate-400 bg-slate-800 border border-slate-700">
                                  ทั่วไป
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">สิทธิ์ Admin:</span>
                            </div>

                            <button
                              type="button"
                              role="switch"
                              aria-checked={uIsAdmin}
                              disabled={isSelf || updatingAdminUser === u.loginname}
                              onClick={() => handleToggleAdmin(u.loginname, !uIsAdmin)}
                              className={cn(
                                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed',
                                uIsAdmin ? 'bg-violet-600' : 'bg-slate-700'
                              )}
                              title={isSelf ? 'บัญชีที่คุณกำลังใช้งานอยู่' : uIsAdmin ? 'ถอดสิทธิ์ Admin' : 'ตั้งเป็น Admin'}
                            >
                              <span className={cn('pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200', uIsAdmin ? 'translate-x-4' : 'translate-x-0')} />
                            </button>
                          </div>

                          {/* 2FA & PIN Badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] border',
                              u.two_factor_enabled
                                ? 'font-semibold bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                : 'font-medium bg-slate-900/80 text-slate-500 border-slate-800'
                            )}>
                              {u.two_factor_enabled && <Check className="size-3" />} 2FA: {u.two_factor_enabled ? 'เปิด' : 'ยังไม่เปิด'}
                            </span>
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] border',
                              u.has_pin
                                ? 'font-semibold bg-teal-500/10 text-teal-300 border-teal-500/25'
                                : 'font-medium bg-slate-900/80 text-slate-500 border-slate-800'
                            )}>
                              {u.has_pin && <Lock className="size-3" />} PIN: {u.has_pin ? `มี (${u.auto_lock_minutes ?? 5}น.)` : 'ไม่มี'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
                            <button
                              type="button"
                              disabled={updatingAccountUser === u.loginname || isSelf}
                              onClick={() => handleToggleHosxpAccount(u.loginname, !u.account_disable)}
                              className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer inline-flex items-center gap-1 disabled:opacity-50', u.account_disable ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : 'bg-rose-500/10 text-rose-300 border-rose-500/25')}
                            >
                              {updatingAccountUser === u.loginname ? <Loader2 className="size-3 animate-spin" /> : null}
                              {u.account_disable ? 'เปิดบัญชี HOSxP' : 'ปิดบัญชี HOSxP'}
                            </button>
                            {u.two_factor_enabled && (
                              <button
                                type="button"
                                disabled={resettingUser === u.loginname}
                                onClick={() => handleResetUser2FA(u.loginname)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/25 cursor-pointer inline-flex items-center gap-1 disabled:opacity-60"
                              >
                                {resettingUser === u.loginname ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                                รีเซ็ต 2FA
                              </button>
                            )}
                            {u.has_pin && (
                              <button
                                type="button"
                                disabled={resettingPinUser === u.loginname}
                                onClick={() => handleResetUserPin(u.loginname)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25 cursor-pointer inline-flex items-center gap-1 disabled:opacity-60"
                              >
                                {resettingPinUser === u.loginname ? <Loader2 className="size-3 animate-spin" /> : <KeyRound className="size-3" />}
                                รีเซ็ต PIN
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* แถบแบ่งหน้า (มือถือ) */}
                <div className="md:hidden rounded-xl overflow-hidden">
                  <PaginationBar {...usersBarProps} pageSizeOptions={[25, 50, 100, 200]} />
                </div>

                {/* Desktop Table Container (>= md) */}
                <div className="hidden md:block rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/60 shadow-sm">
                  <div className="overflow-x-auto overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-700/80 scrollbar-track-slate-900/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="py-2.5 px-3 w-[42px] text-center">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={handleToggleSelectAll}
                              className="size-3.5 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 focus:outline-hidden cursor-pointer"
                              title="เลือกทั้งหมดในหน้านี้"
                            />
                          </th>
                          <th className="py-2.5 px-3 min-w-[170px] whitespace-nowrap">Username / บุคลากร</th>
                          <th className="py-2.5 px-3 min-w-[150px] whitespace-nowrap">กลุ่มงาน / ตำแหน่ง</th>
                          <th className="py-2.5 px-3 w-[200px] whitespace-nowrap text-center">สิทธิ์ Admin & บทบาท</th>
                          <th className="py-2.5 px-3 w-[150px] whitespace-nowrap text-center">2FA / PIN Lock</th>
                          <th className="py-2.5 px-3 w-[150px] whitespace-nowrap text-right">การจัดการบัญชี</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {usersLoading ? (
                          <tr>
                            <td colSpan={6}>
                              <LoadingSkeleton rows={6} label="กำลังโหลดรายชื่อผู้ใช้จาก HOSxP" />
                            </td>
                          </tr>
                        ) : filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                              {searchQuery ? `ไม่พบรายชื่อที่ตรงกับ "${searchQuery}"` : 'ไม่พบข้อมูลบุคลากรในหมวดนี้'}
                            </td>
                          </tr>
                        ) : (
                          pagedUsers.map((u) => {
                            const uIsAdmin = isUserAdmin(u)
                            const uIsThaiMed = isUserThaiMed(u)
                            const uIsPharm = isUserPharmacist(u)
                            const uIsDoc = isUserDoctor(u)
                            const isSelf = u.loginname.toLowerCase() === String(user?.loginname ?? '').toLowerCase()

                            return (
                              <tr key={u.loginname} className="hover:bg-slate-800/35 transition-colors h-11">
                                {/* Checkbox */}
                                <td className="py-2 px-3 text-center align-middle">
                                  <input
                                    type="checkbox"
                                    checked={selectedLogins.has(u.loginname)}
                                    onChange={() => handleToggleSelectOne(u.loginname)}
                                    className="size-3.5 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 focus:outline-hidden cursor-pointer"
                                  />
                                </td>

                                {/* Username / บุคลากร */}
                                <td className="py-2 px-3 align-middle">
                                  <div className="font-mono font-semibold text-emerald-400 text-xs">
                                    {u.loginname}
                                  </div>
                                  <div className="font-medium text-slate-100 text-xs truncate max-w-[190px]">
                                    {u.name}
                                  </div>
                                </td>

                                {/* กลุ่มงาน / ตำแหน่ง */}
                                <td className="py-2 px-3 text-slate-300 text-xs align-middle">
                                  <div className="font-medium text-slate-200 truncate max-w-[160px]" title={u.entryposition || u.position || ''}>
                                    {u.position || u.entryposition || u.groupname || '-'}
                                  </div>
                                  {u.position && u.groupname && u.position !== u.groupname && (
                                    <div className="text-[10.5px] text-slate-400 font-mono truncate max-w-[160px]">
                                      สิทธิ์: {u.groupname}
                                    </div>
                                  )}
                                </td>

                                {/* สิทธิ์ Admin & บทบาท */}
                                <td className="py-2 px-3 align-middle text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    {/* Role Badge */}
                                    {uIsAdmin ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30 whitespace-nowrap"
                                        title={u.admin_enabled ? 'ได้รับสิทธิ์ Admin ในระบบ SMART-HOSCHECK' : 'เป็น Admin จากกลุ่มงาน IT ใน HOSxP'}
                                      >
                                        <ShieldCheck className="size-3 text-amber-400" />
                                        <span>Admin</span>
                                      </span>
                                    ) : uIsThaiMed ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                        <Activity className="size-3 text-emerald-400" />
                                        <span>แผนไทย</span>
                                      </span>
                                    ) : uIsPharm ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 whitespace-nowrap">
                                        <Pill className="size-3 text-sky-400" />
                                        <span>เภสัชกรรม</span>
                                      </span>
                                    ) : uIsDoc ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                                        <UserIcon className="size-3 text-indigo-400" />
                                        <span>แพทย์</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10.5px] font-normal bg-slate-900 text-slate-400 border border-slate-800 whitespace-nowrap">
                                        ทั่วไป
                                      </span>
                                    )}

                                    {/* Toggle Switch ให้สิทธิ์ Admin */}
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={uIsAdmin}
                                      disabled={isSelf || updatingAdminUser === u.loginname}
                                      onClick={() => handleToggleAdmin(u.loginname, !uIsAdmin)}
                                      className={cn(
                                        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed',
                                        uIsAdmin ? 'bg-violet-600' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                                      )}
                                      title={
                                        isSelf
                                          ? 'บัญชีที่คุณกำลังใช้งานอยู่ (ไม่สามารถถอดสิทธิ์ตัวเองได้)'
                                          : uIsAdmin
                                            ? 'คลิกเพื่อถอดสิทธิ์ Admin'
                                            : 'คลิกเพื่อกำหนดให้เป็น Admin'
                                      }
                                    >
                                      <span
                                        className={cn(
                                          'pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                                          uIsAdmin ? 'translate-x-4' : 'translate-x-0'
                                        )}
                                      />
                                    </button>
                                    {updatingAdminUser === u.loginname && (
                                      <Loader2 className="size-3 animate-spin text-violet-400" />
                                    )}
                                    {/* ผู้ดูแลแผนไทย: เห็นการ์ดมูลค่าบริการ (Admin เห็นอยู่แล้ว จึงไม่แสดงสวิตช์) */}
                                    {!uIsAdmin && (
                                      <label
                                        className="inline-flex items-center gap-1 text-[10.5px] text-slate-400 cursor-pointer select-none"
                                        title="ผู้ดูแลแผนไทย: เห็นการ์ดมูลค่าบริการบนหน้าแรก (ไม่ได้สิทธิ์ผู้ดูแลระบบ)"
                                      >
                                        <span>หน.แผนไทย</span>
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={Boolean(u.thaimed_admin_enabled)}
                                          disabled={updatingAdminUser === u.loginname}
                                          onClick={() => handleToggleThaiMedAdmin(u.loginname, !u.thaimed_admin_enabled)}
                                          className={cn(
                                            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed',
                                            u.thaimed_admin_enabled ? 'bg-emerald-600' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                                          )}
                                        >
                                          <span
                                            className={cn(
                                              'pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                                              u.thaimed_admin_enabled ? 'translate-x-4' : 'translate-x-0'
                                            )}
                                          />
                                        </button>
                                      </label>
                                    )}
                                  </div>
                                </td>

                                {/* 2FA & PIN Lock */}
                                <td className="py-2 px-3 align-middle text-center">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    {u.two_factor_enabled ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                        <Check className="size-2.5" /> 2FA
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[10.5px] text-slate-500 bg-slate-900 border border-slate-800 whitespace-nowrap">
                                        ไม่มี 2FA
                                      </span>
                                    )}
                                    {u.has_pin ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30 whitespace-nowrap">
                                        <Lock className="size-2.5" /> PIN ({u.auto_lock_minutes ?? 5}น.)
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[10.5px] text-slate-500 bg-slate-900 border border-slate-800 whitespace-nowrap">
                                        ไม่มี PIN
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* การจัดการบัญชี */}
                                <td className="py-2 px-3 text-right align-middle">
                                  <div className="inline-flex items-center gap-1 justify-end">
                                    <button
                                      type="button"
                                      disabled={updatingAccountUser === u.loginname || isSelf}
                                      onClick={() => handleToggleHosxpAccount(u.loginname, !u.account_disable)}
                                      className={cn(
                                        'px-2 py-1 rounded-md text-[10.5px] font-medium border transition cursor-pointer flex items-center gap-1 whitespace-nowrap disabled:opacity-50',
                                        u.account_disable
                                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                          : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                                      )}
                                      title={u.account_disable ? 'เปิดบัญชีผู้ใช้ใน HOSxP' : 'ปิดบัญชีผู้ใช้ใน HOSxP'}
                                    >
                                      {updatingAccountUser === u.loginname ? <Loader2 className="size-2.5 animate-spin" /> : null}
                                      <span>{u.account_disable ? 'เปิดบัญชี' : 'ปิดบัญชี'}</span>
                                    </button>

                                    {u.two_factor_enabled && (
                                      <button
                                        type="button"
                                        disabled={resettingUser === u.loginname}
                                        onClick={() => handleResetUser2FA(u.loginname)}
                                        className="px-1.5 py-1 rounded-md text-[10.5px] font-medium bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 transition cursor-pointer"
                                        title="รีเซ็ต 2FA"
                                      >
                                        {resettingUser === u.loginname ? <Loader2 className="size-2.5 animate-spin" /> : <RotateCcw className="size-2.5" />}
                                      </button>
                                    )}

                                    {u.has_pin && (
                                      <button
                                        type="button"
                                        disabled={resettingPinUser === u.loginname}
                                        onClick={() => handleResetUserPin(u.loginname)}
                                        className="px-1.5 py-1 rounded-md text-[10.5px] font-medium bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 transition cursor-pointer"
                                        title="รีเซ็ต PIN"
                                      >
                                        {resettingPinUser === u.loginname ? <Loader2 className="size-2.5 animate-spin" /> : <KeyRound className="size-2.5" />}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* แถบแบ่งหน้า */}
                  <div>
                    <PaginationBar {...usersBarProps} pageSizeOptions={[25, 50, 100, 200]} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: ADMIN SYSTEM & VERSION MANAGEMENT                  */}
          {/* ========================================================= */}
          {activeTab === 'admin_sso' && isAdmin && <SsoSettingsPanel />}
          {activeTab === 'admin_menus' && isAdmin && <MenuPermissionsPanel />}

          {activeTab === 'admin_system' && isAdmin && (
            <div className="space-y-5">
              {/* Sync / Action Feedback Notice */}
              {syncFeedback && (
                <div
                  className={cn(
                    'p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 animate-in fade-in shadow-xs',
                    syncFeedback.isError
                      ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {syncFeedback.isError ? (
                      <AlertCircle className="size-4 shrink-0 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                    )}
                    <span>{syncFeedback.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSyncFeedback(null)}
                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              {/* SECTION 1: SYSTEM & RELEASE HERO CARD */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-[#12122b] border border-violet-500/30 relative overflow-hidden shadow-xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="flex items-start gap-4">
                    <div className="size-13 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 shrink-0 border border-violet-400/30">
                      <Cpu className="size-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400 bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 rounded-md font-mono">
                          Production Release
                        </span>
                        {updateStatus && !updateStatus.isLatest ? (
                          <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                            🚀 {updateStatus.latestTag} มีเวอร์ชันใหม่
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            v{__APP_VERSION__} (Latest)
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white mt-1.5 flex items-center gap-2">
                        SMART-HOSCHECK • HerbDx ระบบตรวจสอบยาสมุนไพร
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        เซิร์ฟเวอร์โรงพยาบาลพังโคน • Host: 192.168.1.241:3002 • Node.js PM2 Application (ID: 38)
                      </p>
                    </div>
                  </div>

                  {/* Top Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={isCheckingUpdate}
                      onClick={handleCheckGitHubUpdates}
                      className="px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                      title="ตรวจสอบเลขเวอร์ชันล่าสุดจาก GitHub"
                    >
                      <RefreshCw className={cn('size-3.5 text-slate-400', isCheckingUpdate && 'animate-spin')} />
                      <span>{isCheckingUpdate ? 'กำลังตรวจ…' : 'ตรวจสอบอัปเดต'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onOpenChangelog?.()
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 transition cursor-pointer shadow-md shadow-violet-950/40 active:scale-95 flex items-center gap-1.5"
                    >
                      <FileText className="size-3.5 text-violet-200" />
                      <span>ดูบันทึกการอัปเดต (Changelog)</span>
                    </button>

                    <a
                      href="https://github.com/phpaekkapon-oss/HD-Check/releases"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <ExternalLink className="size-3.5 text-slate-400" />
                      <span>GitHub Releases</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* SECTION 2: TWO COLUMNS (AI ENGINE & NOTIFICATION POLICY) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI Assistant Release Engine Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400 grid place-items-center">
                        <Bot className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Google Gemini AI Auto-Release</h4>
                        <span className="text-[11px] text-teal-400 font-mono">models/gemini-flash-latest</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-teal-400" />
                      Connected
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    ระบบเชื่อมต่อ Google Gemini API Key เพื่อวิเคราะห์ Git commits ล่าสุด และสรุป Release Notes ภาษาไทยจัดหมวดหมู่ (Features, Fixes, Security) ให้แบบอัตโนมัติทุกครั้งที่รัน deploy
                  </p>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-300 space-y-1.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Git Repository:</span>
                      <span className="font-mono text-white">phpaekkapon-oss/HD-Check</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Branch ปัจจุบัน:</span>
                      <span className="font-mono text-teal-300">main (auto-tagged)</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>การรักษาความปลอดภัย:</span>
                      <span className="text-emerald-400 font-medium">.env Git-Ignored ปลอดภัย</span>
                    </div>
                  </div>
                </div>

                {/* Hospital Notification Policy Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 grid place-items-center">
                        <Bell className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">การแจ้งเตือนเวอร์ชันโรงพยาบาล</h4>
                        <span className="text-[11px] text-slate-400">Hospital Version Toast Notice</span>
                      </div>
                    </div>

                    {/* Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifyEnabled}
                      onClick={handleToggleNotify}
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden',
                        notifyEnabled ? 'bg-indigo-500' : 'bg-slate-800'
                      )}
                      title={notifyEnabled ? 'คลิกเพื่อปิดแจ้งเตือน' : 'คลิกเพื่อเปิดแจ้งเตือน'}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
                          notifyEnabled ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {notifyEnabled
                      ? 'เปิดใช้งาน: เจ้าหน้าที่ทุกคนจะเห็น Popup แจ้งเตือนสรุปฟีเจอร์ใหม่ที่มุมขวาล่างทันทีเมื่อมีการอัปเดตเวอร์ชัน'
                      : 'ปิดการใช้งาน: ปิดกั้น Popup แจ้งเตือนเวอร์ชันใหม่ชั่วคราว'}
                  </p>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.removeItem('hd_check_last_seen_version')
                          setSyncFeedback({ text: 'รีเซ็ตสถานะแล้ว! เมื่อโหลดหน้านี้ใหม่จะแสดง Popup แจ้งเตือนเวอร์ชัน' })
                        } catch {}
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700/80 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="size-3 text-slate-400" />
                      <span>ทดสอบแสดง Popup อีกครั้ง</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 3: DATABASE HEALTH & MANUAL SYNC TRIGGER */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 grid place-items-center shrink-0">
                      <Database className="size-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        ฐานข้อมูลและการซิงค์เวชระเบียน HOSxP
                        {isSysStatusLoading && <Loader2 className="size-3.5 animate-spin text-slate-400" />}
                      </h4>
                      <p className="text-xs text-slate-400">
                        ดึงข้อมูลใบสั่งยา แผนกแพทย์แผนไทย เข้าสู่คลัง Data Warehouse อัตโนมัติ
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchSysStatus}
                      disabled={isSysStatusLoading}
                      className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
                      title="รีเฟรชสถานะ"
                    >
                      <RefreshCw className={cn('size-4', isSysStatusLoading && 'animate-spin')} />
                    </button>
                    <button
                      type="button"
                      disabled={isManualSyncing}
                      onClick={handleTriggerManualSync}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-60 transition cursor-pointer shadow-md shadow-cyan-950/40 active:scale-95 disabled:active:scale-100 flex items-center gap-2"
                    >
                      {isManualSyncing ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>กำลังดึงข้อมูลจาก HOSxP…</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="size-3.5" />
                          <span>ซิงค์ข้อมูล HOSxP ตอนนี้ (Manual Sync)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Database Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                    <div className="text-[10.5px] text-slate-400 font-medium">HOSxP Database</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Connected (Source)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">192.168.1.250:3306</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                    <div className="text-[10.5px] text-slate-400 font-medium">Data Warehouse</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {sysStatus?.database ?? 'dw_hd-check'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{sysStatus?.host ?? '192.168.1.241'}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                    <div className="text-[10.5px] text-slate-400 font-medium">ใบสั่งยาในระบบ</div>
                    <div className="text-xs font-bold text-white mt-1 font-mono">
                      {sysStatus?.totalPrescriptions ? Number(sysStatus.totalPrescriptions).toLocaleString() : '...'} รายการ
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">ยาสมุนไพร {sysStatus?.totalDrugs ?? '...'} รายการ</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                    <div className="text-[10.5px] text-slate-400 font-medium">การซิงค์ล่าสุด</div>
                    <div className="text-xs font-bold text-teal-300 mt-1 font-mono truncate">
                      {sysStatus?.lastSync?.at ? sysStatus.lastSync.at.replace('T', ' ') : 'ระบบอัตโนมัติ'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">รอบออโต้ทุก {sysStatus?.autoSyncMinutes ?? 5} นาที</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-white/[0.06] bg-slate-950 dark:bg-[var(--card-header)] shrink-0 text-sm">
          <div className="text-slate-400 font-normal">
            {activeTab === 'admin_system'
              ? 'SMART-HOSCHECK • HerbDx ระบบบริหารจัดการและควบคุมส่วนกลางสำหรับ Admin'
              : activeTab === 'admin_policy'
                ? 'ปุ่มเปิด/ปิดบัญชีแก้สถานะใน HOSxP • การรีเซ็ต 2FA/PIN แก้ข้อมูลใน dw_hd-check'
                : 'PIN/2FA เก็บในฐาน dw_hd-check เท่านั้น'}
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10 transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Interactive Photo Cropper Modal */}
      <ProfileAvatarModal
        isOpen={isCropperOpen}
        onClose={() => {
          setIsCropperOpen(false)
          setCropperFile(null)
        }}
        initialFile={cropperFile}
      />

      {/* Modern Professional Confirm Dialog */}
      {confirmConfig && (
        <ConfirmModal
          isOpen={Boolean(confirmConfig)}
          isLoading={isConfirmLoading}
          onClose={() => !isConfirmLoading && setConfirmConfig(null)}
          {...confirmConfig}
          onConfirm={handleExecuteModalConfirm}
        />
      )}
    </div>
  )
}
