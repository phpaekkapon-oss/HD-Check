import { useMemo, useState, type FC } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileWarning,
  Info,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react'
import { useClaimCheck } from '@/hooks/useHerbDx'
import type { ClaimState, ClaimVisit, DateRange } from '@/types/herbdx.types'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { fmtNum, toThaiDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PhiName, PhiHn } from '@/components/Phi'

interface ClaimsCheckViewProps {
  readonly range: DateRange
}

type Filter = 'ALL' | 'ICD' | ClaimState

const STATE_META: Record<ClaimState, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  settled: { label: 'โอนเงินแล้ว', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300', icon: CheckCircle2 },
  pending: { label: 'ส่งแล้ว รอผล', className: 'bg-sky-500/15 text-sky-600 dark:text-sky-300', icon: Clock },
  rejected: { label: 'ถูกปฏิเสธ / มีข้อผิดพลาด', className: 'bg-rose-500/15 text-rose-600 dark:text-rose-300', icon: XCircle },
  no_result: { label: 'ยังไม่มีผลเบิก', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', icon: FileWarning },
  not_nhso: { label: 'ไม่ใช่สิทธิ UC', className: 'bg-slate-500/10 text-slate-500 dark:text-slate-400', icon: Info },
}

const PAGE = 50

const dxList = (v: ClaimVisit): [string, string][] =>
  (
    [['PDX', v.pdx], ['DX0', v.dx0], ['DX1', v.dx1], ['DX2', v.dx2], ['DX3', v.dx3], ['DX4', v.dx4], ['DX5', v.dx5]] as [string, string | null][]
  ).flatMap(([slot, code]) => (code ? [[slot, code] as [string, string]] : []))

export const ClaimsCheckView: FC<ClaimsCheckViewProps> = ({ range }) => {
  const { data, isLoading, error, isFetching } = useClaimCheck(range)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [openVn, setOpenVn] = useState<string | null>(null)

  const rows = data?.data
  const kpi = data?.kpi
  const icdErrors = (v: ClaimVisit) => v.icd_issues.some((i) => i.level === 'error')

  const filtered = useMemo(() => {
    let list = rows ?? []
    if (filter === 'ICD') list = list.filter((v) => v.icd_issues.length > 0)
    else if (filter !== 'ALL') list = list.filter((v) => v.claim_state === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (v) =>
          v.hn.includes(q) ||
          v.vn.includes(q) ||
          v.patient_name.toLowerCase().includes(q) ||
          dxList(v).some(([, c]) => c.toLowerCase().includes(q))
      )
    }
    return list
  }, [rows, filter, search])

  // HOSxP ยังไม่ได้ดึงผลจาก FDH ของช่วงนี้ → แจ้งให้ชัด ไม่ให้เข้าใจผิดว่ายังไม่ได้ส่งเบิก
  const noFdhForPeriod = Boolean(kpi && kpi.ucVisits > 0 && kpi.noResult / kpi.ucVisits > 0.8)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" /> กำลังตรวจรหัสและผลเบิกจาก HOSxP…
      </div>
    )
  }
  if (error || !kpi) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-300">
        <AlertTriangle className="size-4 shrink-0" /> {error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ'}
      </div>
    )
  }

  const chips: readonly { id: Filter; label: string; n: number }[] = [
    { id: 'ALL', label: 'ทั้งหมด', n: kpi.visits },
    { id: 'ICD', label: 'ปัญหารหัส', n: kpi.icdIssueVisits },
    { id: 'rejected', label: 'ถูกปฏิเสธ', n: kpi.rejected },
    { id: 'no_result', label: 'ยังไม่มีผลเบิก', n: kpi.noResult },
    { id: 'pending', label: 'รอผล', n: kpi.pending },
    { id: 'settled', label: 'โอนแล้ว', n: kpi.settled },
    { id: 'not_nhso', label: 'ไม่ใช่สิทธิ UC', n: kpi.visits - kpi.ucVisits },
  ]

  const cards = [
    { label: 'visit แพทย์แผนไทย', value: kpi.visits, sub: `สิทธิ UC ${fmtNum(kpi.ucVisits)} ครั้ง`, icon: BadgeCheck, tone: 'text-slate-900 dark:text-white', filter: 'ALL' as Filter },
    { label: 'ปัญหารหัสก่อนเบิก', value: kpi.icdIssueVisits, sub: kpi.icdIssueVisits ? 'ต้องแก้ใน HOSxP ก่อนส่ง' : 'รหัสถูกหลักการทั้งหมด', icon: FileWarning, tone: kpi.icdIssueVisits ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400', filter: 'ICD' as Filter },
    { label: 'ถูกปฏิเสธ / มีข้อผิดพลาด', value: kpi.rejected, sub: 'ตามผลจาก FDH', icon: XCircle, tone: kpi.rejected ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white', filter: 'rejected' as Filter },
    { label: 'โอนเงินแล้ว', value: kpi.settled, sub: `รวม ${fmtNum(kpi.settledAmount, 2)} บาท`, icon: Banknote, tone: 'text-emerald-600 dark:text-emerald-400', filter: 'settled' as Filter },
  ]

  return (
    <div className="space-y-4">
      {/* หัวหน้า */}
      <section className="rounded-2xl border border-themed bg-themed-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">ตรวจการเบิก สปสช.</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              ตรวจรหัสวินิจฉัยตามหลักการเบิก และติดตามผลเบิกจาก FDH · visit แผนกแพทย์แผนไทย {toThaiDate(range.startDate)} – {toThaiDate(range.endDate)}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {isFetching && <Loader2 className="size-3.5 animate-spin" />}
            ผลเบิกจาก FDH อัปเดตล่าสุดใน HOSxP: <span className="font-medium text-slate-700 dark:text-slate-200">{data.meta.fdhLastChecked ?? '—'}</span>
          </div>
        </div>
        {noFdhForPeriod && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-200">
            <Info className="mt-0.5 size-4 shrink-0" />
            HOSxP ยังไม่ได้ดึงสถานะการเบิกจาก FDH ของช่วงวันที่นี้ ผลเบิกจึงขึ้นว่า "ยังไม่มีผลเบิก" ไม่ได้แปลว่ายังไม่ได้ส่ง — ดึงสถานะได้จากเมนู FDH ใน HOSxP ส่วนการตรวจรหัสด้านล่างใช้ได้ทันที
          </p>
        )}
      </section>

      {/* การ์ดสรุป */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => {
              setFilter(c.filter)
              setShown(PAGE)
            }}
            className={cn(
              'rounded-2xl border bg-themed-card p-4 text-left transition hover:-translate-y-0.5 cursor-pointer',
              filter === c.filter ? 'border-accent' : 'border-themed'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{c.label}</span>
              <c.icon className="size-4 text-slate-400" />
            </div>
            <div className={cn('mt-2 text-3xl font-bold tabular-nums', c.tone)}>
              <AnimatedNumber value={c.value} />
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.sub}</div>
          </button>
        ))}
      </div>

      {/* ตาราง */}
      <section className="rounded-2xl border border-themed bg-themed-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-themed p-3 sm:p-4">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setFilter(c.id)
                  setShown(PAGE)
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer',
                  filter === c.id ? 'bg-accent text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.08]'
                )}
              >
                {c.label} <span className="tabular-nums opacity-75">{fmtNum(c.n)}</span>
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setShown(PAGE)
              }}
              placeholder="ค้นหา HN, VN, ชื่อ, รหัสโรค…"
              className="h-9 w-full rounded-lg border border-themed bg-transparent pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-accent focus:outline-hidden dark:text-slate-100"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-themed text-left text-xs text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-medium whitespace-nowrap">วันที่</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">ผู้รับบริการ</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">สิทธิ</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">รหัสวินิจฉัย</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">ตรวจรหัส</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">ผลเบิก (FDH)</th>
                <th className="w-8 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    ไม่พบรายการตามเงื่อนไข
                  </td>
                </tr>
              )}
              {filtered.slice(0, shown).map((v) => {
                const st = STATE_META[v.claim_state]
                const bad = new Set(v.icd_issues.map((i) => i.dx).filter(Boolean))
                const open = openVn === v.vn
                const hasDetail = v.icd_issues.length > 0 || v.fdh_errors.length > 0
                return (
                  <FragmentRow key={v.vn}>
                    <tr
                      onClick={() => hasDetail && setOpenVn(open ? null : v.vn)}
                      className={cn('align-top transition-colors', hasDetail && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03]')}
                    >
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">
                        {toThaiDate(v.visit_date)}
                        <div className="text-xs text-slate-400">{v.visit_time ?? ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white whitespace-nowrap"><PhiName value={v.patient_name} /></div>
                        <div className="font-mono text-xs text-slate-500">HN <PhiHn value={v.hn} /> · VN {v.vn}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <span className={cn('rounded px-1.5 py-0.5 font-medium', v.hip === 'UCS' ? 'bg-accent-soft text-accent' : 'bg-slate-500/10 text-slate-500')}>{v.hip ?? '—'}</span>
                        <div className="mt-1 max-w-40 truncate" title={v.pttype_name ?? ''}>{v.pttype_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-64 flex-wrap gap-1">
                          {dxList(v).map(([slot, c]) => (
                            <span
                              key={slot}
                              title={slot}
                              className={cn(
                                'rounded px-1.5 py-0.5 font-mono text-xs',
                                bad.has(c) ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300' : slot === 'PDX' ? 'bg-slate-200 font-semibold text-slate-800 dark:bg-white/10 dark:text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300'
                              )}
                            >
                              {c}
                            </span>
                          ))}
                          {!v.pdx && <span className="text-xs text-rose-500">ไม่มี PDX</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {v.icd_issues.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            <CheckCircle2 className="size-3.5" /> ถูกหลักการ
                          </span>
                        ) : (
                          <span className={cn('inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap', icdErrors(v) ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400')}>
                            <AlertTriangle className="size-3.5" /> {v.icd_issues.length} ประเด็น
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap', st.className)}>
                          <st.icon className="size-3.5" /> {st.label}
                        </span>
                        {v.fdh_status_th && v.claim_state !== 'settled' && <div className="mt-1 text-xs text-slate-500">{v.fdh_status_th}</div>}
                        {v.claim_state === 'settled' && v.fdh_amount != null && (
                          <div className="mt-1 text-xs tabular-nums text-slate-500">{fmtNum(v.fdh_amount, 2)} บาท{v.fdh_stm_period ? ` · งวด ${v.fdh_stm_period}` : ''}</div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-slate-400">{hasDetail && <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />}</td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50/70 dark:bg-white/[0.02]">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            {v.icd_issues.length > 0 && (
                              <div>
                                <div className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">ต้องแก้รหัสใน HOSxP</div>
                                <ul className="space-y-1.5">
                                  {v.icd_issues.map((i, k) => (
                                    <li key={k} className="text-sm">
                                      <span className={i.level === 'error' ? 'text-rose-600 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}>{i.text}</span>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">{i.hint}</div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {v.fdh_errors.length > 0 && (
                              <div>
                                <div className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">ข้อผิดพลาดจาก สปสช. (FDH)</div>
                                <ul className="space-y-1.5">
                                  {v.fdh_errors.map((e, k) => (
                                    <li key={k} className="text-sm text-rose-600 dark:text-rose-300">
                                      <span className="mr-1.5 rounded bg-rose-500/15 px-1.5 py-0.5 font-mono text-xs">{e.code}</span>
                                      {e.text}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-themed px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            แสดง {fmtNum(Math.min(shown, filtered.length))} จาก {fmtNum(filtered.length)} visit
          </span>
          {shown < filtered.length && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="rounded-lg px-3 py-1.5 font-medium text-accent hover:bg-accent-soft cursor-pointer">
              แสดงเพิ่ม
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

const FragmentRow: FC<{ readonly children: React.ReactNode }> = ({ children }) => <>{children}</>
