import { useState, type FC, type ReactNode } from 'react'
import { Sidebar, NAV_ITEMS } from '@/components/Sidebar'
import { AuditHeader } from '@/components/AuditHeader'
import { VersionChangelogModal } from '@/components/VersionChangelogModal'
import { VersionUpdateNotice } from '@/components/VersionUpdateNotice'
import type { ActivePage, DbStatus, SyncResult } from '@/types/herbdx.types'
import { cn } from '@/lib/utils'

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
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />

          {/* Main Content Area (Adaptive Padding: Mobile, Tablet, Desktop) */}
          <main className={cn('flex-1 p-3.5 sm:p-4.5 md:p-5 lg:p-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-6 space-y-4 w-full mx-auto', collapsed ? 'max-w-none' : 'max-w-[1600px]')}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile & Tablet Bottom Navigation Bar (Thumb-Friendly PWA App Bar) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-themed-header backdrop-blur-md border-t border-slate-200 dark:border-[#30364b] py-1.5 px-3 flex items-center justify-around shadow-2xl select-none safe-bottom">
        {NAV_ITEMS.map(({ id, icon: Icon }) => {
          const isActive = activePage === id
          const shortLabel =
            id === 'audit' ? 'ตรวจสอบยา' :
            id === 'drugs' ? 'สรุปจ่ายยา' :
            id === 'mapping' ? 'ตรวจรหัส' :
            id === 'dxwriteback' ? 'ทบทวน DX' :
            id === 'dxmap' ? 'เกณฑ์ ICD' : 'SQL'

          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                onPageChange(id)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer relative active:scale-95',
                isActive ? 'text-accent font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              {isActive && (
                <span className="absolute -top-1.5 size-1.5 rounded-full bg-emerald-500 dark:bg-teal-400 shadow-sm shadow-emerald-400" />
              )}
              <Icon className={cn('size-5 transition-transform', isActive && 'scale-110 text-accent')} />
              <span className="text-[10px] tracking-tight">{shortLabel}</span>
            </button>
          )
        })}
      </nav>

      {/* Hospital System Desktop Bottom Status Bar */}
      <footer className="hidden lg:flex bg-themed-card border-t border-themed py-2 px-4 text-[11px] text-slate-600 dark:text-slate-300 flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-3">
          <span>
            HOSxP Database :{' '}
            <strong className="text-teal-700 dark:text-teal-300">เชื่อมต่อแล้ว (Connected)</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">|</span>
          <span>ระบบ : <strong className="text-slate-900 dark:text-white">แผนกการแพทย์แผนไทย</strong></span>
          <span className="text-slate-300 dark:text-white/20">|</span>
          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
            <span className="font-bold text-violet-600 dark:text-violet-400">ผู้พัฒนา:</span>
            <strong className="text-slate-900 dark:text-white">นายเอกพล อันคำวงค์</strong>
            <span className="text-slate-500 dark:text-slate-400">(นักวิชาการคอมพิวเตอร์ปฏิบัติการ)</span>
            <span className="text-slate-500 dark:text-slate-400 font-sans">• โทร. 257 IT กลุ่มงานสุขภาพดิจิทัล</span>
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono">
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

      {/* Version Changelog & Release Notes Modal */}
      <VersionChangelogModal
        isOpen={changelogOpen}
        onClose={() => setChangelogOpen(false)}
      />

      {/* Floating toast notification for new release */}
      <VersionUpdateNotice
        onOpenChangelog={() => setChangelogOpen(true)}
      />
    </div>
  )
}
