import type { FC } from 'react'
import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  readonly rows?: number
  /** ข้อความสำหรับโปรแกรมอ่านหน้าจอ (ไม่แสดงบนจอ) */
  readonly label?: string
  readonly className?: string
}

/** โครงโหลดแบบ shimmer แทนข้อความ "กำลังโหลด…" — แถวละไอคอน + 2 บรรทัด + ป้ายท้ายแถว */
export const LoadingSkeleton: FC<LoadingSkeletonProps> = ({ rows = 6, label = 'กำลังโหลดข้อมูล', className }) => (
  <div role="status" aria-live="polite" aria-busy="true" className={cn('space-y-3 p-4', className)}>
    <span className="sr-only">{label}…</span>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-3">
        <div className="skeleton size-9 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-2/5" />
          <div className="skeleton h-2.5 w-3/5" />
        </div>
        <div className="skeleton hidden h-6 w-16 sm:block" />
      </div>
    ))}
  </div>
)
