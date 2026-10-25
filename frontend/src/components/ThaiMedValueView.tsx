import type { FC } from 'react'
import { DateRangeFields } from '@/components/AuditFilterBar'
import { ThaiMedValueCard } from '@/components/ThaiMedValueCard'
import { ThaiMedValueChart } from '@/components/ThaiMedValueChart'
import { useThaiMedValue } from '@/hooks/useHerbDx'
import { toThaiDate } from '@/lib/format'
import type { DateRange } from '@/types/herbdx.types'

interface ThaiMedValueViewProps {
  readonly range: DateRange
  readonly onRangeChange: (r: DateRange) => void
}

/** หน้ารายได้แผนไทย: มูลค่าบริการ (ประมาณการ) แยกหมวดและรายวัน เฉพาะ IT / ผู้ดูแลแผนไทย ไม่มีข้อมูลรายแพทย์ */
export const ThaiMedValueView: FC<ThaiMedValueViewProps> = ({ range, onRangeChange }) => {
  const { data } = useThaiMedValue(range, true)
  const daily = data?.daily ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-themed-card border border-themed shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">รายได้แผนกแพทย์แผนไทย</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            มูลค่าบริการ (ประมาณการ) {toThaiDate(range.startDate)} – {toThaiDate(range.endDate)}
          </p>
        </div>
        <DateRangeFields range={range} onChange={onRangeChange} />
      </div>

      <ThaiMedValueCard range={range} />

      <ThaiMedValueChart daily={daily} startDate={range.startDate} endDate={range.endDate} />
    </div>
  )
}
