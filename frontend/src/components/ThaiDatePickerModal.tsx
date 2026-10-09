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

export const ThaiDatePickerModal: FC<ThaiDatePickerModalProps> = ({ range, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)

  // Working state when modal is open
  const [tempStart, setTempStart] = useState(range.startDate)
  const [tempEnd, setTempEnd] = useState(range.endDate)

  // Current calendar view (year in CE, month index 0-11)
  const initialYear = Number(range.startDate.split('-')[0]) || 2026
  const initialMonth = (Number(range.startDate.split('-')[1]) || 10) - 1
  const [viewYear, setViewYear] = useState(initialYear)
  const [viewMonth, setViewMonth] = useState(initialMonth)

  const viewYearBE = viewYear + 543

  const handleOpen = () => {
    setTempStart(range.startDate)
    setTempEnd(range.endDate)
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
    if (!tempStart || (tempStart && tempEnd && tempStart !== tempEnd)) {
      setTempStart(dateStr)
      setTempEnd(dateStr)
    } else {
      if (dateStr < tempStart) {
        setTempStart(dateStr)
      } else {
        setTempEnd(dateStr)
      }
    }
  }

  // Quick Preset Handlers
  const applyPreset = (start: string, end: string) => {
    setTempStart(start)
    setTempEnd(end)
    const y = Number(start.split('-')[0])
    const m = Number(start.split('-')[1]) - 1
    setViewYear(y)
    setViewMonth(m)
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
            className="w-full max-w-lg bg-themed-card text-slate-800 dark:text-slate-100 rounded-3xl shadow-2xl ring-1 ring-slate-200 dark:ring-[#292440] overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
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
                  <h3 className="font-bold text-sm sm:text-base">เลือกช่วงวันที่ (ปฏิทิน พ.ศ. ไทย)</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    พ.ศ. {viewYearBE} • HOSxP Date Filter
                  </p>
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

            {/* Quick Presets Bar */}
            <div className="bg-slate-50 dark:bg-[#1d2035] border-b border-slate-100 dark:border-[#292440] p-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
              <span className="text-[11px] font-semibold text-slate-400 pl-1 shrink-0">ลัด:</span>
              <button
                type="button"
                onClick={() => applyPreset('2026-10-01', '2026-10-31')}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-[#14172a] ring-1 ring-slate-200 dark:ring-[#34304a] text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-white/10"
              >
                ตุลาคม 2569 (ข้อมูลจริง)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('2026-09-01', '2026-09-30')}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-[#14172a] ring-1 ring-slate-200 dark:ring-[#34304a] text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-white/10"
              >
                กันยายน 2569
              </button>
              <button
                type="button"
                onClick={() => applyPreset('2025-10-01', '2026-09-30')}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-[#14172a] ring-1 ring-slate-200 dark:ring-[#34304a] text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-white/10"
              >
                ปีงบฯ 2569
              </button>
            </div>

            {/* Calendar Controls (Month / Year in พ.ศ.) */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 active:scale-95 transition"
                  aria-label="เดือนก่อนหน้า"
                >
                  <ChevronLeft className="size-4.5" />
                </button>

                <div className="text-center">
                  <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {THAI_MONTHS_FULL[viewMonth]} {viewYearBE}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    (ค.ศ. {viewYear})
                  </div>
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
                        'h-9 rounded-xl flex items-center justify-center font-mono text-xs transition cursor-pointer',
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
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="btn-pill-action inline-flex items-center gap-1.5 px-5 py-2 text-xs sm:text-sm font-semibold active:scale-95 transition cursor-pointer"
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
