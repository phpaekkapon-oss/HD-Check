import { useState, useEffect, useRef, type FC } from 'react'
import { Tag, X, ChevronRight, ExternalLink, RefreshCw, Zap } from 'lucide-react'
import changelogData from '@/data/changelog.json'

interface RemoteRelease {
  readonly version: string
  readonly date?: string
  readonly title: string
  readonly highlights?: readonly string[]
}

interface VersionUpdateNoticeProps {
  readonly currentVersion?: string
  readonly serverVersion?: string
  readonly onOpenChangelog: () => void
  /** ซ่อนชั่วคราวเมื่อมีแผง/เมนูมือถือเปิดอยู่ (ไม่ให้ป้ายลอยทับปุ่มในแผงนั้น) */
  readonly suppressed?: boolean
}

export const VersionUpdateNotice: FC<VersionUpdateNoticeProps> = ({
  currentVersion = __APP_VERSION__,
  serverVersion,
  onOpenChangelog,
  suppressed = false,
}) => {
  const [showNotice, setShowNotice] = useState(false)
  // เวอร์ชันบนเซิร์ฟเวอร์ที่ผู้ใช้กดปิดแล้ว: ระบบเช็กซ้ำทุก 15 วินาที ต้องไม่เด้งป้ายเดิมกลับมา
  const dismissedRemoteRef = useRef<string | null>(null)
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null)
  const [isReloading, setIsReloading] = useState(false)
  const latestRelease = changelogData[0]
  // Release notes of the version waiting on the server (read from the newly deployed changelog.json)
  const [notesOpen, setNotesOpen] = useState(false)
  const [remoteNotes, setRemoteNotes] = useState<RemoteRelease | null | 'loading' | 'missing'>(null)

  const toggleNotes = async () => {
    const next = !notesOpen
    setNotesOpen(next)
    if (!next || (remoteNotes && remoteNotes !== 'missing')) return
    setRemoteNotes('loading')
    try {
      const res = await fetch(`changelog.json?ts=${Date.now()}`, { cache: 'no-store' })
      const list = (await res.json()) as RemoteRelease[]
      setRemoteNotes(list.find((r) => r.version === remoteVersion) ?? 'missing')
    } catch {
      setRemoteNotes('missing')
    }
  }

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
          if (dismissedRemoteRef.current !== data.version) setShowNotice(true)
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
      if (dismissedRemoteRef.current !== serverVersion) setShowNotice(true)
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

  if (!showNotice || suppressed) return <NoticeOffset height={0} />
  const autoCloseMs = remoteVersion && remoteVersion !== currentVersion ? 0 : 10_000

  const isServerUpgradePending = Boolean(remoteVersion && remoteVersion !== currentVersion)
  const activeVersion = remoteVersion || currentVersion

  const handleDismiss = () => {
    setShowNotice(false)
    if (remoteVersion && remoteVersion !== currentVersion) dismissedRemoteRef.current = remoteVersion
    try {
      localStorage.setItem('hd_check_last_seen_version', activeVersion)
    } catch {
      // ignore
    }
  }

  const handleView = () => {
    handleDismiss()
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
    <ToastShell autoCloseMs={autoCloseMs} onAutoClose={() => handleDismiss()}>
      <div className={`relative p-3 lg:p-4 rounded-2xl bg-white/95 dark:bg-[#161a2f]/95 backdrop-blur-md border border-teal-500/40 dark:border-teal-500/50 shadow-2xl shadow-teal-500/20 flex ${notesOpen ? 'items-start' : 'items-center'} lg:items-start gap-3`}>
        <div className="size-9 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-teal-500/25">
          {isServerUpgradePending ? <Zap className="size-4.5" /> : <Tag className="size-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-slate-900 dark:text-white">
              {isServerUpgradePending ? 'มีเวอร์ชันใหม่' : 'อัปเดตระบบเรียบร้อย!'}
            </span>
            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400 font-mono border border-teal-500/30">
              v{activeVersion}
            </span>
          </div>

          {/* Details only on desktop; on phones the toast stays one compact row */}
          <p className="hidden lg:block text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">{titleText}</p>

          {isServerUpgradePending && (
            <button
              type="button"
              onClick={() => void toggleNotes()}
              aria-expanded={notesOpen}
              className="inline-flex items-center gap-1 min-h-8 text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-500 cursor-pointer"
            >
              <span>{notesOpen ? 'ซ่อนรายละเอียด' : 'มีอะไรใหม่?'}</span>
              <ChevronRight className={`size-3 transition-transform ${notesOpen ? 'rotate-90' : ''}`} />
            </button>
          )}
          {isServerUpgradePending && notesOpen && (
            <div className="mt-1 mb-1 max-h-48 overflow-y-auto rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-2.5 text-xs text-slate-700 dark:text-slate-200">
              {remoteNotes === 'loading' || remoteNotes === null ? (
                <span className="text-slate-500">กำลังโหลด…</span>
              ) : remoteNotes === 'missing' ? (
                <span className="text-slate-500">ยังไม่มีบันทึกของเวอร์ชันนี้ กดอัปเดตแล้วดูได้ที่ "บันทึกการอัปเดต"</span>
              ) : (
                <>
                  <p className="font-bold">{remoteNotes.title}</p>
                  {remoteNotes.date && <p className="text-slate-500 mt-0.5">{remoteNotes.date}</p>}
                  <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
                    {(remoteNotes.highlights ?? []).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {isServerUpgradePending ? (
            <button
              type="button"
              disabled={isReloading}
              onClick={handleInstantUpdate}
              className="hidden lg:flex mt-3 w-full px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xs items-center justify-center gap-1.5 shadow-md shadow-teal-500/20 active:scale-95 transition cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isReloading ? 'animate-spin' : ''}`} />
              <span>{isReloading ? 'กำลังโหลดเวอร์ชันใหม่…' : `กดยืนยันเพื่อเริ่มใช้ v${remoteVersion} ล่าสุด`}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-teal-500/20 active:scale-95 transition cursor-pointer"
              >
                <span>กดยืนยันใช้งาน v{activeVersion}</span>
              </button>
              <button
                type="button"
                onClick={handleView}
                className="inline-flex items-center gap-1 min-h-8 px-2 text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-500 cursor-pointer"
              >
                <span>ดูรายละเอียด</span>
                <ChevronRight className="size-3" />
              </button>
              <a
                href={githubReleaseUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden lg:inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <span>GitHub Release</span>
                <ExternalLink className="size-2.5" />
              </a>
            </div>
          )}
        </div>

        {/* Phone: compact action button on the same row */}
        {isServerUpgradePending ? (
          <button
            type="button"
            disabled={isReloading}
            onClick={handleInstantUpdate}
            className="lg:hidden shrink-0 min-h-10 px-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold text-xs inline-flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isReloading ? 'animate-spin' : ''}`} />
            {isReloading ? 'กำลังโหลด…' : `ยืนยัน v${remoteVersion}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDismiss}
            className="lg:hidden shrink-0 min-h-10 px-3 rounded-xl bg-teal-500 text-white font-bold text-xs inline-flex items-center gap-1 active:scale-95 transition cursor-pointer"
          >
            ยืนยัน
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 size-9 lg:size-7 grid place-items-center text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="ปิดการแจ้งเตือน"
        >
          <X className="size-4 lg:size-3.5" />
        </button>
      </div>
    </ToastShell>
  )
}

/**
 * Position: phones = full-width bar just above the bottom nav (thumb reach, nothing covered);
 * desktop = top-right under the header (clear of the status bar and back-to-top button).
 */
const ToastShell: FC<{ children: React.ReactNode; autoCloseMs: number; onAutoClose: () => void }> = ({
  children,
  autoCloseMs,
  onAutoClose,
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [paused, setPaused] = useState(false)
  const closeRef = useRef(onAutoClose)
  closeRef.current = onAutoClose
  useEffect(() => {
    if (!autoCloseMs || paused) return
    const t = window.setTimeout(() => closeRef.current(), autoCloseMs)
    return () => window.clearTimeout(t)
  }, [autoCloseMs, paused])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="fixed z-[35] inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:inset-x-auto lg:bottom-auto lg:top-20 lg:right-5 lg:w-full lg:max-w-sm animate-in slide-in-from-bottom-5 lg:slide-in-from-top-5 fade-in duration-300"
    >
      <NoticeOffset height={height} />
      {children}
    </div>
  )
}

/** Exposes the toast height as --update-notice-offset (used by the back-to-top button on phones) */
const NoticeOffset: FC<{ height: number }> = ({ height }) => {
  useEffect(() => {
    document.documentElement.style.setProperty('--update-notice-offset', height ? `${height + 8}px` : '0px')
    return () => document.documentElement.style.setProperty('--update-notice-offset', '0px')
  }, [height])
  return null
}
