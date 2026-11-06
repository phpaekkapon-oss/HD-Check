import { useEffect, useRef, useState, type FC } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { THAI_MONTHS_FULL, THAI_MONTHS_SHORT, toThaiDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ThaiCalendarPickerProps {
  /** day: เลือกวันที่ (YYYY-MM-DD) · month: เลือกเดือน (YYYY-MM) */
  readonly mode: 'day' | 'month'
  readonly value: string
  /** วัน/เดือนสูงสุดที่เลือกได้ (รูปแบบเดียวกับ value) */
  readonly max: string
  readonly onChange: (value: string) => void
}

type Panel = 'days' | 'months'

const pad = (n: number) => String(n).padStart(2, '0')
const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'] as const

const parse = (v: string) => {
  const [y, m, d] = v.split('-').map(Number)
  return { y: y ?? 0, m: (m ?? 1) - 1, d: d ?? 1 }
}

const NAV_BTN = 'p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed'

/** ปฏิทินปี พ.ศ. แบบ popover: คลิกเลือกวัน, คลิกชื่อเดือนเพื่อกระโดดเดือน/ปี */
export const ThaiCalendarPicker: FC<ThaiCalendarPickerProps> = ({ mode, value, max, onChange }) => {
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<Panel>('days')
  const [view, setView] = useState(() => parse(value))
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const maxP = parse(max)
  const cur = parse(value)
  const label = mode === 'day' ? toThaiDateShort(value) : `${THAI_MONTHS_FULL[cur.m] ?? ''} ${cur.y + 543}`
  const monthDisabled = (y: number, m: number) => y > maxP.y || (y === maxP.y && m > maxP.m)

  const toggle = () => {
    if (!open) {
      setView(parse(value))
      setPanel(mode === 'day' ? 'days' : 'months')
    }
    setOpen((v) => !v)
  }

  const shiftMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1)
    setView({ y: d.getFullYear(), m: d.getMonth(), d: 1 })
  }

  const pickMonth = (m: number) => {
    if (mode === 'month') {
      onChange(`${view.y}-${pad(m + 1)}`)
      setOpen(false)
    } else {
      setView({ y: view.y, m, d: 1 })
      setPanel('days')
    }
  }

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const firstWeekday = new Date(view.y, view.m, 1).getDay()
  const todayValue = max
  const nextView = new Date(view.y, view.m + 1, 1)
  const nextMonthBlocked = monthDisabled(nextView.getFullYear(), nextView.getMonth())

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={mode === 'day' ? 'คลิกเพื่อเลือกวันที่ (ปฏิทิน พ.ศ.)' : 'คลิกเพื่อเลือกเดือน (ปฏิทิน พ.ศ.)'}
        className={cn(
          'inline-flex items-center gap-1.5 h-8.5 rounded-xl border px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 transition cursor-pointer bg-white dark:bg-[var(--card-bg)]',
          open ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'border-slate-200/90 dark:border-[var(--card-border)] hover:border-cyan-500/40'
        )}
      >
        <CalendarDays className="size-3.5 text-cyan-500 shrink-0" aria-hidden />
        <span className="whitespace-nowrap">{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={mode === 'day' ? 'เลือกวันที่ ปฏิทินไทย' : 'เลือกเดือน ปฏิทินไทย'}
          className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-[#161c2e] text-slate-900 dark:text-slate-100 shadow-2xl p-4 select-none"
        >
          {panel === 'days' ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => shiftMonth(-1)} className={NAV_BTN} aria-label="เดือนก่อนหน้า">
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPanel('months')}
                  className="font-bold text-sm tracking-wide hover:text-cyan-500 transition cursor-pointer"
                  title="เลือกเดือน/ปี"
                >
                  {THAI_MONTHS_FULL[view.m]} {view.y + 543} ▾
                </button>
                <button type="button" onClick={() => shiftMonth(1)} disabled={nextMonthBlocked} className={NAV_BTN} aria-label="เดือนถัดไป">
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 text-center text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-2">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 text-center gap-y-1 text-sm font-semibold">
                {Array.from({ length: firstWeekday }, (_, i) => (
                  <div key={`e${i}`} className="h-9" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const iso = `${view.y}-${pad(view.m + 1)}-${pad(day)}`
                  const selected = iso === value
                  const isToday = iso === todayValue
                  const future = iso > max
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={future}
                      aria-pressed={selected}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => {
                        onChange(iso)
                        setOpen(false)
                      }}
                      className={cn(
                        'h-9 w-9 mx-auto rounded-xl flex items-center justify-center transition cursor-pointer',
                        selected
                          ? 'bg-[#0284c7] text-white font-bold shadow-md shadow-cyan-600/30'
                          : isToday
                            ? 'text-cyan-600 dark:text-cyan-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800/70'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60',
                        future && 'opacity-30 cursor-not-allowed hover:bg-transparent'
                      )}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setView({ ...view, y: view.y - 1 })} className={NAV_BTN} aria-label="ปีก่อนหน้า">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="font-bold text-sm tracking-wide">พ.ศ. {view.y + 543}</span>
                <button type="button" onClick={() => setView({ ...view, y: view.y + 1 })} disabled={view.y >= maxP.y} className={NAV_BTN} aria-label="ปีถัดไป">
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {THAI_MONTHS_SHORT.map((name, m) => {
                  const selected = view.y === cur.y && m === cur.m
                  const disabled = monthDisabled(view.y, m)
                  return (
                    <button
                      key={name}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      onClick={() => pickMonth(m)}
                      className={cn(
                        'h-10 rounded-xl text-sm font-semibold transition cursor-pointer',
                        selected ? 'bg-[#0284c7] text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60',
                        disabled && 'opacity-30 cursor-not-allowed hover:bg-transparent'
                      )}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200 dark:border-slate-800/80 text-xs">
            <button
              type="button"
              onClick={() => {
                onChange(max)
                setOpen(false)
              }}
              className="text-cyan-600 dark:text-cyan-400 hover:underline font-bold cursor-pointer"
            >
              {mode === 'day' ? 'วันนี้' : 'เดือนนี้'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer">
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
