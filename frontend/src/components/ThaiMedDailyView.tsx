import { useState, type FC, type FormEvent, type ReactNode } from 'react'
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, HandHeart, ImageDown, Pencil, Pill, Users, Wallet } from 'lucide-react'
import type { ThaiMedDailySummary } from '@/api/herbdx.api'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { useSaveThaiMedOutreach, useThaiMedDaily } from '@/hooks/useHerbDx'
import { THAI_MONTHS_FULL, fmtNum, toThaiDateLong } from '@/lib/format'
import { INFOGRAPHIC_STYLES } from '@/lib/infographicStyles'
import type { DateRange } from '@/types/herbdx.types'

const pad = (n: number) => String(n).padStart(2, '0')
const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const shiftDay = (iso: string, delta: number) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
type Mode = 'day' | 'month'

const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date((y ?? 0), (m ?? 1) - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
const monthRange = (ym: string): DateRange => {
  const [y, m] = ym.split('-').map(Number)
  return { startDate: `${ym}-01`, endDate: `${ym}-${pad(new Date(y ?? 0, m ?? 1, 0).getDate())}` }
}
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return `${THAI_MONTHS_FULL[(m ?? 1) - 1] ?? ''} พ.ศ. ${(y ?? 0) + 543}`
}

const WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const
const weekdayOf = (iso: string) => WEEKDAYS[new Date(`${iso}T00:00:00`).getDay()] ?? ''

const baht = (n: number) => fmtNum(n, 2)
const HEAD = 'px-3 py-2 text-[11px] font-bold text-white bg-accent text-center'
const CELL = 'px-3 py-2 text-sm tabular-nums text-right'

const SOURCE_LABEL: Record<ThaiMedDailySummary['outreach']['source'], string> = {
  hosxp: 'จาก HOSxP',
  manual: 'กรอกเอง',
  mixed: 'HOSxP + กรอกเอง',
  none: 'ยังไม่มีข้อมูล',
}

interface OutreachFormProps {
  readonly date: string
  readonly current: number
  readonly hasManual: boolean
  readonly onDone: () => void
}

const OutreachForm: FC<OutreachFormProps> = ({ date, current, hasManual, onDone }) => {
  const save = useSaveThaiMedOutreach()
  const [count, setCount] = useState(String(current))
  const [reason, setReason] = useState('')

  const submit = (clear: boolean) => {
    save.mutate(
      { date, count: clear ? null : Number(count), reason: reason.trim() },
      { onSuccess: onDone }
    )
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(false)
  }
  const validCount = /^\d{1,4}$/.test(count)
  const validReason = reason.trim().length >= 3

  return (
    <form onSubmit={onSubmit} className="mt-2 p-3 rounded-xl border border-themed bg-themed-card space-y-2">
      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        จำนวนผู้ออกชุมชน (ราย)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-themed bg-transparent text-sm tabular-nums"
        />
      </label>
      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        เหตุผล / ที่มาของตัวเลข (บันทึกเป็นประวัติ)
        <input
          type="text"
          maxLength={255}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เช่น ออกหน่วยเยี่ยมบ้าน หมู่ 3"
          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-themed bg-transparent text-sm"
        />
      </label>
      {save.isError && <p className="text-xs text-rose-500" role="alert">{save.error.message}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!validCount || !validReason || save.isPending}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-accent disabled:opacity-40"
        >
          {save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
        {hasManual && (
          <button
            type="button"
            disabled={!validReason || save.isPending}
            onClick={() => submit(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-themed disabled:opacity-40"
            title="ลบค่าที่กรอกเอง แล้วใช้ยอดจาก HOSxP (ต้องระบุเหตุผล)"
          >
            ใช้ยอดจาก HOSxP
          </button>
        )}
        <button type="button" onClick={onDone} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500">
          ยกเลิก
        </button>
      </div>
    </form>
  )
}

interface KpiCardProps {
  readonly icon: typeof Users
  readonly label: string
  readonly value: number
  readonly decimals?: number
  readonly unit: string
  readonly sub: string
  readonly tone: string
  readonly strong?: boolean
  readonly action?: ReactNode
}

const KpiCard: FC<KpiCardProps> = ({ icon: Icon, label, value, decimals = 0, unit, sub, tone, strong = false, action }) => (
  <div className={`relative rounded-2xl p-4 border shadow-xs ${strong ? 'border-accent/50 bg-accent-soft' : 'border-themed bg-themed-card'}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</div>
      <span className={`grid place-items-center size-8 rounded-xl border ${tone}`}>
        <Icon className="size-4" aria-hidden />
      </span>
    </div>
    <div className="mt-1.5 flex items-baseline gap-1.5">
      <AnimatedNumber value={value} decimals={decimals} className="text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white" />
      <span className="text-xs font-semibold text-slate-500">{unit}</span>
    </div>
    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
      <span>{sub}</span>
      {action}
    </div>
  </div>
)

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
const SERVICE_BAR = 'bg-teal-500'
const DRUG_BAR = 'bg-amber-500'

/** สรุปผลการดำเนินงานประจำวัน กลุ่มงานแพทย์แผนไทย แยกตามสิทธิการรักษา (เฉพาะ IT / ผู้ดูแลแผนไทย) */
export const ThaiMedDailyView: FC = () => {
  const [mode, setMode] = useState<Mode>('day')
  const [date, setDate] = useState(todayIso)
  const [month, setMonth] = useState(() => todayIso().slice(0, 7))
  const [editing, setEditing] = useState(false)
  const range: DateRange = mode === 'day' ? { startDate: date, endDate: date } : monthRange(month)
  const { data, isLoading, isError, error } = useThaiMedDaily(range, true)

  const [styleId, setStyleId] = useState(INFOGRAPHIC_STYLES[0]?.id ?? 'classic')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const thisMonth = todayIso().slice(0, 7)

  const changeDate = (next: string) => {
    setEditing(false)
    setDate(next)
  }
  const changeMonth = (next: string) => {
    setEditing(false)
    setMonth(next)
  }
  const changeMode = (next: Mode) => {
    setEditing(false)
    setMode(next)
  }

  const exportImage = async () => {
    if (!data) return
    setExporting(true)
    setExportError('')
    try {
      const { downloadBlob, infographicFilename, renderInfographic } = await import('@/lib/thaiMedInfographic')
      const blob = await renderInfographic(data, 'โรงพยาบาลพังโคน', styleId)
      downloadBlob(blob, infographicFilename(data, styleId))
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'สร้างภาพไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  const totals = data?.totals
  const serviceDrugTotal = totals ? totals.serviceValue + totals.drugValue : 0
  const maxGroupTotal = data ? Math.max(0, ...data.groups.map((g) => g.total)) : 0
  const avgPerPerson = totals && totals.persons > 0 ? totals.grandTotal / totals.persons : 0

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-themed-card border border-themed shadow-xs">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center size-10 rounded-xl bg-accent-soft text-accent">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {mode === 'day' ? 'สรุปผลการดำเนินงานประจำวัน' : 'สรุปผลการดำเนินงานประจำเดือน'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              กลุ่มงานแพทย์แผนไทยและการแพทย์ทางเลือก · {mode === 'day' ? `วัน${weekdayOf(date)}ที่ ${toThaiDateLong(date)}` : monthLabel(month)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div role="group" aria-label="ช่วงเวลา" className="flex rounded-lg border border-themed overflow-hidden text-xs font-semibold">
            {(['day', 'month'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => changeMode(m)}
                className={`px-3 py-1.5 ${mode === m ? 'bg-accent text-white' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {m === 'day' ? 'รายวัน' : 'รายเดือน'}
              </button>
            ))}
          </div>
          {mode === 'day' ? (
            <>
              <button type="button" onClick={() => changeDate(shiftDay(date, -1))} aria-label="วันก่อนหน้า" className="p-2 rounded-lg border border-themed">
                <ChevronLeft className="size-4" />
              </button>
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-themed text-sm">
                <input
                  type="date"
                  value={date}
                  max={todayIso()}
                  onChange={(e) => e.target.value && changeDate(e.target.value)}
                  aria-label="เลือกวันที่"
                  className="bg-transparent outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => changeDate(shiftDay(date, 1))}
                disabled={date >= todayIso()}
                aria-label="วันถัดไป"
                className="p-2 rounded-lg border border-themed disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => changeDate(todayIso())}
                disabled={date === todayIso()}
                className="px-2.5 py-1.5 rounded-lg border border-themed text-xs font-semibold disabled:opacity-30"
              >
                วันนี้
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => changeMonth(shiftMonth(month, -1))} aria-label="เดือนก่อนหน้า" className="p-2 rounded-lg border border-themed">
                <ChevronLeft className="size-4" />
              </button>
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-themed text-sm">
                <input
                  type="month"
                  value={month}
                  max={thisMonth}
                  onChange={(e) => e.target.value && changeMonth(e.target.value)}
                  aria-label="เลือกเดือน"
                  className="bg-transparent outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => changeMonth(shiftMonth(month, 1))}
                disabled={month >= thisMonth}
                aria-label="เดือนถัดไป"
                className="p-2 rounded-lg border border-themed disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => changeMonth(thisMonth)}
                disabled={month === thisMonth}
                className="px-2.5 py-1.5 rounded-lg border border-themed text-xs font-semibold disabled:opacity-30"
              >
                เดือนนี้
              </button>
            </>
          )}
        </div>
      </div>

      <section className="p-3 rounded-2xl bg-themed-card border border-themed shadow-xs space-y-2.5" aria-label="ส่งออกเป็นภาพ">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
            <ImageDown className="size-4 text-accent" aria-hidden /> ส่งออกเป็นภาพอินโฟกราฟิก ({mode === 'day' ? 'รายวัน' : 'รายเดือน'})
          </h3>
          <button
            type="button"
            onClick={exportImage}
            disabled={!data || exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-accent disabled:opacity-40"
          >
            <ImageDown className="size-4" aria-hidden /> {exporting ? 'กำลังสร้างภาพ…' : 'บันทึกเป็นภาพ (PNG)'}
          </button>
        </div>
        <div role="radiogroup" aria-label="สไตล์ภาพ" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          {INFOGRAPHIC_STYLES.map((st) => {
            const on = st.id === styleId
            return (
              <button
                key={st.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setStyleId(st.id)}
                title={st.hint}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left text-xs font-semibold ${on ? 'border-accent bg-accent-soft text-accent' : 'border-themed text-slate-600 dark:text-slate-300'}`}
              >
                <span className="size-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: st.swatch }} aria-hidden />
                <span className="min-w-0 leading-tight">{st.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {INFOGRAPHIC_STYLES.find((st) => st.id === styleId)?.hint}
        </p>
        {exportError && <p className="text-xs text-rose-500" role="alert">{exportError}</p>}
      </section>

      {isLoading && (
        <div role="status" aria-live="polite" className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
          <div className="skeleton h-72 rounded-2xl" />
          <p className="sr-only">กำลังดึงข้อมูลจาก HOSxP…</p>
        </div>
      )}
      {isError && <p className="text-sm text-rose-500" role="alert">ดึงข้อมูลสรุปรายวันไม่สำเร็จ: {error.message}</p>}

      {data && totals && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={Users}
              label="ผู้รับบริการทั้งหมด"
              value={totals.persons}
              unit="ราย"
              sub={`นวด/หัตถการ ${fmtNum(totals.servicePersons)} · รับยา ${fmtNum(totals.drugPersons)}`}
              tone="bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30"
            />
            <KpiCard
              icon={HandHeart}
              label="ออกชุมชน"
              value={data.outreach.count}
              unit="ราย"
              sub={SOURCE_LABEL[data.outreach.source]}
              tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
              action={mode === 'day' ? (
                <button type="button" onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1 font-semibold text-accent" aria-expanded={editing}>
                  <Pencil className="size-3" aria-hidden /> แก้ไข
                </button>
              ) : undefined}
            />
            <KpiCard
              icon={Banknote}
              label="รวมค่าบริการทั้งหมด"
              value={totals.grandTotal}
              decimals={2}
              unit="บาท"
              sub={`รวมค่าบริการผู้ป่วยนอก ${baht(totals.opdFee)}`}
              tone="bg-accent-soft text-accent border-accent/30"
              strong
            />
            <KpiCard
              icon={Wallet}
              label="เฉลี่ยต่อผู้รับบริการ"
              value={avgPerPerson}
              decimals={2}
              unit="บาท/ราย"
              sub="ค่าบริการรวม ÷ ผู้รับบริการ"
              tone="bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30"
            />
          </div>

          {editing && mode === 'day' && (
            <div className="max-w-md">
              <OutreachForm date={date} current={data.outreach.count} hasManual={data.outreach.manual !== null} onDone={() => setEditing(false)} />
            </div>
          )}
          {data.outreach.manual && !editing && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ยอดออกชุมชนกรอกโดย {data.outreach.manual.updatedBy} · {data.outreach.manual.reason}
              {data.outreach.hosxpCount > 0 && ` · HOSxP บันทึกไว้ ${fmtNum(data.outreach.hosxpCount)} ราย`}
            </p>
          )}

          {mode === 'month' && data.outreach.manualDays > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ยอดออกชุมชนรายเดือนรวมจากรายวัน · มี {fmtNum(data.outreach.manualDays)} วันที่เจ้าหน้าที่กรอกเอง (แก้ไขได้ในโหมดรายวัน)
            </p>
          )}

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] items-start">
            <div className="rounded-2xl border border-themed bg-themed-card shadow-xs overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${HEAD} text-left`} scope="col">สิทธิการรักษา</th>
                    <th className={HEAD} scope="col">จำนวนคน (ราย)</th>
                    <th className={HEAD} scope="col">ค่านวด ประคบ อบ พอกเข่า หัตถการอื่นๆ (บาท)</th>
                    <th className={HEAD} scope="col">ค่ายาสมุนไพร (บาท)</th>
                    <th className={HEAD} scope="col">รวมค่าบริการ (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  <tr className="bg-amber-500/10 font-semibold">
                    <th scope="row" className="px-3 py-2.5 text-left text-sm">ผู้รับบริการทั้งหมด</th>
                    <td className={CELL}>{fmtNum(totals.persons)} คน</td>
                    <td className={CELL}>{fmtNum(totals.servicePersons)} คน</td>
                    <td className={CELL}>{fmtNum(totals.drugPersons)} คน</td>
                    <td className={`${CELL} text-slate-400`}>–</td>
                  </tr>
                  <tr className="bg-amber-500/10 font-semibold">
                    <th scope="row" className="px-3 py-2.5 text-left text-sm">
                      ออกชุมชน
                      <span className="ml-2 text-[10px] font-medium text-slate-500">({SOURCE_LABEL[data.outreach.source]})</span>
                    </th>
                    <td className={CELL}>{fmtNum(data.outreach.count)} คน</td>
                    <td className={`${CELL} text-slate-400`}>–</td>
                    <td className={`${CELL} text-slate-400`}>–</td>
                    <td className={`${CELL} text-slate-400`}>–</td>
                  </tr>
                  {data.groups.map((g) => {
                    const empty = g.persons === 0
                    return (
                      <tr key={g.id} className={empty ? 'text-slate-400 dark:text-slate-600' : 'hover:bg-slate-50 dark:hover:bg-white/5'}>
                        <th scope="row" className="px-3 py-2.5 text-left text-sm font-medium">{g.label}</th>
                        <td className={CELL}>{fmtNum(g.persons)}</td>
                        <td className={CELL}>{fmtNum(g.serviceValue, 2)}</td>
                        <td className={CELL}>{fmtNum(g.drugValue, 2)}</td>
                        <td className={`${CELL} font-bold ${empty ? '' : 'text-accent'}`}>{fmtNum(g.total, 2)}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-amber-500/10">
                    <th scope="row" className="px-3 py-2.5 text-left text-sm font-medium">
                      ค่าบริการผู้ป่วยนอก (50 บาท)
                      <span className="block text-[10px] font-normal text-slate-500">
                        ในเวลา {baht(totals.opdFeeInHours)} · นอกเวลา {baht(totals.opdFeeOutHours)}
                      </span>
                    </th>
                    <td className={`${CELL} text-slate-400`}>–</td>
                    <td className={`${CELL} text-slate-400`}>–</td>
                    <td className={`${CELL} text-slate-400`}>–</td>
                    <td className={`${CELL} font-bold`}>{baht(totals.opdFee)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-accent text-white font-extrabold">
                    <th scope="row" className="px-3 py-3 text-left text-sm">รวมทั้งสิ้น</th>
                    <td className={CELL}>{fmtNum(totals.persons)}</td>
                    <td className={CELL}>{baht(totals.serviceValue)}</td>
                    <td className={CELL}>{baht(totals.drugValue)}</td>
                    <td className={CELL}>{baht(totals.grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
              <p className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                ยอดเงินประมาณการจากรายการค่าบริการใน HOSxP (opitemrece) แยกกลุ่มสิทธิตาม hipdata_code ของสิทธิในวันที่รับบริการ
                {mode === 'month' && ' · รายเดือนนับผู้รับบริการไม่ซ้ำคนในแต่ละสิทธิ'}
              </p>
            </div>

            <section className="rounded-2xl border border-themed bg-themed-card shadow-xs p-4 space-y-4" aria-label="สัดส่วนรายได้">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">สัดส่วนรายได้ตามสิทธิ</h3>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${SERVICE_BAR}`} aria-hidden />ค่านวด/หัตถการ</span>
                  <span className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${DRUG_BAR}`} aria-hidden />ค่ายาสมุนไพร</span>
                </div>
              </div>

              {maxGroupTotal === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">ไม่มีรายการค่าบริการในช่วงที่เลือก</p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {data.groups.filter((g) => g.total > 0).map((g) => (
                      <li key={g.id}>
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{g.label}</span>
                          <span className="tabular-nums text-slate-500">{baht(g.total)} บาท · {fmtNum(g.persons)} ราย</span>
                        </div>
                        <div
                          className="mt-1 h-3 rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden"
                          role="img"
                          aria-label={`${g.label} ค่านวดและหัตถการ ${baht(g.serviceValue)} บาท ค่ายา ${baht(g.drugValue)} บาท`}
                        >
                          <div className="flex h-full" style={{ width: `${pct(g.total, maxGroupTotal)}%` }}>
                            <div className={SERVICE_BAR} style={{ width: `${pct(g.serviceValue, g.total)}%` }} />
                            <div className={DRUG_BAR} style={{ width: `${pct(g.drugValue, g.total)}%` }} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t border-themed pt-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <Pill className="size-3.5 text-accent" aria-hidden /> สัดส่วนค่านวด/หัตถการ : ค่ายา
                    </div>
                    <div
                      className="mt-1.5 flex h-4 rounded-full overflow-hidden bg-slate-200/70 dark:bg-white/10"
                      role="img"
                      aria-label={`ค่านวดและหัตถการ ${pct(totals.serviceValue, serviceDrugTotal).toFixed(1)} เปอร์เซ็นต์ ค่ายา ${pct(totals.drugValue, serviceDrugTotal).toFixed(1)} เปอร์เซ็นต์`}
                    >
                      <div className={SERVICE_BAR} style={{ width: `${pct(totals.serviceValue, serviceDrugTotal)}%` }} />
                      <div className={DRUG_BAR} style={{ width: `${pct(totals.drugValue, serviceDrugTotal)}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-500">
                      <span>{pct(totals.serviceValue, serviceDrugTotal).toFixed(1)}% · {baht(totals.serviceValue)}</span>
                      <span>{pct(totals.drugValue, serviceDrugTotal).toFixed(1)}% · {baht(totals.drugValue)}</span>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
