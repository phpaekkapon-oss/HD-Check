import type { FC } from 'react'
import { Download, Search, X, RotateCcw } from 'lucide-react'
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
  { id: 'PROBLEM', label: 'ไม่ผ่านทั้งหมด', activeClass: 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-xs font-bold' },
  { id: 'PASS', label: 'ผ่าน', activeClass: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs font-bold' },
  { id: 'FAIL', label: 'DX ไม่ตรง', activeClass: 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-xs font-bold' },
  { id: 'NO_DX', label: 'ไม่มี DX', activeClass: 'bg-gradient-to-r from-rose-700 to-rose-800 text-white shadow-xs font-bold' },
  { id: 'NO_MAP', label: 'รอตั้งค่า', activeClass: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs font-bold' },
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
  patientType = 'OPD',
  onPatientTypeChange,
  counts,
  onExport,
  canExport,
  embedded = false,
}) => {
  const { accent } = useTheme()
  const hasActiveSearch = Boolean(hn || search)

  const handleClearSearch = () => {
    if (hn) onHnChange('')
    if (search) onSearchChange('')
  }

  return (
    <section
      className={cn(
        'p-3 sm:p-3.5 space-y-3 transition-colors',
        embedded
          ? 'bg-slate-50/70 dark:bg-[#181b30]/70 border-b border-slate-200 dark:border-[#292440]'
          : 'rounded-2xl bg-white dark:bg-[#14172a] border border-slate-200 dark:border-[#292440] shadow-xs'
      )}
    >
      {/* Tier 1: Time Navigation & Presets (Full Width, Never Wraps Unexpectedly) + Export Action */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
        <div className="min-w-0 flex-1">
          <DateRangeFields range={range} onChange={onRangeChange} />
        </div>

        <div className="flex items-center gap-2 self-start xl:self-auto shrink-0">
          <button
            id="btn-export-audit-desktop"
            type="button"
            onClick={onExport}
            disabled={!canExport}
            className="btn-pill-action inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs transition shrink-0 active:scale-95"
            title="ส่งออกรายงานเป็นไฟล์ Excel"
          >
            <Download className="size-3.5 text-white" />
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">ส่งออก</span>
          </button>
        </div>
      </div>

      {/* Tier 2: Patient Type Scope Tabs + Search & HN Filter Box */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        {/* Left: Patient Type Scope Tabs */}
        {onPatientTypeChange ? (
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] text-xs self-start md:self-auto shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => onPatientTypeChange('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-xs flex items-center gap-1.5',
                patientType === 'ALL'
                  ? 'bg-white dark:bg-[#20253f] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <span>🏢 ข้อมูลทั้งหมด</span>
              {counts && (
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200">
                  {counts.all.toLocaleString()}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onPatientTypeChange('OPD')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-xs flex items-center gap-1.5',
                patientType === 'OPD'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <span>🌿 ผู้ป่วยนอก OPD แผนไทย</span>
              {counts && (
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                  {counts.opd.toLocaleString()}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onPatientTypeChange('IPD')}
              className={cn(
                'px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-xs flex items-center gap-1.5',
                patientType === 'IPD'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
              )}
            >
              <span>🏥 ผู้ป่วยใน IPD หอผู้ป่วย</span>
              {counts && (
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                  {counts.ipd.toLocaleString()}
                </span>
              )}
            </button>
          </div>
        ) : (
          <div />
        )}

        {/* Right: HN Specific Filter + Search Query Input + Clear Button */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
          {/* HN Box */}
          <div className="flex items-center gap-1.5 h-8.5 rounded-xl bg-slate-50 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] px-2.5 shadow-2xs shrink-0">
            <label htmlFor="filter-hn" className="text-xs font-bold text-slate-500 dark:text-slate-400">
              HN
            </label>
            <input
              id="filter-hn"
              inputMode="numeric"
              value={hn}
              onChange={(e) => onHnChange(e.target.value.replace(/\D/g, ''))}
              placeholder="000009716"
              className="w-20 sm:w-24 bg-transparent font-mono text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            {hn && (
              <button
                type="button"
                onClick={() => onHnChange('')}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="ล้าง HN"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[150px]">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="filter-search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหาชื่อ, ยา, แพทย์, แผนก, ICD..."
              className="w-full h-8.5 rounded-xl bg-slate-50 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] pl-8 pr-7 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 shadow-2xs transition-all"
              style={{
                borderColor: search ? accent.hex : undefined,
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="ล้างการค้นหา"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Clear Filters Button (Visible when HN or Search has text) */}
          {hasActiveSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="h-8.5 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
              title="ล้างข้อความค้นหาและ HN"
            >
              <RotateCcw className="size-3" />
              <span className="hidden sm:inline">ล้าง</span>
            </button>
          )}
        </div>
      </div>

      {/* Tier 3: Audit Result Status Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none pt-1 border-t border-slate-100 dark:border-[#20253f]">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 mr-1 select-none">
          ผลการตรวจ:
        </span>
        {RESULT_TABS.map((t) => {
          const isSelected = result === t.id
          const isAll = t.id === 'ALL'

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onResultChange(t.id)}
              className={cn(
                'shrink-0 h-8 rounded-lg px-3 text-xs font-semibold transition-all cursor-pointer active:scale-95 flex items-center',
                isSelected && isAll ? 'btn-pill-action font-bold' : '',
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
    </section>
  )
}
