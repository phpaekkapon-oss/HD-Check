import { useState, useMemo, useEffect, type FC } from 'react'
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
  ShieldCheck,
  Loader2,
  Cpu,
  RotateCcw,
  RefreshCw,
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
  Download,
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
import { ThaiDatePickerModal } from '@/components/ThaiDatePickerModal'
import { downloadExcel, fmtNum, toReporter, toThaiDate, type ExcelColumn, type ExcelReport } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
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
  readonly onRangeChange?: (r: DateRange) => void
}

type KpiFilterType = 'ALL' | 'PASS' | 'FAIL' | 'CLOSED_EP' | 'UNCLOSED_EP' | 'DUPLICATE' | 'VISIT2_CLAIM' | 'KNEE' | 'MUSCLE' | 'POSTPARTUM' | 'EP'

const parseAuditTags = (record: HealthMedRecord): { label: string; color: 'amber' | 'rose' | 'purple' }[] => {
  const tags: { label: string; color: 'amber' | 'rose' | 'purple' }[] = []
  const text = (record.failures?.join(' ') || record.audit_reason || '').toLowerCase()

  // 1. ตรวจสอบสถานะการปิดสิทธิ & Visit 2
  if (record.claim_close_status === 'VISIT2_DUP') {
    tags.push({ label: 'Visit 2 เลข EP ซ้ำ Visit 1', color: 'rose' })
  } else if (record.claim_close_status === 'OPEN_ONLY') {
    tags.push({ label: 'รอปิดสิทธิ (เปิด PP แล้ว)', color: 'amber' })
  } else if (record.claim_close_status === 'NONE') {
    tags.push({ label: 'ยังไม่ปิดสิทธิ (ไม่มีเลข)', color: 'rose' })
  } else if (record.is_visit2_claim_fail || text.includes('เลขปิดสิทธิ')) {
    if (text.includes('ไม่มีเลขปิดสิทธิ')) {
      tags.push({ label: 'ไม่มีเลขปิดสิทธิ (Visit 2)', color: 'rose' })
    } else if (text.includes('ซ้ำกับ visit แรก') || text.includes('ซ้ำ')) {
      tags.push({ label: 'เลขปิดสิทธิซ้ำกับ Visit 1', color: 'rose' })
    } else {
      tags.push({ label: 'ปัญหาเลขปิดสิทธิ (Visit 2)', color: 'rose' })
    }
  }

  // 2. ตรวจค่าบริการซ้ำ
  if (record.is_duplicate_fail || text.includes('คิดค่าบริการซ้ำ')) {
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

  // 3. ขาดรหัส U
  if (text.includes('ขาดรหัส u') || text.includes('รหัส u...') || text.includes('แพทย์แผนไทย (รหัส u')) {
    tags.push({ label: 'ขาดรหัสแผนไทย (U..)', color: 'rose' })
  }

  // 4. ขาดรหัส M
  if (text.includes('ขาดรหัส m') || text.includes('โรคกล้ามเนื้อ (รหัส m')) {
    tags.push({ label: 'ขาดรหัสกล้ามเนื้อ (M..)', color: 'rose' })
  }

  // 5. ขาดหัตถการ ICD-10-TM
  if (text.includes('ต้องมีรหัสหัตถการ') || text.includes('ขาดรหัส: 87') || text.includes('ขาดรหัสหัตถการ') || text.includes('872-78-11')) {
    tags.push({ label: 'ขาดหัตถการ ICD-10-TM', color: 'rose' })
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

export const HealthMedAuditView: FC<HealthMedAuditViewProps> = ({ range, onRangeChange }) => {
  const { user } = useAuth()
  const [kpiFilter, setKpiFilter] = useState<KpiFilterType>('ALL')
  const [claimStatusFilter, setClaimStatusFilter] = useState<'ALL' | 'CLOSED' | 'UNCLOSED' | 'OPEN_ONLY' | 'VISIT2_DUP' | 'NONE'>('ALL')
  const [visitDateFilter, setVisitDateFilter] = useState<string>('ALL')
  const [doctorFilter, setDoctorFilter] = useState<string>('ALL')
  const [pttypeFilter, setPttypeFilter] = useState<string>('ALL')
  const [serviceFilter, setServiceFilter] = useState<'ALL' | '58130' | '58101' | '58201' | 'KNEE' | 'POSTPARTUM' | 'VISIT2'>('ALL')
  const [hnFilter, setHnFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedRecord, setSelectedRecord] = useState<HealthMedRecord | null>(null)
  const [isKpiCollapsed, setIsKpiCollapsed] = useState(false)
  const [density, setDensity] = useState<'compact' | 'normal'>('compact')

  // Real-time Auto-Sync State
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('hd_healthmed_autosync') !== 'false'
  })
  const [syncIntervalSec, setSyncIntervalSec] = useState<number>(() => {
    if (typeof window === 'undefined') return 15
    const saved = Number(localStorage.getItem('hd_healthmed_sync_sec'))
    return [10, 15, 30, 60].includes(saved) ? saved : 15
  })
  const [countdown, setCountdown] = useState<number>(syncIntervalSec)

  const handleToggleAutoSync = () => {
    setAutoSync((prev) => {
      const next = !prev
      localStorage.setItem('hd_healthmed_autosync', String(next))
      return next
    })
  }

  const handleChangeSyncInterval = (sec: number) => {
    setSyncIntervalSec(sec)
    setCountdown(sec)
    localStorage.setItem('hd_healthmed_sync_sec', String(sec))
  }

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

  const { data, isLoading, isFetching, isPlaceholderData, refetch, dataUpdatedAt } = useHealthMedAudit(
    {
      startDate: range.startDate,
      endDate: range.endDate,
      result: 'ALL',
      search: '',
      hn: '',
    },
    autoSync ? syncIntervalSec * 1000 : false
  )

  // Countdown timer for Real-Time Auto-Sync
  useEffect(() => {
    setCountdown(syncIntervalSec)
  }, [dataUpdatedAt, syncIntervalSec])

  useEffect(() => {
    if (!autoSync) return
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : syncIntervalSec))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [autoSync, syncIntervalSec])

  const lastUpdatedTimeStr = useMemo(() => {
    if (!dataUpdatedAt) return ''
    const d = new Date(dataUpdatedAt)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} น.`
  }, [dataUpdatedAt])

  const handleManualSyncNow = () => {
    setCountdown(syncIntervalSec)
    void refetch()
  }

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

  // ตัวเลือกสำหรับ Dropdown ตัวกรอง (วันที่รับบริการ, ผู้ให้บริการ, สิทธิการรักษา)
  const filterOptions = useMemo(() => {
    const dateCounts = new Map<string, number>()
    const doctorCounts = new Map<string, number>()
    const pttypeCounts = new Map<string, number>()

    for (const r of rawRecords) {
      if (r.visit_date) {
        dateCounts.set(r.visit_date, (dateCounts.get(r.visit_date) ?? 0) + 1)
      }
      const doc = (r.doctor_name || '').trim() || 'ไม่ระบุผู้ให้บริการ'
      doctorCounts.set(doc, (doctorCounts.get(doc) ?? 0) + 1)

      const pt = (r.pttype_name || '').trim() || 'ไม่ระบุสิทธิ'
      pttypeCounts.set(pt, (pttypeCounts.get(pt) ?? 0) + 1)
    }

    const dates = [...dateCounts.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    const doctors = [...doctorCounts.entries()].sort((a, b) => b[1] - a[1])
    const pttypes = [...pttypeCounts.entries()].sort((a, b) => b[1] - a[1])

    return { dates, doctors, pttypes }
  }, [rawRecords])

  // Filter records based on active KPI filter & detailed filter controls
  const filteredRecords = useMemo(() => {
    return rawRecords.filter((r) => {
      // 1. KPI Category Filter
      if (kpiFilter === 'PASS' && r.audit_result !== 'PASS') return false
      if (kpiFilter === 'FAIL' && r.audit_result !== 'FAIL') return false
      if (kpiFilter === 'CLOSED_EP' && !r.is_claim_closed) return false
      if ((kpiFilter === 'UNCLOSED_EP' || kpiFilter === 'EP') && r.is_claim_closed) return false
      if (kpiFilter === 'DUPLICATE' && !r.is_duplicate_fail) return false
      if (kpiFilter === 'VISIT2_CLAIM' && !r.is_visit2_claim_fail) return false
      if (kpiFilter === 'KNEE' && !r.failures?.some((f) => f.includes('เข่า') || f.includes('พอกเข่า'))) return false
      if (kpiFilter === 'MUSCLE' && !r.failures?.some((f) => f.includes('กล้ามเนื้อ') || f.includes('รหัส M'))) return false
      if (kpiFilter === 'POSTPARTUM' && !r.failures?.some((f) => f.includes('หลังคลอด') || f.includes('วันคลอด'))) return false

      // 2. Claim Close Status Filter
      if (claimStatusFilter === 'CLOSED' && !r.is_claim_closed) return false
      if (claimStatusFilter === 'UNCLOSED' && r.is_claim_closed) return false
      if (claimStatusFilter === 'OPEN_ONLY' && r.claim_close_status !== 'OPEN_ONLY') return false
      if (claimStatusFilter === 'VISIT2_DUP' && r.claim_close_status !== 'VISIT2_DUP') return false
      if (claimStatusFilter === 'NONE' && r.claim_close_status !== 'NONE') return false

      // 3. Specific Visit Date Filter
      if (visitDateFilter !== 'ALL' && r.visit_date !== visitDateFilter) return false

      // 4. Doctor Filter
      if (doctorFilter !== 'ALL') {
        const doc = (r.doctor_name || '').trim() || 'ไม่ระบุผู้ให้บริการ'
        if (doc !== doctorFilter) return false
      }

      // 5. Pttype Filter
      if (pttypeFilter !== 'ALL') {
        const pt = (r.pttype_name || '').trim() || 'ไม่ระบุสิทธิ'
        if (pt !== pttypeFilter) return false
      }

      // 6. Service / Visit Type Filter
      if (serviceFilter === '58130' && !(r.count_58130 > 0)) return false
      if (serviceFilter === '58101' && !(r.count_58101 > 0)) return false
      if (serviceFilter === '58201' && !((r.count_compress ?? 0) > 0)) return false
      if (serviceFilter === 'KNEE') {
        const dxs = [r.pdx, r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5].filter(Boolean)
        if (!dxs.includes('M179') && !dxs.includes('U5753') && !(r.count_58301 > 0)) return false
      }
      if (serviceFilter === 'POSTPARTUM') {
        const dxs = [r.pdx, r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5].filter(Boolean)
        const hasOp = r.operation_codes?.some((c) => c.startsWith('900-77'))
        if (!dxs.includes('U506') && !(r.count_58131 > 0) && !(r.count_58220 > 0) && !hasOp) return false
      }
      if (serviceFilter === 'VISIT2' && !((r.visit_order ?? 1) >= 2)) return false

      // 7. HN Filter
      if (hnFilter.trim() && !r.hn.includes(hnFilter.trim())) return false

      // 8. Text Search Filter
      if (search.trim()) {
        const q = search.toLowerCase()
        const opCodesText = r.operation_codes?.join(' ') ?? ''
        const laborText = r.labor_date ?? ''
        const claimText = `${r.claim_code ?? ''} ${r.ep_code ?? ''} ${r.first_visit_claim_code ?? ''}`
        const text = `${r.hn} ${r.vn ?? ''} ${r.patient_name} ${r.doctor_name} ${r.pdx} ${r.dx0} ${r.dx1} ${r.pttype_name} ${r.audit_reason} ${opCodesText} ${laborText} ${claimText}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [rawRecords, kpiFilter, claimStatusFilter, visitDateFilter, doctorFilter, pttypeFilter, serviceFilter, hnFilter, search])

  const hasActiveFilters =
    kpiFilter !== 'ALL' ||
    claimStatusFilter !== 'ALL' ||
    visitDateFilter !== 'ALL' ||
    doctorFilter !== 'ALL' ||
    pttypeFilter !== 'ALL' ||
    serviceFilter !== 'ALL' ||
    Boolean(hnFilter.trim()) ||
    Boolean(search.trim())

  const handleResetFilters = () => {
    setKpiFilter('ALL')
    setClaimStatusFilter('ALL')
    setVisitDateFilter('ALL')
    setDoctorFilter('ALL')
    setPttypeFilter('ALL')
    setServiceFilter('ALL')
    setHnFilter('')
    setSearch('')
  }

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return

    const parseServiceInfo = (r: HealthMedRecord) => {
      const items = (r.service_items_raw || '').split('||').filter(Boolean)
      const labels: string[] = []
      let totalFee = 0
      for (const s of items) {
        const [code, name, qty, price] = s.split(':')
        const isThaiMed =
          Boolean(code && ['58101', '58102', '58130', '58131', '58201', '58220', '58301'].includes(code)) ||
          Boolean(code?.startsWith('58')) ||
          Boolean(name?.includes('นวด') && !name?.includes('กายภาพ')) ||
          Boolean(name?.includes('ประคบ') && !name?.includes('ความร้อน') && !name?.includes('ประคบร้อน') && !name?.includes('ประคบเย็น') && !name?.includes('กายภาพ')) ||
          Boolean(name?.includes('ทับหม้อเกลือ')) ||
          Boolean(name?.includes('อบไอน้ำ'))
        if (isThaiMed) {
          const cleanName = (name || '').replace(/\s*\(\d+\)\s*$/, '').trim()
          const q = Number(qty) || 1
          const p = Number(price) || 0
          labels.push(`[${code}] ${cleanName} x${q}`)
          totalFee += q * p
        }
      }
      return {
        label: labels.join(', ') || '-',
        totalFee,
      }
    }

    const detailColumns: ExcelColumn[] = [
      { header: 'ลำดับ', type: 'center', width: 8 },
      { header: 'วันที่รับบริการ', type: 'center', width: 14 },
      { header: 'เวลา', type: 'center', width: 10 },
      { header: 'HN', type: 'center', width: 13 },
      { header: 'ชื่อ-สกุล ผู้รับบริการ', width: 26 },
      { header: 'อายุ (ปี)', type: 'int', width: 9 },
      { header: 'สิทธิการรักษา', width: 25 },
      { header: 'ผู้ให้บริการ', width: 24 },
      { header: 'ลำดับ Visit', type: 'center', width: 12 },
      { header: 'สถานะการปิดสิทธิ', type: 'center', width: 22 },
      { header: 'เลขปิดสิทธิ (EP)', type: 'center', width: 18 },
      { header: 'เลขเปิดสิทธิ (PP/Authen)', type: 'center', width: 18 },
      { header: 'รายการค่าบริการ (กรมบัญชีกลาง)', width: 34 },
      { header: 'มูลค่าบริการ (บาท)', type: 'money', width: 15, total: true },
      { header: 'รหัสหัตถการ (ICD-10-TM)', width: 28 },
      { header: 'รหัสโรคหลัก (PDX)', type: 'center', width: 14 },
      { header: 'รหัสโรครอง (DX0-DX5)', width: 20 },
      { header: 'ผลการตรวจ', type: 'center', width: 15 },
      { header: 'สาเหตุ / รายละเอียดการตรวจสอบ', width: 44 },
    ]

    const buildRows = (list: readonly HealthMedRecord[]) =>
      list.map((r, i) => {
        const closeLabel = r.is_claim_closed
          ? 'ปิดสิทธิแล้ว (EP)'
          : r.claim_close_status === 'OPEN_ONLY'
          ? 'รอปิดสิทธิ (เปิด PP แล้ว)'
          : r.claim_close_status === 'VISIT2_DUP'
          ? 'Visit 2 ยังไม่ปิดสิทธิ (ซ้ำ V1)'
          : 'ยังไม่ปิดสิทธิ (ไม่มีเลข)'
        const secondaryDxs = [r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5].filter(Boolean).join(', ')
        const { label: serviceLabel, totalFee } = parseServiceInfo(r)
        const reasonText =
          r.audit_result === 'FAIL' && r.failures && r.failures.length > 0
            ? r.failures.join(' | ')
            : r.audit_reason || 'ผ่านเกณฑ์มาตรฐานครบถ้วน'

        return [
          i + 1,
          toThaiDate(r.visit_date),
          r.visit_time ? `${r.visit_time.substring(0, 5)} น.` : '',
          r.hn,
          r.patient_name,
          r.age_y,
          r.pttype_name || '',
          r.doctor_name || '',
          (r.visit_order ?? 1) >= 2 ? `Visit ${r.visit_order}` : 'Visit 1',
          closeLabel,
          r.ep_code || '-',
          r.claim_code || '-',
          serviceLabel,
          totalFee,
          (r.operation_codes ?? []).join(', ') || '-',
          r.pdx || '-',
          secondaryDxs || '-',
          r.audit_result === 'PASS' ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์',
          reasonText,
        ]
      })

    const buildSummary = (list: readonly HealthMedRecord[]) => {
      const total = list.length
      const pass = list.filter((r) => r.audit_result === 'PASS').length
      const fail = total - pass
      const closed = list.filter((r) => r.is_claim_closed).length
      const unclosed = total - closed
      const passRate = total > 0 ? `${fmtNum((pass / total) * 100, 1)}%` : '0%'
      return [
        { label: 'ผู้รับบริการทั้งหมด', value: `${fmtNum(total)} ราย` },
        { label: 'ผ่านเกณฑ์', value: `${fmtNum(pass)} ราย (${passRate})`, tone: 'good' as const },
        { label: 'ไม่ผ่านเกณฑ์', value: `${fmtNum(fail)} ราย`, tone: (fail > 0 ? 'bad' : 'good') as 'bad' | 'good' },
        { label: 'ปิดสิทธิแล้ว (EP)', value: `${fmtNum(closed)} ราย`, tone: 'good' as const },
        { label: 'ยังไม่ปิดสิทธิ', value: `${fmtNum(unclosed)} ราย`, tone: (unclosed > 0 ? 'bad' : 'good') as 'bad' | 'good' },
      ]
    }

    const reporter = toReporter(user)
    const extraSheets: Omit<ExcelReport, 'filename' | 'extraSheets'>[] = []

    // Sheet 2: เฉพาะรายการที่ไม่ผ่านเกณฑ์ / พบปัญหา
    const failRecords = filteredRecords.filter((r) => r.audit_result === 'FAIL')
    if (failRecords.length > 0 && failRecords.length < filteredRecords.length) {
      extraSheets.push({
        sheetName: 'เฉพาะไม่ผ่านเกณฑ์',
        title: 'รายงานรายการไม่ผ่านเกณฑ์ตรวจสอบหัตถการแพทย์แผนไทย (ต้องทบทวนแก้ไข)',
        range,
        reporter,
        columns: detailColumns,
        rows: buildRows(failRecords),
        summary: buildSummary(failRecords),
        statusColumn: 17,
        rowTones: failRecords.map(() => 'bad'),
      })
    }

    // Sheet 3: เฉพาะรายการที่ยังไม่ปิดสิทธิ (EP)
    const unclosedRecords = filteredRecords.filter((r) => !r.is_claim_closed)
    if (unclosedRecords.length > 0 && unclosedRecords.length < filteredRecords.length) {
      extraSheets.push({
        sheetName: 'เฉพาะยังไม่ปิดสิทธิ',
        title: 'รายงานติดตามรายการที่ยังไม่ปิดสิทธิการรักษา (ไม่มีเลข EP / รอปิด PP / Visit 2 ซ้ำ)',
        range,
        reporter,
        columns: detailColumns,
        rows: buildRows(unclosedRecords),
        summary: buildSummary(unclosedRecords),
        statusColumn: 17,
        rowTones: unclosedRecords.map((r) => (r.audit_result === 'PASS' ? 'good' : 'bad')),
      })
    }

    // Sheet 4: สรุปผลงานแยกตามผู้ให้บริการ (Provider Summary)
    const providerMap = new Map<
      string,
      { total: number; pass: number; fail: number; closed: number; unclosed: number; fee: number }
    >()
    for (const r of filteredRecords) {
      const doc = (r.doctor_name || '').trim() || 'ไม่ระบุผู้ให้บริการ'
      const cur = providerMap.get(doc) ?? { total: 0, pass: 0, fail: 0, closed: 0, unclosed: 0, fee: 0 }
      cur.total += 1
      if (r.audit_result === 'PASS') cur.pass += 1
      else cur.fail += 1
      if (r.is_claim_closed) cur.closed += 1
      else cur.unclosed += 1
      cur.fee += parseServiceInfo(r).totalFee
      providerMap.set(doc, cur)
    }
    const providerEntries = [...providerMap.entries()].sort((a, b) => b[1].total - a[1].total)
    if (providerEntries.length > 0) {
      extraSheets.push({
        sheetName: 'สรุปรายผู้ให้บริการ',
        title: 'สรุปผลการตรวจสอบหัตถการและการปิดสิทธิ แยกตามผู้ให้บริการ',
        range,
        reporter,
        columns: [
          { header: 'ลำดับ', type: 'center', width: 8 },
          { header: 'ชื่อผู้ให้บริการ / แพทย์แผนไทย', width: 32 },
          { header: 'ผู้รับบริการรวม (ราย)', type: 'int', width: 18, total: true },
          { header: 'ผ่านเกณฑ์ (ราย)', type: 'int', width: 16, total: true },
          { header: 'ไม่ผ่านเกณฑ์ (ราย)', type: 'int', width: 16, total: true },
          { header: 'ปิดสิทธิแล้ว EP (ราย)', type: 'int', width: 18, total: true },
          { header: 'ยังไม่ปิดสิทธิ (ราย)', type: 'int', width: 18, total: true },
          { header: 'มูลค่าบริการรวม (บาท)', type: 'money', width: 18, total: true },
          { header: 'อัตราผ่านเกณฑ์', type: 'center', width: 16 },
        ],
        rows: providerEntries.map(([doc, st], idx) => [
          idx + 1,
          doc,
          st.total,
          st.pass,
          st.fail,
          st.closed,
          st.unclosed,
          st.fee,
          `${fmtNum((st.pass / st.total) * 100, 1)}%`,
        ]),
        summary: buildSummary(filteredRecords),
        statusColumn: 8,
        rowTones: providerEntries.map(([, st]) => (st.fail === 0 ? 'good' : st.pass / st.total >= 0.85 ? 'warn' : 'bad')),
      })
    }

    void downloadExcel({
      filename: `ตรวจหัตถการแผนไทย_${range.startDate}_${range.endDate}.xlsx`,
      sheetName: 'รายการตรวจหัตถการทั้งหมด',
      title: 'รายงานตรวจสอบหัตถการและสถานะการปิดสิทธิแพทย์แผนไทย (HOSxP Audit Report)',
      range,
      reporter,
      columns: detailColumns,
      rows: buildRows(filteredRecords),
      summary: buildSummary(filteredRecords),
      statusColumn: 17,
      rowTones: filteredRecords.map((r) => (r.audit_result === 'PASS' ? 'good' : 'bad')),
      extraSheets,
    })
  }

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
          <div className="whitespace-nowrap text-center">
            <div
              className="text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-[13px] leading-tight"
              title={`วันที่บันทึก (ค.ศ.): ${row.original.visit_date}`}
            >
              {toThaiDate(row.original.visit_date)}
            </div>
            <div className="text-xs sm:text-xs text-slate-400 dark:text-slate-400 flex items-center justify-center gap-1 mt-0.5 font-medium leading-tight font-mono">
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
          <div className="min-w-[230px] space-y-1">
            {/* บรรทัดที่ 1: ชื่อผู้รับบริการ + ป้าย Visit 2 (ถ้ามี) */}
            <div className="flex items-center gap-1.5 group whitespace-nowrap">
              <button
                type="button"
                onClick={() => setSelectedRecord(row.original)}
                className="text-left font-bold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition cursor-pointer inline-flex items-center gap-1 text-xs sm:text-[13.5px]"
                title="คลิกเพื่อดูรายละเอียดเวชระเบียน"
              >
                <span className="truncate max-w-[185px]"><PhiName value={row.original.patient_name} /></span>
                <Eye className="size-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
              </button>
              <CopyButton
                text={row.original.patient_name} sensitive
                title="คัดลอกชื่อผู้รับบริการ"
                iconSize="size-3"
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-opacity shrink-0"
              />
              {row.original.visit_order && row.original.visit_order >= 2 && (
                <span
                  title={`ผู้ป่วยมารับบริการครั้งที่ ${row.original.visit_order} ของวัน (รวม ${row.original.total_day_visits ?? 2} Visit)`}
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold border shrink-0 leading-tight',
                    row.original.is_visit2_claim_fail
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                  )}
                >
                  Visit {row.original.visit_order}
                </span>
              )}
            </div>

            {/* บรรทัดที่ 2: ป้าย HN + สถานะการปิดสิทธิ (เรียงในบรรทัดเดียวกันเสมอ ไม่ตกบรรทัดใหม่) */}
            <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/25 shrink-0">
                <span>HN: <PhiHn value={row.original.hn} /></span>
                <CopyButton
                  text={row.original.hn} sensitive
                  title="คัดลอก HN"
                  iconSize="size-2.5"
                  className="p-0.5 hover:bg-teal-500/25 text-teal-600 dark:text-teal-300 rounded cursor-pointer transition"
                />
              </span>

              {row.original.is_claim_closed ? (
                <span
                  title={`ปิดสิทธิแล้ว (Endpoint): ${row.original.ep_code || row.original.claim_code}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shrink-0"
                >
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{row.original.ep_code || row.original.claim_code}</span>
                </span>
              ) : row.original.claim_close_status === 'OPEN_ONLY' ? (
                <span
                  title={`เปิดสิทธิแล้ว (${row.original.claim_code}) แต่ยังไม่ได้กดปิดสิทธิ (ยังไม่มีเลข EP)`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shrink-0"
                >
                  <span>⏳</span>
                  <span>{row.original.claim_code || 'รอปิดสิทธิ'}</span>
                </span>
              ) : row.original.claim_close_status === 'VISIT2_DUP' ? (
                <span
                  title={`ไม่ผ่าน: เลขปิดสิทธิของ Visit 2 (${row.original.claim_code}) ซ้ำกับ Visit 1 (${row.original.first_visit_claim_code || row.original.claim_code}) — ต้องเป็นคนละเลขถึงจะผ่าน`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shrink-0"
                >
                  <span>✕ ซ้ำ V1 ({row.original.claim_code})</span>
                </span>
              ) : (
                <span
                  title="ไม่พบเลขเปิดสิทธิ (PP) และเลขปิดสิทธิ (EP)"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shrink-0"
                >
                  <span>✕ ไม่มีเลขสิทธิ</span>
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
          const isDup = Boolean(row.original.is_duplicate_fail)

          return (
            <div className="flex flex-col items-center justify-center gap-1 mx-auto text-center whitespace-nowrap">
              {/* บรรทัดบน: สถานะหลัก (ไม่ผ่าน) + ปุ่ม AI สไตล์โมเดิร์น */}
              <div className="flex items-center justify-center gap-1.5">
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

              {/* บรรทัดล่าง: ป้ายแท็กสรุปสาเหตุสั้นๆ กระชับ บรรทัดเดียวเสมอ พร้อม Tooltip แสดงข้อความเต็มเมื่อชี้เมาส์ */}
              <div
                className="flex items-center justify-center gap-1 cursor-help whitespace-nowrap"
                title={`[รายละเอียดสาเหตุที่ไม่ผ่าน]\n${row.original.failures?.join('\n') || row.original.audit_reason}`}
              >
                {tags.slice(0, 2).map((t, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'text-[11px] font-medium px-2 py-0.5 rounded-md border inline-flex items-center gap-1 shadow-2xs transition-colors whitespace-nowrap',
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
      id: 'CLOSED_EP' as const,
      label: 'ปิดสิทธิแล้ว (EP)',
      value: kpi?.closedCount ?? 0,
      rate: kpi?.closedRate ?? 0,
      sub: 'มีเลข EP ปิดสิทธิสมบูรณ์',
      icon: Check,
      iconBg: 'bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300 border border-teal-500/30',
      valueColor: 'text-teal-600 dark:text-teal-400',
      subColor: 'text-teal-700/80 dark:text-teal-400/80',
      activeBorder: 'border-teal-500 dark:border-teal-400',
      activeShadow: 'shadow-[0_0_20px_rgba(20,184,166,0.3)]',
      activeBg: 'bg-teal-500/[0.06] dark:bg-teal-950/40',
      hoverBorder: 'hover:border-teal-400/60 dark:hover:border-teal-500/40',
    },
    {
      id: 'UNCLOSED_EP' as const,
      label: 'ยังไม่ปิดสิทธิ',
      value: kpi?.unclosedCount ?? kpi?.epFail ?? 0,
      sub:
        (kpi?.unclosedCount ?? 0) > 0
          ? `รอปิด PP ${kpi?.unclosedOpenOnlyCount ?? 0} • V2 ซ้ำ ${kpi?.unclosedVisit2DupCount ?? 0} • ขาด ${kpi?.unclosedNoneCount ?? 0}`
          : '✓ ปิดสิทธิครบทุกราย',
      icon: ShieldAlert,
      iconBg: 'bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-300 border border-red-500/30',
      valueColor: (kpi?.unclosedCount ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300',
      subColor: (kpi?.unclosedCount ?? 0) > 0 ? 'text-red-700/80 dark:text-red-400/80' : 'text-slate-400 dark:text-slate-400',
      activeBorder: 'border-red-500 dark:border-red-400',
      activeShadow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
      activeBg: 'bg-red-500/[0.06] dark:bg-red-950/40',
      hoverBorder: 'hover:border-red-400/60 dark:hover:border-red-500/40',
    },
    {
      id: 'VISIT2_CLAIM' as const,
      label: 'เลขปิดสิทธิ Visit 2',
      value: kpi?.visit2ClaimFail ?? 0,
      sub:
        (kpi?.visit2TotalCount ?? 0) > 0
          ? `จาก V2 ทั้งหมด ${kpi?.visit2TotalCount} (ปิดแล้ว ${kpi?.visit2ClosedCount ?? 0})`
          : '✓ ปกติ เลขปิดสิทธิถูกต้อง',
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
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>ตรวจหัตถการแพทย์แผนไทย</span>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center gap-1">
                  <Cpu className="size-3" /> HOSxP Audit Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>ช่วงวันที่ {toThaiDate(range.startDate)} – {toThaiDate(range.endDate)}</span>
                <span>•</span>
                <span>คลิกการ์ดสรุปตัวชี้วัดเพื่อกรองดูรายชื่อผู้ป่วย</span>
                {lastUpdatedTimeStr && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-medium">
                      <span className={cn('size-1.5 rounded-full', isFetching ? 'bg-amber-400 animate-ping' : 'bg-emerald-400')} />
                      <span>ซิงค์ล่าสุด {lastUpdatedTimeStr}</span>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Right Actions: Real-time Auto-Sync + Manual Sync + Export Excel + Collapse/Expand KPI Cards */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Real-Time Auto-Sync Toggle & Interval Selector */}
            <div className="inline-flex items-center h-8.5 rounded-xl bg-slate-100/90 dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handleToggleAutoSync}
                className={cn(
                  'inline-flex items-center gap-1.5 h-7.5 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                  autoSync
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                )}
                title={autoSync ? 'คลิกเพื่อปิดซิงค์ข้อมูลอัตโนมัติ' : 'คลิกเพื่อเปิดซิงค์ข้อมูลอัตโนมัติแบบเรียลไทม์'}
              >
                <span
                  className={cn(
                    'size-2 rounded-full shrink-0',
                    autoSync ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-400 dark:bg-slate-600'
                  )}
                />
                <span>ซิงค์อัตโนมัติ</span>
                {autoSync && (
                  <span className="font-mono text-[11px] font-bold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 min-w-[26px] text-center">
                    {countdown}s
                  </span>
                )}
              </button>

              {autoSync && (
                <select
                  value={syncIntervalSec}
                  onChange={(e) => handleChangeSyncInterval(Number(e.target.value))}
                  aria-label="ตั้งเวลาซิงค์อัตโนมัติ"
                  title="ตั้งความถี่การซิงค์อัตโนมัติ"
                  className="h-7.5 bg-transparent pl-1.5 pr-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value={10} className="bg-white dark:bg-slate-900">ทุก 10 วิ</option>
                  <option value={15} className="bg-white dark:bg-slate-900">ทุก 15 วิ</option>
                  <option value={30} className="bg-white dark:bg-slate-900">ทุก 30 วิ</option>
                  <option value={60} className="bg-white dark:bg-slate-900">ทุก 1 นาที</option>
                </select>
              )}
            </div>

            {/* 2. Manual Real-Time Sync Button */}
            <button
              type="button"
              onClick={handleManualSyncNow}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl text-xs font-bold bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 border border-teal-500/30 transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-60 shrink-0"
              title="ดึงข้อมูลสดจากฐานข้อมูล HOSxP ทันที (Real-time Sync)"
            >
              <RefreshCw className={cn('size-3.5 text-teal-500', isFetching && 'animate-spin')} />
              <span>{isFetching ? 'กำลังซิงค์...' : 'ซิงค์ทันที'}</span>
            </button>

            {/* 3. Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              className="btn-pill-action inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs transition shrink-0"
              title="ส่งออกรายงาน Excel ฉบับสมบูรณ์ (แยกชีตอัตโนมัติ: ทั้งหมด / เฉพาะไม่ผ่าน / เฉพาะยังไม่ปิดสิทธิ / สรุปรายผู้ให้บริการ)"
            >
              <Download className="size-3.5 text-white" />
              <span className="hidden sm:inline">ส่งออก Excel ({filteredRecords.length})</span>
              <span className="sm:hidden">Excel</span>
            </button>

            {/* 4. Collapse/Expand KPI Button */}
            <button
              type="button"
              onClick={() => setIsKpiCollapsed(!isKpiCollapsed)}
              className="inline-flex items-center gap-1.5 h-8.5 px-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 transition shadow-2xs cursor-pointer"
              title={isKpiCollapsed ? 'ขยายดูการ์ดสรุปทั้งหมด' : 'ย่อการ์ดสรุปเพื่อประหยัดพื้นที่หน้าจอ'}
            >
              {isKpiCollapsed ? <ChevronDown className="size-3.5 text-teal-500" /> : <ChevronUp className="size-3.5 text-teal-500" />}
              <span>{isKpiCollapsed ? 'แสดงการ์ดสรุป' : 'ย่อการ์ดสรุป'}</span>
            </button>
          </div>
        </div>

        {/* If Collapsed: Render 5-Column Compact Stat Grid (100% Visible, Zero Clipping, Balanced) */}
        {isKpiCollapsed ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 mt-3 border-t border-slate-200/80 dark:border-white/10">
            {kpiCards.map((card) => {
              const isSelected = kpiFilter === card.id
              const Icon = card.icon
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setKpiFilter(isSelected && card.id !== 'ALL' ? 'ALL' : card.id)}
                  className={cn(
                    'flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border cursor-pointer shadow-2xs min-w-0',
                    isSelected
                      ? cn(card.activeBorder, card.activeBg, card.activeShadow, 'ring-1')
                      : cn(
                          'bg-white/95 dark:bg-[#0c1424]/90 border-slate-200/90 dark:border-white/10 hover:shadow-xs',
                          card.hoverBorder
                        )
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('size-5 rounded-md grid place-items-center shrink-0 border', card.iconBg)}>
                      <Icon className="size-3" />
                    </div>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold truncate text-xs">
                      {card.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <strong className={cn('font-mono font-bold text-sm tabular-nums', card.valueColor)}>
                      <AnimatedNumber value={card.value} />
                    </strong>
                    {card.rate !== undefined && (
                      <span className="text-[10.5px] text-emerald-600 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                        {card.rate}%
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          /* If Expanded: Render Compact Space-Saving KPI Cards */
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-5 gap-2.5 mt-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
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

      {/* Comprehensive Filter Bar Card (Row 1: Date Bar + Search/HN/Density | Row 2: Segmented Status Pills + Icon Dropdown Filters) */}
      <section className="rounded-2xl bg-themed-card border border-themed p-3 sm:p-3.5 shadow-xs space-y-2.5">
        {/* Row 1: Inline Date Picker Bar (Left) + HN / Search / Reset / Density (Right) */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
          {/* Left: Full Inline Date Navigation & Range Picker */}
          <div className="min-w-0 overflow-x-auto scrollbar-none">
            {onRangeChange && (
              <ThaiDatePickerModal
                range={range}
                onChange={(nextRange) => {
                  setVisitDateFilter('ALL')
                  onRangeChange(nextRange)
                }}
              />
            )}
          </div>

          {/* Right: HN Input + Search Box + Reset + Density */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
            {/* HN Filter Box */}
            <div className="flex items-center gap-1.5 h-8.5 rounded-xl bg-white dark:bg-[#151b2d] border border-slate-200/90 dark:border-[#2a334d] px-3 shadow-2xs shrink-0 focus-within:ring-2 focus-within:ring-teal-500/40 focus-within:border-teal-500/50 transition">
              <label htmlFor="healthmed-filter-hn" className="text-xs font-bold text-slate-400 dark:text-slate-400 select-none">
                HN
              </label>
              <input
                id="healthmed-filter-hn"
                inputMode="numeric"
                value={hnFilter}
                onChange={(e) => setHnFilter(e.target.value.replace(/\D/g, ''))}
                placeholder="000009716"
                className="w-20 bg-transparent font-mono text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
              {hnFilter && (
                <button
                  type="button"
                  onClick={() => setHnFilter('')}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label="ล้าง HN"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Search Box */}
            <div className="relative flex-1 sm:w-44 lg:w-48">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ, HN, แพทย์, EP/PP..."
                className="w-full h-8.5 rounded-xl border border-slate-200/90 dark:border-[#2a334d] bg-white dark:bg-[#151b2d] pl-8.5 pr-7 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 shadow-2xs transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label="ล้างคำค้นหา"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Reset All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 h-8.5 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/25 text-xs font-bold transition cursor-pointer shadow-2xs shrink-0"
                title="ล้างตัวกรองทั้งหมด"
              >
                <RotateCcw className="size-3" />
                <span>ล้าง ({filteredRecords.length})</span>
              </button>
            )}

            {/* Density Switch Button */}
            <button
              type="button"
              onClick={() => setDensity((d) => (d === 'compact' ? 'normal' : 'compact'))}
              className="inline-flex items-center gap-1.5 h-8.5 px-2.5 rounded-xl border border-slate-200/90 dark:border-[#2a334d] bg-white dark:bg-[#151b2d] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1e263d] transition shadow-2xs cursor-pointer shrink-0"
              title={density === 'compact' ? 'เปลี่ยนเป็นโหมดแถวปกติ' : 'เปลี่ยนเป็นโหมดแถวกะทัดรัด (ประหยัดพื้นที่)'}
            >
              <SlidersHorizontal className="size-3.5 text-teal-500" />
              <span>{density === 'compact' ? 'แถวกะทัดรัด' : 'แถวปกติ'}</span>
            </button>

            {/* Export Excel Button in Filter Bar */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              className="btn-pill-action inline-flex items-center gap-1.5 h-8.5 px-2.5 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs transition shrink-0"
              title="ส่งออกรายงาน Excel ฉบับสมบูรณ์ (แยกชีตอัตโนมัติ: ทั้งหมด / เฉพาะไม่ผ่าน / เฉพาะยังไม่ปิดสิทธิ / สรุปรายผู้ให้บริการ)"
            >
              <Download className="size-3.5 text-white" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Row 2: 5-Column Equal Grid for Enterprise Filter Dropdowns (100% Aligned, Zero Clipping, Zero Orphan Wrapping) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {/* 1. Claim Close Status Dropdown */}
          <div className="relative min-w-0">
            <ShieldCheck className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-violet-500 dark:text-violet-400 pointer-events-none" />
            <select
              value={claimStatusFilter}
              onChange={(e) => setClaimStatusFilter(e.target.value as typeof claimStatusFilter)}
              aria-label="กรองตามสถานะการปิดสิทธิ"
              className={cn(
                'w-full h-9 appearance-none rounded-xl border pl-8.5 pr-7 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer shadow-2xs truncate transition',
                claimStatusFilter !== 'ALL'
                  ? 'bg-teal-500/10 dark:bg-teal-950/50 border-teal-500/50 text-teal-700 dark:text-teal-200'
                  : 'bg-white dark:bg-[#151b2d] border-slate-200/90 dark:border-[#2a334d] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1e263d]'
              )}
            >
              <option value="ALL">ทุกสถานะสิทธิ ({rawRecords.length} ราย)</option>
              <option value="CLOSED">✓ ปิดสิทธิแล้ว EP ({kpi?.closedCount ?? 0} ราย)</option>
              <option value="UNCLOSED">✕ ยังไม่ปิดสิทธิรวม ({kpi?.unclosedCount ?? 0} ราย)</option>
              <option value="OPEN_ONLY">⏳ รอปิดสิทธิ PP ({kpi?.unclosedOpenOnlyCount ?? 0} ราย)</option>
              <option value="VISIT2_DUP">⚠️ Visit 2 ซ้ำ V1 ({kpi?.unclosedVisit2DupCount ?? 0} ราย)</option>
              <option value="NONE">✕ ไม่มีเลขสิทธิ ({kpi?.unclosedNoneCount ?? 0} ราย)</option>
            </select>
            <ChevronDown className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* 2. Specific Visit Date Dropdown */}
          <div className="relative min-w-0">
            <Clock className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500 dark:text-cyan-400 pointer-events-none" />
            <select
              value={visitDateFilter}
              onChange={(e) => setVisitDateFilter(e.target.value)}
              aria-label="กรองตามวันที่รับบริการ"
              className={cn(
                'w-full h-9 appearance-none rounded-xl border pl-8.5 pr-7 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer shadow-2xs truncate transition',
                visitDateFilter !== 'ALL'
                  ? 'bg-teal-500/10 dark:bg-teal-950/50 border-teal-500/50 text-teal-700 dark:text-teal-200'
                  : 'bg-white dark:bg-[#151b2d] border-slate-200/90 dark:border-[#2a334d] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1e263d]'
              )}
            >
              <option value="ALL">ทุกวันที่ในช่วง ({filterOptions.dates.length} วัน)</option>
              {filterOptions.dates.map(([d, count]) => (
                <option key={d} value={d}>
                  {toThaiDate(d)} ({count} ราย)
                </option>
              ))}
            </select>
            <ChevronDown className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* 3. Provider / Doctor Dropdown */}
          <div className="relative min-w-0">
            <Stethoscope className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-teal-500 dark:text-teal-400 pointer-events-none" />
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              aria-label="กรองตามผู้ให้บริการ"
              className={cn(
                'w-full h-9 appearance-none rounded-xl border pl-8.5 pr-7 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer shadow-2xs truncate transition',
                doctorFilter !== 'ALL'
                  ? 'bg-teal-500/10 dark:bg-teal-950/50 border-teal-500/50 text-teal-700 dark:text-teal-200'
                  : 'bg-white dark:bg-[#151b2d] border-slate-200/90 dark:border-[#2a334d] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1e263d]'
              )}
            >
              <option value="ALL">ผู้ให้บริการทั้งหมด ({filterOptions.doctors.length})</option>
              {filterOptions.doctors.map(([doc, count]) => (
                <option key={doc} value={doc}>
                  {doc} ({count})
                </option>
              ))}
            </select>
            <ChevronDown className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* 4. Pttype / Right Dropdown */}
          <div className="relative min-w-0">
            <FileText className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 dark:text-indigo-400 pointer-events-none" />
            <select
              value={pttypeFilter}
              onChange={(e) => setPttypeFilter(e.target.value)}
              aria-label="กรองตามสิทธิการรักษา"
              className={cn(
                'w-full h-9 appearance-none rounded-xl border pl-8.5 pr-7 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer shadow-2xs truncate transition',
                pttypeFilter !== 'ALL'
                  ? 'bg-teal-500/10 dark:bg-teal-950/50 border-teal-500/50 text-teal-700 dark:text-teal-200'
                  : 'bg-white dark:bg-[#151b2d] border-slate-200/90 dark:border-[#2a334d] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1e263d]'
              )}
            >
              <option value="ALL">สิทธิการรักษาทั้งหมด ({filterOptions.pttypes.length})</option>
              {filterOptions.pttypes.map(([pt, count]) => (
                <option key={pt} value={pt}>
                  {pt} ({count})
                </option>
              ))}
            </select>
            <ChevronDown className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* 5. Service / Procedure Type Dropdown */}
          <div className="relative min-w-0">
            <Activity className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 dark:text-emerald-400 pointer-events-none" />
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value as typeof serviceFilter)}
              aria-label="กรองตามประเภทหัตถการ"
              className={cn(
                'w-full h-9 appearance-none rounded-xl border pl-8.5 pr-7 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer shadow-2xs truncate transition',
                serviceFilter !== 'ALL'
                  ? 'bg-teal-500/10 dark:bg-teal-950/50 border-teal-500/50 text-teal-700 dark:text-teal-200'
                  : 'bg-white dark:bg-[#151b2d] border-slate-200/90 dark:border-[#2a334d] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1e263d]'
              )}
            >
              <option value="ALL">ทุกหัตถการ / บริการ</option>
              <option value="58130">ค่านวดและประคบ (58130)</option>
              <option value="58101">ค่านวดเพื่อการรักษา (58101)</option>
              <option value="58201">ค่าประคบสมุนไพร (58201)</option>
              <option value="KNEE">พอกเข่า / ข้อเข่าเสื่อม (M179/U5753)</option>
              <option value="POSTPARTUM">บริบาลหลังคลอด (U506/58131)</option>
              <option value="VISIT2">เฉพาะ Visit 2+ (มารับบริการซ้ำ)</option>
            </select>
            <ChevronDown className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </section>

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
