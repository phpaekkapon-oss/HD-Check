import { useState, useMemo, useRef, useEffect, type FC } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import type { DateRange } from '@/types/herbdx.types'
import { toThaiDateShort, THAI_MONTHS_FULL, THAI_MONTHS_SHORT } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ThaiDatePickerModalProps {
  readonly range: DateRange
  readonly onChange: (newRange: DateRange) => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIsoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

// Returns Thai Buddhist Era Fiscal Year (e.g. Oct 2026 -> 2570)
const getFiscalYearBE = (date: Date): number => {
  const y = date.getFullYear()
  const m = date.getMonth() // 0-11. October is 9
  return m >= 9 ? y + 544 : y + 543
}

type RangeEdge = 'start' | 'end'
type YearMode = 'calendar' | 'fiscal'

export const ThaiDatePickerModal: FC<ThaiDatePickerModalProps> = ({ range, onChange }) => {
  const today = useMemo(() => new Date(), [])
  const todayIso = useMemo(() => toIsoDate(today), [today])
  const currentFY = useMemo(() => getFiscalYearBE(today), [today])

  // Detect whether current range is likely a fiscal year (runs Oct 1 to Sep 30)
  const isCurrentlyFiscalRange = range.startDate.endsWith('-10-01') && range.endDate.endsWith('-09-30')
  const [yearMode, setYearMode] = useState<YearMode>(isCurrentlyFiscalRange ? 'fiscal' : 'calendar')

  // Anchored Popover Calendar state: null | 'start' | 'end'
  const [openPopover, setOpenPopover] = useState<RangeEdge | null>(null)

  // Calendar popover view month & year (CE year, 0-11 month)
  const [viewYear, setViewYear] = useState<number>(() => {
    const y = Number(range.startDate.split('-')[0])
    return Number.isFinite(y) && y > 1900 ? y : today.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState<number>(() => {
    const m = Number(range.startDate.split('-')[1])
    return Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : today.getMonth()
  })

  // Popover and button refs for click-outside detection
  const popoverRef = useRef<HTMLDivElement>(null)
  const startButtonRef = useRef<HTMLButtonElement>(null)
  const endButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!openPopover) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !startButtonRef.current?.contains(target) &&
        !endButtonRef.current?.contains(target)
      ) {
        setOpenPopover(null)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPopover(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openPopover])

  // Fiscal year options (current fiscal year and previous 5 years)
  const fiscalYearOptions = useMemo(() => {
    const list: number[] = []
    for (let fy = currentFY; fy >= currentFY - 5; fy--) {
      list.push(fy)
    }
    return list
  }, [currentFY])

  // Derive active fiscal year from range.startDate
  const activeFiscalYear = useMemo(() => {
    const y = Number(range.startDate.split('-')[0])
    const m = Number(range.startDate.split('-')[1])
    if (!y) return currentFY
    return m >= 10 ? y + 544 : y + 543
  }, [range.startDate, currentFY])

  // Apply full fiscal year
  const applyFiscalYear = (fy: number) => {
    const startCE = fy - 544
    const endCE = fy - 543
    onChange({
      startDate: `${startCE}-10-01`,
      endDate: `${endCE}-09-30`,
    })
  }

  // Calendar year & month logic
  const currentYear = today.getFullYear()
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

  // Presets
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const yesterdayIso = toIsoDate(yesterday)
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

  const activeMonthStartIso = toIsoDate(new Date(activeYear, activeMonth, 1))
  const activeMonthEndIso = toIsoDate(new Date(activeYear, activeMonth + 1, 0))

  const isFullActiveMonth = range.startDate === activeMonthStartIso && range.endDate === activeMonthEndIso
  const isTodaySelected = range.startDate === todayIso && range.endDate === todayIso
  const isYesterdaySelected = range.startDate === yesterdayIso && range.endDate === yesterdayIso
  const isThisMonthSelected = range.startDate === toIsoDate(thisMonthStart) && range.endDate === toIsoDate(thisMonthEnd)
  const isPrevMonthSelected = range.startDate === toIsoDate(previousMonthStart) && range.endDate === toIsoDate(previousMonthEnd)

  // Toggle calendar popover
  const handleTogglePopover = (edge: RangeEdge) => {
    if (openPopover === edge) {
      setOpenPopover(null)
      return
    }
    const refDate = edge === 'end' ? range.endDate : range.startDate
    const y = Number(refDate.split('-')[0]) || today.getFullYear()
    const m = (Number(refDate.split('-')[1]) || (today.getMonth() + 1)) - 1
    setViewYear(y)
    setViewMonth(m)
    setOpenPopover(edge)
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

  const handleSelectDay = (day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
    if (openPopover === 'start') {
      if (dateStr > range.endDate) {
        onChange({ startDate: dateStr, endDate: dateStr })
      } else {
        onChange({ startDate: dateStr, endDate: range.endDate })
      }
    } else if (openPopover === 'end') {
      if (dateStr < range.startDate) {
        onChange({ startDate: dateStr, endDate: dateStr })
      } else {
        onChange({ startDate: range.startDate, endDate: dateStr })
      }
    }
    setOpenPopover(null)
  }

  const handleClearDate = () => {
    if (openPopover === 'start') {
      const firstDay = `${viewYear}-${pad(viewMonth + 1)}-01`
      onChange({ startDate: firstDay, endDate: range.endDate < firstDay ? firstDay : range.endDate })
    } else {
      const lastDay = `${viewYear}-${pad(viewMonth + 1)}-${pad(daysInMonth)}`
      onChange({ startDate: range.startDate > lastDay ? lastDay : range.startDate, endDate: lastDay })
    }
    setOpenPopover(null)
  }

  const handleTodayDate = () => {
    if (openPopover === 'start') {
      onChange({ startDate: todayIso, endDate: range.endDate < todayIso ? todayIso : range.endDate })
    } else {
      onChange({ startDate: range.startDate > todayIso ? todayIso : range.startDate, endDate: todayIso })
    }
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setOpenPopover(null)
  }

  const renderCalendarPopover = (edge: RangeEdge) => {
    const isStart = edge === 'start'
    const targetDate = isStart ? range.startDate : range.endDate

    return (
      <div
        ref={popoverRef}
        className={cn(
          'absolute top-full mt-2 z-50 w-72 bg-[#161c2e] text-slate-100 rounded-2xl border border-slate-700/60 shadow-2xl p-4 sm:p-5 select-none animate-in fade-in zoom-in-95 duration-150',
          isStart ? 'left-0' : 'left-0 sm:left-auto sm:right-0'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="เลือกวันที่ปฏิทินไทย"
      >
        {/* Header: < ตุลาคม 2569 > */}
        <div className="flex items-center justify-between mb-4 px-0.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="เดือนก่อนหน้า"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="font-bold text-base text-white tracking-wide">
            {THAI_MONTHS_FULL[viewMonth]} {viewYear + 543}
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="เดือนถัดไป"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Weekday headers: อา. จ. อ. พ. พฤ. ศ. ส. */}
        <div className="grid grid-cols-7 text-center text-xs text-slate-400 font-medium mb-3">
          <span>อา.</span>
          <span>จ.</span>
          <span>อ.</span>
          <span>พ.</span>
          <span>พฤ.</span>
          <span>ศ.</span>
          <span>ส.</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 text-center gap-y-2 gap-x-1 text-sm font-semibold">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-9 w-9" />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
            const isSelected = dateStr === targetDate
            const isToday = dateStr === todayIso

            return (
              <button
                key={day}
                type="button"
                onClick={() => handleSelectDay(day)}
                className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center transition cursor-pointer text-sm font-semibold mx-auto',
                  isSelected
                    ? 'bg-[#0284c7] text-white font-bold shadow-md shadow-cyan-600/30 scale-105'
                    : isToday
                      ? 'text-cyan-400 hover:bg-slate-800/70 font-bold'
                      : 'text-slate-200 hover:bg-slate-800/60 hover:text-white'
                )}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Footer: ล้างวันที่ | วันนี้ ปิด */}
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={handleClearDate}
            className="text-slate-400 hover:text-slate-200 transition font-medium cursor-pointer"
          >
            ล้างวันที่
          </button>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleTodayDate}
              className="text-cyan-400 hover:text-cyan-300 font-bold transition cursor-pointer"
            >
              วันนี้
            </button>
            <button
              type="button"
              onClick={() => setOpenPopover(null)}
              className="text-slate-400 hover:text-slate-200 font-semibold transition cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap py-0.5 relative">
      {/* Year Mode Toggle: [ ปี พ.ศ. | ปีงบประมาณ ] */}
      <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] shrink-0">
        <button
          type="button"
          onClick={() => {
            setYearMode('calendar')
            applyMonthRange(activeYear, activeMonth)
          }}
          className={cn(
            'px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer',
            yearMode === 'calendar'
              ? 'bg-white dark:bg-[#28324e] text-slate-900 dark:text-white shadow-xs font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          )}
        >
          ปี พ.ศ.
        </button>
        <button
          type="button"
          onClick={() => {
            setYearMode('fiscal')
            applyFiscalYear(activeFiscalYear || currentFY)
          }}
          className={cn(
            'px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer',
            yearMode === 'fiscal'
              ? 'bg-white dark:bg-[#28324e] text-slate-900 dark:text-white shadow-xs font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          )}
        >
          ปีงบประมาณ
        </button>
      </div>

      {/* When in Fiscal Year mode: Show Fiscal Year dropdown */}
      {yearMode === 'fiscal' ? (
        <div className="relative shrink-0">
          <select
            value={activeFiscalYear}
            onChange={(e) => applyFiscalYear(Number(e.target.value))}
            aria-label="เลือกปีงบประมาณ"
            className="h-8.5 appearance-none rounded-xl bg-white dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] pl-3 pr-7 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#1e263d] hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer shadow-2xs transition"
          >
            {fiscalYearOptions.map((fy) => (
              <option key={fy} value={fy}>
                ปีงบ {fy}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 dark:text-slate-400">
            ▼
          </span>
        </div>
      ) : (
        /* When in Calendar Year mode: Show < [ปี 2569 ▼] [ต.ค. ▼] > */
        <>
          <button
            type="button"
            onClick={handleInlinePrevMonth}
            className="inline-flex items-center justify-center h-8.5 w-8.5 shrink-0 rounded-xl bg-white dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e263d] hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 transition cursor-pointer shadow-2xs"
            title="เดือนก่อนหน้า"
            aria-label="เดือนก่อนหน้า"
          >
            <ChevronLeft className="size-3.5" />
          </button>

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

          <button
            type="button"
            onClick={handleInlineNextMonth}
            className="inline-flex items-center justify-center h-8.5 w-8.5 shrink-0 rounded-xl bg-white dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e263d] hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 transition cursor-pointer shadow-2xs"
            title="เดือนถัดไป"
            aria-label="เดือนถัดไป"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </>
      )}

      {/* Subtle Visual Divider */}
      <div className="h-5 w-px bg-slate-200/80 dark:bg-[#2a334d] mx-1 shrink-0 hidden sm:block" />

      {/* Start Date Button with anchored Popover */}
      <div className="relative shrink-0">
        <button
          ref={startButtonRef}
          type="button"
          onClick={() => handleTogglePopover('start')}
          className={cn(
            'inline-flex items-center gap-1.5 h-8.5 shrink-0 rounded-xl bg-white dark:bg-[#151b2d] border px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 transition shadow-2xs cursor-pointer group',
            openPopover === 'start'
              ? 'border-cyan-500 ring-2 ring-cyan-500/30 dark:bg-[#1e263d]'
              : 'border-slate-200/90 dark:border-[#2a334d] hover:bg-slate-50 dark:hover:bg-[#1e263d] hover:border-cyan-500/40'
          )}
          title="คลิกเพื่อเปิดปฏิทินเลือกวันเริ่มต้น"
        >
          <CalendarDays className="size-3.5 text-cyan-500 dark:text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="whitespace-nowrap">{toThaiDateShort(range.startDate)}</span>
        </button>

        {openPopover === 'start' && renderCalendarPopover('start')}
      </div>

      <span className="text-slate-400 dark:text-slate-500 text-xs font-bold select-none px-0.5 shrink-0">–</span>

      {/* End Date Button with anchored Popover */}
      <div className="relative shrink-0">
        <button
          ref={endButtonRef}
          type="button"
          onClick={() => handleTogglePopover('end')}
          className={cn(
            'inline-flex items-center gap-1.5 h-8.5 shrink-0 rounded-xl bg-white dark:bg-[#151b2d] border px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 transition shadow-2xs cursor-pointer group',
            openPopover === 'end'
              ? 'border-cyan-500 ring-2 ring-cyan-500/30 dark:bg-[#1e263d]'
              : 'border-slate-200/90 dark:border-[#2a334d] hover:bg-slate-50 dark:hover:bg-[#1e263d] hover:border-cyan-500/40'
          )}
          title="คลิกเพื่อเปิดปฏิทินเลือกวันสิ้นสุด"
        >
          <CalendarDays className="size-3.5 text-cyan-500 dark:text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="whitespace-nowrap">{toThaiDateShort(range.endDate)}</span>
        </button>

        {openPopover === 'end' && renderCalendarPopover('end')}
      </div>

      {/* Subtle Visual Divider */}
      <div className="h-5 w-px bg-slate-200/80 dark:bg-[#2a334d] mx-1 shrink-0 hidden sm:block" />

      {/* Quick Presets */}
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
  )
}
