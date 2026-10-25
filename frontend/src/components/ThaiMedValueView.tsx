import type { FC } from 'react'
import { DateRangeFields } from '@/components/AuditFilterBar'
import { ThaiMedValueCard } from '@/components/ThaiMedValueCard'
import { useThaiMedValue } from '@/hooks/useHerbDx'
import { fmtNum, toThaiDate } from '@/lib/format'
import type { DateRange } from '@/types/herbdx.types'

interface ThaiMedValueViewProps {
  readonly range: DateRange
  readonly onRangeChange: (r: DateRange) => void
}

/** หน้ารายได้แผนไทย: มูลค่าบริการ (ประมาณการ) แยกหมวดและรายวัน เฉพาะ IT / ผู้ดูแลแผนไทย ไม่มีข้อมูลรายแพทย์ */
export const ThaiMedValueView: FC<ThaiMedValueViewProps> = ({ range, onRangeChange }) => {
  const { data } = useThaiMedValue(range, true)
  const daily = data?.daily ?? []
  const maxValue = Math.max(1, ...daily.map((d) => d.value))

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

      <div className="rounded-2xl p-4 bg-themed-card border border-themed shadow-xs">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">มูลค่ารายวัน (บาท)</h3>
        {daily.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">ไม่มีข้อมูลในช่วงวันที่เลือก</p>
        ) : (
          <div className="flex items-end gap-1 h-40" role="img" aria-label="กราฟแท่งมูลค่าบริการรายวัน">
            {daily.map((d) => (
              <div key={d.date} className="group relative flex-1 min-w-[6px] h-full flex items-end">
                <div
                  className="w-full rounded-t bg-accent opacity-80 group-hover:opacity-100 transition"
                  style={{ height: `${Math.max((d.value / maxValue) * 100, 2)}%` }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white shadow-md">
                  {toThaiDate(d.date)} · {fmtNum(d.value, 2)} บาท · {fmtNum(d.visits)} visit
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
