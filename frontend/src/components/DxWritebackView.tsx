import { useMemo, useState, type FC } from 'react'
import { AlertTriangle, CalendarClock, CircleHelp, LockKeyhole, Send, ShieldCheck, Sparkles } from 'lucide-react'
import type { AuditRecord, DateRange } from '@/types/herbdx.types'
import { DateRangeFields } from '@/components/AuditFilterBar'
import { fmtNum, toThaiDateShort } from '@/lib/format'
import { CopyButton } from '@/components/CopyButton'
import { PhiHn } from '@/components/Phi'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

interface DxWritebackViewProps {
  readonly records: readonly AuditRecord[]
  readonly range: DateRange
  readonly onRangeChange: (range: DateRange) => void
  readonly latestVisitDate?: string | null
  readonly canEdit: boolean
  readonly loading: boolean
}

interface VisitGroup {
  readonly vn: string
  readonly hn: string
  readonly patientName: string
  readonly date: string
  readonly records: readonly AuditRecord[]
  readonly diagnoses: readonly string[]
}

const normalizeIcd = (value: string) => value.trim().toUpperCase().replace(/\./g, '')

export const DxWritebackView: FC<DxWritebackViewProps> = ({ records, range, onRangeChange, latestVisitDate, canEdit, loading }) => {
  const [search, setSearch] = useState('')
  const [selectedVN, setSelectedVN] = useState('')

  const visits = useMemo(() => {
    const byVN = new Map<string, AuditRecord[]>()
    for (const record of records) {
      if (record.audit_result === 'PASS') continue
      const key = record.vn || (record.hn ? `${record.hn}_${record.visit_date}` : String(record.id))
      const group = byVN.get(key) ?? []
      group.push(record)
      byVN.set(key, group)
    }
    return [...byVN.entries()].map(([vn, rows]): VisitGroup => ({
      vn: rows[0]?.vn || vn,
      hn: rows[0]?.hn ?? '',
      patientName: rows[0]?.patient_name ?? '',
      date: rows[0]?.visit_date ?? '',
      records: rows,
      diagnoses: [...new Set(rows.flatMap((row) => [row.main_pdx, row.pdx, row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5]).map((dx) => dx.trim().toUpperCase()).filter(Boolean))],
    })).sort((a, b) => `${b.date}${b.vn}`.localeCompare(`${a.date}${a.vn}`))
  }, [records])

  const filtered = visits.filter((visit) => {
    const q = search.trim().toLocaleLowerCase()
    return !q || visit.hn.toLocaleLowerCase().includes(q) || visit.vn.toLocaleLowerCase().includes(q) || visit.patientName.toLocaleLowerCase().includes(q)
  })
  const selected = visits.find((visit) => visit.vn === selectedVN)
  const matchesConfiguredRule = (dx: string, row: AuditRecord) => {
    const normalizedDx = normalizeIcd(dx)
    return normalizedDx.length > 0 && row.allowed_dx.some((rule) => normalizedDx.startsWith(normalizeIcd(rule)))
  }

  if (!canEdit) {
    return <section className="rounded-2xl border border-rose-300/50 bg-rose-50 p-6 text-center dark:border-rose-900/50 dark:bg-rose-950/25"><LockKeyhole className="mx-auto size-7 text-rose-700 dark:text-rose-300" /><h1 className="mt-2 font-bold text-rose-950 dark:text-rose-100">จำกัดสิทธิ์ผู้ดูแลระบบและแพทย์แผนไทย</h1><p className="mt-1 text-sm text-rose-800 dark:text-rose-200">หน้านี้มีข้อมูลรายครั้งรับบริการและเปิดให้เฉพาะผู้ดูแลระบบและแพทย์แผนไทยตรวจทาน</p></section>
  }

  return (
    <section className="space-y-4" aria-labelledby="dx-writeback-title">
      <header className="flex flex-col gap-3 rounded-2xl border border-themed bg-themed-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><Send className="size-5" /></span>
          <div><h1 id="dx-writeback-title" className="text-lg font-bold text-slate-900 dark:text-white">ทบทวนรหัสโรค (DX) รายครั้งรับบริการ</h1><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">เลือกจากรายการตรวจที่ไม่ผ่าน เพื่อเตรียมทบทวนข้อมูลของ VN นั้นโดยเฉพาะ</p></div>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200"><LockKeyhole className="size-4" /> โหมดตรวจทาน — ยังไม่เขียนลง HOSxP</div>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-themed bg-themed-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3"><DateRangeFields range={range} onChange={onRangeChange} /><span className="text-xs text-slate-500">พบ {fmtNum(visits.length)} VN ที่ควรทบทวน</span></div>
        {latestVisitDate && <button type="button" onClick={() => {
          const [year, month] = latestVisitDate.split('-')
          const lastDay = new Date(Number(year), Number(month), 0).getDate()
          onRangeChange({ startDate: `${year}-${month}-01`, endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}` })
        }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-themed px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"><CalendarClock className="size-4" /> เดือนที่มีข้อมูลล่าสุด ({toThaiDateShort(latestVisitDate)})</button>}
      </div>

      {!canEdit && <div className="flex items-center gap-2 rounded-xl border border-rose-300/50 bg-rose-50 px-3 py-2.5 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/25 dark:text-rose-200"><LockKeyhole className="size-4" /> หน้านี้จำกัดให้ผู้ดูแลระบบใช้ทดสอบเท่านั้น</div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="overflow-hidden rounded-xl border border-themed bg-themed-card">
          <div className="border-b border-themed p-3">
            <label className="block"><span className="sr-only">ค้นหา HN, VN หรือชื่อผู้ป่วย</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหา HN, VN หรือชื่อผู้ป่วย" className="min-h-10 w-full rounded-lg border border-themed bg-themed-app px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500/40 dark:text-white" /></label>
          </div>
          {loading ? <LoadingSkeleton rows={6} label="กำลังโหลดรายการตามช่วงวันที่" /> : filtered.length === 0 ? <div className="p-8 text-center"><CircleHelp className="mx-auto size-6 text-slate-400" /><p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">ไม่พบ VN ที่ต้องทบทวนในช่วงนี้</p><p className="mt-1 text-xs text-slate-500">ลองเปลี่ยนช่วงวันที่ หรือเลือกเดือนที่มีข้อมูลล่าสุด</p></div> : (
            <div className="max-h-[60vh] overflow-auto divide-y divide-slate-100 dark:divide-white/5">
              {filtered.slice(0, 300).map((visit) => <button key={visit.vn} type="button" onClick={() => setSelectedVN(visit.vn)} className={`w-full px-3 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.03] ${selectedVN === visit.vn ? 'bg-violet-50 dark:bg-violet-950/25' : ''}`}>
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                      <span>{visit.patientName || 'ไม่พบชื่อผู้ป่วย'}</span>
                      {visit.patientName ? <CopyButton text={visit.patientName} title="คัดลอกชื่อผู้ป่วย" iconSize="size-3" /> : null}
                    </span>
                    <span className="mt-1 flex items-center gap-1 font-mono text-xs text-slate-500">
                      <span>HN <PhiHn value={visit.hn} /></span>
                      <CopyButton text={visit.hn} sensitive title="คัดลอก HN" iconSize="size-3" />
                      <span>· VN {visit.vn}</span>
                      <CopyButton text={visit.vn} title="คัดลอก VN" iconSize="size-3" />
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{toThaiDateShort(visit.date)}</span>
                </span>
                <span className="mt-1 block truncate text-xs text-slate-600 dark:text-slate-300">{visit.records.map((row) => row.drug_name).join(' · ')}</span>
              </button>)}
              {filtered.length > 300 && <p className="p-3 text-center text-xs text-slate-500">แสดง 300 จาก {fmtNum(filtered.length)} VN · กรุณาค้นหาด้วย HN หรือ VN เพื่อจำกัดรายการ</p>}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-themed bg-themed-card p-4">
          {!selected ? <div className="grid min-h-48 place-items-center text-center"><div><ShieldCheck className="mx-auto size-7 text-slate-400" /><p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">เลือกรายการทางซ้ายเพื่อดูรายละเอียด</p><p className="mt-1 text-xs text-slate-500">ระบบจะแสดง DX ที่มีอยู่และผลตรวจของ VN ที่เลือก</p></div></div> : <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">{selected.patientName}</h2>
                  <CopyButton text={selected.patientName} title="คัดลอกชื่อผู้ป่วย" />
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-slate-500">
                  <span>HN <PhiHn value={selected.hn} /></span>
                  <CopyButton text={selected.hn} sensitive title="คัดลอก HN" iconSize="size-3" />
                  <span>· VN {selected.vn}</span>
                  <CopyButton text={selected.vn} title="คัดลอก VN" iconSize="size-3" />
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-white/5">{toThaiDateShort(selected.date)}</span>
            </div>
            <div className="mt-4 space-y-3">
              <section><h3 className="text-xs font-semibold text-slate-500">รายการยาและผลตรวจ</h3><div className="mt-1 space-y-1">{selected.records.map((row) => <div key={row.id} className="rounded-lg border border-themed bg-themed-app px-3 py-2"><p className="text-sm font-medium text-slate-900 dark:text-white">{row.drug_name}</p><p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">{row.audit_reason}</p></div>)}</div></section>
              <section>
                <h3 className="text-xs font-semibold text-slate-500">DX ที่พบในข้อมูล</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">{selected.diagnoses.length ? selected.diagnoses.map((dx) => {
                  const matched = selected.records.some((row) => matchesConfiguredRule(dx, row))
                  return <span key={dx} title={matched ? 'ตรงกับเกณฑ์ ICD ที่ตั้งไว้ในแอป' : 'ไม่ตรงกับเกณฑ์ ICD ที่ตั้งไว้ในแอป'} className={`rounded-md px-2 py-1 font-mono text-xs ${matched ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'}`}>
                    {dx}{matched ? ' ✓' : ''}
                  </span>
                }) : <span className="text-xs text-slate-500">ไม่พบ DX ในข้อมูลที่อ่านได้</span>}</div>
                <p className="mt-1 text-xs text-slate-500">สีเขียว = ตรงกับเกณฑ์ ICD ที่ตั้งไว้ในแอป · สีแดง = ยังไม่ตรงกับเกณฑ์</p>
              </section>
              <section>
                <h3 className="text-xs font-semibold text-slate-500">รหัส ICD-10 ตามเกณฑ์ข้อบ่งใช้ของยา (นำไปลงใน HOSxP เพื่อให้ผ่านเกณฑ์)</h3>
                <div className="mt-1 space-y-2">
                  {selected.records.map((row) => (
                    <div key={`rule-${row.id}`} className="rounded-xl border border-emerald-300/40 bg-emerald-50/60 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{row.drug_name}</p>
                        <span className="font-mono text-[11px] text-slate-500">{row.drug_icode}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.allowed_dx.length ? (
                          row.allowed_dx.map((dx) => (
                            <span
                              key={`${row.id}-${dx}`}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 font-mono text-xs font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-700/50"
                            >
                              <span>{dx}</span>
                              <CopyButton text={dx} title={`คัดลอกรหัส ${dx}`} iconSize="size-2.5" />
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">ยังไม่ได้กำหนดเกณฑ์ ICD</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  💡 คลิกไอคอนข้างรหัสเพื่อคัดลอกรหัส ICD-10 ไปใส่ใน HOSxP ได้ทันที
                </p>
              </section>
            </div>

            <div className="mt-4 rounded-xl border border-sky-300/60 bg-sky-50/70 p-3.5 text-xs text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-100">
              <h4 className="font-bold flex items-center gap-1.5 text-sky-900 dark:text-sky-200">
                <Sparkles className="size-4 text-sky-600 dark:text-sky-400" />
                วิธีแก้ไขให้เคสนี้ผ่านเกณฑ์ใน HOSxP:
              </h4>
              <ol className="mt-2 list-decimal list-inside space-y-1.5 text-xs leading-5">
                <li>เปิดโปรแกรม <strong>HOSxP</strong> ➔ ระบบผู้ป่วยใน (IPD) ค้นหาด้วย <strong>AN: {selected.vn}</strong> (หรือ HN: <PhiHn value={selected.hn} />)</li>
                <li>ไปที่หน้าจอ <strong>สรุปชาร์จการรักษา (Discharge Summary)</strong> / บันทึกการวินิจฉัยโรค (iptdiag)</li>
                <li>นำรหัส ICD-10 ตามข้อบ่งใช้ของยาด้านบน (เช่น {selected.records[0]?.allowed_dx.slice(0, 4).join(', ') || 'รหัสข้อบ่งใช้'}) ไปบันทึกในช่อง <strong>PDX</strong> หรือ <strong>Secondary DX</strong></li>
                <li>บันทึกใน HOSxP แล้วกลับมากดปุ่มสีม่วง <strong>&quot;ดึงข้อมูล HOSxP&quot;</strong> ที่มุมขวาบนของ HD-Check รายการนี้จะเปลี่ยนเป็น <strong>ผ่านเกณฑ์</strong> ทันทีครับ</li>
              </ol>
            </div>

            <div className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p><strong>ความปลอดภัยของข้อมูล:</strong> หน้านี้แสดงคำแนะนำรหัสที่ตรงเกณฑ์เพื่ออำนวยความสะดวก ระบบ HD-Check จะไม่แอบเขียนทับข้อมูลใน HOSxP จริง เพื่อรักษาความถูกต้องตามเวชระเบียนของผู้ป่วย</p>
              </div>
            </div>
          </>}
        </div>
      </div>
      <p className="rounded-lg border border-themed bg-themed-card px-3 py-2 text-xs leading-5 text-slate-500 dark:text-slate-400">หน้านี้เป็นหน้าทบทวนตัวอย่างก่อนพัฒนาการเขียนกลับ ไม่ได้เพิ่มหรือลบ DX ใน HOSxP และไม่ใช้แทนการยืนยันของผู้รับผิดชอบทางคลินิก</p>
    </section>
  )
}
