import { useState, useEffect, type FC } from 'react'
import { Sparkles, X, ChevronRight, ExternalLink } from 'lucide-react'
import changelogData from '@/data/changelog.json'

interface VersionUpdateNoticeProps {
  readonly currentVersion?: string
  readonly onOpenChangelog: () => void
}

export const VersionUpdateNotice: FC<VersionUpdateNoticeProps> = ({
  currentVersion = __APP_VERSION__,
  onOpenChangelog,
}) => {
  const [showNotice, setShowNotice] = useState(false)
  const latestRelease = changelogData[0]

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const notifyEnabled = localStorage.getItem('hd_check_notify_enabled') !== 'false'
      const lastSeen = localStorage.getItem('hd_check_last_seen_version')
      if (notifyEnabled && lastSeen !== currentVersion) {
        timer = setTimeout(() => setShowNotice(true), 800)
      }
    } catch {
      // ignore
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [currentVersion])

  if (!showNotice) return null

  const handleDismiss = () => {
    setShowNotice(false)
    try {
      localStorage.setItem('hd_check_last_seen_version', currentVersion)
    } catch {
      // ignore
    }
  }

  const handleView = () => {
    setShowNotice(false)
    onOpenChangelog()
  }

  const titleText = latestRelease?.title || 'มีการปรับปรุงและอัปเดตระบบเวอร์ชันใหม่'
  const githubReleaseUrl = `https://github.com/phpaekkapon-oss/HD-Check/releases/tag/v${currentVersion}`

  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="relative p-3.5 sm:p-4 rounded-2xl bg-white/95 dark:bg-[#161a2f]/95 backdrop-blur-md border border-teal-500/30 dark:border-teal-500/40 shadow-xl shadow-teal-500/10 flex items-start gap-3">
        <div className="size-9 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-teal-500/20">
          <Sparkles className="size-4 animate-spin-slow" />
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-slate-900 dark:text-white">
              มีอัปเดตเวอร์ชันใหม่!
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400 font-mono">
              v{currentVersion}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
            {titleText}
          </p>

          <div className="flex items-center gap-3 mt-2.5">
            <button
              type="button"
              onClick={handleView}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:text-teal-500 cursor-pointer"
            >
              <span>ดูรายละเอียด</span>
              <ChevronRight className="size-3" />
            </button>

            <a
              href={githubReleaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <span>GitHub Release</span>
              <ExternalLink className="size-2.5" />
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="ปิดการแจ้งเตือน"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
