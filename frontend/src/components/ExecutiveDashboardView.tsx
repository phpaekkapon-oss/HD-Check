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
} from 'lucide-react'
import type {
  ActivePage,
  AuditRecord,
  AuditKpiMetrics,
  DateRange,
  DbStatus,
  DrugSummaryRecord,
} from '@/types/herbdx.types'
import { fmtNum, toThaiDate } from '@/lib/format'
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
  // Chart filter mode
  const [chartScope, setChartScope] = useState<'ALL' | 'OPD' | 'IPD'>('ALL')
  const [is3DMode, setIs3DMode] = useState<boolean>(true)
  const [hoveredDay, setHoveredDay] = useState<DailyTrendItem | null>(null)

  // Quick range presets
  const handleSelectMonthPreset = (preset: 'THIS_MONTH' | 'LAST_MONTH') => {
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
    } else {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const year = lastMonthDate.getFullYear()
      const month = lastMonthDate.getMonth() + 1
      const lastDay = new Date(year, month, 0).getDate()
      onRangeChange({
        startDate: `${year}-${pad(month)}-01`,
        endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
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

  // 1. Daily Trend Aggregation for SVG Chart
  const dailyTrends = useMemo<DailyTrendItem[]>(() => {
    if (scopedRecords.length === 0) return []

    const map = new Map<string, { pass: number; fail: number; noDx: number; noMap: number; total: number }>()

    for (const r of scopedRecords) {
      const d = r.visit_date
      if (!d) continue
      const current = map.get(d) || { pass: 0, fail: 0, noDx: 0, noMap: 0, total: 0 }
      current.total += 1
      if (r.audit_result === 'PASS') current.pass += 1
      else if (r.audit_result === 'FAIL') current.fail += 1
      else if (r.audit_result === 'NO_DX') current.noDx += 1
      else if (r.audit_result === 'NO_MAP') current.noMap += 1
      map.set(d, current)
    }

    const sortedDates = Array.from(map.keys()).sort()
    return sortedDates.map((dateStr) => {
      const item = map.get(dateStr)!
      const dateObj = new Date(dateStr)
      const dayNum = dateObj.getDate()
      const passRate = item.total > 0 ? (item.pass / item.total) * 100 : 0
      return {
        date: dateStr,
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
  }, [scopedRecords])

  // Maximum value for SVG scaling
  const maxDailyVolume = useMemo(() => {
    if (dailyTrends.length === 0) return 10
    const m = Math.max(...dailyTrends.map((d) => d.total))
    return Math.ceil(m * 1.15) || 10
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

  // SVG Chart Geometry Constants
  const chartHeight = 180
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
          <div className="size-10 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 grid place-items-center shrink-0">
            <Activity className="size-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>ภาพรวมการสั่งใช้ยาสมุนไพร</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-normal">
                รพ.พังโคน
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ตัวชี้วัดคุณภาพและความสอดคล้องรหัสโรค ICD-10
              {status?.latestVisitDate ? ` · วันที่ข้อมูล HOSxP: ${toThaiDate(status.latestVisitDate)}` : ''}
              {drugs.length > 0 ? ` · ยาสมุนไพรในระบบ ${drugs.length} ชนิด` : ''}
            </p>
          </div>
        </div>

        {/* Date presets & Sync */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 text-xs">
            <button
              type="button"
              onClick={() => handleSelectMonthPreset('THIS_MONTH')}
              className="px-2.5 py-1 rounded-lg font-medium transition cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10"
            >
              เดือนนี้
            </button>
            <button
              type="button"
              onClick={() => handleSelectMonthPreset('LAST_MONTH')}
              className="px-2.5 py-1 rounded-lg font-medium transition cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10"
            >
              เดือนก่อน
            </button>
            <span className="px-2 py-0.5 text-[11px] font-mono text-teal-700 dark:text-teal-300 bg-teal-500/10 rounded-md border border-teal-500/20">
              {toThaiDate(range.startDate)} - {toThaiDate(range.endDate)}
            </span>
          </div>

          <button
            type="button"
            disabled={isSyncing}
            onClick={onSync}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="ดึงข้อมูลล่าสุดจาก HOSxP"
          >
            <RefreshCw className={cn('size-3.5', isSyncing && 'animate-spin')} />
            <span className="hidden sm:inline">{isSyncing ? 'กำลังซิงค์…' : 'ซิงค์ HOSxP'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. COMPACT 4 EXECUTIVE KPI CARDS                                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Pass Rate */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-themed-card border border-themed shadow-xs transition hover:border-emerald-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">อัตราผ่านเกณฑ์</span>
            <div className="size-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center">
              <CheckCircle2 className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {passRate.toFixed(1)}%
            </span>
            <span className={cn('text-[11px] font-semibold', passRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500')}>
              {passRate >= 50 ? '✓ บรรลุเป้าหมาย' : '⚠️ ต่ำกว่าเป้า'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>ผ่าน {fmtNum(passCount)} / {fmtNum(totalPrescriptions)}</span>
            <span className="text-slate-400">เป้า &ge; 50%</span>
          </div>
          <div className="mt-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, passRate))}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Total Volume */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-themed-card border border-themed shadow-xs transition hover:border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">ยอดสั่งจ่ายสมุนไพร</span>
            <div className="size-7 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 grid place-items-center">
              <Pill className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
              <AnimatedNumber value={totalPrescriptions} />
            </span>
            <span className="text-xs text-slate-500">ใบ</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono">
              OPD: {fmtNum(opdCount)}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono">
              IPD: {fmtNum(ipdCount)}
            </span>
          </div>
        </div>

        {/* KPI 3: Unique Patients */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-themed-card border border-themed shadow-xs transition hover:border-teal-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">จำนวนผู้รับบริการ</span>
            <div className="size-7 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 grid place-items-center">
              <Users className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
              <AnimatedNumber value={uniquePatients} />
            </span>
            <span className="text-xs text-slate-500">ราย</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            เฉลี่ยการรับยา{' '}
            <strong className="text-teal-600 dark:text-teal-400 font-mono">
              {uniquePatients > 0 ? (totalPrescriptions / uniquePatients).toFixed(1) : 0}
            </strong>{' '}
            ใบ/คน
          </div>
        </div>

        {/* KPI 4: Action Required */}
        <div
          onClick={() => onNavigate('dxwriteback')}
          className="p-3.5 sm:p-4 rounded-2xl bg-themed-card border border-rose-500/20 shadow-xs transition hover:border-rose-500/40 cursor-pointer group"
          title="คลิกเพื่อเข้าหน้าตรวจสอบเคสที่ไม่ตรงเกณฑ์"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">ต้องทบทวน / แก้ไข</span>
            <div className="size-7 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 grid place-items-center group-hover:scale-105 transition-transform">
              <AlertTriangle className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight font-mono">
              <AnimatedNumber value={problemCount} />
            </span>
            <span className="text-xs text-rose-500">
              ({totalPrescriptions > 0 ? ((problemCount / totalPrescriptions) * 100).toFixed(0) : 0}%)
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>ไม่ตรง {fmtNum(failCount)} · ไม่มี DX {fmtNum(noDxCount)}</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold group-hover:underline">เปิดดู &gt;</span>
          </div>
        </div>
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
                <TrendingUp className="size-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  แนวโน้มการสั่งใช้ยาและอัตราผ่านเกณฑ์รายวัน
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                กราฟแท่งแสดงจำนวนใบสั่งยา (ผ่าน vs ไม่ตรงเกณฑ์) ซ้อนเส้นแนวโน้มอัตราผ่าน (%)
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
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-teal-400/40 shadow-xs'
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
                      ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-2xs'
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
                      ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-2xs'
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
                      ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-2xs'
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
                        y={y + 3}
                        textAnchor="end"
                        className="text-[9px] fill-slate-400 font-mono"
                      >
                        {Math.round(maxDailyVolume * pct)}
                      </text>
                      {/* Right Y Axis Label (Pass Rate %) */}
                      <text
                        x={padLeft + plotWidth + 6}
                        y={y + 3}
                        textAnchor="start"
                        className="text-[9px] fill-teal-500 font-mono font-medium"
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
                          y={padTop + plotHeight + 14}
                          textAnchor="middle"
                          className={cn(
                            'text-[9px] font-mono',
                            isHovered
                              ? 'fill-teal-500 font-bold'
                              : 'fill-slate-400 dark:fill-slate-500'
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
                  <span>{toThaiDate(hoveredDay.date)}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px]">
                  <span className="text-slate-300">รวมทั้งหมด:</span>
                  <strong className="font-mono text-right">{fmtNum(hoveredDay.total)} ใบ</strong>
                  <span className="text-emerald-400">ผ่านเกณฑ์:</span>
                  <strong className="font-mono text-emerald-400 text-right">
                    {fmtNum(hoveredDay.pass)} ({hoveredDay.passRate.toFixed(1)}%)
                  </strong>
                  <span className="text-rose-400">ไม่ตรง/ไม่มี DX:</span>
                  <strong className="font-mono text-rose-400 text-right">
                    {fmtNum(hoveredDay.fail + hoveredDay.noDx + hoveredDay.noMap)} ใบ
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
              className="text-teal-600 dark:text-teal-400 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
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
                <Pill className="size-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  5 อันดับยาสมุนไพรที่สั่งใช้สูงสุด
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('drugs')}
                className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer flex items-center gap-0.5"
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
                  return (
                    <div
                      key={d.icode}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-2 hover:border-teal-500/30 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'size-5 rounded-md text-[10px] font-bold grid place-items-center shrink-0 font-mono text-white',
                            index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-700' : 'bg-slate-500'
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                          {d.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                          {fmtNum(d.count)} <span className="font-normal text-[10px] text-slate-400">ใบ</span>
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded font-mono',
                            drugPassPct >= 60
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          )}
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
                <Building2 className="size-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  แผนกที่มีการสั่งจ่ายยาสูงสุด
                </h3>
              </div>
              <span className="text-[10.5px] text-slate-400">สัดส่วนในรอบเดือน</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {topDepartments.map((dept) => (
                <div
                  key={dept.name}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-1"
                >
                  <span className="truncate text-slate-600 dark:text-slate-300 text-[11px] font-medium" title={dept.name}>
                    {dept.name}
                  </span>
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400 shrink-0 text-[11px]">
                    {fmtNum(dept.count)}
                  </span>
                </div>
              ))}
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
            <Layers className="size-3.5 text-teal-600 dark:text-teal-400" />
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
              <div className="text-[10px] text-slate-400 truncate">
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
              <div className="text-[10px] text-slate-400 truncate">
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
              <div className="text-[10px] text-slate-400 truncate">
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
              <div className="text-[10px] text-slate-400 truncate">
                จับคู่ยาสมุนไพรกับข้อบ่งใช้
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
