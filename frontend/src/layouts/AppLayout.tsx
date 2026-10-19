import { useEffect, useState, type FC, type ReactNode } from 'react'
import { ArrowUp, MoreHorizontal } from 'lucide-react'
import { Sidebar, NAV_ITEMS } from '@/components/Sidebar'
import { AuditHeader } from '@/components/AuditHeader'
import { VersionChangelogModal } from '@/components/VersionChangelogModal'
import { VersionUpdateNotice } from '@/components/VersionUpdateNotice'
import { AiChatCopilot } from '@/components/AiChatCopilot'
import type { ActivePage, DbStatus, SyncResult } from '@/types/herbdx.types'
import { cn } from '@/lib/utils'

const PRIMARY_NAV_IDS: readonly ActivePage[] = ['dashboard', 'audit', 'drugs', 'mapping']

interface AppLayoutProps {
  readonly activePage: ActivePage
  readonly onPageChange: (page: ActivePage) => void
  readonly status: DbStatus | undefined
  readonly isStatusError: boolean
  readonly statusError: string | null
  readonly onSync: () => void
  readonly isSyncing: boolean
  readonly syncResult: SyncResult | undefined
  readonly syncError: string | null
  readonly children: ReactNode
}

export const AppLayout: FC<AppLayoutProps> = ({
  activePage,
  onPageChange,
  status,
  isStatusError,
  statusError,
  onSync,
  isSyncing,
  syncResult,
  syncError,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === 'true'
    }
    return false
  })

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  return (
    <div className="min-h-dvh bg-themed-app text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-violet-500 selection:text-white antialiased transition-colors duration-300">
      <div className="flex-1 flex min-w-0">
        {/* Left Sidebar: Desktop Collapsible + Mobile Slide-over Drawer */}
        <Sidebar
          active={activePage}
          onChange={onPageChange}
          status={status}
          statusError={isStatusError}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          onOpenChangelog={() => setChangelogOpen(true)}
        />

        {/* Main Application Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Sticky Header matching Hospital Theme */}
          <AuditHeader
            page={activePage}
            status={status}
            statusError={statusError}
            onSync={onSync}
            isSyncing={isSyncing}
            syncResult={syncResult}
            syncError={syncError}
            collapsed={collapsed}
            onToggleCollapse={handleToggleCollapse}
            onOpenMobileMenu={() => { setMoreOpen(false); setMobileMenuOpen(true) }}
            onOpenChangelog={() => setChangelogOpen(true)}
          />

          {/* Main Content Area (Adaptive Padding: Mobile, Tablet, Desktop) */}
          <main className={cn('flex-1 p-3.5 sm:p-4.5 md:p-5 lg:p-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-14 space-y-4 w-full mx-auto', collapsed ? 'max-w-none' : 'max-w-[1600px]')}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile & Tablet Bottom Navigation Bar: 4 primary items + "more" sheet */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-themed-card border-t border-themed p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-white/20" />
            <div className="grid grid-cols-3 gap-2">
              {NAV_ITEMS.filter((n) => !PRIMARY_NAV_IDS.includes(n.id)).map(({ id, icon: Icon, shortLabel }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onPageChange(id)
                    setMoreOpen(false)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 min-h-16 rounded-xl border border-themed text-xs cursor-pointer active:scale-95 transition',
                    activePage === id ? 'text-accent font-bold bg-slate-100 dark:bg-white/10' : 'text-slate-600 dark:text-slate-300'
                  )}
                >
                  <Icon className="size-5" />
                  <span>{shortLabel}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className={cn("lg:hidden fixed bottom-0 inset-x-0 z-50 bg-themed-header backdrop-blur-md border-t border-slate-200 dark:border-[#30364b] py-1 px-2 flex items-stretch justify-around shadow-2xl select-none safe-bottom", mobileMenuOpen && "hidden")}>
        {NAV_ITEMS.filter((n) => PRIMARY_NAV_IDS.includes(n.id)).map(({ id, icon: Icon, shortLabel }) => {
          const isActive = activePage === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMoreOpen(false)
                onPageChange(id)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className={cn(
                'flex-1 min-h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer relative active:scale-95',
                isActive ? 'text-accent font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              {isActive && (
                <span className="absolute -top-1 size-1.5 rounded-full bg-emerald-500 dark:bg-teal-400 shadow-sm shadow-emerald-400" />
              )}
              <Icon className={cn('size-5 transition-transform', isActive && 'scale-110 text-accent')} />
              <span className="text-[11px] leading-tight tracking-tight truncate max-w-full px-0.5">{shortLabel}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className={cn(
            'flex-1 min-h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer active:scale-95',
            moreOpen || !PRIMARY_NAV_IDS.includes(activePage) ? 'text-accent font-bold' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          <MoreHorizontal className="size-5" />
          <span className="text-[11px] leading-tight">เพิ่มเติม</span>
        </button>
      </nav>

      {/* Back-to-top: Perfectly stacked above the AI Chat Copilot button with 3D response */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="เลื่อนขึ้นบนสุด"
        title="เลื่อนขึ้นบนสุด"
        className={cn(
          'fixed right-3.5 sm:right-5 lg:right-6 z-30 size-10 sm:size-11 grid place-items-center rounded-full text-white shadow-xl backdrop-blur-md transition-all duration-300 cursor-pointer active:scale-95',
          'bg-gradient-to-b from-slate-700/90 to-slate-900/95 hover:from-slate-600 hover:to-slate-800 border-t border-white/30 ring-1 ring-white/10 shadow-[0_6px_16px_-2px_rgba(0,0,0,0.4)]',
          'bottom-[calc(8rem+env(safe-area-inset-bottom,0px))] lg:bottom-[7rem]',
          showScrollTop && !mobileMenuOpen && !moreOpen ? 'opacity-100 translate-y-0 hover:-translate-y-1 hover:scale-105' : 'opacity-0 translate-y-3 pointer-events-none'
        )}
      >
        <ArrowUp className="size-4.5 sm:size-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
      </button>

      {/* Hospital System Desktop Bottom Status Bar */}
      <footer className="hidden lg:flex fixed bottom-0 inset-x-0 z-30 h-9 bg-themed-card border-t border-themed px-4 text-[11px] text-slate-600 dark:text-slate-300 items-center justify-between gap-3 whitespace-nowrap overflow-hidden select-none">
        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
          <span>
            HOSxP Database :{' '}
            <strong className="text-teal-700 dark:text-teal-300">เชื่อมต่อแล้ว (Connected)</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">|</span>
          <span>ระบบ : <strong className="text-slate-900 dark:text-white">แผนกการแพทย์แผนไทย</strong></span>
          <span className="text-slate-300 dark:text-white/20">|</span>
          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
            <img
              src="/api/auth/avatar/aekkapon"
              alt="นายเอกพล อันคำวงศ์"
              className="size-5 rounded-full object-cover border border-teal-500/50 shadow-xs inline-block"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <span className="font-bold text-violet-600 dark:text-violet-400">ผู้พัฒนา:</span>
            <strong className="text-slate-900 dark:text-white">นายเอกพล อันคำวงศ์</strong>
            <span className="hidden 2xl:inline text-slate-500 dark:text-slate-400">(นักวิชาการคอมพิวเตอร์ปฏิบัติการ)</span>
            <span className="hidden xl:inline text-slate-500 dark:text-slate-400 font-sans">• โทร. 257 IT กลุ่มงานสุขภาพดิจิทัล</span>
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            Online
          </span>
          <button
            type="button"
            onClick={() => setChangelogOpen(true)}
            className="inline-flex items-center gap-1.5 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer group"
            title="คลิกเพื่อดูบันทึกการอัปเดตเวอร์ชัน"
          >
            <span>SMART-HOSCHECK • HerbDx v{__APP_VERSION__}</span>
            <span className="size-1.5 rounded-full bg-teal-500 group-hover:scale-125 transition-transform" />
          </button>
        </div>
      </footer>

      {/* Floating AI Smart Copilot Chat Widget */}
      <AiChatCopilot />

      {/* Version Changelog & Release Notes Modal */}
      <VersionChangelogModal
        isOpen={changelogOpen}
        onClose={() => setChangelogOpen(false)}
      />

      {/* Floating toast notification for new release */}
      <VersionUpdateNotice
        serverVersion={status?.appVersion}
        onOpenChangelog={() => setChangelogOpen(true)}
      />
    </div>
  )
}
