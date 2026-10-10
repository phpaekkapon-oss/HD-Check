import { useState, type FC } from 'react'
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

  if (!isOpen) return null

  const activeRelease = releases.find((r) => r.version === selectedVersion) || releases[0]

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-[#131627] border border-slate-200 dark:border-[#292440] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with decorative gradient banner */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-indigo-500/10 dark:from-teal-500/15 dark:via-cyan-500/15 dark:to-indigo-500/15 border-b border-slate-200 dark:border-[#26233d]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/25 text-white">
                <Sparkles className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    บันทึกการอัปเดตระบบ
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                    <Tag className="size-3" /> v{currentVersion} ล่าสุด
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  สิ่งที่ได้รับการพัฒนา ปรับปรุง และแก้ไขในระบบ SMART-HOSCHECK
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="ปิด"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Version Selector Tabs */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto scrollbar-none pb-0.5">
            {releases.map((rel) => {
              const isSelected = rel.version === selectedVersion
              const isLatest = rel.version === currentVersion

              return (
                <button
                  key={rel.version}
                  type="button"
                  onClick={() => setSelectedVersion(rel.version)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0',
                    isSelected
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                      : 'bg-white/80 dark:bg-[#1a1e36] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2f2b4a] hover:bg-white dark:hover:bg-[#222744]'
                  )}
                >
                  <GitBranch className="size-3.5" />
                  <span>v{rel.version}</span>
                  {isLatest && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded font-black',
                        isSelected ? 'bg-white/20 text-white' : 'bg-teal-500/20 text-teal-600 dark:text-teal-400'
                      )}
                    >
                      ล่าสุด
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {activeRelease ? (
            <>
              {/* Release Title & Date */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100 dark:border-[#22263d]">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {activeRelease.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <Calendar className="size-3.5 text-slate-400" />
                    <span>เผยแพร่เมื่อ: {activeRelease.date}</span>
                    <span>•</span>
                    <span className="capitalize font-semibold text-teal-600 dark:text-teal-400">
                      Release Type: {activeRelease.type}
                    </span>
                  </div>
                </div>

                <a
                  href="https://github.com/phpaekkapon-oss/HD-Check"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#1a1e36] hover:bg-slate-200 dark:hover:bg-[#252a48] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#34304a] transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <ExternalLink className="size-3.5" />
                  <span>ดูบน GitHub</span>
                </a>
              </div>

              {/* Highlights */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
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

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#111425] border-t border-slate-200 dark:border-[#26233d] flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>ระบบทำงานอัตโนมัติเชื่อมต่อกับ GitHub Repository</span>
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
