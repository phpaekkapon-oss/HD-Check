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

export type PatientTypeFilter = 'ALL' | 'OPD' | 'IPD'

interface AuditFilterBarProps {
  readonly range: DateRange
  readonly onRangeChange: (r: DateRange) => void
  readonly hn: string
  readonly onHnChange: (v: string) => void
  readonly search: string
  readonly onSearchChange: (v: string) => void
  readonly result: AuditResultFilter
  readonly onResultChange: (r: AuditResultFilter) => void
  readonly patientType?: PatientTypeFilter
  readonly onPatientTypeChange?: (t: PatientTypeFilter) => void
  readonly counts?: { all: number; opd: number; ipd: number }
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
  patientType = 'ALL',
  onPatientTypeChange,
  counts,
  onExport,
  canExport,
  embedded = false,
}) => {
  const { accent } = useTheme()

  return (
    <section
      className={cn(
        'p-2.5 sm:p-3 space-y-2.5 transition-colors',
        embedded
          ? 'bg-slate-50/70 dark:bg-[#181b30]/70 border-b border-slate-200 dark:border-[#292440]'
          : 'rounded-2xl bg-white dark:bg-[#14172a] border border-slate-200 dark:border-[#292440] shadow-xs'
      )}
    >
      {/* Row 1: Global Context & Actions (Patient Type Scope + Date Range + Export) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-100 dark:border-[#20253f]">
        {/* Left: Patient Type Scope Tabs */}
        {onPatientTypeChange ? (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => onPatientTypeChange('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs',
                patientType === 'ALL'
                  ? 'bg-white dark:bg-[#20253f] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              🏢 ข้อมูลทั้งหมด {counts ? `(${counts.all})` : ''}
            </button>
            <button
              type="button"
              onClick={() => onPatientTypeChange('OPD')}
              className={cn(
                'px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs',
                patientType === 'OPD'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'
              )}
            >
              🌿 ผู้ป่วยนอก OPD แผนไทย {counts ? `(${counts.opd})` : ''}
            </button>
            <button
              type="button"
              onClick={() => onPatientTypeChange('IPD')}
              className={cn(
                'px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs',
                patientType === 'IPD'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
              )}
            >
              🏥 ผู้ป่วยใน IPD หอผู้ป่วย {counts ? `(${counts.ipd})` : ''}
            </button>
          </div>
        ) : <div />}

        {/* Right: Date Range Picker & Export Excel */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <DateRangeFields range={range} onChange={onRangeChange} />

          <button
            id="btn-export-audit-desktop"
            type="button"
            onClick={onExport}
            disabled={!canExport}
            className="btn-pill-action inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs transition shrink-0"
          >
            <Download className="size-3.5 text-white" />
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">ส่งออก</span>
          </button>
        </div>
      </div>

      {/* Row 2: Grid Filters & Search (Audit Status Tabs + HN Box + Search Input) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        {/* Left: Audit Status Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none shrink-0">
          {RESULT_TABS.map((t) => {
            const isSelected = result === t.id
            const isAll = t.id === 'ALL'

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onResultChange(t.id)}
                className={cn(
                  'shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer active:scale-95',
                  isSelected && isAll ? 'btn-pill-action' : '',
                  isSelected && !isAll ? t.activeClass : '',
                  !isSelected
                    ? 'bg-slate-100 dark:bg-[#101326] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#34304a] hover:bg-slate-200 dark:hover:bg-white/5'
                    : ''
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Right: HN Specific Filter + Search Query Input */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
          {/* HN Box */}
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] px-2.5 py-1 shadow-2xs shrink-0">
            <label htmlFor="filter-hn" className="text-xs font-bold text-slate-500 dark:text-slate-400">HN</label>
            <input
              id="filter-hn"
              inputMode="numeric"
              value={hn}
              onChange={(e) => onHnChange(e.target.value.replace(/\D/g, ''))}
              placeholder="000009716"
              className="w-20 sm:w-24 bg-transparent font-mono text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            {hn && (
              <button type="button" onClick={() => onHnChange('')} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer" aria-label="ล้าง HN">
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="filter-search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหาชื่อ, ยา, แพทย์, แผนก, ICD..."
              className="w-full rounded-xl bg-slate-50 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] pl-8 pr-2.5 py-1 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 shadow-2xs transition-all"
              style={{
                borderColor: search ? accent.hex : undefined,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
