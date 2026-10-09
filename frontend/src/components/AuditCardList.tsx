import { useState, useMemo, type FC } from 'react'
import { AlertCircle, CheckCircle2, FileQuestion, HelpCircle, User, Clock, Pill, Stethoscope, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { AuditRecord } from '@/types/herbdx.types'
import { cn } from '@/lib/utils'
import { toThaiDate, fmtNum } from '@/lib/format'

interface AuditCardListProps {
  readonly records: readonly AuditRecord[]
}

const PAGE_SIZE = 15

export const AuditCardList: FC<AuditCardListProps> = ({ records }) => {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(records.length / PAGE_SIZE) || 1
  const safePage = Math.min(currentPage, totalPages)

  const paginatedRecords = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return records.slice(start, start + PAGE_SIZE)
  }, [records, safePage])
  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto size-8 text-amber-500 mb-2" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">ไม่พบข้อมูล</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">โปรดลองเปลี่ยนคำค้นหาใหม่อีกครั้ง</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Mobile Records Counter */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
        <span>พบ {fmtNum(records.length)} รายการ</span>
        <span>หน้า {safePage} จาก {totalPages}</span>
      </div>

      {paginatedRecords.map((rec, i) => {
        const isPass = rec.audit_result === 'PASS'
        const isFail = rec.audit_result === 'FAIL'
        const isNoDx = rec.audit_result === 'NO_DX'
        const isNoMap = rec.audit_result === 'NO_MAP'

        const cardBorder = cn(
          'rounded-2xl bg-themed-card p-4 shadow-xs dark:shadow-sm border transition-all space-y-3',
          isNoDx && 'border-rose-300 dark:border-rose-600 bg-rose-50/50 dark:bg-rose-950/20 shadow-rose-100 dark:shadow-none',
          isFail && 'border-rose-200 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/15 shadow-rose-50 dark:shadow-none',
          isNoMap && 'border-amber-200 dark:border-amber-500 bg-amber-50/30 dark:bg-amber-950/15 shadow-amber-50 dark:shadow-none',
          isPass && 'border-slate-200 dark:border-[#292440] hover:border-slate-300 dark:hover:border-violet-400/50'
        )

        return (
          <div key={`${rec.id}-${i}`} className={cardBorder}>
            {/* Top row: HN, Visit time, and Status */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-[#292440]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-[#101326] text-slate-800 dark:text-slate-200">
                  HN {rec.hn}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                  <Clock className="size-3 text-slate-400" />
                  {toThaiDate(rec.visit_date)} {rec.visit_time.slice(0, 5)}
                </span>
              </div>

              <div>
                {isPass && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" /> ผ่านเกณฑ์
                  </span>
                )}
                {isFail && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                    <AlertCircle className="size-3 text-rose-600 dark:text-rose-400" /> ไม่ตรงข้อบ่งใช้
                  </span>
                )}
                {isNoDx && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-200 dark:bg-rose-900/50 text-rose-900 dark:text-rose-200">
                    <FileQuestion className="size-3 text-rose-700 dark:text-rose-300" /> ไม่มี DX
                  </span>
                )}
                {isNoMap && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                    <HelpCircle className="size-3 text-amber-600 dark:text-amber-400" /> รอตั้งค่า
                  </span>
                )}
              </div>
            </div>

            {/* Patient & Scheme */}
            <div className="space-y-0.5">
              <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                <User className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>{rec.patient_name}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">{rec.pttype_name}</p>
            </div>

            {/* Herbal Drug Prescribed */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#101326] border border-slate-100 dark:border-[#292440] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Pill className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className={cn('text-xs font-semibold truncate', isFail || isNoDx ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-slate-800 dark:text-slate-200')}>
                  {rec.drug_name}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-white dark:bg-[#14172a] ring-1 ring-slate-200 dark:ring-[#34304a] shrink-0">
                x {rec.drug_qty}
              </span>
            </div>

            {/* Diagnoses with U-Code highlight */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">PDX:</span>
                <span className="font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#101326] font-bold text-slate-800 dark:text-slate-200">
                  {rec.pdx || '-'}
                </span>

                <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">DX:</span>
                {[rec.dx0, rec.dx1, rec.dx2, rec.dx3, rec.dx4, rec.dx5]
                  .filter(Boolean)
                  .map((dx, idx) => (
                    <span
                      key={`${dx}-${idx}`}
                      className={cn(
                        'font-mono text-[11px] px-1.5 py-0.5 rounded',
                        dx.startsWith('U') ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold' : 'bg-slate-100 dark:bg-[#101326] text-slate-600 dark:text-slate-300'
                      )}
                    >
                      {dx}
                    </span>
                  ))}
              </div>

              {rec.audit_reason && (
                <div className={cn('text-[11px] pt-1', isPass ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400 font-medium')}>
                  {rec.audit_reason}
                </div>
              )}
            </div>

            {/* Department & Doctor */}
            <div className="pt-2 border-t border-slate-100 dark:border-[#292440] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="truncate max-w-[150px]">{rec.department_name}</span>
              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                <Stethoscope className="size-3 text-slate-400" />
                <span className="truncate max-w-[130px]">{rec.doctor_name}</span>
              </span>
            </div>
          </div>
        )
      })}

      {/* Touch-Friendly Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 pb-2 px-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={safePage <= 1}
              className="p-2 rounded-xl bg-white dark:bg-[#14172a] border border-slate-200 dark:border-[#292440] text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95 transition"
              aria-label="หน้าแรก"
            >
              <ChevronsLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#14172a] border border-slate-200 dark:border-[#292440] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95 transition"
            >
              <ChevronLeft className="size-4" /> ก่อนหน้า
            </button>
          </div>

          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#101326] px-3 py-1.5 rounded-lg">
            {safePage} / {totalPages}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#14172a] border border-slate-200 dark:border-[#292440] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95 transition"
            >
              ถัดไป <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage >= totalPages}
              className="p-2 rounded-xl bg-white dark:bg-[#14172a] border border-slate-200 dark:border-[#292440] text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95 transition"
              aria-label="หน้าสุดท้าย"
            >
              <ChevronsRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
