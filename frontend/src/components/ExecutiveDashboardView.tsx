import { useState, useMemo, type FC } from 'react'
import {
  Building2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Pill,
  ClipboardCheck,
  ArrowUpRight,
  Send,
  Settings2,
  Activity,
  Layers,
  Calendar,
  Box,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  User,
  Clock,
  XCircle,
} from 'lucide-react'
import type {
  ActivePage,
  AuditRecord,
  AuditKpiMetrics,
  DateRange,
  DbStatus,
  DrugSummaryRecord,
} from '@/types/herbdx.types'
import { fmtNum, toThaiDate, downloadExcel, AUDIT_RESULT_META, type ExcelColumn, toReporter } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { cn } from '@/lib/utils'

interface ExecutiveDashboardViewProps {
  readonly kpi: AuditKpiMetrics | undefined
  readonly records: readonly AuditRecord[]
  readonly drugs: readonly DrugSummaryRecord[]
  readonly status: DbStatus | undefined
  readonly range: DateRange
  readonly onRangeChange: (r: DateRange) => void
  readonly onNavigate: (page: ActivePage) => void
  readonly onSync: () => void
  readonly isSyncing: boolean
  readonly onConfigureDrug?: (record: AuditRecord) => void
}

interface DailyTrendItem {
  date: string
  dayNum: number
  label: string
  total: number
  pass: number
  fail: number
  noDx: number
  noMap: number
  passRate: number
}

export const ExecutiveDashboardView: FC<ExecutiveDashboardViewProps> = ({
  kpi,
  records,
  drugs,
  status,
  range,
  onRangeChange,
  onNavigate,
  onSync,
  isSyncing,
}) => {
  const { user } = useAuth()
  // Chart filter mode
  const [chartScope, setChartScope] = useState<'ALL' | 'OPD' | 'IPD'>('ALL')
  const [is3DMode, setIs3DMode] = useState<boolean>(true)
  const [hoveredDay, setHoveredDay] = useState<DailyTrendItem | null>(null)

  // Quick range presets (Month & Fiscal Year)
  type PresetType = 'THIS_MONTH' | 'LAST_MONTH' | 'FY_70' | 'FY_69'

  const handleSelectPreset = (preset: PresetType) => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    if (preset === 'THIS_MONTH') {
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const lastDay = new Date(year, month, 0).getDate()
      onRangeChange({
        startDate: `${year}-${pad(month)}-01`,
        endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
      })
    } else if (preset === 'LAST_MONTH') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const year = lastMonthDate.getFullYear()
      const month = lastMonthDate.getMonth() + 1
      const lastDay = new Date(year, month, 0).getDate()
      onRangeChange({
        startDate: `${year}-${pad(month)}-01`,
        endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
      })
    } else if (preset === 'FY_70') {
      // ปีงบประมาณ 2570: 1 ต.ค. 2569 ถึง 30 ก.ย. 2570
      onRangeChange({
        startDate: '2026-10-01',
        endDate: '2027-09-30',
      })
    } else if (preset === 'FY_69') {
      // ปีงบประมาณ 2569: 1 ต.ค. 2568 ถึง 30 ก.ย. 2569
      onRangeChange({
        startDate: '2025-10-01',
        endDate: '2026-09-30',
      })
    }
  }

  // Filter records based on chartScope
  const scopedRecords = useMemo(() => {
    if (chartScope === 'OPD') return records.filter((r) => !r.vn.startsWith('AN:'))
    if (chartScope === 'IPD') return records.filter((r) => r.vn.startsWith('AN:'))
    return records
  }, [records, chartScope])

  // KPIs
  const totalPrescriptions = kpi?.total ?? records.length
  const passCount = kpi?.pass ?? records.filter((r) => r.audit_result === 'PASS').length
  const failCount = kpi?.fail ?? records.filter((r) => r.audit_result === 'FAIL').length
  const noDxCount = kpi?.noDx ?? records.filter((r) => r.audit_result === 'NO_DX').length
  const noMapCount = kpi?.noMap ?? records.filter((r) => r.audit_result === 'NO_MAP').length
  const passRate = kpi?.passRate ?? (totalPrescriptions > 0 ? (passCount / totalPrescriptions) * 100 : 0)
  const uniquePatients = kpi?.uniquePatients ?? new Set(records.map((r) => r.hn)).size
  const problemCount = failCount + noDxCount + noMapCount

  const opdCount = useMemo(() => records.filter((r) => !r.vn.startsWith('AN:')).length, [records])
  const ipdCount = useMemo(() => records.filter((r) => r.vn.startsWith('AN:')).length, [records])

  const isYearlyRange = useMemo(() => {
    const d1 = new Date(range.startDate).getTime()
    const d2 = new Date(range.endDate).getTime()
    return (d2 - d1) > 35 * 24 * 60 * 60 * 1000
  }, [range.startDate, range.endDate])

  // =========================================================================
  // Drill-down Modal State & Memoized Aggregations
  // =========================================================================
  type DrillDownType = 'PASS' | 'TOTAL' | 'PATIENTS' | 'PROBLEMS' | null
  const [activeDrillDown, setActiveDrillDown] = useState<DrillDownType>(null)
  const [drillDownSearch, setDrillDownSearch] = useState('')
  const [drillDownPage, setDrillDownPage] = useState(0)
  const drillDownPageSize = 15
  const [drillDownScope, setDrillDownScope] = useState<'ALL' | 'OPD' | 'IPD'>('ALL')
  const [selectedPatientRecord, setSelectedPatientRecord] = useState<AuditRecord | null>(null)

  const openDrillDown = (type: DrillDownType) => {
    setActiveDrillDown(type)
    setDrillDownSearch('')
    setDrillDownPage(0)
    setDrillDownScope('ALL')
  }

  // Drill-down Prescriptions List (for PASS, TOTAL, PROBLEMS)
  const drillDownPrescriptions = useMemo(() => {
    if (!activeDrillDown || activeDrillDown === 'PATIENTS') return []
    let list = records
    if (activeDrillDown === 'PASS') {
      list = list.filter((r) => r.audit_result === 'PASS')
    } else if (activeDrillDown === 'PROBLEMS') {
      list = list.filter((r) => r.audit_result !== 'PASS')
    }

    if (drillDownScope === 'OPD') {
      list = list.filter((r) => !r.vn.startsWith('AN:'))
    } else if (drillDownScope === 'IPD') {
      list = list.filter((r) => r.vn.startsWith('AN:'))
    }

    if (drillDownSearch.trim()) {
      const q = drillDownSearch.toLowerCase().trim()
      list = list.filter((r) =>
        r.hn.toLowerCase().includes(q) ||
        r.patient_name.toLowerCase().includes(q) ||
        r.drug_name.toLowerCase().includes(q) ||
        (r.department_name && r.department_name.toLowerCase().includes(q)) ||
        (r.doctor_name && r.doctor_name.toLowerCase().includes(q)) ||
        (r.pdx && r.pdx.toLowerCase().includes(q)) ||
        (r.audit_reason && r.audit_reason.toLowerCase().includes(q))
      )
    }

    return list
  }, [records, activeDrillDown, drillDownScope, drillDownSearch])

  // Drill-down Patients List (Grouped by HN)
  interface PatientRow {
    hn: string
    patientName: string
    visitCount: number
    prescriptionsCount: number
    drugs: string[]
    departments: string[]
    latestDate: string
    hasProblem: boolean
    records: AuditRecord[]
  }

  const drillDownPatients = useMemo<PatientRow[]>(() => {
    if (activeDrillDown !== 'PATIENTS') return []
    const map = new Map<string, {
      hn: string
      patientName: string
      vns: Set<string>
      drugSet: Set<string>
      deptSet: Set<string>
      latestDate: string
      hasProblem: boolean
      records: AuditRecord[]
    }>()

    for (const r of records) {
      let p = map.get(r.hn)
      if (!p) {
        p = {
          hn: r.hn,
          patientName: r.patient_name,
          vns: new Set(),
          drugSet: new Set(),
          deptSet: new Set(),
          latestDate: r.visit_date,
          hasProblem: false,
          records: [],
        }
        map.set(r.hn, p)
      }
      p.vns.add(r.vn)
      p.drugSet.add(r.drug_name)
      if (r.department_name) p.deptSet.add(r.department_name)
      if (r.visit_date > p.latestDate) p.latestDate = r.visit_date
      if (r.audit_result !== 'PASS') p.hasProblem = true
      p.records.push(r)
    }

    let list: PatientRow[] = Array.from(map.values()).map((p) => ({
      hn: p.hn,
      patientName: p.patientName,
      visitCount: p.vns.size,
      prescriptionsCount: p.records.length,
      drugs: Array.from(p.drugSet),
      departments: Array.from(p.deptSet),
      latestDate: p.latestDate,
      hasProblem: p.hasProblem,
      records: p.records,
    }))

    if (drillDownSearch.trim()) {
      const q = drillDownSearch.toLowerCase().trim()
      list = list.filter((p) =>
        p.hn.toLowerCase().includes(q) ||
        p.patientName.toLowerCase().includes(q) ||
        p.departments.some((d) => d.toLowerCase().includes(q)) ||
        p.drugs.some((d) => d.toLowerCase().includes(q))
      )
    }

    return list
  }, [records, activeDrillDown, drillDownSearch])

  // Pagination for drill-down
  const totalDrillDownItems = activeDrillDown === 'PATIENTS' ? drillDownPatients.length : drillDownPrescriptions.length
  const totalDrillDownPages = Math.max(1, Math.ceil(totalDrillDownItems / drillDownPageSize))
  const paginatedPrescriptions = useMemo(() => {
    return drillDownPrescriptions.slice(drillDownPage * drillDownPageSize, (drillDownPage + 1) * drillDownPageSize)
  }, [drillDownPrescriptions, drillDownPage, drillDownPageSize])

  const paginatedPatients = useMemo(() => {
    return drillDownPatients.slice(drillDownPage * drillDownPageSize, (drillDownPage + 1) * drillDownPageSize)
  }, [drillDownPatients, drillDownPage, drillDownPageSize])

  // Export Excel handler
  const handleExportDrillDownExcel = () => {
    if (!activeDrillDown) return
    if (activeDrillDown === 'PATIENTS') {
      const columns: ExcelColumn[] = [
        { header: 'ลำดับ', type: 'center', width: 7 },
        { header: 'HN', type: 'center' },
        { header: 'ชื่อ-สกุล ผู้รับบริการ', width: 28 },
        { header: 'จำนวนครั้งรับบริการ (VN)', type: 'int', width: 14, total: true },
        { header: 'จำนวนรายการยา', type: 'int', width: 12, total: true },
        { header: 'รายการยาที่ได้รับ', width: 48 },
        { header: 'แผนกที่รับบริการ', width: 30 },
        { header: 'วันที่รับบริการล่าสุด', type: 'center', width: 14 },
        { header: 'ผลการตรวจสอบ', type: 'center', width: 18 },
      ]
      const problemPatients = drillDownPatients.filter((p) => p.hasProblem).length
      const rows = drillDownPatients.map((p, idx) => [
        idx + 1,
        p.hn,
        p.patientName,
        p.visitCount,
        p.prescriptionsCount,
        p.drugs.join(', '),
        p.departments.join(', '),
        toThaiDate(p.latestDate),
        p.hasProblem ? 'มีรายการต้องทบทวน' : 'ผ่านเกณฑ์ทั้งหมด',
      ])
      void downloadExcel({
        filename: `รายชื่อผู้รับบริการสั่งใช้สมุนไพร_${range.startDate}_${range.endDate}.xlsx`,
        sheetName: 'ผู้รับบริการ',
        title: 'รายชื่อผู้รับบริการที่ได้รับการสั่งใช้ยาสมุนไพร',
        range,
        reporter: toReporter(user),
        columns,
        rows,
        summary: [
          { label: 'ผู้รับบริการ', value: `${fmtNum(drillDownPatients.length)} ราย` },
          { label: 'ผ่านเกณฑ์ทั้งหมด', value: drillDownPatients.length - problemPatients, tone: 'good' },
          { label: 'มีรายการต้องทบทวน', value: problemPatients, tone: 'bad' },
        ],
        statusColumn: 8,
        rowTones: drillDownPatients.map((p) => (p.hasProblem ? 'bad' : 'good')),
      })
    } else {
      const columns: ExcelColumn[] = [
        { header: 'ลำดับ', type: 'center', width: 7 },
        { header: 'ประเภท', type: 'center', width: 8 },
        { header: 'วันที่', type: 'center' },
        { header: 'เวลา', type: 'center' },
        { header: 'HN', type: 'center' },
        { header: 'VN / AN', type: 'center' },
        { header: 'ชื่อ-สกุล ผู้รับบริการ', width: 28 },
        { header: 'แผนก', width: 24 },
        { header: 'รายการยา', width: 36 },
        { header: 'จำนวน', type: 'int', total: true },
        { header: 'หน่วย', type: 'center' },
        { header: 'แพทย์ผู้สั่ง', width: 26 },
        { header: 'รหัสวินิจฉัย (PDX)', type: 'center', width: 13 },
        { header: 'ผลการตรวจสอบ', type: 'center', width: 15 },
        { header: 'เหตุผลประกอบ', width: 46 },
      ]
      const isIpd = (r: AuditRecord) => r.vn.startsWith('AN:')
      const toRows = (list: readonly AuditRecord[]) => list.map((r, idx) => [
        idx + 1,
        isIpd(r) ? 'IPD' : 'OPD',
        toThaiDate(r.visit_date),
        r.visit_time ? `${r.visit_time.substring(0, 5)} น.` : '-',
        r.hn,
        isIpd(r) ? `AN ${r.vn.slice(3)}` : r.vn,
        r.patient_name,
        r.department_name || '-',
        r.drug_name,
        r.drug_qty,
        r.drug_units || '-',
        r.doctor_name || '-',
        r.pdx || '-',
        r.audit_result === 'PASS' ? 'ผ่านเกณฑ์' : AUDIT_RESULT_META[r.audit_result].short,
        r.audit_reason || '-',
      ])
      const title = activeDrillDown === 'PASS' ? 'รายการผ่านเกณฑ์' : activeDrillDown === 'PROBLEMS' ? 'รายการต้องทบทวนแก้ไข' : 'รายการสั่งยาทั้งหมด'
      const scopeLabel = drillDownScope === 'ALL' ? 'ทั้งหมด' : drillDownScope
      const sheetFor = (list: readonly AuditRecord[], label: string) => {
        const passRows = list.filter((r) => r.audit_result === 'PASS').length
        return {
          sheetName: label,
          title: `รายงานการสั่งใช้ยาสมุนไพร — ${title} (${label})`,
          range,
          reporter: toReporter(user),
          columns,
          rows: toRows(list),
          summary: [
            { label: 'รายการยา', value: `${fmtNum(list.length)} รายการ` },
            { label: 'ผ่านเกณฑ์', value: passRows, tone: 'good' as const },
            { label: 'ไม่ผ่าน / ต้องทบทวน', value: list.length - passRows, tone: 'bad' as const },
          ],
          statusColumn: 13,
          rowTones: list.map((r) => (r.audit_result === 'PASS' ? 'good' as const : r.audit_result === 'NO_MAP' ? 'warn' as const : 'bad' as const)),
        }
      }
      // เลือก "ทั้งหมด" -> แยกชีต OPD / IPD เพิ่มในไฟล์เดียวกัน (เฉพาะชีตที่มีข้อมูล)
      const extraSheets = drillDownScope === 'ALL'
        ? ([['OPD', drillDownPrescriptions.filter((r) => !isIpd(r))], ['IPD', drillDownPrescriptions.filter(isIpd)]] as const)
            .filter(([, list]) => list.length > 0)
            .map(([label, list]) => sheetFor(list, label))
        : []
      void downloadExcel({
        filename: `${title}_${scopeLabel}_${range.startDate}_${range.endDate}.xlsx`,
        ...sheetFor(drillDownPrescriptions, scopeLabel),
        extraSheets,
      })
    }
  }

  // 1. Daily/Monthly Trend Aggregation for SVG Chart
  const dailyTrends = useMemo<DailyTrendItem[]>(() => {
    if (scopedRecords.length === 0) return []

    const thaiMonthShort = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ]

    const map = new Map<string, { pass: number; fail: number; noDx: number; noMap: number; total: number }>()

    for (const r of scopedRecords) {
      const d = r.visit_date
      if (!d) continue
      // If viewing a yearly period, aggregate by YYYY-MM; otherwise by date YYYY-MM-DD
      const key = isYearlyRange ? d.slice(0, 7) : d
      const current = map.get(key) || { pass: 0, fail: 0, noDx: 0, noMap: 0, total: 0 }
      current.total += 1
      if (r.audit_result === 'PASS') current.pass += 1
      else if (r.audit_result === 'FAIL') current.fail += 1
      else if (r.audit_result === 'NO_DX') current.noDx += 1
      else if (r.audit_result === 'NO_MAP') current.noMap += 1
      map.set(key, current)
    }

    const sortedKeys = Array.from(map.keys()).sort()
    return sortedKeys.map((keyStr, idx) => {
      const item = map.get(keyStr)!
      const passRate = item.total > 0 ? (item.pass / item.total) * 100 : 0

      if (isYearlyRange) {
        const parts = keyStr.split('-')
        const m = parseInt(parts[1] ?? '1', 10) || 1
        const monthLabel = thaiMonthShort[m - 1] ?? keyStr
        return {
          date: `${keyStr}-01`,
          dayNum: idx + 1,
          label: monthLabel,
          total: item.total,
          pass: item.pass,
          fail: item.fail,
          noDx: item.noDx,
          noMap: item.noMap,
          passRate,
        }
      }

      const dateObj = new Date(keyStr)
      const dayNum = dateObj.getDate()
      return {
        date: keyStr,
        dayNum,
        label: `${dayNum}`,
        total: item.total,
        pass: item.pass,
        fail: item.fail,
        noDx: item.noDx,
        noMap: item.noMap,
        passRate,
      }
    })
  }, [scopedRecords, isYearlyRange])

  // Maximum value for SVG scaling
  const maxDailyVolume = useMemo(() => {
    if (dailyTrends.length === 0) return 10
    const m = Math.max(...dailyTrends.map((d) => d.total))
    // Round up to a "nice" max so the 4 grid steps get round labels (e.g. 0/60/120/180/240)
    const raw = Math.max(1, (m * 1.1) / 4)
    const mag = 10 ** Math.floor(Math.log10(raw))
    const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10].map((n) => n * mag).find((v) => v >= raw && Number.isInteger(v)) ?? Math.ceil(raw)
    return step * 4
  }, [dailyTrends])

  // 2. Top 5 Prescribed Herbs
  const topHerbs = useMemo(() => {
    const map = new Map<string, { name: string; count: number; pass: number; icode: string }>()
    for (const r of records) {
      const key = r.drug_icode || r.drug_name
      const cur = map.get(key) || { name: r.drug_name, count: 0, pass: 0, icode: r.drug_icode }
      cur.count += 1
      if (r.audit_result === 'PASS') cur.pass += 1
      map.set(key, cur)
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [records])

  // 3. Top Departments
  const topDepartments = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of records) {
      const dept = r.department_name || 'ไม่ระบุแผนก'
      map.set(dept, (map.get(dept) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  }, [records])

  const maxDeptCount = useMemo(() => {
    if (topDepartments.length === 0) return 1
    return Math.max(...topDepartments.map((d) => d.count)) || 1
  }, [topDepartments])

  // SVG Chart Geometry Constants
  const chartHeight = 240
  const chartWidth = 740
  const padLeft = 36
  const padRight = 40
  const padTop = 20
  const padBottom = 26
  const plotWidth = chartWidth - padLeft - padRight
  const plotHeight = chartHeight - padTop - padBottom

  return (
    <div className="space-y-4 animate-fade-in pb-8 text-slate-800 dark:text-slate-100">
      {/* ========================================================================= */}
      {/* 1. SLIM & PROFESSIONAL EXECUTIVE HEADER BAR                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-themed-card border border-themed shadow-xs">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-accent-soft border border-accent-soft text-accent grid place-items-center shrink-0">
            <Activity className="size-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>ภาพรวมการสั่งใช้ยาสมุนไพร</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-accent-soft text-accent border border-accent-soft font-normal">
                รพ.พังโคน
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
              <span>ตัวชี้วัดคุณภาพและความสอดคล้องรหัสโรค ICD-10 (เป้าหมาย ≥ 50%)</span>
              {drugs.length > 0 && (
                <span className="text-slate-400 dark:text-slate-500">
                  • บัญชียาสมุนไพร {drugs.length} ชนิด
                </span>
              )}
              {status?.latestVisitDate && (
                <span className="text-slate-400 dark:text-slate-500">
                  • ข้อมูล HOSxP ล่าสุด {toThaiDate(status.latestVisitDate)}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Date presets & Subtle Refresh */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 text-xs flex-wrap">
            {/* กลุ่ม 1: ปีงบประมาณ (เรียงตามลำดับเวลา: ปีงบ 69 -> ปีงบ 70) */}
            <div className="flex items-center gap-1 pr-1.5 border-r border-slate-300 dark:border-white/10">
              <span className="text-[11px] text-slate-400 font-semibold px-0.5 select-none">ปีงบ:</span>
              <button
                type="button"
                onClick={() => handleSelectPreset('FY_69')}
                className={cn(
                  'px-2 py-1 rounded-lg font-medium transition cursor-pointer',
                  range.startDate === '2025-10-01' && range.endDate === '2026-09-30'
                    ? 'bg-white dark:bg-slate-800 text-accent font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                )}
                title="ปีงบประมาณ 2569 (1 ต.ค. 68 - 30 ก.ย. 69)"
              >
                ปีงบ 69
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('FY_70')}
                className={cn(
                  'px-2 py-1 rounded-lg font-medium transition cursor-pointer',
                  range.startDate === '2026-10-01' && range.endDate === '2027-09-30'
                    ? 'bg-white dark:bg-slate-800 text-accent font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                )}
                title="ปีงบประมาณ 2570 (1 ต.ค. 69 - 30 ก.ย. 70)"
              >
                ปีงบ 70
              </button>
            </div>

            {/* กลุ่ม 2: รายเดือน (เรียงตามลำดับเวลา: ก.ย. 69 -> ต.ค. 69) */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 font-semibold px-0.5 select-none">เดือน:</span>
              <button
                type="button"
                onClick={() => handleSelectPreset('LAST_MONTH')}
                className={cn(
                  'px-2 py-1 rounded-lg font-medium transition cursor-pointer',
                  range.startDate === '2026-09-01' && range.endDate === '2026-09-30'
                    ? 'bg-white dark:bg-slate-800 text-accent font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                )}
                title="เดือนก่อนหน้า (กันยายน 2569)"
              >
                ก.ย. 69
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('THIS_MONTH')}
                className={cn(
                  'px-2 py-1 rounded-lg font-medium transition cursor-pointer',
                  range.startDate === '2026-10-01' && range.endDate === '2026-10-31'
                    ? 'bg-white dark:bg-slate-800 text-accent font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                )}
                title="เดือนปัจจุบัน (ตุลาคม 2569)"
              >
                ต.ค. 69 (เดือนนี้)
              </button>
            </div>

            <span className="px-2 py-0.5 text-[11px] font-mono text-accent bg-accent-soft rounded-md border border-accent-soft ml-0.5">
              {toThaiDate(range.startDate)} - {toThaiDate(range.endDate)}
            </span>

            {/* Subtle Refresh button (ไม่แย่งสายตากับปุ่มหลักบน Navbar) */}
            <button
              type="button"
              disabled={isSyncing}
              onClick={onSync}
              className="p-1 rounded-lg text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-200/60 dark:hover:bg-white/10 disabled:opacity-50 transition cursor-pointer ml-0.5"
              title="ดึงข้อมูลล่าสุดจาก HOSxP"
            >
              <RefreshCw className={cn('size-3.5', isSyncing && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* Informative Banner when 0 records are present in current date range */}
      {records.length === 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold">ยังไม่ได้ดึงข้อมูลช่วง {toThaiDate(range.startDate)} ถึง {toThaiDate(range.endDate)} เข้าสู่คลังข้อมูล</span>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5">
                ในฐานข้อมูล HOSxP มีประวัติการสั่งจ่ายยาอยู่ครบถ้วน กดปุ่มเพื่อดึงข้อมูลช่วงนี้เข้ามาประมวลผลทันที
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSyncing}
            onClick={onSync}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition shadow-sm active:scale-95"
          >
            <RefreshCw className={cn('size-3.5', isSyncing && 'animate-spin')} />
            <span>{isSyncing ? 'กำลังดึงข้อมูลจาก HOSxP…' : 'ดึงข้อมูลช่วงนี้จาก HOSxP ทันที'}</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. COMPACT 4 EXECUTIVE KPI CARDS                                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Pass Rate */}
        <button
          type="button"
          onClick={() => openDrillDown('PASS')}
          className="rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer relative overflow-hidden group border-2 flex flex-col justify-between min-h-[132px] backdrop-blur-md bg-white/95 dark:bg-[#0c1424]/90 border-slate-200/90 dark:border-white/10 shadow-2xs hover:shadow-lg hover:border-emerald-400 dark:hover:border-emerald-500 hover:-translate-y-1 active:scale-[0.99]"
          title="คลิกเพื่อดูรายชื่อผู้รับบริการและรายการสั่งยาที่ผ่านเกณฑ์"
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                ร้อยละผ่านเกณฑ์
              </span>
              <div className="size-8 rounded-lg grid place-items-center group-hover:scale-110 transition-transform shrink-0 border bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30">
                <CheckCircle2 className="size-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl sm:text-[32px] font-bold tabular-nums tracking-normal font-sans leading-none text-emerald-600 dark:text-emerald-400">
                {passRate.toFixed(1)}%
              </span>
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full border',
                passRate >= 50
                  ? 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                  : 'text-amber-600 dark:text-amber-300 bg-amber-500/10 border-amber-500/25'
              )}>
                {passRate >= 50 ? '✓ บรรลุเป้าหมาย' : '⚠️ ต่ำกว่าเป้าหมาย'}
              </span>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-emerald-700/80 dark:text-emerald-400/80">
                ผ่านเกณฑ์ {fmtNum(passCount)} จาก {fmtNum(totalPrescriptions)} รายการ
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold group-hover:underline flex items-center gap-0.5">
                ดูรายละเอียด &gt;
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, passRate))}%` }}
              />
            </div>
          </div>
        </button>

        {/* KPI 2: Total Volume */}
        <button
          type="button"
          onClick={() => openDrillDown('TOTAL')}
          className="rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer relative overflow-hidden group border-2 flex flex-col justify-between min-h-[132px] backdrop-blur-md bg-white/95 dark:bg-[#0c1424]/90 border-slate-200/90 dark:border-white/10 shadow-2xs hover:shadow-lg hover:border-indigo-400 dark:hover:border-indigo-500 hover:-translate-y-1 active:scale-[0.99]"
          title="คลิกเพื่อดูประวัติการสั่งใช้ยาสมุนไพรทั้งหมด"
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                รายการสั่งจ่ายยาสมุนไพร
              </span>
              <div className="size-8 rounded-lg grid place-items-center group-hover:scale-110 transition-transform shrink-0 border bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-500/30">
                <Pill className="size-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl sm:text-[32px] font-bold tabular-nums tracking-normal font-sans leading-none text-slate-900 dark:text-white">
                <AnimatedNumber value={totalPrescriptions} />
              </span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25">
                รายการ
              </span>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs gap-1">
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                OPD {fmtNum(opdCount)}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                IPD {fmtNum(ipdCount)}
              </span>
            </div>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold group-hover:underline flex items-center gap-0.5">
              ดูรายละเอียด &gt;
            </span>
          </div>
        </button>

        {/* KPI 3: Unique Patients */}
        <button
          type="button"
          onClick={() => openDrillDown('PATIENTS')}
          className="rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer relative overflow-hidden group border-2 flex flex-col justify-between min-h-[132px] backdrop-blur-md bg-white/95 dark:bg-[#0c1424]/90 border-slate-200/90 dark:border-white/10 shadow-2xs hover:shadow-lg hover:border-teal-400 dark:hover:border-teal-500 hover:-translate-y-1 active:scale-[0.99]"
          title="คลิกเพื่อดูรายชื่อผู้รับบริการสั่งใช้สมุนไพรทุกคน"
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                จำนวนผู้รับบริการ
              </span>
              <div className="size-8 rounded-lg grid place-items-center group-hover:scale-110 transition-transform shrink-0 border bg-teal-500/15 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300 border-teal-500/30">
                <Users className="size-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl sm:text-[32px] font-bold tabular-nums tracking-normal font-sans leading-none text-teal-600 dark:text-teal-400">
                <AnimatedNumber value={uniquePatients} />
              </span>
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-300 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/25">
                ราย
              </span>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>เฉลี่ย {(totalPrescriptions / (uniquePatients || 1)).toFixed(1)} รายการต่อราย</span>
            <span className="text-teal-600 dark:text-teal-400 font-bold group-hover:underline flex items-center gap-0.5">
              ดูรายชื่อผู้รับบริการ &gt;
            </span>
          </div>
        </button>

        {/* KPI 4: Action Required */}
        <button
          type="button"
          onClick={() => openDrillDown('PROBLEMS')}
          className="rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer relative overflow-hidden group border-2 flex flex-col justify-between min-h-[132px] backdrop-blur-md bg-rose-500/[0.04] dark:bg-rose-950/20 border-rose-500/30 dark:border-rose-500/30 shadow-2xs hover:shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:border-rose-500 dark:hover:border-rose-400 hover:-translate-y-1 active:scale-[0.99]"
          title="คลิกเพื่อดูรายการที่ต้องทบทวนหรือแก้ไขรหัสโรค"
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[13px] font-semibold text-rose-700 dark:text-rose-300 truncate">
                รายการที่ต้องทบทวนแก้ไข
              </span>
              <div className="size-8 rounded-lg grid place-items-center group-hover:scale-110 transition-transform shrink-0 border bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 border-rose-500/30">
                <AlertTriangle className="size-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl sm:text-[32px] font-bold tabular-nums tracking-normal font-sans leading-none text-rose-600 dark:text-rose-400">
                <AnimatedNumber value={problemCount} />
              </span>
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30">
                {totalPrescriptions > 0 ? ((problemCount / totalPrescriptions) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-rose-200/50 dark:border-white/5 flex items-center justify-between text-xs">
            <span className="text-rose-700/80 dark:text-rose-400/80 font-medium truncate">
              ไม่ผ่านเกณฑ์ {fmtNum(failCount)} · ไม่มีรหัสวินิจฉัย {fmtNum(noDxCount)}
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-bold group-hover:underline flex items-center gap-0.5">
              ดูรายละเอียด &gt;
            </span>
          </div>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. CORE ANALYTICS: INTERACTIVE TREND CHART & TOP HERBS                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 Cols: Daily Trend Bar & Line Chart */}
        <div className="lg:col-span-7 rounded-2xl bg-themed-card border border-themed p-4 sm:p-5 shadow-xs space-y-3.5">
          {/* Chart Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-accent" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isYearlyRange
                    ? 'แนวโน้มการสั่งใช้ยาและอัตราผ่านเกณฑ์รายเดือน (12 เดือนของปีงบประมาณ)'
                    : 'แนวโน้มการสั่งใช้ยาและอัตราผ่านเกณฑ์รายวัน'}
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isYearlyRange
                  ? 'กราฟแท่ง 3D แสดงยอดจ่ายยาสมุนไพรแยกรายเดือน พร้อมเส้นแนวโน้มอัตราผ่านเกณฑ์ (%)'
                  : 'กราฟแท่งแสดงจำนวนรายการยา (ผ่าน vs ไม่ตรงเกณฑ์) ซ้อนเส้นแนวโน้มอัตราผ่าน (%)'}
              </p>
            </div>

            {/* Controls: 3D toggle & Scope switcher */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* 3D Mode Toggle */}
              <button
                type="button"
                onClick={() => setIs3DMode(!is3DMode)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5 border',
                  is3DMode
                    ? 'bg-accent border-accent shadow-xs'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200/80 dark:border-white/5 hover:text-slate-800 dark:hover:text-white'
                )}
                title="สลับการแสดงผลแบบ 3D Isometric มีมิติแสงเงา"
              >
                <Box className="size-3" />
                <span>{is3DMode ? 'กราฟ 3D' : 'กราฟ 2D'}</span>
              </button>

              {/* Scope switcher (All / OPD / IPD) */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setChartScope('ALL')}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-semibold transition cursor-pointer',
                    chartScope === 'ALL'
                      ? 'bg-white dark:bg-slate-800 text-accent shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  )}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setChartScope('OPD')}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-semibold transition cursor-pointer',
                    chartScope === 'OPD'
                      ? 'bg-white dark:bg-slate-800 text-accent shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  )}
                >
                  OPD
                </button>
                <button
                  type="button"
                  onClick={() => setChartScope('IPD')}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-semibold transition cursor-pointer',
                    chartScope === 'IPD'
                      ? 'bg-white dark:bg-slate-800 text-accent shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  )}
                >
                  IPD
                </button>
              </div>
            </div>
          </div>

          {/* SVG Chart Container */}
          <div className="relative w-full rounded-xl bg-slate-50/70 dark:bg-[#070b14]/50 border border-slate-200/60 dark:border-white/5 p-2 overflow-hidden">
            {dailyTrends.length === 0 ? (
              <div className="h-44 grid place-items-center text-xs text-slate-400">
                ไม่พบข้อมูลการสั่งจ่ายยาในช่วงเวลานี้
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto overflow-visible select-none"
              >
                <defs>
                  {/* Gradients */}
                  <linearGradient id="barPassGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                  <linearGradient id="barFailGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#be123c" />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                  <radialGradient id="sphereGrad" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="40%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </radialGradient>
                  <linearGradient id="areaGlow3d" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="glow3d" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const y = padTop + plotHeight * (1 - pct)
                  return (
                    <g key={pct}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={padLeft + plotWidth}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800/80"
                        strokeDasharray={pct === 0.5 ? '4 3' : '2 2'}
                        strokeWidth="1"
                      />
                      {/* Left Y Axis Label (Volume) */}
                      <text
                        x={padLeft - 6}
                        y={y + 3.5}
                        textAnchor="end"
                        className="text-[11px] fill-slate-400 dark:fill-slate-400 font-mono font-medium"
                      >
                        {Math.round(maxDailyVolume * pct)}
                      </text>
                      {/* Right Y Axis Label (Pass Rate %) */}
                      <text
                        x={padLeft + plotWidth + 6}
                        y={y + 3.5}
                        textAnchor="start"
                        className="text-[11px] fill-teal-500 dark:fill-teal-400 font-mono font-semibold"
                      >
                        {Math.round(pct * 100)}%
                      </text>
                    </g>
                  )
                })}

                {/* 50% Benchmark Reference Line */}
                <line
                  x1={padLeft}
                  y1={padTop + plotHeight * 0.5}
                  x2={padLeft + plotWidth}
                  y2={padTop + plotHeight * 0.5}
                  stroke="#eab308"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />

                {/* 3D Stacked Columns */}
                {dailyTrends.map((d, idx) => {
                  const slotWidth = plotWidth / dailyTrends.length
                  const barWidth = Math.min(18, Math.max(7, slotWidth * 0.65))
                  const cx = padLeft + idx * slotWidth + slotWidth / 2
                  const x = cx - barWidth / 2

                  const totalH = (d.total / maxDailyVolume) * plotHeight
                  const passH = (d.pass / maxDailyVolume) * plotHeight
                  const failH = totalH - passH

                  const passY = padTop + plotHeight - passH
                  const failY = passY - failH

                  const isHovered = hoveredDay?.date === d.date
                  const isoDx = is3DMode ? 5 : 0
                  const isoDy = is3DMode ? -4 : 0

                  return (
                    <g
                      key={d.date}
                      className="cursor-pointer transition-transform"
                      style={{
                        transform: isHovered && is3DMode ? 'translateY(-3px)' : 'none',
                        transition: 'transform 0.15s ease-out',
                      }}
                      onMouseEnter={() => setHoveredDay(d)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      {/* Hover column backdrop */}
                      {isHovered && (
                        <rect
                          x={cx - slotWidth / 2}
                          y={padTop - 8}
                          width={slotWidth}
                          height={plotHeight + 16}
                          fill="currentColor"
                          className="text-teal-500/10"
                        />
                      )}

                      {/* 3D Floor Shadow */}
                      {is3DMode && totalH > 0 && (
                        <ellipse
                          cx={cx + isoDx / 2}
                          cy={padTop + plotHeight + 2}
                          rx={barWidth * 0.75}
                          ry={2.5}
                          fill="#000000"
                          opacity={isHovered ? 0.6 : 0.4}
                        />
                      )}

                      {/* 1. Pass Segment (Green) */}
                      {passH > 0 && (
                        <g>
                          {/* Front Face */}
                          <rect
                            x={x}
                            y={passY}
                            width={barWidth}
                            height={passH}
                            rx={!is3DMode && failH === 0 ? 3 : 0}
                            fill="url(#barPassGrad)"
                            opacity={isHovered ? 1 : 0.92}
                          />

                          {/* 3D Right Side Facet */}
                          {is3DMode && (
                            <polygon
                              points={`${x + barWidth},${passY} ${x + barWidth + isoDx},${passY + isoDy} ${x + barWidth + isoDx},${passY + passH + isoDy} ${x + barWidth},${passY + passH}`}
                              fill="#047857"
                              opacity={0.95}
                            />
                          )}

                          {/* 3D Top Cap (only if no fail segment on top) */}
                          {is3DMode && failH === 0 && (
                            <polygon
                              points={`${x},${passY} ${x + isoDx},${passY + isoDy} ${x + barWidth + isoDx},${passY + isoDy} ${x + barWidth},${passY}`}
                              fill="#6ee7b7"
                            />
                          )}
                        </g>
                      )}

                      {/* 2. Fail Segment (Red/Coral) */}
                      {failH > 0 && (
                        <g>
                          {/* Front Face */}
                          <rect
                            x={x}
                            y={failY}
                            width={barWidth}
                            height={failH}
                            rx={!is3DMode ? 3 : 0}
                            fill="url(#barFailGrad)"
                            opacity={isHovered ? 1 : 0.9}
                          />

                          {/* 3D Right Side Facet */}
                          {is3DMode && (
                            <polygon
                              points={`${x + barWidth},${failY} ${x + barWidth + isoDx},${failY + isoDy} ${x + barWidth + isoDx},${failY + failH + isoDy} ${x + barWidth},${failY + failH}`}
                              fill="#9f1239"
                              opacity={0.95}
                            />
                          )}

                          {/* 3D Top Diamond Cap */}
                          {is3DMode && (
                            <polygon
                              points={`${x},${failY} ${x + isoDx},${failY + isoDy} ${x + barWidth + isoDx},${failY + isoDy} ${x + barWidth},${failY}`}
                              fill="#fda4af"
                            />
                          )}
                        </g>
                      )}

                      {/* X-axis date tick */}
                      {(dailyTrends.length <= 16 || idx % 2 === 0) && (
                        <text
                          x={cx + (is3DMode ? isoDx / 2 : 0)}
                          y={padTop + plotHeight + 15}
                          textAnchor="middle"
                          className={cn(
                            'text-[11px] font-mono',
                            isHovered
                              ? 'fill-teal-500 font-bold'
                              : 'fill-slate-500 dark:fill-slate-400 font-medium'
                          )}
                        >
                          {d.dayNum}
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* 3D Trend Area Glow (Only in 3D Mode) */}
                {is3DMode && dailyTrends.length > 1 && (
                  <path
                    d={`${dailyTrends
                      .map((d, idx) => {
                        const slotWidth = plotWidth / dailyTrends.length
                        const cx = padLeft + idx * slotWidth + slotWidth / 2 + (is3DMode ? 2.5 : 0)
                        const cy = padTop + plotHeight * (1 - d.passRate / 100) + (is3DMode ? -2 : 0)
                        return `${idx === 0 ? 'M' : 'L'} ${cx} ${cy}`
                      })
                      .join(' ')} L ${padLeft + (dailyTrends.length - 1) * (plotWidth / dailyTrends.length) + (plotWidth / dailyTrends.length) / 2 + 2.5} ${padTop + plotHeight} L ${padLeft + (plotWidth / dailyTrends.length) / 2 + 2.5} ${padTop + plotHeight} Z`}
                    fill="url(#areaGlow3d)"
                  />
                )}

                {/* Trend Line: Pass Rate % */}
                {dailyTrends.length > 1 && (
                  <>
                    <path
                      d={dailyTrends
                        .map((d, idx) => {
                          const slotWidth = plotWidth / dailyTrends.length
                          const cx = padLeft + idx * slotWidth + slotWidth / 2 + (is3DMode ? 2.5 : 0)
                          const cy = padTop + plotHeight * (1 - d.passRate / 100) + (is3DMode ? -2 : 0)
                          return `${idx === 0 ? 'M' : 'L'} ${cx} ${cy}`
                        })
                        .join(' ')}
                      fill="none"
                      stroke="url(#lineGrad)"
                      strokeWidth={is3DMode ? '2.8' : '2.2'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter={is3DMode ? 'url(#glow3d)' : undefined}
                    />

                    {/* 3D Spheres or Points on Line */}
                    {dailyTrends.map((d, idx) => {
                      const slotWidth = plotWidth / dailyTrends.length
                      const cx = padLeft + idx * slotWidth + slotWidth / 2 + (is3DMode ? 2.5 : 0)
                      const cy = padTop + plotHeight * (1 - d.passRate / 100) + (is3DMode ? -2 : 0)
                      const isHovered = hoveredDay?.date === d.date
                      return (
                        <circle
                          key={d.date}
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 5.5 : is3DMode ? 3.8 : 2.5}
                          fill={is3DMode ? 'url(#sphereGrad)' : isHovered ? '#38bdf8' : '#06b6d4'}
                          stroke="#ffffff"
                          strokeWidth={isHovered ? 2 : 1.2}
                          className="transition-all"
                        />
                      )
                    })}
                  </>
                )}
              </svg>
            )}

            {/* Hover Tooltip Card */}
            {hoveredDay && (
              <div className="absolute top-2 right-2 bg-slate-900/90 backdrop-blur-md text-white text-[11px] p-2.5 rounded-xl border border-teal-500/30 shadow-lg pointer-events-none space-y-1">
                <div className="font-bold text-teal-300 flex items-center gap-1.5">
                  <Calendar className="size-3" />
                  <span>
                    {isYearlyRange
                      ? `เดือน ${hoveredDay.label} (รวมทั้งเดือน)`
                      : toThaiDate(hoveredDay.date)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px]">
                  <span className="text-slate-300">รวมทั้งหมด:</span>
                  <strong className="font-mono text-right">{fmtNum(hoveredDay.total)} รายการ</strong>
                  <span className="text-emerald-400">ผ่านเกณฑ์:</span>
                  <strong className="font-mono text-emerald-400 text-right">
                    {fmtNum(hoveredDay.pass)} ({hoveredDay.passRate.toFixed(1)}%)
                  </strong>
                  <span className="text-rose-400">ไม่ตรง/ไม่มี DX:</span>
                  <strong className="font-mono text-rose-400 text-right">
                    {fmtNum(hoveredDay.fail + hoveredDay.noDx + hoveredDay.noMap)} รายการ
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Chart Legends & Compliance Breakdown */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-white/5 text-[11px]">
            {/* Legends */}
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <span className="size-2.5 rounded-xs bg-emerald-500" />
                <span>ผ่านเกณฑ์</span>
              </span>
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <span className="size-2.5 rounded-xs bg-rose-500" />
                <span>ไม่ตรงเกณฑ์</span>
              </span>
              <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                <span className="w-3.5 h-0.5 bg-cyan-400 inline-block" />
                <span>แนวโน้ม % ผ่าน</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="text-accent font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>ดูตารางตรวจละเอียด</span>
              <ArrowUpRight className="size-3" />
            </button>
          </div>
        </div>

        {/* Right 5 Cols: Top 5 Herbs & Top Clinics */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card A: Top 5 Herbs */}
          <div className="rounded-2xl bg-themed-card border border-themed p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill className="size-4 text-accent" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  5 อันดับยาสมุนไพรที่สั่งใช้สูงสุด
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('drugs')}
                className="text-[11px] font-semibold text-accent hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>ดูทั้งหมด</span>
                <ArrowUpRight className="size-3" />
              </button>
            </div>

            <div className="space-y-2">
              {topHerbs.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">ไม่มีข้อมูลการสั่งจ่ายยา</div>
              ) : (
                topHerbs.map((d, index) => {
                  const drugPassPct = d.count > 0 ? (d.pass / d.count) * 100 : 0
                  const isPass = drugPassPct >= 50
                  const isWarning = drugPassPct >= 40 && drugPassPct < 50
                  return (
                    <div
                      key={d.icode}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-2 hover:border-teal-500/30 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'size-5 rounded-md text-[11px] font-bold grid place-items-center shrink-0 font-mono text-white',
                            index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-700' : 'bg-slate-500'
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className="font-semibold text-xs text-slate-900 dark:text-white truncate" title={d.name}>
                          {d.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                          {fmtNum(d.count)} <span className="font-normal text-[11px] text-slate-400">รายการ</span>
                        </span>
                        <span
                          className={cn(
                            'text-[11px] font-bold px-1.5 py-0.5 rounded font-mono border',
                            isPass
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : isWarning
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          )}
                          title={`ผ่านเกณฑ์ ${d.pass}/${d.count} รายการ (${drugPassPct.toFixed(1)}%) - เป้าหมาย สธ. ≥ 50%`}
                        >
                          {drugPassPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Card B: Top Prescribing Departments */}
          <div className="rounded-2xl bg-themed-card border border-themed p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-accent" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  แผนกที่มีการสั่งจ่ายยาสูงสุด
                </h3>
              </div>
              <span className="text-[10.5px] text-slate-400">สัดส่วนในรอบที่เลือก</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {topDepartments.map((dept) => {
                const pctOfTotal = records.length > 0 ? Math.round((dept.count / records.length) * 100) : 0
                const barWidthPct = Math.round((dept.count / maxDeptCount) * 100)
                return (
                  <div
                    key={dept.name}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex flex-col justify-between gap-1.5 hover:border-teal-500/30 transition group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-slate-700 dark:text-slate-300 text-[11px] font-medium" title={dept.name}>
                        {dept.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
                        <strong className="text-accent font-bold">{fmtNum(dept.count)}</strong>
                        <span className="text-[11px] text-slate-400 font-normal">({pctOfTotal}%)</span>
                      </div>
                    </div>
                    {/* Visual Proportion Bar */}
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${Math.max(barWidthPct, 4)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. COMPACT QUICK LAUNCHPAD TOOLBAR                                        */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="size-3.5 text-accent" />
            <span>ศูนย์ปฏิบัติการทางลัด (Quick Launchpad)</span>
          </span>
          <span className="text-[11px] text-slate-400">เข้าถึงฟังก์ชันงานได้ทันที</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('audit')}
            className="p-3 rounded-xl bg-themed-card border border-themed hover:border-teal-500/40 text-left transition hover:shadow-xs cursor-pointer group flex items-center gap-3"
          >
            <div className="size-9 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
              <ClipboardCheck className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400">
                ตรวจสอบเวชระเบียน
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                ตารางตรวจสอบรหัสโรค
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('drugs')}
            className="p-3 rounded-xl bg-themed-card border border-themed hover:border-cyan-500/40 text-left transition hover:shadow-xs cursor-pointer group flex items-center gap-3"
          >
            <div className="size-9 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
              <Pill className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                สรุปการจ่ายยา & ต้นทุน
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                วิเคราะห์ยอดจ่าย OPD / IPD
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('dxwriteback')}
            className="p-3 rounded-xl bg-themed-card border border-rose-500/25 hover:border-rose-500/50 text-left transition hover:shadow-xs cursor-pointer group flex items-center gap-3 bg-rose-50/10 dark:bg-rose-950/10"
          >
            <div className="size-9 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
              <Send className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-rose-600 dark:group-hover:text-rose-400">
                ทบทวนเคสไม่ตรง ({fmtNum(problemCount)})
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                คิวตรวจสอบและแก้ไขผล
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('dxmap')}
            className="p-3 rounded-xl bg-themed-card border border-themed hover:border-violet-500/40 text-left transition hover:shadow-xs cursor-pointer group flex items-center gap-3"
          >
            <div className="size-9 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
              <Settings2 className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400">
                ตั้งค่าเกณฑ์ ICD-10
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                จับคู่ยาสมุนไพรกับข้อบ่งใช้
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. EXECUTIVE DRILL-DOWN MODAL (รายชื่อผู้ป่วย & ประวัติสั่งยาตาม BOX)         */}
      {/* ========================================================================= */}
      {activeDrillDown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-5xl rounded-2xl bg-white dark:bg-[#0c1424] border border-slate-200/90 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'size-10 rounded-xl grid place-items-center shrink-0 border',
                    activeDrillDown === 'PASS'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : activeDrillDown === 'TOTAL'
                      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                      : activeDrillDown === 'PATIENTS'
                      ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  )}
                >
                  {activeDrillDown === 'PASS' && <CheckCircle2 className="size-5" />}
                  {activeDrillDown === 'TOTAL' && <Pill className="size-5" />}
                  {activeDrillDown === 'PATIENTS' && <Users className="size-5" />}
                  {activeDrillDown === 'PROBLEMS' && <AlertTriangle className="size-5" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                      {activeDrillDown === 'PASS' && 'รายการสั่งจ่ายยาสมุนไพรที่ผ่านเกณฑ์'}
                      {activeDrillDown === 'TOTAL' && 'รายการสั่งจ่ายยาสมุนไพรทั้งหมด'}
                      {activeDrillDown === 'PATIENTS' && 'รายชื่อผู้รับบริการที่ได้รับยาสมุนไพร'}
                      {activeDrillDown === 'PROBLEMS' && 'รายการสั่งจ่ายยาสมุนไพรที่ต้องทบทวนแก้ไข'}
                    </h3>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-bold font-mono border',
                        activeDrillDown === 'PASS'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                          : activeDrillDown === 'TOTAL'
                          ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                          : activeDrillDown === 'PATIENTS'
                          ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
                      )}
                    >
                      {activeDrillDown === 'PATIENTS'
                        ? `${fmtNum(drillDownPatients.length)} ราย`
                        : `${fmtNum(drillDownPrescriptions.length)} รายการ`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ช่วงวันที่ {toThaiDate(range.startDate)} ถึง {toThaiDate(range.endDate)} • โรงพยาบาลพังโคน
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportDrillDownExcel}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 transition cursor-pointer flex items-center gap-1.5"
                  title="ดาวน์โหลดข้อมูลเป็นไฟล์ Excel"
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">ส่งออก Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrillDown(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
                  title="ปิดหน้าต่าง (ESC)"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Toolbar: Search & Scope Filter */}
            <div className="p-3 sm:px-5 border-b border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0c1424]">
              {/* Search */}
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={drillDownSearch}
                  onChange={(e) => {
                    setDrillDownSearch(e.target.value)
                    setDrillDownPage(0)
                  }}
                  placeholder={
                    activeDrillDown === 'PATIENTS'
                      ? 'ค้นหา HN, ชื่อผู้ป่วย, รายการยา หรือแผนก…'
                      : 'ค้นหา HN, ผู้ป่วย, รายการยา, แพทย์, PDX…'
                  }
                  className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
                {drillDownSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrillDownSearch('')
                      setDrillDownPage(0)
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Scope filter (for prescriptions) */}
              {activeDrillDown !== 'PATIENTS' && (
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 text-xs">
                  {(['ALL', 'OPD', 'IPD'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setDrillDownScope(s)
                        setDrillDownPage(0)
                      }}
                      className={cn(
                        'px-2.5 py-1 rounded-lg font-medium transition cursor-pointer',
                        drillDownScope === s
                          ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 font-bold shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      {s === 'ALL' ? 'ทั้งหมด' : s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-auto divide-y divide-slate-100 dark:divide-white/5">
              {activeDrillDown === 'PATIENTS' ? (
                // PATIENTS VIEW
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[170px]">ผู้รับบริการ / HN</th>
                      <th className="py-2.5 px-3 text-center">ครั้งรับบริการ (VN)</th>
                      <th className="py-2.5 px-3 text-center">รายการยา</th>
                      <th className="py-2.5 px-3 min-w-[200px]">ยาสมุนไพรที่ได้รับ</th>
                      <th className="py-2.5 px-3 min-w-[130px]">แผนกที่รับบริการ</th>
                      <th className="py-2.5 px-3 text-center min-w-[100px]">วันที่ล่าสุด</th>
                      <th className="py-2.5 px-3 text-center">ผลตรวจ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-sans">
                    {paginatedPatients.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          ไม่พบข้อมูลผู้รับบริการที่ตรงกับเงื่อนไข
                        </td>
                      </tr>
                    ) : (
                      paginatedPatients.map((p, idx) => (
                        <tr
                          key={p.hn}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                            {drillDownPage * drillDownPageSize + idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {p.patientName}
                            </div>
                            <div className="text-[10.5px] font-mono text-teal-600 dark:text-teal-400 font-semibold mt-0.5">
                              HN: {p.hn}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-200">
                            {p.visitCount} ครั้ง
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                            {p.prescriptionsCount} รายการ
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[260px]">
                              {p.drugs.map((d, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[10.5px] border border-slate-200/80 dark:border-white/10"
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 text-[11px]">
                            {p.departments.join(', ') || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                            {toThaiDate(p.latestDate)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {p.hasProblem ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                <AlertTriangle className="size-3 text-rose-500" /> มีรายการไม่ตรง
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="size-3 text-emerald-500" /> ผ่านเกณฑ์
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                // PRESCRIPTIONS VIEW (PASS, TOTAL, PROBLEMS)
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[90px]">วันที่ / เวลา</th>
                      <th className="py-2.5 px-3 min-w-[150px]">ผู้รับบริการ / HN</th>
                      <th className="py-2.5 px-3 min-w-[180px]">รายการยาสมุนไพร</th>
                      <th className="py-2.5 px-3 min-w-[110px]">แผนก</th>
                      <th className="py-2.5 px-3 min-w-[120px]">แพทย์ผู้สั่ง</th>
                      <th className="py-2.5 px-3 min-w-[80px]">รหัสโรค (PDX)</th>
                      <th className="py-2.5 px-3 text-center min-w-[120px]">ผลการตรวจสอบ</th>
                      <th className="py-2.5 px-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-sans">
                    {paginatedPrescriptions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          ไม่พบรายการสั่งจ่ายยาที่ตรงกับเงื่อนไข
                        </td>
                      </tr>
                    ) : (
                      paginatedPrescriptions.map((r, idx) => {
                        const isFail = r.audit_result !== 'PASS'
                        return (
                          <tr
                            key={r.id || idx}
                            className={cn(
                              'hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors',
                              isFail && 'bg-rose-50/20 dark:bg-rose-950/[0.08]'
                            )}
                          >
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                              {drillDownPage * drillDownPageSize + idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono whitespace-nowrap text-[11px]">
                              <div className="text-slate-900 dark:text-slate-100 font-semibold">{toThaiDate(r.visit_date)}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="size-3" />
                                <span>{r.visit_time ? `${r.visit_time.substring(0, 5)} น.` : '-'}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 dark:text-white truncate max-w-[170px]">
                                {r.patient_name}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 text-[10px] font-mono">
                                <span className="px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 font-semibold">
                                  HN {r.hn}
                                </span>
                                <span className="text-slate-400">VN {r.vn}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {r.drug_name}
                              </div>
                              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                                จำนวน {fmtNum(r.drug_qty)} {r.drug_units || 'หน่วย'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 text-[11px] truncate max-w-[110px]">
                              {r.department_name || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 text-[11px] truncate max-w-[120px]">
                              {r.doctor_name || '-'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-xs">
                              {r.pdx ? (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                                  {r.pdx}
                                </span>
                              ) : (
                                <span className="text-rose-500 text-[11px] italic">ไม่มี DX</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isFail ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                    <XCircle className="size-3 text-rose-500" /> ไม่ผ่าน
                                  </span>
                                  {r.audit_reason && (
                                    <span className="text-[9.5px] text-rose-600 dark:text-rose-400 max-w-[130px] truncate">
                                      {r.audit_reason}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="size-3 text-emerald-500" /> ผ่านเกณฑ์
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedPatientRecord(r)}
                                className="p-1 rounded-lg text-slate-400 hover:text-teal-600 dark:hover:text-teal-300 hover:bg-teal-500/10 transition cursor-pointer"
                                title="ดูรายละเอียดเคสนี้"
                              >
                                <Eye className="size-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer: Pagination & Direct Actions */}
            <div className="p-3 sm:px-5 border-t border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-white/[0.02]">
              {/* Pagination */}
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span>
                  หน้า <strong className="font-mono text-slate-900 dark:text-white">{drillDownPage + 1}</strong> จาก{' '}
                  <strong className="font-mono text-slate-900 dark:text-white">{totalDrillDownPages}</strong>
                </span>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    disabled={drillDownPage === 0}
                    onClick={() => setDrillDownPage((p) => Math.max(0, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={drillDownPage >= totalDrillDownPages - 1}
                    onClick={() => setDrillDownPage((p) => Math.min(totalDrillDownPages - 1, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              {/* Direct Jump Buttons */}
              <div className="flex items-center gap-2">
                {activeDrillDown === 'PROBLEMS' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDrillDown(null)
                      onNavigate('dxwriteback')
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-450 text-white transition shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="size-3.5" />
                    <span>เปิดหน้าทบทวน DX (DxWriteback)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrillDown(null)
                    onNavigate('audit')
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <ExternalLink className="size-3.5" />
                  <span>เปิดดูในหน้าตรวจสอบการจ่ายยาเต็มรูปแบบ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SINGLE RECORD DETAIL OVERLAY (เมื่อคลิกดูรายละเอียดของรายการใดรายการหนึ่ง)   */}
      {/* ========================================================================= */}
      {selectedPatientRecord && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 grid place-items-center">
                  <User className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedPatientRecord.patient_name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
                    <span>HN: {selectedPatientRecord.hn}</span>
                    <span>•</span>
                    <span>VN: {selectedPatientRecord.vn}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatientRecord(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5">
                <div>
                  <span className="text-slate-400 block text-[11px]">วันที่รับบริการ</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {toThaiDate(selectedPatientRecord.visit_date)} {selectedPatientRecord.visit_time?.substring(0, 5)} น.
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">สิทธิการรักษา</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedPatientRecord.pttype_name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">แผนกที่รับบริการ</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedPatientRecord.department_name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">แพทย์ผู้สั่งใช้ยา</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedPatientRecord.doctor_name || '-'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                <span className="text-slate-400 block text-[11px]">รายการยาสมุนไพร</span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{selectedPatientRecord.drug_name}</span>
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                    {selectedPatientRecord.drug_qty} {selectedPatientRecord.drug_units || 'หน่วย'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 space-y-2">
                <span className="text-slate-400 block text-[11px]">รหัสวินิจฉัยโรค (ICD-10)</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    selectedPatientRecord.pdx ? { label: 'PDX', code: selectedPatientRecord.pdx } : null,
                    selectedPatientRecord.dx0 ? { label: 'DX0', code: selectedPatientRecord.dx0 } : null,
                    selectedPatientRecord.dx1 ? { label: 'DX1', code: selectedPatientRecord.dx1 } : null,
                    selectedPatientRecord.dx2 ? { label: 'DX2', code: selectedPatientRecord.dx2 } : null,
                    selectedPatientRecord.dx3 ? { label: 'DX3', code: selectedPatientRecord.dx3 } : null,
                    selectedPatientRecord.dx4 ? { label: 'DX4', code: selectedPatientRecord.dx4 } : null,
                    selectedPatientRecord.dx5 ? { label: 'DX5', code: selectedPatientRecord.dx5 } : null,
                  ]
                    .filter(Boolean)
                    .map((d, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20"
                      >
                        {d?.label}: {d?.code}
                      </span>
                    ))}
                </div>
              </div>

              <div
                className={cn(
                  'p-3.5 rounded-xl border space-y-1',
                  selectedPatientRecord.audit_result === 'PASS'
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-800 dark:text-rose-200'
                )}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  {selectedPatientRecord.audit_result === 'PASS' ? (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-500" />
                      <span>ผ่านเกณฑ์ — รหัสโรคตรงตามข้อบ่งใช้ยา</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4 text-rose-500" />
                      <span>ไม่ผ่านเกณฑ์ — {selectedPatientRecord.audit_reason || 'รหัสโรคไม่ตรงข้อบ่งใช้'}</span>
                    </>
                  )}
                </div>
                {selectedPatientRecord.allowed_dx && selectedPatientRecord.allowed_dx.length > 0 && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    รหัสที่ตรงเกณฑ์ของยานี้:{' '}
                    <span className="font-mono">{selectedPatientRecord.allowed_dx.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
