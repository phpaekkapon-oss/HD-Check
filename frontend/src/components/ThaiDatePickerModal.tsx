import { useState, useMemo, type FC } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X, Check, CalendarDays, Clock } from 'lucide-react'
import type { DateRange } from '@/types/herbdx.types'
import { toThaiDateShort, THAI_MONTHS_FULL, toThaiDate } from '@/lib/format'
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

  const handleOpen = () => {
    setTempStart(range.startDate)
    setTempEnd(range.endDate)
    setSelectionTarget('start')
    const y = Number(range.startDate.split('-')[0]) || 2026
    const m = (Number(range.startDate.split('-')[1]) || 10) - 1
    setViewYear(y)
    setViewMonth(m)
    setIsOpen(true)
  }

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
      {/* Trigger Button showing Thai Buddhist Era */}
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-[#111326] ring-1 ring-slate-200 dark:ring-[#34304a] px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#1d2035] active:scale-[0.99] transition shadow-2xs cursor-pointer group"
        title="คลิกเพื่อเลือกช่วงวันที่ พ.ศ."
      >
        <CalendarDays className="size-4 text-accent shrink-0 group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-slate-700 dark:text-slate-100">
          {toThaiDateShort(range.startDate)} – {toThaiDateShort(range.endDate)}
        </span>
        <span className="text-[10px] font-mono font-bold bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200 px-1.5 py-0.5 rounded ring-1 ring-violet-600/20">
          พ.ศ.
        </span>
      </button>

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
                  <p className="text-[11px] text-slate-400">ปฏิทินปี พ.ศ. • ข้อมูลบริการ HOSxP</p>
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
                <div className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">ช่วงที่ใช้บ่อย</div>
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
                <div className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">ดูข้อมูลรายปี</div>
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
                      <span className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
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
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">ช่วงวันที่เลือก:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {toThaiDate(tempStart)} ถึง {toThaiDate(tempEnd)}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
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
