import { useEffect, useRef, useState, type FC } from 'react'
import {
  LayoutDashboard,
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
  ExternalLink,
  Activity,
  Banknote,
  BadgeCheck,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import type { ActivePage, DbStatus } from '@/types/herbdx.types'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { Security2FASettingsModal } from '@/components/Security2FASettingsModal'
import { SystemOverview } from '@/components/SystemOverview'
import { useMenuPermissions } from '@/hooks/useHerbDx'
import { canViewThaiMedValue, isAdminUser } from '@/types/auth.types'
import { cn } from '@/lib/utils'

export interface NavItem {
  readonly id: ActivePage
  readonly label: string
  readonly shortLabel?: string
  readonly hint: string
  readonly icon: typeof Pill
  /** เมนูเฉพาะผู้ดูแลระบบ (เช่น SQL ที่เปิดเผยชื่อตารางฐานข้อมูล) */
  readonly adminOnly?: boolean
  /** เมนูที่เปิดรายคน (IT หรือผู้ดูแลแผนไทย) ไม่ผูกกับตารางสิทธิ์เมนูตามกลุ่ม */
  readonly perUser?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'หน้าแรก', shortLabel: 'หน้าแรก', hint: 'สรุปภาพรวมและตัวชี้วัด', icon: LayoutDashboard },
  { id: 'audit', label: 'ตรวจสอบการจ่ายยาสมุนไพร', shortLabel: 'ตรวจสอบยา', hint: 'ยา + DX ตรงข้อบ่งใช้', icon: ClipboardCheck },
  { id: 'healthmed', label: 'ตรวจหัตถการแผนไทย', shortLabel: 'ตรวจหัตถการ', hint: 'นวด/ประคบ/ซ้ำ/หลังคลอด', icon: Activity },
  { id: 'claims', label: 'ตรวจการเบิก สปสช.', shortLabel: 'การเบิก สปสช.', hint: 'รหัสก่อนเบิก + ผลเบิกจาก FDH', icon: BadgeCheck },
  { id: 'drugs', label: 'รายการจ่ายยาสมุนไพร', shortLabel: 'รายการจ่ายยา', hint: 'OPD / IPD / ต้นทุน', icon: Pill },
  { id: 'mapping', label: 'ตรวจรหัสยาและ ICD-10', shortLabel: 'ตรวจรหัส', hint: 'รหัสว่าง / เกณฑ์ไม่ครบ', icon: ScanSearch },
  { id: 'dxwriteback', label: 'ทบทวนรหัสโรค (DX)', shortLabel: 'ทบทวน DX', hint: 'เตรียมตรวจการส่งกลับ HOSxP', icon: Send },
  { id: 'dxmap', label: 'ตั้งค่ายา ↔ ICD-10', shortLabel: 'เกณฑ์ ICD-10', hint: 'เกณฑ์การตรวจสอบ', icon: Settings2 },
  { id: 'thaimedvalue', label: 'รายได้แผนไทย', shortLabel: 'รายได้แผนไทย', hint: 'มูลค่าบริการ (ประมาณการ)', icon: Banknote, perUser: true },
  { id: 'sql', label: 'SQL Query', shortLabel: 'SQL Query', hint: 'คำสั่งต้นฉบับ (เฉพาะผู้ดูแลระบบ)', icon: TerminalSquare, adminOnly: true },
]

/**
 * เมนูที่ผู้ใช้คนนี้เห็นได้: ตามสิทธิ์ที่ IT ตั้งไว้ (allowed จาก /api/permissions/menus)
 * ระหว่างโหลดสิทธิ์ใช้กฎเดิม (ซ่อนเมนู adminOnly จากผู้ที่ไม่ใช่ IT)
 */
export const visibleNavItems = (isAdmin: boolean, allowed?: readonly string[], canViewValue = false): readonly NavItem[] =>
  NAV_ITEMS.filter((n) => {
    if (n.perUser) return canViewValue
    return allowed ? allowed.includes(n.id) : !n.adminOnly || isAdmin
  })

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

const SYSTEM_ITEM =
  'group w-full flex items-center rounded-xl transition cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
const SYSTEM_ICON = 'size-4.5 shrink-0 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'

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
  const displayVersion = (status?.appVersion || __APP_VERSION__).replace(/^v/, '')
  const { data: menuPerms } = useMenuPermissions(Boolean(user))
  // รายการเมนูยาวกว่าความสูงจอ (เช่นมือถือ): บอกใบ้ว่าเลื่อนได้ด้วยแถบเลื่อนบางๆ และแถบจางพร้อมข้อความที่ท้ายรายการ
  const navRef = useRef<HTMLElement>(null)
  const [navHasMore, setNavHasMore] = useState(false)
  const updateNavHasMore = () => {
    const el = navRef.current
    if (el) setNavHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8)
  }
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    updateNavHasMore()
    const ro = new ResizeObserver(updateNavHasMore)
    ro.observe(el)
    return () => ro.disconnect()
  }, [mobileOpen, collapsed, menuPerms, isAdmin])
  const [securityModalOpen, setSecurityModalOpen] = useState(() => {
    try {
      return sessionStorage.getItem('hd_check_security_modal_open') === 'true'
    } catch {
      return false
    }
  })
  const [securityInitialTab, setSecurityInitialTab] = useState<
    'my_profile' | 'my_2fa' | 'my_pin' | 'admin_policy' | 'admin_system' | 'admin_sso' | 'admin_menus'
  >(() => {
    try {
      const saved = sessionStorage.getItem('hd_check_security_modal_tab')
      if (
        saved &&
        ['my_profile', 'my_2fa', 'my_pin', 'admin_policy', 'admin_system', 'admin_sso', 'admin_menus'].includes(saved)
      ) {
        return saved as any
      }
    } catch {}
    return 'admin_policy'
  })
  const [aboutModalOpen, setAboutModalOpen] = useState(false)
  // ป้ายชื่อเมนูลอยด้านขวาเมื่อย่อแถบเมนู (แทน title ของเบราว์เซอร์ที่ขึ้นช้าและถูกบัง)
  const [tip, setTip] = useState<{ label: string; hint?: string; top: number; left: number } | null>(null)

  useEffect(() => {
    setTip(null)
  }, [collapsed, active])

  // เปิดหน้าต่างเกี่ยวกับระบบ/ผู้พัฒนาจากส่วนอื่น (เช่น ชื่อผู้พัฒนาในแถบสถานะล่าง)
  useEffect(() => {
    const open = () => setAboutModalOpen(true)
    window.addEventListener('open-about-system', open)
    return () => window.removeEventListener('open-about-system', open)
  }, [])

  // เปิดหน้าต่างความปลอดภัย/จัดการระบบจากส่วนอื่น
  useEffect(() => {
    const handleOpenSecurity = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab || 'my_profile'
      setSecurityInitialTab(tab)
      setSecurityModalOpen(true)
    }
    window.addEventListener('open-security-modal', handleOpenSecurity)
    return () => window.removeEventListener('open-security-modal', handleOpenSecurity)
  }, [])

  const tipProps = (isCollapsedView: boolean, label: string, hint?: string) => {
    if (!isCollapsedView) return {}
    const show = (e: { currentTarget: HTMLElement }) => {
      const r = e.currentTarget.getBoundingClientRect()
      setTip({ label, hint, top: r.top + r.height / 2, left: r.right + 10 })
    }
    const hide = () => setTip(null)
    return { 'aria-label': hint ? `${label} — ${hint}` : label, onMouseEnter: show, onFocus: show, onMouseLeave: hide, onBlur: hide }
  }

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
            title={isCollapsedView ? undefined : 'SMART-HOSCHECK ตรวจสอบยาสมุนไพร โรงพยาบาลพังโคน'}
            {...tipProps(isCollapsedView, 'ขยายแถบเมนู', 'SMART-HOSCHECK')}
          >
            <Leaf className="size-5 text-white drop-shadow-md stroke-[2.4]" />
          </button>
          {!isCollapsedView && (
            <div className="leading-tight min-w-0 animate-fade-in">
              <div
                className="text-xs uppercase font-bold font-mono tracking-wider transition-colors"
                style={{ color: mode === 'dark' ? accent.darkText : accent.hex }}
              >
                HOSxP HERB-CHECK
              </div>
              <div className="font-extrabold text-slate-900 dark:text-white tracking-tight text-sm truncate">SMART-HOSCHECK</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">แพทย์แผนไทย • รพ.พังโคน</div>
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
              title="ย่อแถบเมนู"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )
        )}
      </div>

      {/* Navigation List */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <nav ref={navRef} onScroll={updateNavHasMore} className="flex-1 min-h-0 p-2.5 space-y-1.5 overflow-y-auto overscroll-contain">
        {!isCollapsedView && (
          <div className="px-2.5 pt-2 pb-1 text-xs font-bold uppercase tracking-wider font-mono text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
            <span
              className="size-1 rounded-full"
              style={{ backgroundColor: mode === 'dark' ? accent.darkText : accent.hex }}
            />
            เมนูหลัก
          </div>
        )}

        {visibleNavItems(isAdmin, menuPerms?.myMenus, canViewThaiMedValue(user)).map(({ id, label, hint, icon: Icon }) => {
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
              title={isCollapsedView ? undefined : hint}
              {...tipProps(isCollapsedView, label, hint)}
              className={cn(
                'group w-full flex items-center rounded-xl transition-all duration-200 cursor-pointer relative',
                isCollapsedView
                  ? 'justify-center p-2.5 my-1'
                  : cn('gap-3 px-3.5 text-left', isMobileView ? 'min-h-12 py-2' : 'min-h-11 py-2'),
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
                  <span className={cn('block truncate text-sm', isActive ? 'text-slate-900 dark:text-white font-semibold' : 'font-medium')}>
                    {label}
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
      {navHasMore && !isCollapsedView && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-gradient-to-t from-[var(--sidebar-bg)] via-[var(--sidebar-bg)]/85 to-transparent pb-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 shadow-xs dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
            เลื่อนดูเมนูเพิ่ม <ChevronDown className="size-3" />
          </span>
        </div>
      )}
      </div>

      {/* System actions */}
      <div className="p-2.5 border-t border-slate-200 dark:border-white/10 space-y-1">
        {!isCollapsedView && (
          <div className="px-3 pb-1 pt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">ระบบ</div>
        )}
        <button
          type="button"
          onClick={() => {
            onChange('dxmap')
            if (isMobileView && onMobileClose) onMobileClose()
          }}
          {...tipProps(isCollapsedView, 'การตั้งค่า', 'ตั้งค่ายาสมุนไพร ↔ ICD-10')}
          className={cn(SYSTEM_ITEM, isCollapsedView ? 'justify-center p-2.5' : 'gap-3 px-3 min-h-10')}
        >
          <Settings2 className={cn(SYSTEM_ICON, 'transition-transform group-hover:rotate-45')} />
          {!isCollapsedView && <span className="text-sm font-medium truncate">การตั้งค่า</span>}
        </button>

        {/* บัญชีและความปลอดภัย (Admin / IT) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              // Admins usually open this panel to manage staff security and 2FA.
              setSecurityInitialTab('admin_policy')
              setSecurityModalOpen(true)
              if (isMobileView && onMobileClose) onMobileClose()
            }}
            {...tipProps(isCollapsedView, 'บัญชีและความปลอดภัย', user?.two_factor_enabled ? 'ผู้ใช้ HOSxP · 2FA เปิดใช้งาน' : 'ผู้ใช้ HOSxP · 2FA ปิดอยู่')}
            className={cn(SYSTEM_ITEM, isCollapsedView ? 'justify-center p-2.5' : 'gap-3 px-3 min-h-10')}
          >
            <div className="relative shrink-0">
              <ShieldCheck className={SYSTEM_ICON} />
              {isCollapsedView && user?.two_factor_enabled && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-[var(--sidebar-bg)]" />
              )}
            </div>
            {!isCollapsedView && (
              <>
                <span className="flex-1 min-w-0 text-left text-sm font-medium truncate">ความปลอดภัย</span>
                <span
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    user?.two_factor_enabled
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
                  )}
                  title={user?.two_factor_enabled ? 'ยืนยันตัวตน 2 ขั้นตอนเปิดใช้งาน' : 'ยืนยันตัวตน 2 ขั้นตอนปิดอยู่'}
                >
                  <span className={cn('size-1.5 rounded-full', user?.two_factor_enabled ? 'bg-emerald-500' : 'bg-slate-400')} />
                  2FA
                </span>
              </>
            )}
          </button>
        )}

        {/* จัดการระบบ & เวอร์ชัน (Admin) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setSecurityInitialTab('admin_system')
              setSecurityModalOpen(true)
              if (isMobileView && onMobileClose) onMobileClose()
            }}
            {...tipProps(isCollapsedView, 'จัดการระบบ', 'เวอร์ชัน · เซิร์ฟเวอร์ · เฉพาะผู้ดูแลระบบ')}
            className={cn(SYSTEM_ITEM, isCollapsedView ? 'justify-center p-2.5' : 'gap-3 px-3 min-h-10')}
          >
            <Cpu className={SYSTEM_ICON} />
            {!isCollapsedView && (
              <>
                <span className="flex-1 min-w-0 text-left text-sm font-medium truncate">จัดการระบบ</span>
                <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">ผู้ดูแล</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Hospital / about */}
      <div className="p-2.5 border-t border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => setAboutModalOpen(true)}
          className={cn(
            'group w-full flex items-center rounded-xl p-2 text-left transition hover:bg-slate-100/70 dark:hover:bg-white/[0.05] cursor-pointer',
            isCollapsedView ? 'justify-center' : 'gap-3'
          )}
          {...tipProps(isCollapsedView, 'โรงพยาบาลพังโคน', `เกี่ยวกับระบบ · v${displayVersion}`)}
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Building2 className="size-4.5" />
          </div>
          {!isCollapsedView && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">โรงพยาบาลพังโคน</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="whitespace-nowrap">แพทย์แผนไทย</span>
                <span aria-hidden className="text-slate-300 dark:text-white/20">·</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenChangelog?.()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      onOpenChangelog?.()
                    }
                  }}
                  className="shrink-0 tabular-nums hover:text-accent hover:underline"
                  title="ดูบันทึกการอัปเดตเวอร์ชัน"
                >
                  v{displayVersion}
                </span>
              </div>
            </div>
          )}
          {!isCollapsedView && (
            <ChevronRight aria-hidden className="size-4 shrink-0 text-slate-400 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
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
          'hidden lg:flex sticky top-0 h-[calc(100dvh-2.25rem)] shrink-0 flex-col select-none transition-all duration-300 ease-in-out',
          collapsed ? 'w-18' : 'w-64'
        )}
      >
        {content(false, collapsed)}
      </aside>

      {/* Flyout label for the collapsed rail (fixed, so the nav's overflow never clips it) */}
      {collapsed && tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[100] hidden lg:block -translate-y-1/2"
          style={{ top: tip.top, left: tip.left }}
        >
          <div className="relative rounded-lg bg-slate-900 px-3 py-2 text-white shadow-xl ring-1 ring-white/10 dark:bg-slate-800 animate-in fade-in slide-in-from-left-1 duration-100">
            <span className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rotate-45 bg-slate-900 dark:bg-slate-800" />
            <div className="whitespace-nowrap text-sm font-semibold">{tip.label}</div>
            {tip.hint && <div className="mt-0.5 whitespace-nowrap text-xs text-slate-300">{tip.hint}</div>}
          </div>
        </div>
      )}

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
            className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white dark:bg-[var(--card-bg)] border border-slate-200 dark:border-white/15 p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-in text-slate-800 dark:text-slate-100"
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAboutModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* App Version Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>SMART-HOSCHECK • HerbDx</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAboutModalOpen(false)
                      onOpenChangelog?.()
                    }}
                    className="font-mono text-xs text-teal-600 dark:text-teal-400 font-bold bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1"
                    title="คลิกเพื่อดูบันทึกการอัปเดตเวอร์ชัน"
                  >
                    <span>v{displayVersion}</span>
                    <span className="text-xs font-sans font-normal">(ดูอัปเดต)</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  ระบบตรวจสอบเวชระเบียนการสั่งใช้ยาสมุนไพรตามเงื่อนไขข้อบ่งใช้ ICD-10 / ICD-10-TM
                </p>
              </div>

              {/* Developer Profile Card (พร้อมรูปถ่ายข้าราชการจริงและข้อมูลผู้พัฒนา) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-teal-50/50 dark:from-slate-800/80 dark:to-teal-950/20 border border-teal-500/25 dark:border-teal-500/35 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" />
                    ผู้พัฒนาระบบ & ฝ่ายเทคโนโลยี
                  </div>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25">
                    Lead Developer
                  </span>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <img
                      src="/api/auth/avatar/aekkapon"
                      alt="นายเอกพล อันคำวงศ์"
                      className="size-15 rounded-2xl object-cover border-2 border-teal-500/50 shadow-md shadow-teal-500/15 ring-2 ring-teal-500/20"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.style.display = 'none'
                        if (target.nextElementSibling) {
                          (target.nextElementSibling as HTMLElement).style.display = 'flex'
                        }
                      }}
                    />
                    <div
                      style={{ display: 'none' }}
                      className="size-15 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-600 items-center justify-center text-white font-bold text-sm shadow-md border-2 border-teal-400/30"
                    >
                      เอกพล
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-xs grid place-items-center text-xs text-white"
                      title="ผู้พัฒนาระบบตัวจริง"
                    >
                      ✓
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-white text-sm tracking-tight truncate">
                      นายเอกพล อันคำวงศ์
                    </div>
                    <div className="text-teal-700 dark:text-teal-300 font-medium text-[11.5px] truncate">
                      นักวิชาการคอมพิวเตอร์ปฏิบัติการ
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-xs truncate">
                      กลุ่มงานสุขภาพดิจิทัล • โทร. 257 IT
                    </div>
                  </div>
                </div>

                {/* Developer Interactive Actions */}
                <div className="pt-2 flex items-center gap-2 border-t border-slate-200/70 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setAboutModalOpen(false)
                      setSecurityInitialTab('my_profile')
                      setSecurityModalOpen(true)
                    }}
                    className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    title="คลิกเพื่อดูโปรไฟล์และสิทธิ์ผู้พัฒนา"
                  >
                    <span>คลิกดูโปรไฟล์ผู้พัฒนา</span>
                    <ExternalLink className="size-3 text-teal-600 dark:text-teal-400" />
                  </button>

                  <a
                    href="https://github.com/phpaekkapon-oss/HD-Check"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-3 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                    title="เปิดดู GitHub Source Code & Releases"
                  >
                    <span>GitHub</span>
                    <ExternalLink className="size-3 text-slate-400" />
                  </a>
                </div>
              </div>

              {/* ระบบทำงานอย่างไร (ทุกคน) + รายละเอียดเทคนิค (ผู้ดูแลระบบ) */}
              <SystemOverview status={status} statusError={statusError} isAdmin={isAdmin} />
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
