import { useState, useMemo, type FC } from 'react'
import {
  Sparkles,
  X,
  CheckCircle2,
  Calendar,
  Tag,
  GitBranch,
  ExternalLink,
  Check,
  ChevronRight,
  ShieldCheck,
  Zap,
  Wrench,
  Search,
  Bell,
  BellOff,
  RefreshCw,
  SlidersHorizontal,
  History,
} from 'lucide-react'
import changelogData from '@/data/changelog.json'
import { cn } from '@/lib/utils'

export interface ReleaseLog {
  version: string
  date: string
  title: string
  type: string
  highlights: string[]
  categories?: {
    features?: string[]
    improvements?: string[]
    fixes?: string[]
  }
}

interface VersionChangelogModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly currentVersion?: string
}

export const VersionChangelogModal: FC<VersionChangelogModalProps> = ({
  isOpen,
  onClose,
  currentVersion = __APP_VERSION__,
}) => {
  const releases = changelogData as ReleaseLog[]
  const [selectedVersion, setSelectedVersion] = useState<string>(releases[0]?.version || currentVersion)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'minor' | 'patch'>('ALL')
  const [showSettings, setShowSettings] = useState(false)
  const [notifyEnabled, setNotifyEnabled] = useState(() => {
    try {
      return localStorage.getItem('hd_check_notify_enabled') !== 'false'
    } catch {
      return true
    }
  })
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [checkResult, setCheckResult] = useState<string | null>(null)

  // Filter releases based on search query and type
  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      const matchType = typeFilter === 'ALL' || r.type === typeFilter
      if (!matchType) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const inVersion = r.version.toLowerCase().includes(q)
      const inTitle = r.title.toLowerCase().includes(q)
      const inHighlights = r.highlights.some((h) => h.toLowerCase().includes(q))
      return inVersion || inTitle || inHighlights
    })
  }, [releases, searchQuery, typeFilter])

  const activeRelease = useMemo(() => {
    return releases.find((r) => r.version === selectedVersion) || filteredReleases[0] || releases[0]
  }, [releases, selectedVersion, filteredReleases])

  if (!isOpen) return null

  const handleToggleNotify = () => {
    const next = !notifyEnabled
    setNotifyEnabled(next)
    try {
      localStorage.setItem('hd_check_notify_enabled', String(next))
    } catch {
      // ignore
    }
  }

  const handleCheckUpdate = () => {
    setCheckingUpdate(true)
    setCheckResult(null)
    setTimeout(() => {
      setCheckingUpdate(false)
      setCheckResult(`คุณกำลังใช้งานเวอร์ชันล่าสุด (v${currentVersion}) เรียบร้อยแล้ว`)
    }, 600)
  }

  const handleAcknowledge = () => {
    try {
      localStorage.setItem('hd_check_last_seen_version', currentVersion)
    } catch {
      // ignore
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-[88vh] max-h-[750px] flex flex-col rounded-3xl bg-white dark:bg-[#131627] border border-slate-200 dark:border-[#292440] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="relative p-4 sm:p-5 bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-indigo-500/10 dark:from-teal-500/15 dark:via-cyan-500/15 dark:to-indigo-500/15 border-b border-slate-200 dark:border-[#26233d] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 sm:size-11 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/25 text-white shrink-0">
              <Sparkles className="size-5 sm:size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  บันทึกการอัปเดตระบบ SMART-HOSCHECK
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30 font-mono">
                  <Tag className="size-3" /> v{currentVersion} ล่าสุด
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ประวัติเวอร์ชัน ฟีเจอร์ใหม่ และการปรับปรุงประสิทธิภาพ ({releases.length} รายการ)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border',
                showSettings
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white/80 dark:bg-[#1a1e36] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#34304a] hover:bg-slate-100 dark:hover:bg-white/10'
              )}
              title="ตั้งค่าการแจ้งเตือน"
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden md:inline">ตั้งค่า</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="ปิด"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Settings Panel */}
        {showSettings && (
          <div className="p-4 bg-slate-50 dark:bg-[#101325] border-b border-slate-200 dark:border-[#26233d] flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Notification Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifyEnabled}
                  onChange={handleToggleNotify}
                  className="sr-only"
                />
                <div
                  className={cn(
                    'w-9 h-5 rounded-full transition-colors relative p-0.5',
                    notifyEnabled ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700'
                  )}
                >
                  <div
                    className={cn(
                      'size-4 rounded-full bg-white transition-transform shadow-xs',
                      notifyEnabled ? 'translate-x-4' : 'translate-x-0'
                    )}
                  />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  {notifyEnabled ? <Bell className="size-3.5 text-teal-500" /> : <BellOff className="size-3.5 text-slate-400" />}
                  แจ้งเตือน Popup อัตโนมัติเมื่อมีเวอร์ชันใหม่
                </span>
              </label>

              {/* Check Update Button */}
              <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-white dark:bg-[#1a1e36] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#34304a] hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <RefreshCw className={cn('size-3 text-teal-500', checkingUpdate && 'animate-spin')} />
                <span>ตรวจสอบเวอร์ชันใหม่</span>
              </button>
            </div>

            {checkResult && (
              <span className="text-teal-600 dark:text-teal-400 font-medium">
                {checkResult}
              </span>
            )}
          </div>
        )}

        {/* Master-Detail Body: Split View Left Timeline + Right Content */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Panel: Search & Version Timeline (Scales to 100+ versions cleanly) */}
          <div className="w-full md:w-72 lg:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-[#26233d] flex flex-col bg-slate-50/50 dark:bg-[#111425]/50 shrink-0">
            {/* Search Box & Type Filter */}
            <div className="p-3 space-y-2 border-b border-slate-200 dark:border-[#26233d]">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาเวอร์ชัน, ฟีเจอร์, บั๊ก..."
                  className="w-full rounded-xl bg-white dark:bg-[#181c33] border border-slate-200 dark:border-[#2f3555] pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Type Filter Pills */}
              <div className="flex items-center gap-1 text-[11px]">
                {(['ALL', 'minor', 'patch'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      'px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer capitalize',
                      typeFilter === t
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    {t === 'ALL' ? 'ทั้งหมด' : t}
                  </button>
                ))}
                <span className="ml-auto text-[10px] text-slate-400 font-mono">
                  {filteredReleases.length} รุ่น
                </span>
              </div>
            </div>

            {/* Scrollable Version List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {filteredReleases.map((rel) => {
                const isSelected = rel.version === activeRelease?.version
                const isLatest = rel.version === currentVersion

                return (
                  <button
                    key={rel.version}
                    type="button"
                    onClick={() => setSelectedVersion(rel.version)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex flex-col gap-1',
                      isSelected
                        ? 'bg-white dark:bg-[#1e233d] border border-teal-500/40 dark:border-teal-500/50 shadow-sm'
                        : 'hover:bg-white/60 dark:hover:bg-white/5 border border-transparent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 font-mono">
                        <GitBranch className={cn('size-3.5', isSelected ? 'text-teal-500' : 'text-slate-400')} />
                        <span className={cn('text-xs font-bold', isSelected ? 'text-teal-600 dark:text-teal-400' : 'text-slate-900 dark:text-white')}>
                          v{rel.version}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {isLatest && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-black bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                            ล่าสุด
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {rel.date}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {rel.title}
                    </p>
                  </button>
                )
              })}

              {filteredReleases.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  ไม่พบเวอร์ชันที่ตรงกับคำค้น
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Detailed Release Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {activeRelease ? (
              <>
                {/* Release Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#22263d]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                        v{activeRelease.version}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {activeRelease.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      <Calendar className="size-3.5 text-slate-400" />
                      <span>เผยแพร่เมื่อ: {activeRelease.date}</span>
                      <span>•</span>
                      <span className="capitalize font-semibold text-teal-600 dark:text-teal-400">
                        ประเภท: {activeRelease.type} Release
                      </span>
                    </div>
                  </div>

                  {/* Direct GitHub Release Tag Link */}
                  <a
                    href={`https://github.com/phpaekkapon-oss/HD-Check/releases/tag/v${activeRelease.version}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#1a1e36] hover:bg-slate-200 dark:hover:bg-[#252a48] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#34304a] transition-colors self-start sm:self-auto cursor-pointer shrink-0"
                    title={`เปิดดู Release v${activeRelease.version} และ Commit History บน GitHub`}
                  >
                    <ExternalLink className="size-3.5 text-teal-500" />
                    <span>Release v{activeRelease.version} บน GitHub</span>
                  </a>
                </div>

                {/* Highlights */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <History className="size-3.5 text-teal-500" />
                    ไฮไลท์เด่นในเวอร์ชันนี้
                  </h4>
                  <div className="grid gap-2">
                    {activeRelease.highlights.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#171b30] border border-slate-200/80 dark:border-[#282d49]"
                      >
                        <CheckCircle2 className="size-4 text-teal-500 shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                          {h}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Categorized details */}
                {activeRelease.categories && (
                  <div className="space-y-4 pt-2">
                    {/* Features */}
                    {activeRelease.categories.features && activeRelease.categories.features.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <Zap className="size-3.5" />
                          <span>ฟีเจอร์ใหม่ (New Features)</span>
                        </div>
                        <ul className="space-y-1.5 pl-2">
                          {activeRelease.categories.features.map((f, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300"
                            >
                              <ChevronRight className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Improvements */}
                    {activeRelease.categories.improvements && activeRelease.categories.improvements.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400">
                          <ShieldCheck className="size-3.5" />
                          <span>ปรับปรุงประสิทธิภาพและ UX (Improvements)</span>
                        </div>
                        <ul className="space-y-1.5 pl-2">
                          {activeRelease.categories.improvements.map((imp, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300"
                            >
                              <ChevronRight className="size-3.5 text-cyan-500 shrink-0 mt-0.5" />
                              <span>{imp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Fixes */}
                    {activeRelease.categories.fixes && activeRelease.categories.fixes.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                          <Wrench className="size-3.5" />
                          <span>แก้ไขข้อผิดพลาด (Bug Fixes)</span>
                        </div>
                        <ul className="space-y-1.5 pl-2">
                          {activeRelease.categories.fixes.map((fix, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300"
                            >
                              <ChevronRight className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span>{fix}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-slate-400 text-sm py-8">ไม่พบข้อมูลเวอร์ชันนี้</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-[#111425] border-t border-slate-200 dark:border-[#26233d] flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="hidden sm:inline">เชื่อมต่อประวัติ Release กับ GitHub Repository อัตโนมัติ</span>
            <span className="sm:hidden">GitHub Synchronized</span>
          </div>

          <button
            type="button"
            onClick={handleAcknowledge}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-md shadow-teal-500/25 transition-all cursor-pointer active:scale-95"
          >
            <Check className="size-4" />
            <span>รับทราบแล้ว</span>
          </button>
        </div>
      </div>
    </div>
  )
}
