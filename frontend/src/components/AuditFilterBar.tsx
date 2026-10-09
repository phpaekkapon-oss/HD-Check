import type { FC } from 'react'
import { Download, Search, X } from 'lucide-react'
import type { AuditResultFilter, DateRange } from '@/types/herbdx.types'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

import { ThaiDatePickerModal } from '@/components/ThaiDatePickerModal'

interface DateRangeFieldsProps {
  readonly range: DateRange
  readonly onChange: (r: DateRange) => void
}

export const DateRangeFields: FC<DateRangeFieldsProps> = ({ range, onChange }) => (
  <ThaiDatePickerModal range={range} onChange={onChange} />
)

const RESULT_TABS: readonly { id: AuditResultFilter; label: string; activeClass?: string }[] = [
  { id: 'ALL', label: 'ทั้งหมด' },
  { id: 'PROBLEM', label: 'ไม่ผ่านทั้งหมด', activeClass: 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-xs' },
  { id: 'PASS', label: 'ผ่าน', activeClass: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs' },
  { id: 'FAIL', label: 'DX ไม่ตรง', activeClass: 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-xs' },
  { id: 'NO_DX', label: 'ไม่มี DX', activeClass: 'bg-gradient-to-r from-rose-700 to-rose-800 text-white shadow-xs' },
  { id: 'NO_MAP', label: 'รอตั้งค่า', activeClass: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs' },
]

interface AuditFilterBarProps {
  readonly range: DateRange
  readonly onRangeChange: (r: DateRange) => void
  readonly hn: string
  readonly onHnChange: (v: string) => void
  readonly search: string
  readonly onSearchChange: (v: string) => void
  readonly result: AuditResultFilter
  readonly onResultChange: (r: AuditResultFilter) => void
  readonly onExport: () => void
  readonly canExport: boolean
  readonly embedded?: boolean
}

export const AuditFilterBar: FC<AuditFilterBarProps> = ({
  range,
  onRangeChange,
  hn,
  onHnChange,
  search,
  onSearchChange,
  result,
  onResultChange,
  onExport,
  canExport,
  embedded = false,
}) => {
  const { accent } = useTheme()

  return (
    <section
      className={cn(
        'p-3 sm:p-3.5 space-y-3 transition-colors',
        embedded
          ? 'bg-slate-50/70 dark:bg-[#181b30]/70 border-b border-slate-200 dark:border-[#292440]'
          : 'rounded-2xl bg-white dark:bg-[#14172a] border border-slate-200 dark:border-[#292440] shadow-xs'
      )}
    >
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
        <DateRangeFields range={range} onChange={onRangeChange} />

        <div className="flex items-center gap-2">
          <div className="flex-1 sm:flex-none flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] px-3 py-1.5 shadow-2xs">
            <label htmlFor="filter-hn" className="text-xs font-bold text-slate-500 dark:text-slate-400">HN</label>
            <input
              id="filter-hn"
              inputMode="numeric"
              value={hn}
              onChange={(e) => onHnChange(e.target.value.replace(/\D/g, ''))}
              placeholder="000009716"
              className="w-full sm:w-24 bg-transparent font-mono text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            {hn && (
              <button type="button" onClick={() => onHnChange('')} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer" aria-label="ล้าง HN">
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <button
            id="btn-export-audit"
            type="button"
            onClick={onExport}
            disabled={!canExport}
            className="sm:hidden btn-pill-action inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-2xs shrink-0"
          >
            <Download className="size-3.5" /> ส่งออก
          </button>
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="filter-search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาชื่อผู้ป่วย, ยา, แพทย์, แผนก หรือ ICD (เช่น M79, U57)…"
            className="w-full rounded-xl bg-slate-50 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 shadow-2xs transition-all"
            style={{
              borderColor: search ? accent.hex : undefined,
            }}
          />
        </div>

        <button
          id="btn-export-audit-desktop"
          type="button"
          onClick={onExport}
          disabled={!canExport}
          className="hidden sm:inline-flex btn-pill-action items-center gap-1.5 px-3.5 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm transition"
        >
          <Download className="size-4 text-white" /> Export Excel
        </button>
      </div>

      {/* Quick Filter Status Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {RESULT_TABS.map((t) => {
          const isSelected = result === t.id
          const isAll = t.id === 'ALL'

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onResultChange(t.id)}
              className={cn(
                'shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer active:scale-95',
                isSelected && isAll ? 'btn-pill-action' : '',
                isSelected && !isAll ? t.activeClass : '',
                !isSelected
                  ? 'bg-slate-100 dark:bg-[#101326] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#34304a] hover:bg-slate-200 dark:hover:bg-white/5'
                  : ''
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
