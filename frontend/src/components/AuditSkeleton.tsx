import type { FC } from 'react'

const Bar: FC<{ className: string }> = ({ className }) => <div className={`rounded bg-slate-200/80 dark:bg-white/10 ${className}`} />

export const AuditKpiSkeleton: FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 animate-pulse">
    {Array.from({ length: 5 }, (_, i) => (
      <div key={i} className="h-[118px] rounded-2xl bg-white dark:bg-[#14172a] ring-1 ring-slate-200 dark:ring-[#292440] p-4 space-y-3">
        <Bar className="h-3 w-24" />
        <Bar className="h-7 w-16" />
        <Bar className="h-2.5 w-28" />
      </div>
    ))}
  </div>
)

export const AuditTableSkeleton: FC<{ rows?: number }> = ({ rows = 12 }) => (
  <div className="rounded-2xl bg-white dark:bg-[#14172a] ring-1 ring-slate-200 dark:ring-[#292440] overflow-hidden animate-pulse">
    <div className="h-10 bg-slate-100 dark:bg-[#1d2035] border-b border-slate-200 dark:border-[#292440]" />
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="h-10 flex items-center gap-4 px-4 border-b border-slate-100 dark:border-[#292440]">
        <Bar className="h-3 w-6" />
        <Bar className="h-3 w-20" />
        <Bar className="h-3 w-24" />
        <Bar className="h-3 w-40" />
        <Bar className="h-3 flex-1" />
        <Bar className="h-3 w-16" />
      </div>
    ))}
  </div>
)

export const AuditCardListSkeleton: FC = () => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="h-40 rounded-2xl bg-white dark:bg-[#14172a] ring-1 ring-slate-200 dark:ring-[#292440] p-4 space-y-3">
        <Bar className="h-4 w-32" />
        <Bar className="h-4 w-48" />
        <Bar className="h-10 w-full" />
      </div>
    ))}
  </div>
)
