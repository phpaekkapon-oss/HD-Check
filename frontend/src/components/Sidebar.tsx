import { useState, type FC } from 'react'
import {
  ClipboardCheck,
  Leaf,
  Pill,
  Settings2,
  TerminalSquare,
  Building2,
  X,
  PanelLeftClose,
  ShieldCheck,
  ScanSearch,
  Send,
  Cpu,
} from 'lucide-react'
import type { ActivePage, DbStatus } from '@/types/herbdx.types'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { Security2FASettingsModal } from '@/components/Security2FASettingsModal'
import { isAdminUser } from '@/types/auth.types'
import { cn } from '@/lib/utils'

export interface NavItem {
  readonly id: ActivePage
  readonly label: string
  readonly shortLabel?: string
  readonly hint: string
  readonly icon: typeof Pill
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'audit', label: 'ตรวจสอบการจ่ายยาสมุนไพร', shortLabel: 'ตรวจสอบยา', hint: 'ยา + DX ตรงข้อบ่งใช้', icon: ClipboardCheck },
  { id: 'drugs', label: 'รายการจ่ายยาสมุนไพร', shortLabel: 'รายการจ่ายยา', hint: 'OPD / IPD / ต้นทุน', icon: Pill },
  { id: 'mapping', label: 'ตรวจรหัสยาและ ICD-10', shortLabel: 'ตรวจรหัส', hint: 'รหัสว่าง / เกณฑ์ไม่ครบ', icon: ScanSearch },
  { id: 'dxwriteback', label: 'ทบทวน DX รายครั้งรับบริการ', shortLabel: 'ทบทวน DX', hint: 'เตรียมตรวจการส่งกลับ HOSxP', icon: Send },
  { id: 'dxmap', label: 'ตั้งค่ายา ↔ ICD-10', shortLabel: 'เกณฑ์ ICD-10', hint: 'เกณฑ์การตรวจสอบ', icon: Settings2 },
  { id: 'sql', label: 'SQL Query', shortLabel: 'SQL Query', hint: 'คำสั่งต้นฉบับ', icon: TerminalSquare },
]

interface SidebarProps {
  readonly active: ActivePage
  readonly onChange: (page: ActivePage) => void
  readonly status: DbStatus | undefined
  readonly statusError: boolean
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
  readonly mobileOpen?: boolean
  readonly onMobileClose?: () => void
  readonly onOpenChangelog?: () => void
}

export const Sidebar: FC<SidebarProps> = ({
  active,
  onChange,
  status,
  statusError,
  collapsed,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
  onOpenChangelog,
}) => {
  const { accent, mode } = useTheme()
  const { user } = useAuth()
  const isAdmin = isAdminUser(user)
  const [securityModalOpen, setSecurityModalOpen] = useState(false)
  const [securityInitialTab, setSecurityInitialTab] = useState<'my_profile' | 'my_2fa' | 'my_pin' | 'admin_policy' | 'admin_system'>('my_profile')
  const [aboutModalOpen, setAboutModalOpen] = useState(false)

  const content = (isMobileView: boolean, isCollapsedView: boolean) => (
    <div
      className="flex h-full flex-col bg-[var(--sidebar-bg)] text-slate-800 dark:text-slate-100 select-none border-r border-slate-200 dark:border-[var(--sidebar-border)] transition-colors duration-300"
    >
      {/* Brand Header (แพทย์แผนไทย / ยาสมุนไพร SMART-HOSCHECK) */}
      <div className={cn(
        'flex items-center h-16 border-b border-slate-200 dark:border-white/10 px-3.5 transition-all duration-300',
        isCollapsedView ? 'justify-center px-2' : 'justify-between'
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={isCollapsedView ? onToggleCollapse : undefined}
            disabled={!isCollapsedView}
            className={cn(
              'grid place-items-center size-9.5 rounded-xl shrink-0 transition-all duration-300 shadow-md',
              isCollapsedView ? 'hover:scale-105 cursor-pointer' : 'cursor-default'
            )}
            style={{
              background: `linear-gradient(135deg, ${accent.hex} 0%, ${accent.darkText} 100%)`,
              boxShadow: `0 4px 16px ${accent.glow}`,
            }}
            title={isCollapsedView ? 'คลิกเพื่อขยายแถบเมนู (Expand)' : 'SMART-HOSCHECK ตรวจสอบยาสมุนไพร โรงพยาบาลพังโคน'}
          >
            <Leaf className="size-5 text-white drop-shadow-md stroke-[2.4]" />
          </button>
          {!isCollapsedView && (
            <div className="leading-tight min-w-0 animate-fade-in">
              <div
                className="text-[9.5px] uppercase font-bold font-mono tracking-wider transition-colors"
                style={{ color: mode === 'dark' ? accent.darkText : accent.hex }}
              >
                HOSxP HERB-CHECK
              </div>
              <div className="font-extrabold text-slate-900 dark:text-white tracking-tight text-sm truncate">SMART-HOSCHECK</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">แพทย์แผนไทย • รพ.พังโคน</div>
            </div>
          )}
        </div>

        {/* Toggle Button on Desktop / Close on Mobile */}
        {isMobileView ? (
          <button
            type="button"
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition"
            aria-label="ปิดเมนู"
          >
            <X className="size-5" />
          </button>
        ) : (
          !isCollapsedView && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition cursor-pointer"
              title="ย่อแถบเมนู (Collapse Sidebar)"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-2.5 space-y-1.5 overflow-y-auto scrollbar-none">
        {!isCollapsedView && (
          <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <span
              className="size-1 rounded-full"
              style={{ backgroundColor: mode === 'dark' ? accent.darkText : accent.hex }}
            />
            เมนูหลัก
          </div>
        )}

        {NAV_ITEMS.map(({ id, label, hint, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              id={`nav-${id}`}
              type="button"
              onClick={() => {
                onChange(id)
                if (isMobileView && onMobileClose) onMobileClose()
              }}
              title={isCollapsedView ? `${label} (${hint})` : undefined}
              className={cn(
                'group w-full flex items-center rounded-xl transition-all duration-200 cursor-pointer relative',
                isCollapsedView
                  ? 'justify-center p-2.5 my-1'
                  : 'gap-3 px-3.5 py-2.5 text-left',
                isActive
                  ? 'border shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
              )}
              style={
                isActive
                  ? {
                      background: mode === 'dark'
                        ? `linear-gradient(90deg, color-mix(in srgb, ${accent.hex} 18%, transparent) 0%, color-mix(in srgb, ${accent.hex} 7%, transparent) 100%)`
                        : `linear-gradient(90deg, color-mix(in srgb, ${accent.hex} 14%, white) 0%, color-mix(in srgb, ${accent.hex} 5%, white) 100%)`,
                      borderColor: `color-mix(in srgb, ${accent.hex} 35%, transparent)`,
                      boxShadow: `0 2px 10px color-mix(in srgb, ${accent.hex} 14%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.08)`,
                    }
                  : undefined
              }
            >
              {/* Left Active Glow Indicator Bar */}
              {isActive && !isCollapsedView && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full shadow-xs"
                  style={{
                    backgroundColor: mode === 'dark' ? accent.darkText : accent.hex,
                    boxShadow: `0 0 8px ${accent.glow}`,
                  }}
                />
              )}

              <Icon
                className={cn(
                  'shrink-0 transition-transform duration-200 group-hover:scale-105',
                  isCollapsedView ? 'size-5' : 'size-4.5',
                  isActive
                    ? 'stroke-[2.2]'
                    : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                )}
                style={isActive ? { color: mode === 'dark' ? accent.darkText : accent.hex } : undefined}
              />

              {!isCollapsedView && (
                <span className="min-w-0 flex-1 animate-fade-in pl-0.5">
                  <span className={cn('block text-[13px] truncate', isActive ? 'text-slate-900 dark:text-white font-semibold' : 'font-medium')}>
                    {label}
                  </span>
                  <span className={cn('block text-[10.5px] truncate mt-0.5', isActive ? 'text-slate-600 dark:text-slate-300 font-normal' : 'text-slate-500 dark:text-slate-400')}>
                    {hint}
                  </span>
                </span>
              )}

              {/* Collapsed Active Indicator Dot */}
              {isCollapsedView && isActive && (
                <span
                  className="absolute left-1 size-1 rounded-full shadow-xs"
                  style={{ backgroundColor: mode === 'dark' ? accent.darkText : accent.hex }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Settings Action */}
      <div className="p-2.5 border-t border-slate-200 dark:border-white/10 space-y-1.5">
        <button
          type="button"
          onClick={() => {
            onChange('dxmap')
            if (isMobileView && onMobileClose) onMobileClose()
          }}
          title={isCollapsedView ? 'ตั้งค่ายาสมุนไพร ↔ ICD-10' : undefined}
          className={cn(
            'group w-full flex items-center rounded-xl transition-all cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.05]',
            isCollapsedView ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
          )}
        >
          <Settings2 className="size-4.5 shrink-0 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-transform group-hover:rotate-45" />
          {!isCollapsedView && <span className="text-xs font-medium truncate">การตั้งค่า</span>}
        </button>

        {/* 2FA Security Action (Visible to Admin / IT staff only) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setSecurityInitialTab('my_profile')
              setSecurityModalOpen(true)
              if (isMobileView && onMobileClose) onMobileClose()
            }}
            title={isCollapsedView ? 'ความปลอดภัย 2FA & PIN (เฉพาะ Admin / IT)' : undefined}
            className={cn(
              'group w-full flex items-center rounded-xl transition-all cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.05]',
              isCollapsedView ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
            )}
          >
            <div className="relative shrink-0">
              <ShieldCheck className="size-4.5 text-slate-500 dark:text-slate-400 group-hover:text-emerald-400 transition-colors" />
              {user?.two_factor_enabled && (
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-400" />
              )}
            </div>
            {!isCollapsedView && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="text-xs font-medium truncate">ความปลอดภัย 2FA & PIN</span>
                {user?.two_factor_enabled ? (
                  <span className="text-[9.5px] font-mono text-emerald-500 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">
                    ON
                  </span>
                ) : (
                  <span className="text-[9.5px] font-mono text-slate-400 bg-white/5 px-1 rounded">
                    OFF
                  </span>
                )}
              </div>
            )}
          </button>
        )}

        {/* Admin System Management & Version Control Hub */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setSecurityInitialTab('admin_system')
              setSecurityModalOpen(true)
              if (isMobileView && onMobileClose) onMobileClose()
            }}
            title={isCollapsedView ? 'จัดการระบบ & เวอร์ชัน (เฉพาะ Admin)' : undefined}
            className={cn(
              'group w-full flex items-center rounded-xl transition-all cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.05]',
              isCollapsedView ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
            )}
          >
            <div className="relative shrink-0">
              <Cpu className="size-4.5 text-slate-500 dark:text-slate-400 group-hover:text-violet-400 transition-colors" />
              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-violet-400 animate-pulse" />
            </div>
            {!isCollapsedView && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="text-xs font-medium truncate">จัดการระบบ & เวอร์ชัน</span>
                <span className="text-[9px] font-mono font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1 py-0.2 rounded">
                  ADMIN
                </span>
              </div>
            )}
          </button>
        )}
      </div>

      {/* Hospital Footer Branding (Standard Clean Enterprise Card) */}
      <div className="p-2 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setAboutModalOpen(true)}
          className={cn(
            'w-full flex items-center rounded-xl p-2 text-left hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer group',
            isCollapsedView ? 'justify-center' : 'gap-2.5'
          )}
          title="ข้อมูลโรงพยาบาลและผู้พัฒนาระบบ (คลิกเพื่อดูรายละเอียด)"
        >
          <div className="size-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
            <Building2 className="size-4" />
          </div>
          {!isCollapsedView && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  โรงพยาบาลพังโคน
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenChangelog?.()
                  }}
                  className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 px-1.5 py-0.5 rounded transition cursor-pointer shrink-0"
                  title="คลิกเพื่อดูบันทึกการอัปเดตเวอร์ชัน"
                >
                  v{__APP_VERSION__}
                </button>
              </div>
              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center justify-between">
                <span>แพทย์แผนไทย</span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  เกี่ยวกับระบบ →
                </span>
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar with Expand/Collapse Width */}
      <aside
        className={cn(
          'hidden lg:flex shrink-0 flex-col select-none transition-all duration-300 ease-in-out',
          collapsed ? 'w-18' : 'w-64'
        )}
      >
        {content(false, collapsed)}
      </aside>

      {/* Mobile Slide-over Drawer with Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={onMobileClose}
          />
          <div className="relative w-72 max-w-[80vw] h-dvh shadow-2xl z-10 animate-slide-right">
            {content(true, false)}
          </div>
        </div>
      )}

      {/* About System & Developer Modal (Clean Hospital Enterprise Standard) */}
      {aboutModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setAboutModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 p-5 shadow-2xl space-y-4 animate-scale-in text-slate-800 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 grid place-items-center">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    โรงพยาบาลพังโคน
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAboutModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 space-y-1">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>SMART-HOSCHECK</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAboutModalOpen(false)
                      onOpenChangelog?.()
                    }}
                    className="font-mono text-[11px] text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    title="คลิกเพื่อดูบันทึกการอัปเดต"
                  >
                    <span>v{__APP_VERSION__}</span>
                    <span className="text-[10px] text-teal-500 font-sans font-normal">(ดูอัปเดต)</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  ระบบตรวจสอบเวชระเบียนการสั่งใช้ยาสมุนไพรตามเงื่อนไขข้อบ่งใช้ ICD-10 / ICD-10-TM
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 space-y-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  ข้อมูลผู้พัฒนา & ฝ่ายเทคโนโลยี
                </div>
                <div className="font-bold text-slate-900 dark:text-white text-xs">
                  👨‍💻 นายเอกพล อันคำวงศ์
                </div>
                <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                  นักวิชาการคอมพิวเตอร์ปฏิบัติการ
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                  กลุ่มงานสุขภาพดิจิทัล • โทร. 257 IT
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 text-[11.5px]">
                <span className="text-slate-500 dark:text-slate-400">การเชื่อมต่อ HOSxP</span>
                <span className={cn('font-semibold inline-flex items-center gap-1.5', statusError ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400')}>
                  <span className={cn('size-1.5 rounded-full', statusError ? 'bg-rose-500' : status ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                  {statusError ? 'ขาดการเชื่อมต่อ' : status ? 'Online พร้อมใช้งาน' : 'กำลังตรวจสอบ…'}
                </span>
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setAboutModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Security Modal & Admin System Hub */}
      <Security2FASettingsModal
        isOpen={securityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
        initialTab={securityInitialTab}
        onOpenChangelog={onOpenChangelog}
      />
    </>
  )
}
