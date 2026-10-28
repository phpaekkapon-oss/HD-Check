import { useState, useMemo, type FC } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from '@tanstack/react-table'
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Users,
  Baby,
  Bone,
  Layers,
  ShieldAlert,
  Loader2,
  Cpu,
  RotateCcw,
  Eye,
  X,
  Stethoscope,
  Clock,
  User,
  FileText,
  Bot,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Check,
  Copy,
} from 'lucide-react'
import { useHealthMedAudit } from '@/hooks/useHerbDx'
import { herbDxApi } from '@/api/herbdx.api'
import type { DateRange, HealthMedRecord } from '@/types/herbdx.types'
import { DataTableColumnHeader } from '@/components/DataTableColumnHeader'
import { DataTablePagination } from '@/components/DataTablePagination'
import { RangeLoadingNotice } from '@/components/RangeLoadingNotice'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { CopyButton } from '@/components/CopyButton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { PhiName, PhiHn } from '@/components/Phi'

interface HealthMedAuditViewProps {
  readonly range: DateRange
}

type KpiFilterType = 'ALL' | 'PASS' | 'FAIL' | 'DUPLICATE' | 'VISIT2_CLAIM' | 'KNEE' | 'MUSCLE' | 'POSTPARTUM' | 'EP'

const parseAuditTags = (record: HealthMedRecord): { label: string; color: 'amber' | 'rose' | 'purple' }[] => {
  const tags: { label: string; color: 'amber' | 'rose' | 'purple' }[] = []
  const text = (record.failures?.join(' ') || record.audit_reason || '').toLowerCase()

  // 1. ตรวจสอบเลขปิดสิทธิ Visit 2 (ตามเกณฑ์ สปสช. / คำขอแผนกแพทย์แผนไทย)
  if (record.is_visit2_claim_fail || text.includes('เลขปิดสิทธิ')) {
    if (text.includes('ไม่มีเลขปิดสิทธิ')) {
      tags.push({ label: 'ไม่มีเลขปิดสิทธิ (Visit 2)', color: 'rose' })
    } else if (text.includes('ซ้ำกับ visit แรก') || text.includes('ซ้ำ')) {
      tags.push({ label: 'เลขปิดสิทธิซ้ำกับ Visit 1', color: 'rose' })
    } else {
      tags.push({ label: 'ปัญหาเลขปิดสิทธิ (Visit 2)', color: 'rose' })
    }
  }

  // 1. ตรวจค่าบริการซ้ำ
  if (record.is_duplicate_fail || text.includes('ซ้ำ')) {
    if (text.includes('58201') || text.includes('ประคบ')) {
      tags.push({ label: 'คิดค่าประคบซ้ำ (58201)', color: 'amber' })
    } else if (text.includes('58101') || text.includes('นวดเพื่อ')) {
      tags.push({ label: 'คิดค่านวดซ้ำ (58101)', color: 'amber' })
    } else if (text.includes('58130') || text.includes('นวดและประคบ')) {
      tags.push({ label: 'ค่านวด+ประคบซ้ำ (58130)', color: 'amber' })
    } else {
      tags.push({ label: 'คิดค่าบริการซ้ำ', color: 'amber' })
    }
  }

  // 2. ขาดรหัส U
  if (text.includes('ขาดรหัส u') || text.includes('รหัส u...') || text.includes('แพทย์แผนไทย (รหัส u')) {
    tags.push({ label: 'ขาดรหัสแผนไทย (U..)', color: 'rose' })
  }

  // 3. ขาดรหัส M
  if (text.includes('ขาดรหัส m') || text.includes('โรคกล้ามเนื้อ (รหัส m')) {
    tags.push({ label: 'ขาดรหัสกล้ามเนื้อ (M..)', color: 'rose' })
  }

  // 4. ขาดหัตถการ ICD-10-TM
  if (text.includes('ต้องมีรหัสหัตถการ') || text.includes('ขาดรหัส: 87') || text.includes('ขาดรหัสหัตถการ') || text.includes('872-78-11')) {
    tags.push({ label: 'ขาดหัตถการ ICD-10-TM', color: 'rose' })
  }

  // 5. ปิดสิทธิ EP
  if (text.includes('ep') || text.includes('ปิดสิทธิ')) {
    tags.push({ label: 'ติดรหัสปิดสิทธิ (EP)', color: 'rose' })
  }

  // 6. เกณฑ์พอกเข่า
  if (text.includes('พอกเข่า') || text.includes('m179') || text.includes('u5753')) {
    if (text.includes('อายุ 40') || record.age_y < 40) {
      tags.push({ label: `อายุ < 40 ปี (${record.age_y} ปี)`, color: 'rose' })
    }
    if (!tags.some((t) => t.label.includes('พอกเข่า'))) {
      tags.push({ label: 'เกณฑ์พอกเข่าไม่ครบ', color: 'rose' })
    }
  }

  // 7. หลังคลอด / บัญชี 2
  if (text.includes('หลังคลอด') || text.includes('วันคลอด') || text.includes('บัญชี 2')) {
    if (text.includes('ไม่มีวันคลอด') || !record.labor_date) {
      tags.push({ label: 'ไม่มีวันคลอดในบัญชี 2', color: 'purple' })
    } else {
      tags.push({ label: 'บริบาลหลังคลอดไม่ครบ', color: 'purple' })
    }
  }

  // Fallback
  if (tags.length === 0) {
    const raw = ((record.audit_reason || 'เวชระเบียนไม่ผ่านเกณฑ์').split('•')[0] ?? '').trim()
    const clean = raw.length > 24 ? `${raw.slice(0, 24)}...` : raw
    tags.push({ label: clean || 'เวชระเบียนไม่ผ่านเกณฑ์', color: 'rose' })
  }

  return tags
}

export const HealthMedAuditView: FC<HealthMedAuditViewProps> = ({ range }) => {
  const [kpiFilter, setKpiFilter] = useState<KpiFilterType>('ALL')
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedRecord, setSelectedRecord] = useState<HealthMedRecord | null>(null)
  const [isKpiCollapsed, setIsKpiCollapsed] = useState(false)
  const [density, setDensity] = useState<'compact' | 'normal'>('compact')

  // AI Clinical Advisor State
  const [aiAdvice, setAiAdvice] = useState<{
    summary: string
    hosxpAction: string
    caution: string
    aiModel?: string
  } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [copiedAdvice, setCopiedAdvice] = useState(false)

  const handleAskAi = async (record: HealthMedRecord) => {
    setAiLoading(true)
    setAiError(null)
    setAiAdvice(null)
    try {
      const res = await herbDxApi.healthMedAiAdvisor(record)
      if (res?.advice) {
        setAiAdvice(res.advice)
      } else {
        setAiError('ไม่สามารถรับคำแนะนำจาก AI ได้ในขณะนี้')
      }
    } catch (err) {
      setAiError((err as Error).message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI')
    } finally {
      setAiLoading(false)
    }
  }

  const handleCopyAdvice = () => {
    if (!aiAdvice) return
    const text = `[คำแนะนำจาก AI สำหรับเคส: ${selectedRecord?.patient_name} (HN: ${selectedRecord?.hn})]\n\n📌 สรุปสาเหตุ:\n${aiAdvice.summary}\n\n🛠️ สิ่งที่ต้องแก้ไขใน HOSxP:\n${aiAdvice.hosxpAction}\n\n⚠️ ข้อควรระวัง:\n${aiAdvice.caution}\n\nวิเคราะห์โดย: ${aiAdvice.aiModel || 'Google Gemini AI'}`
    navigator.clipboard.writeText(text)
    setCopiedAdvice(true)
    setTimeout(() => setCopiedAdvice(false), 2000)
  }

  const { data, isLoading, isFetching, isPlaceholderData } = useHealthMedAudit({
    startDate: range.startDate,
    endDate: range.endDate,
    result: 'ALL',
    search: '',
    hn: '',
  })

  // กรองเฉพาะเคสที่มีรหัสหัตถการหรือค่าบริการ (ตัดเคสไม่มีหัตถการ/ค่าบริการออก เพราะไปเช็คที่หน้าตรวจจ่ายยาสมุนไพร)
  const rawRecords = useMemo(() => {
    const list = data?.data ?? []
    return list.filter((r) => {
      const hasOps = (r.operation_codes?.length ?? 0) > 0 || (r.operations?.length ?? 0) > 0
      const hasServices = Boolean(r.service_items_raw && r.service_items_raw.trim())
      return hasOps || hasServices
    })
  }, [data?.data])
  const kpi = data?.kpi

  // Filter records based on active KPI filter & search input
  const filteredRecords = useMemo(() => {
    return rawRecords.filter((r) => {
      // 1. KPI Category Filter
      if (kpiFilter === 'PASS' && r.audit_result !== 'PASS') return false
      if (kpiFilter === 'FAIL' && r.audit_result !== 'FAIL') return false
      if (kpiFilter === 'DUPLICATE' && !r.is_duplicate_fail && !r.failures?.some((f) => f.includes('ซ้ำ') && !f.includes('เลขปิดสิทธิ'))) return false
      if (kpiFilter === 'VISIT2_CLAIM' && !r.is_visit2_claim_fail && !r.failures?.some((f) => f.includes('เลขปิดสิทธิ'))) return false
      if (kpiFilter === 'KNEE' && !r.failures?.some((f) => f.includes('เข่า') || f.includes('พอกเข่า'))) return false
      if (kpiFilter === 'MUSCLE' && !r.failures?.some((f) => f.includes('กล้ามเนื้อ') || f.includes('รหัส M'))) return false
      if (kpiFilter === 'POSTPARTUM' && !r.failures?.some((f) => f.includes('หลังคลอด') || f.includes('วันคลอด'))) return false
      if (kpiFilter === 'EP' && !r.failures?.some((f) => f.includes('EP'))) return false

      // 2. Text Search Filter
      if (search.trim()) {
        const q = search.toLowerCase()
        const opCodesText = r.operation_codes?.join(' ') ?? ''
        const laborText = r.labor_date ?? ''
        const text = `${r.hn} ${r.patient_name} ${r.doctor_name} ${r.pdx} ${r.dx0} ${r.dx1} ${r.pttype_name} ${r.audit_reason} ${opCodesText} ${laborText}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [rawRecords, kpiFilter, search])

  const columns = useMemo<ColumnDef<HealthMedRecord>[]>(
    () => [
      {
        id: 'index',
        header: () => <span className="text-center block w-full text-xs font-bold">#</span>,
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination
          return (
            <span className="font-mono text-slate-400 dark:text-slate-400 font-bold text-center block w-6 mx-auto text-xs sm:text-[13px]">
              {pageIndex * pageSize + row.index + 1}
            </span>
          )
        },
        size: 38,
      },
      {
        accessorKey: 'visit_date',
        header: ({ column }) => <DataTableColumnHeader column={column} title="วันที่ / เวลา" className="justify-center" />,
        cell: ({ row }) => (
          <div className="font-mono whitespace-nowrap text-center">
            <div className="text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-[13px] leading-tight">{row.original.visit_date}</div>
            <div className="text-xs sm:text-xs text-slate-400 dark:text-slate-400 flex items-center justify-center gap-1 mt-0.5 font-medium leading-tight">
              <Clock className="size-3 text-slate-400 shrink-0" />
              <span>{row.original.visit_time ? `${row.original.visit_time.substring(0, 5)} น.` : '—'}</span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'patient_name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="ผู้รับบริการ / HN" />,
        cell: ({ row }) => (
          <div className="whitespace-nowrap min-w-[160px] max-w-[240px]">
            <div className="flex items-center gap-1 group">
              <button
                type="button"
                onClick={() => setSelectedRecord(row.original)}
                className="text-left font-bold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition cursor-pointer flex items-center gap-1.5 truncate text-xs sm:text-[13.5px]"
                title="คลิกเพื่อดูรายละเอียดเวชระเบียน"
              >
                <span className="truncate"><PhiName value={row.original.patient_name} /></span>
                <Eye className="size-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
              </button>
              <CopyButton
                text={row.original.patient_name} sensitive
                title="คัดลอกชื่อผู้รับบริการ"
                iconSize="size-3.5"
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-opacity shrink-0"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/25 shadow-2xs">
                <span>HN: <PhiHn value={row.original.hn} /></span>
                <CopyButton
                  text={row.original.hn} sensitive
                  title="คัดลอก HN"
                  iconSize="size-2.5"
                  className="p-0.5 hover:bg-teal-500/25 text-teal-600 dark:text-teal-300 rounded cursor-pointer transition"
                />
              </span>
              {row.original.vn && (
                <span className="inline-flex items-center gap-0.5 font-mono text-slate-400 dark:text-slate-400 text-xs font-medium">
                  <span>VN: {row.original.vn}</span>
                  <CopyButton
                    text={row.original.vn}
                    title="คัดลอก VN"
                    iconSize="size-2.5"
                    className="p-0.5 hover:bg-slate-500/20 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded cursor-pointer transition"
                  />
                </span>
              )}
              {row.original.visit_order && row.original.visit_order >= 2 && (
                <span
                  title={`ผู้ป่วยมีทั้งหมด ${row.original.total_day_visits ?? 2} Visit ในวันเดียวกัน | เลขปิดสิทธิ: ${row.original.claim_code || 'ไม่มี'}${row.original.first_visit_claim_code ? ` (Visit 1: ${row.original.first_visit_claim_code})` : ''}`}
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold border transition shadow-2xs',
                    row.original.is_visit2_claim_fail
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 animate-pulse'
                      : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                  )}
                >
                  <span>Visit {row.original.visit_order}</span>
                  {row.original.is_visit2_claim_fail ? (
                    <span className="text-rose-600 dark:text-rose-400 font-extrabold text-[10px]">✕ ซ้ำ/ขาด</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px]">✓</span>
                  )}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'age_y',
        header: ({ column }) => <DataTableColumnHeader column={column} title="อายุ" className="justify-center" />,
        cell: ({ row }) => {
          const age = row.original.age_y
          // เตือนอายุเฉพาะเคสที่ถูกตรวจด้วยเกณฑ์พอกเข่าจริง (เคสนวดอย่างเดียวไม่ต้องเตือน)
          const isKneeIssue = Boolean(row.original.failures?.some((f) => f.includes('อายุ 40')))
          return (
            <div className="flex justify-center whitespace-nowrap">
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs sm:text-[13px] font-mono font-bold inline-flex items-center gap-1 border shrink-0',
                  isKneeIssue
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 animate-pulse'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                )}
              >
                {isKneeIssue && <span className="text-xs">⚠️</span>}
                {age} ปี
              </span>
            </div>
          )
        },
        size: 58,
      },
      {
        accessorKey: 'pttype_name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="สิทธิการรักษา" />,
        cell: ({ row }) => (
          <div className="max-w-[160px] min-w-[95px]">
            <span
              className="text-xs sm:text-[12.5px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 font-medium truncate block text-center shadow-2xs"
              title={row.original.pttype_name || undefined}
            >
              {row.original.pttype_name || '—'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'doctor_name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="ผู้ให้บริการ" />,
        cell: ({ row }) => (
          <div className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap max-w-[140px] flex items-center gap-1.5">
            <User className="size-3.5 text-teal-500 shrink-0" />
            <span className="truncate" title={row.original.doctor_name || undefined}>
              {row.original.doctor_name || <span className="text-slate-400 italic">— ไม่ระบุ —</span>}
            </span>
          </div>
        ),
      },
      {
        id: 'services',
        header: 'ค่าบริการ / หัตถการ',
        cell: ({ row }) => {
          const raw = String(row.original.service_items_raw || '')
          const items = raw.split('||').filter(Boolean)
          const operations = row.original.operations ?? []
          const laborDate = row.original.labor_date
          const dxs = [row.original.pdx, row.original.dx0, row.original.dx1, row.original.dx2, row.original.dx3, row.original.dx4, row.original.dx5].filter(Boolean)
          const isPostpartum =
            dxs.includes('U506') ||
            (row.original.count_58220 > 0) ||
            (row.original.count_58131 > 0) ||
            operations.some((o) => o.code?.startsWith('900-77'))

          const parsed = items.map((s) => {
            const [code, name, qty, price] = s.split(':')
            const isThaiMed =
              Boolean(code && ['58101', '58102', '58130', '58131', '58201', '58220', '58301'].includes(code)) ||
              Boolean(code?.startsWith('58')) ||
              Boolean(name?.includes('นวด') && !name?.includes('กายภาพ')) ||
              Boolean(name?.includes('ประคบ') && !name?.includes('ความร้อน') && !name?.includes('ประคบร้อน') && !name?.includes('ประคบเย็น') && !name?.includes('กายภาพ')) ||
              Boolean(name?.includes('ทับหม้อเกลือ')) ||
              Boolean(name?.includes('อบไอน้ำ'))
            const isDup =
              (code === '58130' && row.original.count_58130 >= 2) ||
              (code === '58131' && row.original.count_58131 >= 2) ||
              (code === '58101' && row.original.count_58101 >= 2) ||
              (code === '58201' && (row.original.count_compress ?? 0) >= 2) ||
              (Boolean(row.original.is_duplicate_fail && code) && ['58130', '58131', '58101', '58102', '58201'].includes(code!))
            return { code, name, qty, price, isThaiMed, isDup }
          })

          const thaiMedItems = parsed.filter((p) => p.isThaiMed)

          return (
            <div className="space-y-1 max-w-[285px] min-w-[230px]">
              {/* รายการค่าบริการ 58xxx */}
              {thaiMedItems.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {thaiMedItems.map((p, idx) => {
                    const cleanName = (p.name || '').replace(/\s*\(\d+\)\s*$/, '').trim()
                    return (
                      <span
                        key={idx}
                        className={cn(
                          'text-xs sm:text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-md border transition shadow-2xs leading-tight',
                          p.isDup
                            ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-500/40 font-semibold'
                            : 'bg-teal-50/80 dark:bg-teal-950/25 text-teal-900 dark:text-teal-200 border-teal-200/70 dark:border-teal-500/30 font-medium'
                        )}
                        title={`${cleanName} (${p.code}) x${p.qty} ราคา ${Number(p.price || 0).toLocaleString()} บ.`}
                      >
                        <strong className="font-mono font-bold text-teal-600 dark:text-teal-400 shrink-0">
                          [{p.code}]
                        </strong>
                        <span className="truncate max-w-[160px]">{cleanName}</span>
                        <span className="font-mono text-xs opacity-80 shrink-0 font-bold">x{p.qty}</span>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* รายการรหัสหัตถการ ICD-10-TM (จัดวางแถวละ 3 รายการเพื่อประหยัดพื้นที่แนวตั้ง) */}
              {operations.length > 0 && (
                <div className="flex flex-wrap gap-1 max-w-[280px]">
                  {operations.map((op, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded text-xs sm:text-xs font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 whitespace-nowrap text-center"
                      title={`${op.code}: ${op.name}`}
                    >
                      {op.code}
                    </span>
                  ))}
                </div>
              )}

              {/* วันคลอดในระบบงานบัญชี 2 */}
              {isPostpartum && (
                laborDate ? (
                  <div className="text-xs text-fuchsia-700 dark:text-fuchsia-300 font-mono flex items-center gap-1 font-bold">
                    <Baby className="size-3 shrink-0" />
                    <span>คลอด: {laborDate}</span>
                  </div>
                ) : (
                  <div className="text-xs text-rose-600 dark:text-rose-400 font-sans flex items-center gap-1 font-bold">
                    <AlertTriangle className="size-3 shrink-0" />
                    <span>ไม่มีวันคลอดในบัญชี 2</span>
                  </div>
                )
              )}

              {thaiMedItems.length === 0 && operations.length === 0 && (
                <div className="text-xs text-slate-400 italic">
                  ไม่มีหัตถการ/ค่าบริการ
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'diagnoses',
        header: 'รหัสโรค (DX)',
        cell: ({ row }) => {
          const allExtra = Array.isArray((row.original as any).all_dx) ? ((row.original as any).all_dx as string[]) : []
          const rawDxs = [
            row.original.pdx ? { code: row.original.pdx, isPdx: true } : null,
            row.original.dx0 ? { code: row.original.dx0, isPdx: false } : null,
            row.original.dx1 ? { code: row.original.dx1, isPdx: false } : null,
            row.original.dx2 ? { code: row.original.dx2, isPdx: false } : null,
            row.original.dx3 ? { code: row.original.dx3, isPdx: false } : null,
            row.original.dx4 ? { code: row.original.dx4, isPdx: false } : null,
            row.original.dx5 ? { code: row.original.dx5, isPdx: false } : null,
            ...allExtra.map((c) => ({ code: c, isPdx: false })),
          ].filter(Boolean) as { code: string; isPdx: boolean }[]

          const seen = new Set<string>()
          const thaiMedDxs = rawDxs.filter((d) => {
            const code = d.code.toUpperCase()
            const isRelevant = code.startsWith('M') || code.startsWith('U') || code.startsWith('EP')
            if (!isRelevant) return false
            if (seen.has(code)) return false
            seen.add(code)
            return true
          })

          // แสดงเฉพาะรหัสหลัก (M...) และรหัสรองแพทย์แผนไทย (U50-U59)
          // ไม่แสดงรหัสกลุ่มกระบวนการ/ส่งเสริม U60-U69 (เช่น U6680, U6688, U6984) ในหน้านี้
          const mCode = thaiMedDxs.find((d) => d.code.toUpperCase().startsWith('M'))
          const uCode =
            thaiMedDxs.find((d) => d.code.toUpperCase().startsWith('U5')) ||
            thaiMedDxs.find((d) => d.code.toUpperCase().startsWith('U') && !d.code.toUpperCase().startsWith('U6'))
          const epCode = thaiMedDxs.find((d) => d.code.toUpperCase().startsWith('EP'))

          const primaryDxs = [mCode, uCode, epCode].filter(Boolean) as { code: string; isPdx: boolean }[]
          const displayDxs = primaryDxs.length > 0
            ? primaryDxs
            : thaiMedDxs.filter((d) => !d.code.toUpperCase().startsWith('U6')).slice(0, 2)

          if (displayDxs.length === 0) {
            return (
              <span className="text-amber-500 font-semibold text-xs italic">
                ไม่มีรหัส M/U
              </span>
            )
          }

          return (
            <div className="flex flex-wrap gap-1 max-w-[145px]">
              {displayDxs.map((item, idx) => {
                const isU = item.code.startsWith('U')
                const isM = item.code.startsWith('M')
                const isEP = item.code.startsWith('EP')
                return (
                  <span
                    key={idx}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-xs sm:text-[12.5px] font-mono font-bold border transition shadow-2xs whitespace-nowrap leading-tight',
                      isM
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300/60 ring-1 ring-blue-400/50'
                        : isU
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300/60 ring-1 ring-emerald-400/50'
                        : isEP
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-400 ring-1 ring-rose-400/50'
                        : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300 border-slate-200'
                    )}
                    title={
                      isM
                        ? `รหัสหลัก (ICD-10): ${item.code}`
                        : isU
                        ? `รหัสรองแพทย์แผนไทย (ICD-10-TM): ${item.code}`
                        : `รหัสปิดสิทธิ: ${item.code}`
                    }
                  >
                    {item.code}
                  </span>
                )
              })}
            </div>
          )
        },
      },
      {
        accessorKey: 'audit_result',
        header: ({ column }) => <DataTableColumnHeader column={column} title="ผลการตรวจ" className="justify-center" />,
        cell: ({ row }) => {
          const isFail = row.original.audit_result === 'FAIL'
          if (!isFail) {
            return (
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs">
                  <CheckCircle2 className="size-3.5 text-emerald-500" /> ผ่านเกณฑ์
                </span>
              </div>
            )
          }

          const tags = parseAuditTags(row.original)
          const isDup = Boolean(
            row.original.is_duplicate_fail ||
            row.original.failures?.some((f) => f.includes('ซ้ำ')) ||
            row.original.audit_reason?.includes('ซ้ำ')
          )

          return (
            <div className="flex flex-col items-center justify-center gap-1 max-w-[210px] mx-auto text-center">
              {/* บรรทัดบน: สถานะหลัก (ไม่ผ่าน) + ปุ่ม AI สไตล์โมเดิร์น */}
              <div className="flex items-center justify-center gap-1.5 w-full">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shadow-2xs shrink-0">
                  <XCircle className="size-3.5 text-rose-500 shrink-0" />
                  <span>ไม่ผ่านเกณฑ์</span>
                  {isDup && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-bold">
                      ซ้ำ
                    </span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedRecord(row.original)
                    handleAskAi(row.original)
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-teal-500/10 hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 border border-teal-500/30 transition-all cursor-pointer group shrink-0 hover:scale-105 active:scale-95 shadow-2xs"
                  title="คลิกให้ AI ช่วยวิเคราะห์สาเหตุและวิธีแก้ไขใน HOSxP"
                >
                  <Bot className="size-3 text-teal-500 group-hover:scale-110 transition-transform" />
                  <span>AI</span>
                </button>
              </div>

              {/* บรรทัดล่าง: ป้ายแท็กสรุปสาเหตุสั้นๆ กระชับ ชัดเจน พร้อม Tooltip แสดงข้อความเต็มเมื่อชี้เมาส์ */}
              <div
                className="flex flex-wrap items-center justify-center gap-1 cursor-help"
                title={`[รายละเอียดสาเหตุที่ไม่ผ่าน]\n${row.original.failures?.join('\n') || row.original.audit_reason}`}
              >
                {tags.slice(0, 2).map((t, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-md border inline-flex items-center gap-1 shadow-2xs transition-colors',
                      t.color === 'amber'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300/80 dark:border-amber-500/30 font-semibold'
                        : t.color === 'purple'
                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border-purple-300/80 dark:border-purple-500/30 font-medium'
                        : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-500/30'
                    )}
                  >
                    <span>{t.label}</span>
                  </span>
                ))}
                {tags.length > 2 && (
                  <span className="text-xs text-slate-400 font-mono font-bold">
                    +{tags.length - 2}
                  </span>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setSelectedRecord(row.original)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-teal-600 dark:hover:text-teal-300 hover:bg-teal-500/10 transition cursor-pointer"
            title="ดูรายละเอียดการรับบริการ"
          >
            <Eye className="size-4" />
          </button>
        ),
        size: 36,
      },
    ],
    []
  )

  // oxlint-disable-next-line react/incompatible-library
  const table = useReactTable({
    data: filteredRecords,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  })

  // Enterprise-Grade KPI Cards Configuration with Rich Corporate Colors
  // Enterprise-Grade KPI Cards Configuration with Seamless Single Borders
  const kpiCards = [
    {
      id: 'ALL' as const,
      label: 'ทั้งหมด',
      value: kpi?.total ?? 0,
      sub: 'ผู้รับบริการทั้งหมด',
      icon: Users,
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-500/20',
      valueColor: 'text-slate-900 dark:text-white',
      subColor: 'text-slate-500 dark:text-slate-400',
      activeBorder: 'border-indigo-500 dark:border-indigo-400',
      activeShadow: 'shadow-[0_0_20px_rgba(99,102,241,0.25)]',
      activeBg: 'bg-indigo-500/[0.06] dark:bg-indigo-950/40',
      hoverBorder: 'hover:border-indigo-400/60 dark:hover:border-indigo-500/40',
    },
    {
      id: 'PASS' as const,
      label: 'ผ่านเกณฑ์',
      value: kpi?.pass ?? 0,
      rate: kpi?.passRate ?? 0,
      sub: 'ถูกต้องตามเกณฑ์',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/30',
      valueColor: 'text-emerald-600 dark:text-emerald-400',
      subColor: 'text-emerald-700/80 dark:text-emerald-400/80',
      activeBorder: 'border-emerald-500 dark:border-emerald-400',
      activeShadow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
      activeBg: 'bg-emerald-500/[0.06] dark:bg-emerald-950/40',
      hoverBorder: 'hover:border-emerald-400/60 dark:hover:border-emerald-500/40',
    },
    {
      id: 'FAIL' as const,
      label: 'ไม่ผ่าน / พบปัญหา',
      value: kpi?.fail ?? 0,
      sub: 'ต้องทบทวนแก้ไข',
      icon: AlertTriangle,
      iconBg: 'bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-500/30',
      valueColor: 'text-rose-600 dark:text-rose-400',
      subColor: 'text-rose-700/80 dark:text-rose-400/80',
      activeBorder: 'border-rose-500 dark:border-rose-400',
      activeShadow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)]',
      activeBg: 'bg-rose-500/[0.06] dark:bg-rose-950/40',
      hoverBorder: 'hover:border-rose-400/60 dark:hover:border-rose-500/40',
    },
    {
      id: 'DUPLICATE' as const,
      label: 'คิดค่าบริการซ้ำ',
      value: kpi?.duplicateFail ?? 0,
      sub: (kpi?.duplicateFail ?? 0) > 0 ? 'นวด/ประคบซ้ำ 2 ครั้ง' : '✓ ปกติ ไม่มีเบิกซ้ำ',
      icon: Layers,
      iconBg: 'bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/30',
      valueColor: (kpi?.duplicateFail ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300',
      subColor: (kpi?.duplicateFail ?? 0) > 0 ? 'text-amber-700/80 dark:text-amber-400/80' : 'text-slate-400 dark:text-slate-400',
      activeBorder: 'border-amber-500 dark:border-amber-400',
      activeShadow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      activeBg: 'bg-amber-500/[0.06] dark:bg-amber-950/40',
      hoverBorder: 'hover:border-amber-400/60 dark:hover:border-amber-500/40',
    },
    {
      id: 'VISIT2_CLAIM' as const,
      label: 'เลขปิดสิทธิ Visit 2',
      value: kpi?.visit2ClaimFail ?? 0,
      sub: (kpi?.visit2ClaimFail ?? 0) > 0 ? 'Visit 2 ขาด/ซ้ำเลขปิดสิทธิ' : '✓ ปกติ เลขปิดสิทธิถูกต้อง',
      icon: FileText,
      iconBg: 'bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-500/30',
      valueColor: (kpi?.visit2ClaimFail ?? 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-300',
      subColor: (kpi?.visit2ClaimFail ?? 0) > 0 ? 'text-orange-700/80 dark:text-orange-400/80' : 'text-slate-400 dark:text-slate-400',
      activeBorder: 'border-orange-500 dark:border-orange-400',
      activeShadow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]',
      activeBg: 'bg-orange-500/[0.06] dark:bg-orange-950/40',
      hoverBorder: 'hover:border-orange-400/60 dark:hover:border-orange-500/40',
    },
    {
      id: 'KNEE' as const,
      label: 'ข้อเข่า / พอกเข่า',
      value: kpi?.kneeFail ?? 0,
      sub: (kpi?.kneeFail ?? 0) > 0 ? 'M179+U5753 ไม่ครบเกณฑ์' : '✓ ปกติ ครบ 4 หัตถการ',
      icon: Bone,
      iconBg: 'bg-cyan-500/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300 border border-cyan-500/30',
      valueColor: (kpi?.kneeFail ?? 0) > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-300',
      subColor: (kpi?.kneeFail ?? 0) > 0 ? 'text-cyan-700/80 dark:text-cyan-400/80' : 'text-slate-400 dark:text-slate-400',
      activeBorder: 'border-cyan-500 dark:border-cyan-400',
      activeShadow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
      activeBg: 'bg-cyan-500/[0.06] dark:bg-cyan-950/40',
      hoverBorder: 'hover:border-cyan-400/60 dark:hover:border-cyan-500/40',
    },
    {
      id: 'MUSCLE' as const,
      label: 'โรคกล้ามเนื้อ',
      value: kpi?.muscleFail ?? 0,
      sub: (kpi?.muscleFail ?? 0) > 0 ? 'รหัส M/หัตถการไม่ครบ' : '✓ ปกติ ครบหัตถการ',
      icon: Activity,
      iconBg: 'bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 border border-violet-500/30',
      valueColor: (kpi?.muscleFail ?? 0) > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-300',
      subColor: (kpi?.muscleFail ?? 0) > 0 ? 'text-violet-700/80 dark:text-violet-400/80' : 'text-slate-400 dark:text-slate-400',
      activeBorder: 'border-violet-500 dark:border-violet-400',
      activeShadow: 'shadow-[0_0_20px_rgba(139,92,246,0.3)]',
      activeBg: 'bg-violet-500/[0.06] dark:bg-violet-950/40',
      hoverBorder: 'hover:border-violet-400/60 dark:hover:border-violet-500/40',
    },
    {
      id: 'POSTPARTUM' as const,
      label: 'บริบาลหลังคลอด',
      value: kpi?.postpartumFail ?? 0,
      sub: (kpi?.postpartumFail ?? 0) > 0 ? '5 หัตถการ/วันคลอดไม่ครบ' : '✓ ปกติ ครบ 5 หัตถการ',
      icon: Baby,
      iconBg: 'bg-fuchsia-500/15 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 border border-fuchsia-500/30',
      valueColor: (kpi?.postpartumFail ?? 0) > 0 ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-slate-600 dark:text-slate-300',
      subColor: (kpi?.postpartumFail ?? 0) > 0 ? 'text-fuchsia-700/80 dark:text-fuchsia-400/80' : 'text-slate-400 dark:text-slate-400',
      activeBorder: 'border-fuchsia-500 dark:border-fuchsia-400',
      activeShadow: 'shadow-[0_0_20px_rgba(217,70,239,0.3)]',
      activeBg: 'bg-fuchsia-500/[0.06] dark:bg-fuchsia-950/40',
      hoverBorder: 'hover:border-fuchsia-400/60 dark:hover:border-fuchsia-500/40',
    },
    {
      id: 'EP' as const,
      label: 'ปิดสิทธิ (EP)',
      value: kpi?.epFail ?? 0,
      sub: (kpi?.epFail ?? 0) > 0 ? 'ติดรหัสปิดสิทธิ UC' : '✓ ปกติ ไม่มีปิดสิทธิ',
      icon: ShieldAlert,
      iconBg: 'bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-300 border border-red-500/30',
      valueColor: (kpi?.epFail ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300',
      subColor: (kpi?.epFail ?? 0) > 0 ? 'text-red-700/80 dark:text-red-400/80' : 'text-slate-400 dark:text-slate-400',
      activeBorder: 'border-red-500 dark:border-red-400',
      activeShadow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
      activeBg: 'bg-red-500/[0.06] dark:bg-red-950/40',
      hoverBorder: 'hover:border-red-400/60 dark:hover:border-red-500/40',
    },
  ]

  return (
    <div className="space-y-4">
      {isFetching && isPlaceholderData && <RangeLoadingNotice range={range} />}
      {/* Header Banner - Enterprise Space-Saving Style */}
      <div className="rounded-2xl bg-themed-card p-3 sm:p-4 border border-themed shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 sm:size-9 rounded-xl bg-teal-500/15 text-teal-400 grid place-items-center shrink-0">
              <Activity className="size-4 sm:size-4.5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>ตรวจหัตถการแพทย์แผนไทย</span>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center gap-1">
                  <Cpu className="size-3" /> HOSxP Audit Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                คลิกการ์ดสรุปตัวชี้วัดเพื่อกรองดูรายชื่อผู้ป่วยในแต่ละกลุ่ม
              </p>
            </div>
          </div>

          {/* Quick Action: Collapse/Expand KPI Cards */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsKpiCollapsed(!isKpiCollapsed)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 transition shadow-2xs cursor-pointer"
              title={isKpiCollapsed ? 'ขยายดูการ์ดสรุปทั้งหมด' : 'ย่อการ์ดสรุปเพื่อประหยัดพื้นที่หน้าจอ'}
            >
              {isKpiCollapsed ? <ChevronDown className="size-3.5 text-teal-500" /> : <ChevronUp className="size-3.5 text-teal-500" />}
              <span>{isKpiCollapsed ? 'แสดงการ์ดสรุป' : 'ย่อการ์ดสรุป'}</span>
            </button>
          </div>
        </div>

        {/* If Collapsed: Render High-Density Single-Line Stat Ribbon */}
        {isKpiCollapsed ? (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 mt-2.5 border-t border-slate-200/80 dark:border-white/10 scrollbar-none">
            {kpiCards.map((card) => {
              const isSelected = kpiFilter === card.id
              const Icon = card.icon
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setKpiFilter(isSelected && card.id !== 'ALL' ? 'ALL' : card.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-all border cursor-pointer shrink-0 shadow-2xs',
                    isSelected
                      ? cn(card.activeBorder, card.activeBg, 'ring-1 ring-current')
                      : 'bg-white/90 dark:bg-slate-900/80 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  )}
                >
                  <Icon className="size-3 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300 text-xs">{card.label}:</span>
                  <strong className={cn('font-mono font-bold text-sm', card.valueColor)}>
                    <AnimatedNumber value={card.value} />
                  </strong>
                  {card.rate !== undefined && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      ({card.rate}%)
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          /* If Expanded: Render Compact Space-Saving KPI Cards */
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mt-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
            {kpiCards.map((card) => {
              const isSelected = kpiFilter === card.id
              const Icon = card.icon
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setKpiFilter(isSelected && card.id !== 'ALL' ? 'ALL' : card.id)}
                  className={cn(
                    'rounded-xl p-2.5 sm:p-3 text-left transition-all duration-200 cursor-pointer relative group',
                    'border flex flex-col justify-between min-h-[82px] sm:min-h-[88px]',
                    'backdrop-blur-md',
                    isSelected
                      ? cn(card.activeBorder, card.activeShadow, card.activeBg, '-translate-y-0.5 ring-1')
                      : cn(
                          'bg-white/95 dark:bg-[#0c1424]/90 border-slate-200/90 dark:border-white/10 shadow-2xs hover:shadow-sm hover:-translate-y-0.5',
                          card.hoverBorder
                        )
                  )}
                >
                  {/* Top row: Label & Icon */}
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs sm:text-[12.5px] font-semibold text-slate-800 dark:text-slate-100 truncate leading-snug">
                      {card.label}
                    </span>
                    <div className={cn('size-6 rounded-md grid place-items-center group-hover:scale-110 transition-transform shrink-0 border', card.iconBg)}>
                      <Icon className="size-3.5" />
                    </div>
                  </div>

                  {/* Metric Value */}
                  <div className="flex items-baseline gap-1.5 flex-wrap my-1">
                    <span className={cn('text-2xl sm:text-[26px] font-bold tabular-nums font-sans leading-none', card.valueColor)}>
                      <AnimatedNumber value={card.value} />
                    </span>
                    {card.rate !== undefined && (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                        {card.rate}%
                      </span>
                    )}
                  </div>

                  {/* Bottom row: Subtext or Active Badge */}
                  <div className="pt-1.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs sm:text-[11.5px] leading-tight gap-1">
                    <span className={cn('truncate font-medium', card.subColor)}>
                      {card.sub}
                    </span>
                    {isSelected && (
                      <span className="shrink-0 flex items-center gap-1 font-bold text-xs px-1.5 py-0.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        เลือก
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Filter Status Badge & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {kpiFilter !== 'ALL' && (
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs shadow-2xs transition-all animate-in fade-in',
                kpiFilter === 'PASS' && 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200',
                kpiFilter === 'FAIL' && 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200',
                kpiFilter === 'DUPLICATE' && 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200',
                kpiFilter === 'KNEE' && 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-200',
                kpiFilter === 'MUSCLE' && 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-500/30 text-violet-800 dark:text-violet-200',
                kpiFilter === 'POSTPARTUM' && 'bg-fuchsia-50 dark:bg-fuchsia-950/40 border-fuchsia-200 dark:border-fuchsia-500/30 text-fuchsia-800 dark:text-fuchsia-200',
                kpiFilter === 'EP' && 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-200'
              )}
            >
              <span className="size-2 rounded-full bg-current animate-pulse shrink-0" />
              <span className="opacity-75 text-xs">กลุ่ม:</span>
              <strong className="font-bold text-xs">
                {kpiFilter === 'PASS' && 'ผ่านเกณฑ์'}
                {kpiFilter === 'FAIL' && 'ไม่ผ่าน / พบปัญหา'}
                {kpiFilter === 'DUPLICATE' && 'คิดค่าบริการซ้ำ'}
                {kpiFilter === 'KNEE' && 'ข้อเข่า (M179+U5753)'}
                {kpiFilter === 'MUSCLE' && 'กล้ามเนื้อ (M+U)'}
                {kpiFilter === 'POSTPARTUM' && 'บริบาลหลังคลอด'}
                {kpiFilter === 'EP' && 'ปิดสิทธิ (EP)'}
              </strong>
              <span className="font-mono font-bold text-xs">({filteredRecords.length})</span>
              <button
                type="button"
                onClick={() => setKpiFilter('ALL')}
                className="ml-0.5 p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/20 transition cursor-pointer"
                title="ล้างตัวกรอง"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Density Switch Button */}
          <button
            type="button"
            onClick={() => setDensity((d) => (d === 'compact' ? 'normal' : 'compact'))}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition shadow-2xs cursor-pointer"
            title={density === 'compact' ? 'เปลี่ยนเป็นโหมดแถวปกติ' : 'เปลี่ยนเป็นโหมดแถวกะทัดรัด (ประหยัดพื้นที่)'}
          >
            <SlidersHorizontal className="size-3 text-teal-500" />
            <span className="text-xs font-semibold">{density === 'compact' ? 'แถวกะทัดรัด' : 'แถวปกติ'}</span>
          </button>

          {/* Search Box */}
          <div className="relative min-w-[220px] sm:min-w-[260px]">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา HN, ผู้ป่วย, แพทย์..."
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Main DataTable Container */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-themed-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full table-auto">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-white/10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-slate-200 dark:border-white/10">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap',
                        density === 'compact' ? 'py-2 px-2.5 sm:px-3 text-xs sm:text-[13px]' : 'py-3 px-3.5 text-xs sm:text-sm'
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-white/5">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <LoadingSkeleton rows={8} label="กำลังโหลดข้อมูลการให้บริการแพทย์แผนไทย" />
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-12 text-center text-slate-400">
                    ไม่พบรายการรับบริการตามเงื่อนไขที่เลือก
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const isFail = row.original.audit_result === 'FAIL'
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(
                        'hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors border-slate-100 dark:border-white/5',
                        isFail && 'bg-rose-50/25 dark:bg-rose-950/[0.08]'
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            'align-middle',
                            density === 'compact' ? 'py-1.5 px-2.5 sm:px-3 text-xs sm:text-[13px]' : 'py-2.5 px-3.5 text-xs sm:text-sm'
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Enterprise Numbered Pagination */}
        <DataTablePagination table={table} pageSizeOptions={[15, 25, 50, 100, 200]} />
      </div>

      {/* Detail Modal: แสดงข้อมูลการรับบริการเมื่อคลิกดูรายชื่อ */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-teal-500/15 text-teal-500 grid place-items-center">
                  <User className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      <PhiName value={selectedRecord.patient_name} />
                    </h3>
                    <CopyButton
                      text={selectedRecord.patient_name} sensitive
                      title="คัดลอกชื่อผู้รับบริการ"
                      iconSize="size-3.5"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <span className="text-teal-600 dark:text-teal-400 font-bold inline-flex items-center gap-1">
                      <span>HN: <PhiHn value={selectedRecord.hn} /></span>
                      <CopyButton
                        text={selectedRecord.hn} sensitive
                        title="คัดลอก HN"
                        iconSize="size-3"
                      />
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <span>VN: {selectedRecord.vn}</span>
                      <CopyButton
                        text={selectedRecord.vn}
                        title="คัดลอก VN"
                        iconSize="size-3"
                      />
                    </span>
                    <span>•</span>
                    <span>อายุ {selectedRecord.age_y} ปี</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Status Alert Banner */}
            <div
              className={cn(
                'p-3 rounded-xl border flex items-start gap-2.5 text-xs',
                selectedRecord.audit_result === 'PASS'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-200'
              )}
            >
              {selectedRecord.audit_result === 'PASS' ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <AlertTriangle className="size-4 shrink-0 text-rose-500 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold text-sm">
                  ผลการตรวจสอบ: {selectedRecord.audit_result === 'PASS' ? 'ผ่านตามเกณฑ์มาตรฐาน' : 'ไม่ผ่านเกณฑ์การตรวจสอบ'}
                </p>
                <p className="text-[11.5px] leading-relaxed opacity-90">{selectedRecord.audit_reason}</p>
              </div>
            </div>

            {/* Visit Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
              <div>
                <span className="text-slate-400 block text-xs uppercase font-semibold">วันที่ / เวลาที่รับบริการ</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 font-mono">
                  {selectedRecord.visit_date} {selectedRecord.visit_time}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs uppercase font-semibold">สิทธิการรักษา</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRecord.pttype_name || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs uppercase font-semibold">แพทย์ / ผู้ตรวจวินิจฉัย</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRecord.doctor_name || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs uppercase font-semibold">แผนกที่ให้บริการ</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRecord.department_name || 'แผนกแพทย์แผนไทย'}</span>
              </div>
            </div>

            {/* Visit Order & Claim Code Info */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="size-3.5 text-orange-500" /> ข้อมูล Visit และเลขปิดสิทธิ (สปสช.)
                </span>
                {selectedRecord.visit_order && selectedRecord.visit_order >= 2 ? (
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-bold border',
                    selectedRecord.is_visit2_claim_fail
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  )}>
                    Visit {selectedRecord.visit_order} ของวัน
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                    Visit 1 (รอบแรก)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white dark:bg-white/5 p-2 rounded-lg border border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-400 block text-[11px]">เลขปิดสิทธิ Visit นี้:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {selectedRecord.claim_code || <span className="text-rose-500 italic font-sans">ไม่มีเลขปิดสิทธิ</span>}
                  </span>
                </div>
                <div className="bg-white dark:bg-white/5 p-2 rounded-lg border border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-400 block text-[11px]">เลขปิดสิทธิ Visit แรก (ของวัน):</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {selectedRecord.first_visit_claim_code || <span className="text-slate-400 italic font-sans">— ไม่มี —</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnoses Section */}
            {/* Diagnoses Section */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="size-3.5 text-teal-500" /> รหัสการวินิจฉัยโรคทางการแพทย์แผนไทย (รหัสหลัก / รหัสรอง)
              </h4>
              {(() => {
                const allExtra = Array.isArray((selectedRecord as any).all_dx) ? ((selectedRecord as any).all_dx as string[]) : []
                const allDxs = [
                  ...new Set([
                    selectedRecord.pdx,
                    selectedRecord.dx0,
                    selectedRecord.dx1,
                    selectedRecord.dx2,
                    selectedRecord.dx3,
                    selectedRecord.dx4,
                    selectedRecord.dx5,
                    ...allExtra,
                  ].filter((dx): dx is string => Boolean(dx)))
                ]

                const thaiMedList = allDxs.filter((dx) => dx.startsWith('M') || dx.startsWith('U') || dx.startsWith('EP'))
                const otherList = allDxs.filter((dx) => !dx.startsWith('M') && !dx.startsWith('U') && !dx.startsWith('EP'))

                return (
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">รหัสแผนไทย:</span>
                      {thaiMedList.length > 0 ? (
                        thaiMedList.map((dx, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              'px-2 py-0.5 rounded-md text-xs font-mono font-bold border',
                              dx.startsWith('U6')
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border-slate-300'
                                : dx.startsWith('U')
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300'
                                : dx.startsWith('M')
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-300'
                            )}
                          >
                            {dx.startsWith('M') ? `รหัสหลัก: ${dx}` : dx.startsWith('U6') ? `รหัสกระบวนการ: ${dx}` : dx.startsWith('U') ? `รหัสรอง: ${dx}` : dx}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-amber-500 italic">ไม่มีรหัสแผนไทย (M/U)</span>
                      )}
                    </div>

                    {otherList.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-200/50 dark:border-white/5 flex flex-wrap gap-1 items-center text-xs text-slate-400">
                        <span className="mr-1">รหัสโรคทั่วไป (ตรวจในหน้าจ่ายยาสมุนไพร):</span>
                        {otherList.map((dx, idx) => (
                          <span key={idx} className="font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs">
                            {dx}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Service Items Section */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Stethoscope className="size-3.5 text-teal-500" /> รายการค่าบริการที่คิดใน Visit นี้
              </h4>
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                {String(selectedRecord.service_items_raw || '')
                  .split('||')
                  .filter(Boolean)
                  .map((s, idx) => {
                    const [code, name, qty, price] = s.split(':')
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          <strong className="font-mono text-teal-600 dark:text-teal-400 mr-1.5">[{code}]</strong>
                          {name}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-300">
                          จำนวน {qty} ครั้ง • {Number(price || 0).toLocaleString()} บาท
                        </span>
                      </div>
                    )
                  })}
                {!selectedRecord.service_items_raw && (
                  <span className="text-slate-400 text-xs italic block text-center py-1">
                    — ไม่มีรายการค่าบริการ 58xxx —
                  </span>
                )}
              </div>
            </div>

            {/* ICD-10-TM Operations Section */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Activity className="size-3.5 text-teal-500" /> รหัสหัตถการแพทย์แผนไทย (ICD-10-TM)
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {selectedRecord.operations?.length ?? 0} รายการ
                </span>
              </h4>
              <div className="space-y-1 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                {selectedRecord.operations && selectedRecord.operations.length > 0 ? (
                  selectedRecord.operations.map((op, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        <strong className="font-mono text-emerald-600 dark:text-emerald-400 mr-2">[{op.code}]</strong>
                        {op.name}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-400 text-xs italic block text-center py-1">
                    — ไม่มีบันทึกรหัสหัตถการ ICD-10-TM ในระบบ —
                  </span>
                )}
              </div>
            </div>

            {/* Labor Date Section (Account 2) - เฉพาะเคสบริบาลหญิงหลังคลอด */}
            {(() => {
              const modalDxs = [selectedRecord.pdx, selectedRecord.dx0, selectedRecord.dx1, selectedRecord.dx2, selectedRecord.dx3, selectedRecord.dx4, selectedRecord.dx5].filter(Boolean)
              const isPostpartumModal =
                modalDxs.includes('U506') ||
                (selectedRecord.count_58220 > 0) ||
                (selectedRecord.count_58131 > 0) ||
                (selectedRecord.operations ?? []).some((o) => o.code?.startsWith('900-77'))

              if (!isPostpartumModal) return null

              return (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Baby className="size-3.5 text-fuchsia-500" /> ข้อมูลการคลอดบุตร (ระบบงานบัญชี 2: หญิงตั้งครรภ์และหลังคลอด)
                  </h4>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">วันคลอดที่บันทึกในระบบงานบัญชี 2:</span>
                    {selectedRecord.labor_date ? (
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/30">
                        ✓ {selectedRecord.labor_date}
                      </span>
                    ) : (
                      <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/30">
                        ⚠️ ไม่พบวันคลอดในระบบงานบัญชี 2
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* AI Clinical Audit Advisor Section */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-lg bg-gradient-to-tr from-violet-600 via-teal-500 to-cyan-400 text-white grid place-items-center shadow-xs">
                    <Bot className="size-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span>AI Clinical Audit Advisor</span>
                      <span className="text-xs font-mono px-1.5 py-0.2 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/25 flex items-center gap-0.5">
                        <Bot className="size-2.5" /> Google Gemini
                      </span>
                    </h4>
                  </div>
                </div>

                {!aiAdvice && (
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleAskAi(selectedRecord)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-violet-500 hover:from-teal-600 hover:to-violet-600 text-white font-bold text-xs shadow-md shadow-teal-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>กำลังวิเคราะห์…</span>
                      </>
                    ) : (
                      <>
                        <Bot className="size-3.5" />
                        <span>วิเคราะห์ & ขอคำแนะนำแก้ไข</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {aiLoading && (
                <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-white/[0.02] border border-teal-500/20 flex flex-col items-center justify-center text-center gap-2 animate-pulse">
                  <div className="size-8 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 grid place-items-center">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    กำลังส่งข้อมูลให้ <strong>Google Gemini AI</strong> วิเคราะห์เวชระเบียนและจัดทำแนวทางแก้ไขใน HOSxP...
                  </p>
                </div>
              )}

              {aiError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
                  <span>{aiError}</span>
                  <button
                    type="button"
                    onClick={() => handleAskAi(selectedRecord)}
                    className="underline font-bold cursor-pointer hover:text-rose-700"
                  >
                    ลองใหม่อีกครั้ง
                  </button>
                </div>
              )}

              {aiAdvice && (
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-teal-50/90 via-slate-50/90 to-violet-50/80 dark:from-[#0d1627] dark:via-[#0c1424] dark:to-[#141226] border border-teal-500/30 dark:border-teal-500/40 shadow-sm space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                        <Bot className="size-3" /> บทวิเคราะห์โดย {aiAdvice.aiModel || 'Google Gemini AI'}:
                      </span>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1 leading-snug">
                        {aiAdvice.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAdvice}
                      className="shrink-0 px-2 py-1 rounded-lg bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition cursor-pointer flex items-center gap-1 text-xs font-medium"
                      title="คัดลอกคำแนะนำไปใช้งาน"
                    >
                      {copiedAdvice ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                      <span>{copiedAdvice ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                    </button>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/90 dark:bg-black/30 border border-teal-500/20 text-xs text-slate-800 dark:text-slate-200 space-y-1">
                    <strong className="block font-bold text-teal-700 dark:text-teal-300 text-xs flex items-center gap-1">
                      🛠️ สิ่งที่ต้องแก้ไขในระบบ HOSxP:
                    </strong>
                    <div className="whitespace-pre-line leading-relaxed pl-1 text-slate-700 dark:text-slate-200 text-xs font-medium">
                      {aiAdvice.hosxpAction}
                    </div>
                  </div>

                  {aiAdvice.caution && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                      <strong>⚠️ ข้อควรระวัง:</strong> {aiAdvice.caution}
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => handleAskAi(selectedRecord)}
                      className="text-xs text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="size-2.5" /> วิเคราะห์ใหม่อีกครั้ง
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setSelectedRecord(null)
                  setAiAdvice(null)
                  setAiError(null)
                  setCopiedAdvice(false)
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
