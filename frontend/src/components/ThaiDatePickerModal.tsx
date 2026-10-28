import { useState, useMemo, type FC } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X, Check, CalendarDays, Clock } from 'lucide-react'
import type { DateRange } from '@/types/herbdx.types'
import { toThaiDateShort, THAI_MONTHS_FULL, THAI_MONTHS_SHORT, toThaiDate } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ThaiDatePickerModalProps {
  readonly range: DateRange
  readonly onChange: (newRange: DateRange) => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIsoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

type RangeEdge = 'start' | 'end'

export const ThaiDatePickerModal: FC<ThaiDatePickerModalProps> = ({ range, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)

  // Working state when modal is open
  const [tempStart, setTempStart] = useState(range.startDate)
  const [tempEnd, setTempEnd] = useState(range.endDate)
  const [selectionTarget, setSelectionTarget] = useState<RangeEdge>('start')

  // Current calendar view (year in CE, month index 0-11)
  const initialYear = Number(range.startDate.split('-')[0]) || 2026
  const initialMonth = (Number(range.startDate.split('-')[1]) || 10) - 1
  const [viewYear, setViewYear] = useState(initialYear)
  const [viewMonth, setViewMonth] = useState(initialMonth)

  const currentYear = new Date().getFullYear()
  const firstYear = Math.min(currentYear - 10, Number(tempStart.slice(0, 4)) || currentYear - 10)
  const lastYear = Math.max(currentYear + 1, Number(tempEnd.slice(0, 4)) || currentYear + 1)

  const today = new Date()
  const todayIso = toIsoDate(today)
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const yesterdayIso = toIsoDate(yesterday)
  const last7DaysStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const thisCalendarYearStart = new Date(today.getFullYear(), 0, 1)
  const thisCalendarYearEnd = new Date(today.getFullYear(), 11, 31)
  const previousCalendarYearStart = new Date(today.getFullYear() - 1, 0, 1)
  const previousCalendarYearEnd = new Date(today.getFullYear() - 1, 11, 31)
  const fiscalYearStart = new Date(today.getFullYear() - (today.getMonth() < 9 ? 1 : 0), 9, 1)
  const fiscalYearEnd = new Date(fiscalYearStart.getFullYear() + 1, 8, 30)
  const quickPresets = [
    { label: 'วันนี้', start: todayIso, end: todayIso },
    { label: 'เมื่อวานนี้', start: yesterdayIso, end: yesterdayIso },
    { label: '7 วันล่าสุด', start: toIsoDate(last7DaysStart), end: todayIso },
    { label: 'เดือนนี้', start: toIsoDate(thisMonthStart), end: toIsoDate(thisMonthEnd) },
    { label: 'เดือนก่อน', start: toIsoDate(previousMonthStart), end: toIsoDate(previousMonthEnd) },
  ]
  const yearPresets = [
    {
      label: `ปี ${today.getFullYear() + 543}`,
      start: toIsoDate(thisCalendarYearStart),
      end: toIsoDate(thisCalendarYearEnd),
    },
    {
      label: `ปี ${today.getFullYear() + 542}`,
      start: toIsoDate(previousCalendarYearStart),
      end: toIsoDate(previousCalendarYearEnd),
    },
    {
      label: `ปีงบฯ ${fiscalYearStart.getFullYear() + 544}`,
      start: toIsoDate(fiscalYearStart),
      end: toIsoDate(fiscalYearEnd),
    },
  ].sort((a, b) => a.start.localeCompare(b.start))

  const handleOpen = (edge: RangeEdge = 'start') => {
    setTempStart(range.startDate)
    setTempEnd(range.endDate)
    setSelectionTarget(edge)
    const refDate = edge === 'end' ? range.endDate : range.startDate
    const y = Number(refDate.split('-')[0]) || 2026
    const m = (Number(refDate.split('-')[1]) || 10) - 1
    setViewYear(y)
    setViewMonth(m)
    setIsOpen(true)
  }

  // Inline Month/Year values derived from range.startDate
  const activeYear = Number(range.startDate.split('-')[0]) || currentYear
  const activeMonth = (Number(range.startDate.split('-')[1]) || (today.getMonth() + 1)) - 1
  const inlineYears = useMemo(() => {
    const minY = Math.min(currentYear - 10, activeYear)
    const maxY = Math.max(currentYear + 1, activeYear)
    const list: number[] = []
    for (let y = maxY; y >= minY; y--) list.push(y)
    return list
  }, [currentYear, activeYear])

  const applyMonthRange = (year: number, monthIndex: number) => {
    const start = toIsoDate(new Date(year, monthIndex, 1))
    const end = toIsoDate(new Date(year, monthIndex + 1, 0))
    onChange({ startDate: start, endDate: end })
  }

  const handleInlinePrevMonth = () => {
    if (activeMonth === 0) {
      applyMonthRange(activeYear - 1, 11)
    } else {
      applyMonthRange(activeYear, activeMonth - 1)
    }
  }

  const handleInlineNextMonth = () => {
    if (activeMonth === 11) {
      applyMonthRange(activeYear + 1, 0)
    } else {
      applyMonthRange(activeYear, activeMonth + 1)
    }
  }

  const activeMonthStartIso = toIsoDate(new Date(activeYear, activeMonth, 1))
  const activeMonthEndIso = toIsoDate(new Date(activeYear, activeMonth + 1, 0))
  const isFullActiveMonth = range.startDate === activeMonthStartIso && range.endDate === activeMonthEndIso
  const isTodaySelected = range.startDate === todayIso && range.endDate === todayIso
  const isYesterdaySelected = range.startDate === yesterdayIso && range.endDate === yesterdayIso
  const isThisMonthSelected = range.startDate === toIsoDate(thisMonthStart) && range.endDate === toIsoDate(thisMonthEnd)
  const isPrevMonthSelected = range.startDate === toIsoDate(previousMonthStart) && range.endDate === toIsoDate(previousMonthEnd)

  const handleApply = () => {
    // Ensure start <= end
    if (tempStart > tempEnd) {
      onChange({ startDate: tempEnd, endDate: tempStart })
    } else {
      onChange({ startDate: tempStart, endDate: tempEnd })
    }
    setIsOpen(false)
  }

  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate()
  }, [viewYear, viewMonth])

  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay() // 0 = Sunday
  }, [viewYear, viewMonth])

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const selectDay = (day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
    if (selectionTarget === 'start') {
      setTempStart(dateStr)
      if (dateStr > tempEnd) setTempEnd(dateStr)
      setSelectionTarget('end')
    } else {
      if (dateStr < tempStart) {
        setTempStart(dateStr)
        setTempEnd(tempStart)
      } else {
        setTempEnd(dateStr)
      }
      setSelectionTarget('start')
    }
  }

  // Quick Preset Handlers (Auto-applies and closes modal immediately)
  const applyPreset = (start: string, end: string, autoApply = true) => {
    setTempStart(start)
    setTempEnd(end)
    setSelectionTarget('start')
    const y = Number(start.split('-')[0])
    const m = Number(start.split('-')[1]) - 1
    setViewYear(y)
    setViewMonth(m)
    if (autoApply) {
      onChange({ startDate: start, endDate: end })
      setIsOpen(false)
    }
  }

  return (
    <>
      {/* Inline Date Navigation & Range Bar: [<] [ปี 2569 ▼] [ต.ค. ▼] [>] [📅 1 ต.ค. 2569] – [📅 31 ต.ค. 2569] [ทั้งเดือน] [วันนี้] [เดือนนี้] [เดือนที่แล้ว] */}
      <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto scrollbar-none py-0.5">
        {/* Prev Month */}
        <button
          type="button"
          onClick={handleInlinePrevMonth}
          className="inline-flex items-center justify-center h-8.5 w-8.5 shrink-0 rounded-xl bg-white dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e263d] hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 transition cursor-pointer shadow-2xs"
          title="เดือนก่อนหน้า"
          aria-label="เดือนก่อนหน้า"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {/* Year Select (พ.ศ.) */}
        <div className="relative shrink-0">
          <select
            value={activeYear}
            onChange={(e) => applyMonthRange(Number(e.target.value), activeMonth)}
            aria-label="เลือกปี พ.ศ."
            className="h-8.5 appearance-none rounded-xl bg-white dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] pl-3 pr-7 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#1e263d] hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer shadow-2xs transition"
          >
            {inlineYears.map((y) => (
              <option key={y} value={y}>
                ปี {y + 543}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 dark:text-slate-400">
            ▼
          </span>
        </div>

        {/* Month Select (ม.ค. - ธ.ค.) */}
        <div className="relative shrink-0">
          <select
            value={activeMonth}
            onChange={(e) => applyMonthRange(activeYear, Number(e.target.value))}
            aria-label="เลือกเดือน"
            className="h-8.5 appearance-none rounded-xl bg-white dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] pl-3 pr-7 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#1e263d] hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer shadow-2xs transition"
          >
            {THAI_MONTHS_SHORT.map((mLabel, idx) => (
              <option key={mLabel} value={idx}>
                {mLabel}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 dark:text-slate-400">
            ▼
          </span>
        </div>

        {/* Next Month */}
        <button
          type="button"
          onClick={handleInlineNextMonth}
          className="inline-flex items-center justify-center h-8.5 w-8.5 shrink-0 rounded-xl bg-white dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e263d] hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 transition cursor-pointer shadow-2xs"
          title="เดือนถัดไป"
          aria-label="เดือนถัดไป"
        >
          <ChevronRight className="size-3.5" />
        </button>

        {/* Start Date Picker Button */}
        <button
          type="button"
          onClick={() => handleOpen('start')}
          className="inline-flex items-center gap-1.5 h-8.5 shrink-0 rounded-xl bg-white dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#1e263d] hover:border-cyan-500/40 active:scale-[0.99] transition shadow-2xs cursor-pointer group"
          title="คลิกเพื่อเลือกวันเริ่มต้นจากปฏิทิน พ.ศ."
        >
          <CalendarDays className="size-3.5 text-cyan-500 dark:text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="whitespace-nowrap">{toThaiDateShort(range.startDate)}</span>
        </button>

        <span className="text-slate-400 dark:text-slate-500 text-xs font-bold select-none px-0.5 shrink-0">–</span>

        {/* End Date Picker Button */}
        <button
          type="button"
          onClick={() => handleOpen('end')}
          className="inline-flex items-center gap-1.5 h-8.5 shrink-0 rounded-xl bg-white dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#1e263d] hover:border-cyan-500/40 active:scale-[0.99] transition shadow-2xs cursor-pointer group"
          title="คลิกเพื่อเลือกวันสิ้นสุดจากปฏิทิน พ.ศ."
        >
          <CalendarDays className="size-3.5 text-cyan-500 dark:text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="whitespace-nowrap">{toThaiDateShort(range.endDate)}</span>
        </button>

        {/* Quick Preset: ทั้งเดือน */}
        <button
          type="button"
          onClick={() => onChange({ startDate: activeMonthStartIso, endDate: activeMonthEndIso })}
          className={cn(
            'h-8.5 px-3 shrink-0 rounded-xl text-xs font-semibold border transition cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap',
            isFullActiveMonth && !isThisMonthSelected && !isPrevMonthSelected
              ? 'bg-teal-600 text-white border-teal-500 shadow-sm shadow-teal-500/20'
              : 'bg-white dark:bg-[#151b2d] border-slate-200/90 dark:border-[#2a334d] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e263d]'
          )}
          title="เลือกทั้งเดือนของเดือนที่แสดงอยู่"
        >
          ทั้งเดือน
        </button>

        {/* Quick Preset: วันนี้ */}
        <button
          type="button"
          onClick={() => onChange({ startDate: todayIso, endDate: todayIso })}
          className={cn(
            'h-8.5 px-2.5 shrink-0 rounded-xl text-xs font-semibold border transition cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap',
            isTodaySelected
              ? 'bg-teal-600 text-white border-teal-500 shadow-sm shadow-teal-500/20'
              : 'bg-white dark:bg-[#151b2d] border-slate-200/90 dark:border-[#2a334d] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e263d]'
          )}
          title="ดูข้อมูลเฉพาะวันนี้"
        >
          วันนี้
        </button>

        {/* Quick Preset: เมื่อวานนี้ */}
        <button
          type="button"
          onClick={() => onChange({ startDate: yesterdayIso, endDate: yesterdayIso })}
          className={cn(
            'h-8.5 px-2.5 shrink-0 rounded-xl text-xs font-semibold border transition cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap',
            isYesterdaySelected
              ? 'bg-teal-600 text-white border-teal-500 shadow-sm shadow-teal-500/20'
              : 'bg-white dark:bg-[#151b2d] border-slate-200/90 dark:border-[#2a334d] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e263d]'
          )}
          title="ดูข้อมูลเฉพาะเมื่อวานนี้"
        >
          เมื่อวานนี้
        </button>

        {/* Quick Preset: เดือนนี้ */}
        <button
          type="button"
          onClick={() => onChange({ startDate: toIsoDate(thisMonthStart), endDate: toIsoDate(thisMonthEnd) })}
          className={cn(
            'h-8.5 px-3 shrink-0 rounded-xl text-xs font-semibold border transition cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap',
            isThisMonthSelected
              ? 'bg-teal-600 text-white border-teal-500 shadow-sm shadow-teal-500/20'
              : 'bg-white dark:bg-[#151b2d] border-slate-200/90 dark:border-[#2a334d] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e263d]'
          )}
          title="ดูข้อมูลทั้งเดือนปัจจุบัน"
        >
          เดือนนี้
        </button>

        {/* Quick Preset: เดือนที่แล้ว */}
        <button
          type="button"
          onClick={() => onChange({ startDate: toIsoDate(previousMonthStart), endDate: toIsoDate(previousMonthEnd) })}
          className={cn(
            'h-8.5 px-3 shrink-0 rounded-xl text-xs font-semibold border transition cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap',
            isPrevMonthSelected
              ? 'bg-teal-600 text-white border-teal-500 shadow-sm shadow-teal-500/20'
              : 'bg-white dark:bg-[#151b2d] border-slate-200/90 dark:border-[#2a334d] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e263d]'
          )}
          title="ดูข้อมูลเดือนที่แล้ว"
        >
          เดือนที่แล้ว
        </button>
      </div>

      {/* Thai Calendar Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div
            className="w-full max-w-xl bg-themed-card text-slate-800 dark:text-slate-100 rounded-3xl shadow-2xl ring-1 ring-slate-200 dark:ring-[#292440] overflow-hidden flex flex-col max-h-[92dvh] animate-scale-in"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid place-items-center size-8 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Calendar className="size-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">กำหนดช่วงวันที่</h3>
                  <p className="text-xs text-slate-400">ปฏิทินปี พ.ศ. • ข้อมูลบริการ HOSxP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Grouped presets separate short periods from calendar/fiscal years */}
            <div className="bg-slate-50 dark:bg-[#1d2035] border-b border-slate-100 dark:border-[#292440] p-3 sm:p-4 space-y-3">
              <div>
                <div className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">ช่วงที่ใช้บ่อย</div>
                <div className="grid grid-cols-2 gap-2">
                  {quickPresets.map((preset) => {
                    const selected = tempStart === preset.start && tempEnd === preset.end
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPreset(preset.start, preset.end, true)}
                        className={cn(
                          'min-h-11 rounded-xl px-3 text-xs font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                          selected
                            ? 'bg-accent text-white shadow-sm'
                            : 'bg-white dark:bg-[#14172a] ring-1 ring-slate-200 dark:ring-[#34304a] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                        )}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="border-t border-slate-200 pt-3 dark:border-[#34304a]">
                <div className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">ดูข้อมูลรายปี</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {yearPresets.map((preset) => {
                    const selected = tempStart === preset.start && tempEnd === preset.end
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPreset(preset.start, preset.end, true)}
                        className={cn(
                          'min-h-11 rounded-xl px-3 text-xs font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                          selected
                            ? 'bg-accent text-white shadow-sm'
                            : 'bg-white dark:bg-[#14172a] ring-1 ring-slate-200 dark:ring-[#34304a] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                        )}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Calendar controls with explicit start/end selection and direct month/year navigation */}
            <div className="p-3 sm:p-5 flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(['start', 'end'] as const).map((edge) => {
                  const active = selectionTarget === edge
                  const value = edge === 'start' ? tempStart : tempEnd
                  return (
                    <button
                      key={edge}
                      type="button"
                      onClick={() => setSelectionTarget(edge)}
                      aria-pressed={active}
                      className={cn(
                        'min-h-[62px] rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        active ? 'border-accent bg-violet-50 ring-1 ring-accent/40 dark:bg-violet-500/10' : 'border-slate-200 dark:border-[#34304a] bg-white dark:bg-[#111326]'
                      )}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{edge === 'start' ? 'วันเริ่มต้น' : 'วันสิ้นสุด'}</span>
                        {active && <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">กำลังเลือก</span>}
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{toThaiDateShort(value)}</span>
                    </button>
                  )
                })}
              </div>
              <p className="rounded-lg bg-violet-50 px-3 py-2 text-center text-xs font-medium text-violet-800 dark:bg-violet-500/10 dark:text-violet-200" aria-live="polite">
                แตะวันที่บนปฏิทินเพื่อกำหนด{selectionTarget === 'start' ? 'วันเริ่มต้น' : 'วันสิ้นสุด'}
              </p>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 active:scale-95 transition"
                  aria-label="เดือนก่อนหน้า"
                >
                  <ChevronLeft className="size-4.5" />
                </button>

                <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                  <select
                    value={viewMonth}
                    onChange={(event) => setViewMonth(Number(event.target.value))}
                    aria-label="เลือกเดือน"
                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-800 dark:border-[#34304a] dark:bg-[#111326] dark:text-white"
                  >
                    {THAI_MONTHS_FULL.map((month, index) => <option key={month} value={index}>{month}</option>)}
                  </select>
                  <select
                    value={viewYear}
                    onChange={(event) => setViewYear(Number(event.target.value))}
                    aria-label="เลือกปี พ.ศ."
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-800 dark:border-[#34304a] dark:bg-[#111326] dark:text-white"
                  >
                    {Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index).map((year) => (
                      <option key={year} value={year}>{year + 543}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 active:scale-95 transition"
                  aria-label="เดือนถัดไป"
                >
                  <ChevronRight className="size-4.5" />
                </button>
              </div>

              {/* Day of Week Header */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
                <span className="text-rose-500">อา.</span>
                <span>จ.</span>
                <span>อ.</span>
                <span>พ.</span>
                <span>พฤ.</span>
                <span>ศ.</span>
                <span className="text-indigo-500">ส.</span>
              </div>

              {/* Calendar Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-9" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                  const isStart = dateStr === tempStart
                  const isEnd = dateStr === tempEnd
                  const isInRange = tempStart && tempEnd && dateStr >= tempStart && dateStr <= tempEnd

                  return (
                    <button
                      key={`day-${day}`}
                      type="button"
                      onClick={() => selectDay(day)}
                      className={cn(
                        'h-10 sm:h-11 rounded-xl flex items-center justify-center font-mono text-sm transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        isInRange && 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300',
                        (isStart || isEnd) && 'bg-accent text-white font-bold shadow-xs scale-105 z-10',
                        !isInRange && 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                      )}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              {/* Selection Summary */}
              <div className="rounded-2xl bg-slate-50 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-xs">ช่วงวันที่เลือก:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {toThaiDate(tempStart)} ถึง {toThaiDate(tempEnd)}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="size-3 text-slate-400" /> เวลาไทย (UTC+7)
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-50 dark:bg-[#1d2035] border-t border-slate-200 dark:border-[#292440] p-3 sm:p-4 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-11 px-4 rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="btn-pill-action inline-flex min-h-11 items-center gap-1.5 px-5 text-xs sm:text-sm font-semibold active:scale-95 transition cursor-pointer"
              >
                <Check className="size-4" /> ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
