import { useMemo, useState, type FC } from 'react'
import { AlertTriangle, BadgeCheck, CircleHelp, ClipboardList, Clock3, Database, ListFilter, ScanLine, ShieldAlert, Stethoscope } from 'lucide-react'
import type { AuditRecord, DrugSummaryRecord, DxMapRecord } from '@/types/herbdx.types'
import { fmtNum } from '@/lib/format'
import { DxMismatchReview } from '@/components/DxMismatchReview'

interface CodeReviewQueueProps {
  readonly drugs: readonly DrugSummaryRecord[]
  readonly dxMap: readonly DxMapRecord[]
  readonly mismatches: readonly AuditRecord[]
  readonly canEdit: boolean
  readonly loading: boolean
}

type QueueFilter = 'all' | 'drug-code' | 'icd'
type QueueMode = 'mismatch' | 'missing'

export const CodeReviewQueue: FC<CodeReviewQueueProps> = ({ drugs, dxMap, mismatches, canEdit, loading }) => {
  const [mode, setMode] = useState<QueueMode>('mismatch')
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const maps = new Map(dxMap.map((item) => [item.icode, item]))
    return drugs.map((drug) => {
      const rule = maps.get(drug.icode)
      const missingDrugCode = !drug.nhso_adp_code.trim()
      const missingIcdRule = !rule?.dx_prefixes.trim()
      return {
        ...drug,
        indication: rule?.indication ?? '',
        missingDrugCode,
        missingIcdRule,
        flags: [
          ...(missingDrugCode ? ['ไม่มีรหัสยามาตรฐานในข้อมูลที่อ่านได้'] : []),
          ...(missingIcdRule ? ['ยังไม่มีเกณฑ์ ICD-10 ในระบบตรวจสอบ'] : []),
        ],
      }
    }).filter((row) => row.missingDrugCode || row.missingIcdRule)
  }, [drugs, dxMap])

  const filteredRows = rows.filter((row) => {
    const matchesFilter = filter === 'all' || (filter === 'drug-code' ? row.missingDrugCode : row.missingIcdRule)
    const q = query.trim().toLocaleLowerCase()
    return matchesFilter && (!q || row.name.toLocaleLowerCase().includes(q) || row.icode.toLocaleLowerCase().includes(q))
  })
  const noDrugCode = rows.filter((row) => row.missingDrugCode).length
  const noIcd = rows.filter((row) => row.missingIcdRule).length

  return (
    <section className="space-y-3" aria-labelledby="code-review-title">
      <div className="rounded-2xl border border-teal-200/70 bg-white/80 p-3.5 shadow-xs dark:border-teal-900/70 dark:bg-[#0d2028] sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white dark:bg-teal-500 dark:text-slate-950"><ScanLine className="size-5" /></span>
            <div className="min-w-0">
              <h1 id="code-review-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">คิวตรวจรหัสยาและ ICD-10</h1>
              <p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">ตรวจ DX ที่ไม่ตรง และรายการยาที่ข้อมูลยังไม่ครบ · ระบบไม่แก้ DX ใน HOSxP</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-teal-900/10 pt-2.5 text-[11px] text-slate-600 dark:border-white/10 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5"><Database className="size-3.5 text-teal-700 dark:text-teal-300" /> HOSxP + เกณฑ์ในระบบ</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-slate-500" /> {loading ? 'กำลังโหลดข้อมูลตามช่วงวันที่…' : 'แสดงผลอัตโนมัติตามช่วงวันที่'}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-themed bg-themed-card shadow-xs dark:divide-[#292440]">
        <Metric icon={ClipboardList} label={mode === 'mismatch' ? 'รายการ DX ไม่ตรง' : 'รายการยาทั้งหมด'} value={mode === 'mismatch' ? mismatches.length : drugs.length} tone="slate" />
        <Metric icon={AlertTriangle} label={mode === 'mismatch' ? 'รหัสยาที่พบปัญหา' : 'ไม่มีรหัสยาในข้อมูล'} value={mode === 'mismatch' ? new Set(mismatches.map((row) => row.drug_icode)).size : noDrugCode} tone="amber" />
        <Metric icon={ShieldAlert} label={mode === 'mismatch' ? 'รายการยาที่ควรตรวจเกณฑ์' : 'ยังไม่มีเกณฑ์ ICD-10'} value={mode === 'mismatch' ? mismatches.filter((row) => row.audit_result === 'FAIL').length : noIcd} tone="rose" />
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-themed bg-themed-card p-1" role="tablist" aria-label="ประเภทการตรวจ">
        <button type="button" role="tab" aria-selected={mode === 'mismatch'} onClick={() => setMode('mismatch')} className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:gap-2 sm:px-4 sm:text-sm ${mode === 'mismatch' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/35 dark:text-rose-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'}`}><Stethoscope className="size-4 shrink-0" /> <span className="truncate">DX ไม่ตรง</span> <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] dark:bg-black/20 sm:px-2 sm:text-xs">{fmtNum(mismatches.length)}</span></button>
        <button type="button" role="tab" aria-selected={mode === 'missing'} onClick={() => setMode('missing')} className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:gap-2 sm:px-4 sm:text-sm ${mode === 'missing' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/35 dark:text-amber-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'}`}><AlertTriangle className="size-4 shrink-0" /> <span className="truncate">รหัส/เกณฑ์ขาด</span> <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] dark:bg-black/20 sm:px-2 sm:text-xs">{fmtNum(rows.length)}</span></button>
      </div>

      {mode === 'mismatch' ? (
        loading ? <QueueLoading /> : <DxMismatchReview records={mismatches} dxMap={dxMap} canEdit={canEdit} />
      ) : <div className="overflow-hidden rounded-2xl border border-themed bg-themed-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-themed p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">รายการที่ควรตรวจทาน</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">แสดงเฉพาะรายการที่พบข้อมูลไม่ครบจากฐานข้อมูลของระบบ</p>
          </div>
          <label className="relative block sm:w-64">
            <ListFilter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อยาหรือรหัสยา" className="min-h-11 w-full rounded-xl border border-themed bg-themed-card pl-9 pr-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/40 dark:text-white sm:text-sm" />
          </label>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-themed px-4 py-3 sm:px-5" role="group" aria-label="กรองรายการ">
          {([
            ['all', 'ทั้งหมด', rows.length],
            ['drug-code', 'รหัสยาว่าง', noDrugCode],
            ['icd', 'เกณฑ์ ICD ว่าง', noIcd],
          ] as const).map(([key, label, count]) => (
            <button key={key} type="button" onClick={() => setFilter(key)} className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${filter === key ? 'bg-teal-700 text-white dark:bg-teal-400 dark:text-slate-950' : 'border border-themed text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'}`}>
              {label} <span className="ml-1 opacity-75">{count}</span>
            </button>
          ))}
        </div>

        {loading ? <QueueLoading /> : filteredRows.length === 0 ? (
          <div className="grid justify-items-center px-5 py-12 text-center">
            <BadgeCheck className="size-8 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">ไม่พบรายการตามตัวกรองนี้</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">การตรวจนี้ดูเฉพาะข้อมูลที่มีในระบบ ยังไม่ใช่การรับรองว่ารหัสผ่านเกณฑ์ สปสช.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-themed-header text-xs text-slate-500 dark:text-slate-400">
                  <tr><th className="px-5 py-3 font-semibold">รายการยา</th><th className="px-4 py-3 font-semibold">รหัส HOSxP</th><th className="px-4 py-3 font-semibold">รหัสที่อ่านได้</th><th className="px-4 py-3 font-semibold">สิ่งที่พบ</th><th className="px-4 py-3 text-right font-semibold">จำนวนจ่าย</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredRows.map((row) => <tr key={row.icode} className="align-top hover:bg-slate-50/70 dark:hover:bg-white/[0.025]"><td className="max-w-xs px-5 py-4 font-semibold text-slate-800 dark:text-slate-100">{row.name}</td><td className="px-4 py-4 font-mono text-xs text-slate-500">{row.icode}</td><td className="px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">{row.nhso_adp_code || '—'}</td><td className="px-4 py-4"><FlagList flags={row.flags} /></td><td className="px-4 py-4 text-right font-mono text-xs text-slate-600 dark:text-slate-300">{fmtNum(row.total_qty)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 md:hidden">
              {filteredRows.map((row) => <article key={row.icode} className="rounded-xl border border-themed bg-themed-app p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold leading-5 text-slate-900 dark:text-white">{row.name}</h3><span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600 dark:bg-white/5 dark:text-slate-300">{row.icode}</span></div><div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs"><span className="text-slate-500">รหัสที่อ่านได้</span><span className="break-all font-mono text-slate-700 dark:text-slate-300">{row.nhso_adp_code || '—'}</span><span className="text-slate-500">จำนวนจ่าย</span><span className="font-mono text-slate-700 dark:text-slate-300">{fmtNum(row.total_qty)}</span></div><div className="mt-3 border-t border-themed pt-3"><FlagList flags={row.flags} /></div></article>)}
            </div>
          </>
        )}
      </div>}

      <aside className="flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[11px] leading-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-100">
        <CircleHelp className="mt-0.5 size-3.5 shrink-0" />
        <p><strong>โปรดตรวจยืนยัน:</strong> คิวนี้ช่วยชี้รายการให้ตรวจ ไม่ใช่การรับรองเกณฑ์เบิกจ่าย และไม่แก้ DX ใน HOSxP</p>
      </aside>
    </section>
  )
}

const Metric: FC<{ icon: typeof ClipboardList; label: string; value: number; tone: 'slate' | 'amber' | 'rose' }> = ({ icon: Icon, label, value, tone }) => {
  const colors = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-200',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  }
  return <div className="flex min-w-0 items-center gap-2 px-2.5 py-2.5 sm:gap-3 sm:px-4"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${colors[tone]}`}><Icon className="size-4" /></span><div className="min-w-0"><p className="text-base font-bold leading-5 text-slate-900 dark:text-white sm:text-lg">{fmtNum(value)}</p><p className="mt-0.5 truncate text-[10px] leading-4 text-slate-500 dark:text-slate-400 sm:text-xs">{label}</p></div></div>
}

const QueueLoading: FC = () => <div role="status" className="grid justify-items-center rounded-xl border border-themed bg-themed-card px-4 py-8 text-center"><span className="grid size-9 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"><ScanLine className="size-4 animate-pulse" /></span><p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">กำลังโหลดข้อมูลตามช่วงวันที่</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">เมื่อโหลดเสร็จ รายการจะแสดงอัตโนมัติ</p></div>

const FlagList: FC<{ flags: readonly string[] }> = ({ flags }) => <div className="flex flex-wrap gap-1.5">{flags.map((flag) => <span key={flag} className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium leading-4 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"><AlertTriangle className="size-3 shrink-0" />{flag}</span>)}</div>
