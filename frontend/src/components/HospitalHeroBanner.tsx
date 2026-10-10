import type { FC } from 'react'
import { Sparkles, Database, Building2, RefreshCw } from 'lucide-react'
import type { DbStatus } from '@/types/herbdx.types'
import { useAuth } from '@/context/AuthContext'
import { toThaiDateLong } from '@/lib/format'

interface HospitalHeroBannerProps {
  readonly status: DbStatus | undefined
  readonly onSync: () => void
  readonly isSyncing: boolean
}

export const HospitalHeroBanner: FC<HospitalHeroBannerProps> = ({ status, onSync, isSyncing }) => {
  const { user } = useAuth()
  const todayIso = new Date().toISOString().slice(0, 10)
  const todayThai = toThaiDateLong(todayIso)
  const isOnline = Boolean(status)
  const autoSyncEnabled = Boolean(status?.syncEnabled && status.autoSyncMinutes > 0)
  const syncModeLabel = !status
    ? 'กำลังตรวจสอบรอบซิงค์'
    : !status.syncEnabled
      ? 'ปิดการซิงค์'
      : autoSyncEnabled
        ? `Auto-Sync ทุก ${status.autoSyncMinutes} นาที`
        : 'ซิงค์ด้วยตนเอง'

  return (
    <div
      className="rounded-2xl bg-themed-card text-slate-900 dark:text-white p-4 sm:p-5 shadow-xs dark:shadow-sm border border-slate-200 dark:border-[#292440] flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-colors"
    >
      {/* Welcome Title & Hospital Details */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span>
              ยินดีต้อนรับ,{' '}
              <span className="whitespace-nowrap">{user?.name || 'นายเอกพล อันคำวงค์'}</span>
            </span>
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-mono"
            >
              <Sparkles className="size-3 text-emerald-600 dark:text-emerald-300" />
              เกณฑ์อัตโนมัติ ICD-10 แพทย์แผนไทย
            </span>
          </h2>
        </div>

        <div className="text-xs text-slate-600 dark:text-teal-200/80 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
          <span className="flex items-center gap-1.5 font-sans text-slate-800 dark:text-white/90">
            <Building2 className="size-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            โรงพยาบาลพังโคน • กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก
          </span>
          <span className="text-slate-300 dark:text-white/20 hidden sm:inline">•</span>
          <span className="text-slate-600 dark:text-white/80">{todayThai}</span>
          <span className="text-slate-300 dark:text-white/20 hidden sm:inline">•</span>
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
            <Database className="size-3 shrink-0" />
            {isOnline ? 'ฐานข้อมูล Online' : 'ฐานข้อมูล Offline'}
          </span>
        </div>
      </div>

      {/* Right Controls: Quick Status Badges */}
      <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
        <div className={`hidden sm:inline-flex h-9 items-center gap-1.5 px-3 rounded-xl border text-xs font-mono font-medium ${autoSyncEnabled ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'}`}>
          <span className={`size-2 rounded-full shrink-0 ${autoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span>{syncModeLabel}</span>
        </div>

        <div className="h-9 inline-flex items-center px-3 rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-xs font-mono font-medium text-slate-700 dark:text-white">
          พ.ศ. 2569
        </div>

        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing || status?.syncEnabled === false}
          className="btn-pill-action h-9 inline-flex items-center gap-2 px-4 text-xs font-bold text-white active:scale-95 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'กำลังดึงข้อมูล…' : status?.syncEnabled === false ? 'ปิดการซิงก์ (โหมดดูข้อมูล)' : 'ดึงข้อมูล HOSxP ทันที'}</span>
        </button>

        {status?.lastSync?.at && (
          <span className="text-[11px] font-mono text-slate-500 dark:text-white/60 hidden md:inline">
            อัปเดต {new Date(status.lastSync.at).toTimeString().slice(0, 8)}
          </span>
        )}
      </div>
    </div>
  )
}
