import { useState, useEffect, type FC } from 'react'
import { Sparkles, X, ChevronRight, ExternalLink, RefreshCw, Zap } from 'lucide-react'
import changelogData from '@/data/changelog.json'

interface VersionUpdateNoticeProps {
  readonly currentVersion?: string
  readonly serverVersion?: string
  readonly onOpenChangelog: () => void
}

export const VersionUpdateNotice: FC<VersionUpdateNoticeProps> = ({
  currentVersion = __APP_VERSION__,
  serverVersion,
  onOpenChangelog,
}) => {
  const [showNotice, setShowNotice] = useState(false)
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null)
  const [isReloading, setIsReloading] = useState(false)
  const latestRelease = changelogData[0]

  // 1. Real-time background detection: Poll /api/version every 15s without needing page refresh
  useEffect(() => {
    let isMounted = true

    const checkServerVersion = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data?.version && data.version !== currentVersion && isMounted) {
          setRemoteVersion(data.version)
          setShowNotice(true)
        }
      } catch {
        // network silent ignore
      }
    }

    // Check immediately on mount
    checkServerVersion()

    // Poll every 15 seconds
    const interval = setInterval(checkServerVersion, 15_000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [currentVersion])

  // 2. React to serverVersion from props (via status polling in useDbStatus)
  useEffect(() => {
    if (serverVersion && serverVersion !== currentVersion) {
      setRemoteVersion(serverVersion)
      setShowNotice(true)
    }
  }, [serverVersion, currentVersion])

  // 3. Post-reload announcement: If user just updated, show release summary once
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const notifyEnabled = localStorage.getItem('hd_check_notify_enabled') !== 'false'
      const lastSeen = localStorage.getItem('hd_check_last_seen_version')
      if (notifyEnabled && lastSeen !== currentVersion && !remoteVersion) {
        timer = setTimeout(() => setShowNotice(true), 800)
      }
    } catch {
      // ignore
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [currentVersion, remoteVersion])

  if (!showNotice) return null

  const isServerUpgradePending = Boolean(remoteVersion && remoteVersion !== currentVersion)
  const activeVersion = remoteVersion || currentVersion

  const handleDismiss = () => {
    setShowNotice(false)
    try {
      localStorage.setItem('hd_check_last_seen_version', activeVersion)
    } catch {
      // ignore
    }
  }

  const handleView = () => {
    setShowNotice(false)
    onOpenChangelog()
  }

  // One-click instant update without manual Ctrl+F5
  const handleInstantUpdate = async () => {
    setIsReloading(true)
    try {
      localStorage.setItem('hd_check_last_seen_version', activeVersion)
      // Flush client caches if CacheStorage is available
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map((name) => caches.delete(name)))
      }
    } catch {
      // ignore
    }

    // Force reload with query cache buster
    const url = new URL(window.location.href)
    url.searchParams.set('_v', Date.now().toString())
    window.location.replace(url.toString())
  }

  const titleText = isServerUpgradePending
    ? `ระบบบนเซิร์ฟเวอร์ได้รับการอัปเดตเป็น v${remoteVersion} เรียบร้อยแล้ว กดปุ่มเพื่อเริ่มใช้งานทันที`
    : latestRelease?.title || 'มีการปรับปรุงและอัปเดตระบบเวอร์ชันใหม่'

  const githubReleaseUrl = `https://github.com/phpaekkapon-oss/HD-Check/releases/tag/v${activeVersion}`

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="relative p-3.5 sm:p-4 rounded-2xl bg-white/95 dark:bg-[#161a2f]/95 backdrop-blur-md border border-teal-500/40 dark:border-teal-500/50 shadow-2xl shadow-teal-500/20 flex items-start gap-3">
        <div className="size-9 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-teal-500/25">
          {isServerUpgradePending ? (
            <Zap className="size-4.5 animate-bounce" />
          ) : (
            <Sparkles className="size-4 animate-spin-slow" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-slate-900 dark:text-white">
              {isServerUpgradePending ? 'มีอัปเดตเวอร์ชันใหม่พร้อมใช้งาน!' : 'อัปเดตระบบเรียบร้อย!'}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400 font-mono border border-teal-500/30">
              v{activeVersion}
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
            {titleText}
          </p>

          {/* Quick Action: Instant Reload Button if server has newer version */}
          {isServerUpgradePending ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={isReloading}
                onClick={handleInstantUpdate}
                className="w-full px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-teal-500/20 active:scale-95 transition cursor-pointer"
              >
                <RefreshCw className={`size-3.5 ${isReloading ? 'animate-spin' : ''}`} />
                <span>{isReloading ? 'กำลังโหลดเวอร์ชันใหม่…' : 'อัปเดตทันที (โหลดใหม่)'}</span>
              </button>
            </div>
          ) : (
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
          )}
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
