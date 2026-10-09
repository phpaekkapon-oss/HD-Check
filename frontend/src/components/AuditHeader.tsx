import { useState, useEffect, type FC } from 'react'
import {
  AlertCircle,
  CloudDownload,
  Download,
  Loader2,
  PanelLeft,
  Smartphone,
  User,
  Clock,
  Maximize2,
  Minimize2,
  X,
  Palette,
  Moon,
  Sun,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Lock,
  Camera,
} from 'lucide-react'
import type { ActivePage, DbStatus, SyncResult } from '@/types/herbdx.types'
import { NAV_ITEMS, type NavItem } from '@/components/Sidebar'
import { ThemeCustomizerPopover } from '@/components/ThemeCustomizerModal'
import { Security2FASettingsModal } from '@/components/Security2FASettingsModal'
import { ProfileAvatarModal } from '@/components/ProfileAvatarModal'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { usePinLock } from '@/context/PinLockContext'
import { cn } from '@/lib/utils'
import { fmtNum, toThaiDate, THAI_MONTHS_SHORT } from '@/lib/format'
import { AnimatedNumber } from '@/components/AnimatedNumber'


interface AuditHeaderProps {
  readonly page: ActivePage
  readonly onPageChange: (page: ActivePage) => void
  readonly status: DbStatus | undefined
  readonly statusError: string | null
  readonly onSync: () => void
  readonly isSyncing: boolean
  readonly syncResult: SyncResult | undefined
  readonly syncError: string | null
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
  readonly onOpenMobileMenu?: () => void
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const AuditHeader: FC<AuditHeaderProps> = ({
  page,
  onPageChange,
  status,
  statusError,
  onSync,
  isSyncing,
  syncResult,
  syncError,
  collapsed,
  onToggleCollapse,
  onOpenMobileMenu,
}) => {
  const current = NAV_ITEMS.find((n: NavItem) => n.id === page)
  const last = status?.lastSync

  // Live Thai Clock & Date (updates every second)
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const day = now.getDate()
  const monthShort = THAI_MONTHS_SHORT[now.getMonth()]
  const yearBE = (now.getFullYear() + 543).toString().slice(-2) // e.g. 69
  const timeFormatted = now.toTimeString().slice(0, 8) // HH:MM:SS
  const liveDateTimeStr = `${day} ${monthShort} ${yearBE}  ${timeFormatted}`

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showPwaTip, setShowPwaTip] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone)
    ) {
      setIsInstalled(true)
    }

    const win = window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }
    if (win.__pwaInstallPrompt) {
      setDeferredPrompt(win.__pwaInstallPrompt)
    }

    const onPromptReady = () => {
      if (win.__pwaInstallPrompt) {
        setDeferredPrompt(win.__pwaInstallPrompt)
      }
    }

    const onAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      win.__pwaInstallPrompt = null
    }

    const handler = (e: Event) => {
      try { e.preventDefault() } catch (_) {}
      const pe = e as BeforeInstallPromptEvent
      win.__pwaInstallPrompt = pe
      setDeferredPrompt(pe)
    }

    window.addEventListener('pwa-prompt-ready', onPromptReady)
    window.addEventListener('pwa-installed', onAppInstalled)
    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('pwa-prompt-ready', onPromptReady)
      window.removeEventListener('pwa-installed', onAppInstalled)
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    const win = window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }
    const prompt = deferredPrompt || win.__pwaInstallPrompt
    if (prompt) {
      try {
        await prompt.prompt()
        const { outcome } = await prompt.userChoice
        if (outcome === 'accepted') {
          setIsInstalled(true)
        }
      } catch (err) {
        console.error('PWA prompt error:', err)
      } finally {
        setDeferredPrompt(null)
        win.__pwaInstallPrompt = null
      }
    } else {
      setShowPwaTip(true)
      setTimeout(() => setShowPwaTip(false), 12000)
    }
  }

  // Theme controls
  const { mode, toggleMode, accent } = useTheme()
  const [themeCustomizerOpen, setThemeCustomizerOpen] = useState(false)

  // Auth & 2FA controls
  const { user, logout } = useAuth()
  const { lockNow, hasPin, pinEnabled, autoLockMinutes } = usePinLock()
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [securityModalOpen, setSecurityModalOpen] = useState(false)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [securityInitialTab, setSecurityInitialTab] = useState<'my_profile' | 'my_2fa' | 'my_pin' | 'admin_policy'>('my_2fa')

  return (
    <header className="sticky top-0 z-30 bg-themed-header text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#30364b] select-none shadow-sm dark:shadow-md transition-colors">
      <div className="flex items-center justify-between gap-2.5 px-3.5 sm:px-5 min-h-16 py-2">
        {/* Left Section: Sidebar Toggle, Standardized Clean Title & Metadata */}
        <div className="flex items-center gap-3 min-w-0 mr-auto">
          {/* Desktop Toggle Button: แสดงเฉพาะตอน Sidebar ย่ออยู่เพื่อกดขยายกลับมา */}
          {collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition cursor-pointer"
              title="ขยายเมนู (Expand)"
            >
              <PanelLeft className="size-5" />
            </button>
          )}

          {/* Mobile Drawer Trigger Button */}
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden size-9 grid place-items-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition cursor-pointer shrink-0 border border-slate-200/80 dark:border-white/10"
            aria-label="เปิดเมนู"
          >
            <PanelLeft className="size-4.5" />
          </button>

          {/* Clean Enterprise Title & Subtitle Hierarchy */}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {current?.label}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium font-sans">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                HOSxP Online
              </span>
            </div>

            {/* Clean Metadata Line (แทนที่กล่องป้ายซ้อนทับกันหลายชิ้นแบบเดิม) */}
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 font-sans truncate">
              {statusError ? (
                <span className="inline-flex items-center gap-1 text-rose-500 dark:text-rose-400 truncate">
                  <AlertCircle className="size-3.5 shrink-0" /> {statusError}
                </span>
              ) : last ? (
                <div className="flex items-center gap-2 truncate">
                  <span className="text-slate-500 dark:text-slate-400">
                    ซิงก์ล่าสุด: {toThaiDate(last.start_date)} – {toThaiDate(last.end_date)}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 select-none">•</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    สะสมในระบบ <strong className="text-slate-800 dark:text-slate-100 font-bold"><AnimatedNumber value={status?.totalPrescriptions ?? 0} /></strong> รายการ
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 select-none hidden md:inline">•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium hidden md:inline">
                    Auto-Sync
                  </span>
                </div>
              ) : (
                <span>กำลังเชื่อมต่อฐานข้อมูล…</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Standardized Professional Utilities, Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Live Thai Date & Clock (Clean Subtle Pill) */}
          <div className="hidden xl:flex items-center gap-2 px-3 h-9 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-300">
            <Clock className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium tracking-wide">{liveDateTimeStr}</span>
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-xs shadow-emerald-400" />
          </div>

          {/* Utility Icon Group (Fullscreen, Theme Toggle, Palette Customizer) */}
          <div className="hidden sm:flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 active:scale-95 transition cursor-pointer"
              title={isFullscreen ? 'ออกจากเต็มจอ' : 'เปิดเต็มจอ'}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>

            <button
              type="button"
              onClick={toggleMode}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 active:scale-95 transition cursor-pointer"
              title={mode === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง (Light Mode)' : 'เปลี่ยนเป็นโหมดมืด (Dark Mode)'}
            >
              {mode === 'dark' ? (
                <Moon className="size-4 text-amber-300" />
              ) : (
                <Sun className="size-4 text-amber-500" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setThemeCustomizerOpen((prev) => !prev)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 active:scale-95 transition cursor-pointer relative"
                title="ปรับแต่งธีม (5 ธีม + 12 เฉดสี)"
              >
                <Palette className="size-4 transition-transform hover:scale-110" style={{ color: accent.hex }} />
                <span
                  className="absolute top-1 right-1 size-1.5 rounded-full"
                  style={{ backgroundColor: accent.hex }}
                />
              </button>

              <ThemeCustomizerPopover
                isOpen={themeCustomizerOpen}
                onClose={() => setThemeCustomizerOpen(false)}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-white/10" />

          {/* PWA Install Button (Clean Responsive Size-9 / h-9 Pill) */}
          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="size-9 md:w-auto md:px-3 grid place-items-center md:flex md:items-center md:gap-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold active:scale-95 transition cursor-pointer shrink-0"
              title="ติดตั้ง SMART-HOSCHECK เป็นแอปพลิเคชันบนเครื่อง"
            >
              <Smartphone className="size-4 text-teal-600 dark:text-teal-400" />
              <span className="hidden md:inline">ติดตั้งแอป</span>
            </button>
          )}

          {/* Sync Result / Error feedback */}
          {syncError && (
            <span className="hidden 2xl:inline text-xs text-rose-500 dark:text-rose-400 font-mono truncate max-w-xs" title={syncError}>
              {syncError}
            </span>
          )}
          {syncResult && !syncError && !isSyncing && (
            <span className="hidden 2xl:inline text-xs text-emerald-600 dark:text-emerald-400 font-mono">
              +{fmtNum(syncResult.totalPrescriptions)}
            </span>
          )}

          {/* Primary Action: HOSxP Sync Button (Strict Uniform h-9 Height & Responsive on Mobile) */}
          <button
            id="btn-sync-hosxp"
            type="button"
            onClick={onSync}
            disabled={isSyncing || Boolean(status?.isSyncing)}
            className="btn-pill-action size-9 sm:w-auto sm:px-3.5 grid place-items-center sm:flex sm:items-center sm:gap-1.5 text-xs font-bold text-white active:scale-95 transition disabled:opacity-60 disabled:cursor-wait cursor-pointer rounded-xl shadow-xs shrink-0"
            title={isSyncing || status?.isSyncing ? 'กำลังดึงข้อมูล HOSxP…' : 'ดึงข้อมูล HOSxP'}
          >
            {isSyncing || status?.isSyncing ? (
              <Loader2 className="size-4 animate-spin shrink-0" />
            ) : (
              <CloudDownload className="size-4 shrink-0" />
            )}
            <span className="hidden sm:inline">
              {isSyncing || status?.isSyncing ? 'กำลังดึง…' : 'ดึง HOSxP'}
            </span>
          </button>

          {/* Quick Lock Button (Strict Uniform h-9 Height & Responsive on Mobile) */}
          <button
            type="button"
            onClick={() => {
              if (hasPin) {
                lockNow()
              } else {
                setSecurityInitialTab('my_pin')
                setSecurityModalOpen(true)
              }
            }}
            className="size-9 md:w-auto md:px-3 grid place-items-center md:flex md:items-center md:gap-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-amber-500/10 active:scale-95 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200 dark:border-white/10 text-xs font-semibold cursor-pointer transition shrink-0"
            title={hasPin ? 'ล็อกหน้าจอทันที (Ctrl + L)' : 'ตั้งรหัส PIN ล็อกหน้าจอ'}
          >
            <Lock className="size-4 text-slate-500 dark:text-slate-400" />
            <span className="hidden md:inline">{hasPin ? 'ล็อกหน้าจอ' : 'ตั้ง PIN'}</span>
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 shrink-0" />

          {/* User Profile Pill (Strict Uniform h-9 Height with Proportional Avatar) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="group flex items-center gap-2 h-9 p-0.5 xl:pr-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <div
                className="grid place-items-center size-8 sm:size-8.5 rounded-full bg-slate-100 dark:bg-white/15 border-2 shrink-0 text-slate-700 dark:text-white shadow-xs overflow-hidden ring-1 ring-black/5 dark:ring-white/10 transition-all duration-200 group-hover:ring-2"
                style={{
                  borderColor: accent.hex,
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden',
                }}
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name || 'Profile'}
                    className="w-full h-full object-cover select-none"
                    style={{
                      imageRendering: '-webkit-optimize-contrast',
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden',
                    }}
                  />
                ) : (
                  <User className="size-4 text-slate-400 dark:text-slate-300" />
                )}
              </div>
              <div className="hidden xl:block text-left leading-tight">
                <div
                  className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[170px]"
                  title={user?.name || ''}
                >
                  {user?.name || 'นายเอกพล อันคำวงค์'}
                </div>
                <div
                  className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate max-w-[170px] mt-0.5"
                  title={user?.position || user?.entryposition || user?.groupname || 'เจ้าหน้าที่ HOSxP'}
                >
                  {user?.position || user?.entryposition || user?.groupname || 'เจ้าหน้าที่ HOSxP'}
                </div>
              </div>
              <ChevronDown className="size-3.5 text-slate-400 group-hover:text-slate-200 transition-colors hidden xl:block" />
            </button>

            {/* User Dropdown Menu */}
            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-76 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 shadow-2xl z-50 p-2 text-slate-800 dark:text-white animate-scale-in">
                  <div className="p-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] rounded-xl mb-1.5">
                    <div className="flex items-center gap-3 mb-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false)
                          setAvatarModalOpen(true)
                        }}
                        className="relative group size-14 rounded-full overflow-hidden border-2 border-teal-500/50 bg-slate-100 dark:bg-slate-800 grid place-items-center shadow-lg shrink-0 cursor-pointer focus:outline-none"
                        title="คลิกเพื่อเปลี่ยนหรือปรับแต่งรูปโปรไฟล์"
                      >
                        {user?.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <User className="size-7 text-slate-400 dark:text-slate-500" />
                        )}
                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center text-white">
                          <Camera className="size-4.5 drop-shadow" />
                        </div>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">
                          {user?.name || 'ผู้ใช้งาน'}
                        </div>
                        <div
                          className="text-[11px] text-teal-600 dark:text-teal-300 font-medium truncate mt-0.5"
                          title={user?.position || user?.entryposition || ''}
                        >
                          {user?.position || user?.entryposition || user?.groupname || 'เจ้าหน้าที่ HOSxP'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                          @{user?.loginname} {user?.groupname && user?.position && user.position !== user.groupname ? `• สิทธิ์ ${user.groupname}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          user?.two_factor_enabled
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        )}
                      >
                        <ShieldCheck className="size-3" />
                        {user?.two_factor_enabled ? '2FA: เปิด' : '2FA: ยังไม่เปิด'}
                      </span>

                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          hasPin && pinEnabled
                            ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30'
                            : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
                        )}
                      >
                        <Lock className="size-3" />
                        {hasPin && pinEnabled ? `PIN: ${autoLockMinutes}น.` : hasPin ? 'PIN: ปิดชั่วคราว' : 'PIN: ยังไม่ตั้ง'}
                      </span>
                    </div>
                  </div>

                  {/* Lock Screen Button (Always Visible in Menu) */}
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false)
                      if (hasPin) {
                        lockNow()
                      } else {
                        setSecurityInitialTab('my_pin')
                        setSecurityModalOpen(true)
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold rounded-xl text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition cursor-pointer mb-1 shadow-xs"
                    title={hasPin ? 'ล็อกหน้าจอทันที ไม่ให้ผู้อื่นเข้าดูข้อมูล (Ctrl + L)' : 'คลิกเพื่อตั้งรหัส PIN สำหรับล็อกหน้าจอ'}
                  >
                    <div className="flex items-center gap-2.5">
                      <Lock className="size-4 text-amber-500 dark:text-amber-400" />
                      <span>{hasPin ? 'ล็อกหน้าจอทันที' : 'ตั้ง PIN เพื่อล็อกหน้าจอ'}</span>
                    </div>
                    {hasPin ? (
                      <kbd className="px-1.5 py-0.5 rounded bg-white/40 dark:bg-white/10 text-[10px] font-mono text-amber-800 dark:text-amber-200">Ctrl+L</kbd>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">เริ่มตั้งค่า</span>
                    )}
                  </button>

                  {/* Change Profile Photo Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false)
                      setAvatarModalOpen(true)
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
                  >
                    <Camera className="size-4 text-teal-600 dark:text-teal-400" />
                    <span>จัดการรูปโปรไฟล์ (Profile Photo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false)
                      setSecurityInitialTab('my_2fa')
                      setSecurityModalOpen(true)
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
                  >
                    <ShieldCheck className="size-4 text-emerald-500 dark:text-emerald-400" />
                    <span>ตั้งค่าความปลอดภัย (2FA & PIN)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false)
                      logout()
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition cursor-pointer mt-0.5"
                  >
                    <LogOut className="size-4" />
                    <span>ออกจากระบบ (Logout)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Security & 2FA Settings Modal */}
      <Security2FASettingsModal
        isOpen={securityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
        initialTab={securityInitialTab}
      />

      {/* User Avatar Photo Modal */}
      <ProfileAvatarModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
      />

      {/* PWA Install Tip Banner */}
      {showPwaTip && (
        <div className="bg-teal-700 dark:bg-[#124259] text-white px-4 py-2 text-xs flex items-center justify-between gap-3 animate-fade-in border-t border-teal-400/20">
          <div className="flex items-center gap-2">
            <Download className="size-4 text-emerald-300 shrink-0" />
            <span>
              <strong>วิธีติดตั้งแอป:</strong> บน <strong>Google Chrome/Edge</strong> คลิกไอคอนติดตั้งที่แถบ URL หรือบน <strong>iPhone/iPad</strong> แตะปุ่มแชร์ แล้วเลือก <strong>'เพิ่มไปยังหน้าจอโฮม' (Add to Home Screen)</strong>
            </span>
          </div>
          <button type="button" onClick={() => setShowPwaTip(false)} className="text-slate-200 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Responsive 4-Column navigation bar on mobile / tablet */}
      <nav className="lg:hidden px-2.5 sm:px-3.5 pb-2 border-t border-slate-200 dark:border-white/10 pt-1.5 bg-themed-header">
        <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
          {NAV_ITEMS.map(({ id, label, shortLabel, icon: Icon }: NavItem) => (
            <button
              key={id}
              type="button"
              onClick={() => onPageChange(id)}
              className={cn(
                'inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-1.5 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-medium cursor-pointer transition text-center truncate',
                page === id
                  ? 'bg-accent text-white font-bold shadow-xs'
                  : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5'
              )}
              title={label}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{shortLabel ?? label}</span>
            </button>
          ))}
        </div>
      </nav>
    </header>
  )
}
