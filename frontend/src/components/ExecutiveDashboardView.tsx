import { useState, useMemo, type FC } from 'react'
import {
  Sparkles,
  Database,
  Building2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Pill,
  ClipboardCheck,
  ChevronRight,
  ArrowUpRight,
  Send,
  Settings2,
  Activity,
  Layers,
} from 'lucide-react'
import type {
  ActivePage,
  AuditRecord,
  AuditKpiMetrics,
  DateRange,
  DbStatus,
  DrugSummaryRecord,
} from '@/types/herbdx.types'
import { cleanDrugUnit } from '@/types/herbdx.types'
import { useAuth } from '@/context/AuthContext'
import { fmtNum, toThaiDate, toThaiDateLong, currentMonthRange } from '@/lib/format'
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
  const todayIso = new Date().toISOString().slice(0, 10)
  const todayThai = toThaiDateLong(todayIso)

  // Quick range helpers
  const handleSelectMonthPreset = (preset: 'THIS_MONTH' | 'LAST_MONTH') => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    if (preset === 'THIS_MONTH') {
      onRangeChange(currentMonthRange())
    } else {
      const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      const m = now.getMonth() === 0 ? 12 : now.getMonth()
      const lastDay = new Date(y, m, 0).getDate()
      onRangeChange({
        startDate: `${y}-${pad(m)}-01`,
        endDate: `${y}-${pad(m)}-${pad(lastDay)}`,
      })
    }
  }

  // Calculated Metrics
  const totalPrescriptions = kpi?.total ?? records.length
  const passCount = kpi?.pass ?? records.filter((r) => r.audit_result === 'PASS').length
  const failCount = kpi?.fail ?? records.filter((r) => r.audit_result === 'FAIL').length
  const noDxCount = kpi?.noDx ?? records.filter((r) => r.audit_result === 'NO_DX').length
  const noMapCount = kpi?.noMap ?? records.filter((r) => r.audit_result === 'NO_MAP').length
  const problemCount = failCount + noDxCount + noMapCount
  const passRate = totalPrescriptions > 0 ? (passCount / totalPrescriptions) * 100 : 0
  const uniquePatients = kpi?.uniquePatients ?? new Set(records.map((r) => r.hn)).size
  const totalUnits = kpi?.totalQty ?? records.reduce((s, r) => s + r.drug_qty, 0)

  // Patient Type Breakdown
  const opdRecords = useMemo(() => records.filter((r) => !r.vn.startsWith('AN:')), [records])
  const ipdRecords = useMemo(() => records.filter((r) => r.vn.startsWith('AN:')), [records])

  // Top 5 Prescribed Herbal Drugs
  const topHerbs = useMemo(() => {
    const map = new Map<string, { icode: string; name: string; count: number; pass: number; qty: number; unit?: string }>()
    for (const r of records) {
      const existing = map.get(r.drug_icode) || {
        icode: r.drug_icode,
        name: r.drug_name,
        count: 0,
        pass: 0,
        qty: 0,
        unit: r.drug_units,
      }
      existing.count += 1
      existing.qty += r.drug_qty
      if (r.audit_result === 'PASS') existing.pass += 1
      map.set(r.drug_icode, existing)
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [records])

  // Recent 4 Problem Records
  const recentProblems = useMemo(() => {
    return records
      .filter((r) => r.audit_result !== 'PASS')
      .slice(0, 4)
  }, [records])

  // Top Departments
  const topDepartments = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of records) {
      const dept = r.department_name || 'ไม่ระบุแผนก'
      map.set(dept, (map.get(dept) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, pct: totalPrescriptions > 0 ? (count / totalPrescriptions) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  }, [records, totalPrescriptions])

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE HERO BANNER                                                  */}
      {/* ========================================================================= */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#0e1626] to-[#0c1f2d] border border-teal-500/30 p-5 sm:p-6 shadow-xl overflow-hidden text-white">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Greeting & Hospital Branding */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-teal-400" />
                SMART-HOSCHECK • แดชบอร์ดภาพรวมผู้บริหาร
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                HOSxP Online
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <span>ภาพรวมการสั่งใช้ยาสมุนไพร</span>
              <span className="text-teal-400 font-normal text-base sm:text-lg">โรงพยาบาลพังโคน</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-2 flex-wrap">
              <span className="text-white font-medium">กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{todayThai}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">
                ผู้ล็อกอิน: <strong className="text-white">{user?.name || 'นายเอกพล อันคำวงศ์'}</strong>
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-teal-300 font-mono text-xs">
                ยาสมุนไพรในคลัง {fmtNum(drugs.length)} รายการ
                {status?.latestVisitDate ? ` · ข้อมูล HOSxP ล่าสุด ${toThaiDate(status.latestVisitDate)}` : ''}
              </span>
            </p>
          </div>

          {/* Date Range Selector & Sync Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleSelectMonthPreset('THIS_MONTH')}
                className="px-3 py-1.5 rounded-xl transition cursor-pointer text-slate-300 hover:text-white hover:bg-white/10"
              >
                เดือนนี้
              </button>
              <button
                type="button"
                onClick={() => handleSelectMonthPreset('LAST_MONTH')}
                className="px-3 py-1.5 rounded-xl transition cursor-pointer text-slate-400 hover:text-white hover:bg-white/10"
              >
                เดือนก่อน
              </button>
              <span className="px-2.5 py-1 text-[11px] font-mono text-teal-300 bg-teal-500/20 rounded-lg border border-teal-500/30">
                {toThaiDate(range.startDate)} - {toThaiDate(range.endDate)}
              </span>
            </div>

            <button
              type="button"
              disabled={isSyncing}
              onClick={onSync}
              className="px-4 py-2 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 disabled:opacity-60 transition shadow-lg shadow-teal-950/40 cursor-pointer flex items-center gap-2 active:scale-95"
              title="ดึงข้อมูลล่าสุดจากฐานข้อมูล HOSxP"
            >
              <RefreshCw className={cn('size-3.5', isSyncing && 'animate-spin')} />
              <span>{isSyncing ? 'กำลังซิงค์ข้อมูล…' : 'ซิงค์ HOSxP'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FOUR EXECUTIVE KPI METRIC CARDS                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pass Rate (%) */}
        <div className="relative rounded-2xl bg-themed-card border border-themed p-5 shadow-xs transition-all hover:shadow-md hover:border-emerald-500/40 group overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              อัตราผ่านเกณฑ์ข้อบ่งใช้
            </span>
            <div className="size-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 grid place-items-center">
              <CheckCircle2 className="size-4.5" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {passRate.toFixed(1)}%
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ผ่าน {fmtNum(passCount)} รายการ
            </span>
          </div>

          {/* Custom Mini Progress Bar */}
          <div className="mt-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, passRate))}%` }}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>เป้าหมายมาตรฐาน &ge; 50%</span>
            <span className={cn('font-bold', passRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500')}>
              {passRate >= 50 ? '✓ ผ่านเกณฑ์เป้าหมาย' : '⚠️ ต่ำกว่าเป้าหมาย'}
            </span>
          </div>
        </div>

        {/* KPI 2: Total Prescriptions */}
        <div className="relative rounded-2xl bg-themed-card border border-themed p-5 shadow-xs transition-all hover:shadow-md hover:border-teal-500/40 group overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ยอดจ่ายยาสมุนไพรทั้งหมด
            </span>
            <div className="size-8 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 grid place-items-center">
              <Pill className="size-4.5" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              <AnimatedNumber value={totalPrescriptions} />
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              รายการ ({fmtNum(totalUnits)} หน่วย)
            </span>
          </div>

          {/* OPD vs IPD Split Pills */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">ผู้ป่วยนอก OPD</span>
              <strong className="text-slate-900 dark:text-white font-mono">{fmtNum(opdRecords.length)}</strong>
            </div>
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">ผู้ป่วยใน IPD</span>
              <strong className="text-slate-900 dark:text-white font-mono">{fmtNum(ipdRecords.length)}</strong>
            </div>
          </div>
        </div>

        {/* KPI 3: Unique Patients */}
        <div className="relative rounded-2xl bg-themed-card border border-themed p-5 shadow-xs transition-all hover:shadow-md hover:border-cyan-500/40 group overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ผู้รับบริการ (Patients)
            </span>
            <div className="size-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 grid place-items-center">
              <Users className="size-4.5" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              <AnimatedNumber value={uniquePatients} />
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">ราย (คน)</span>
          </div>

          <div className="mt-3 p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between">
            <span>เฉลี่ยต่อผู้ป่วย 1 ราย:</span>
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
              {uniquePatients > 0 ? (totalPrescriptions / uniquePatients).toFixed(1) : '0'} ขนานยา
            </span>
          </div>
        </div>

        {/* KPI 4: Pending Action / Problem Cases */}
        <div className="relative rounded-2xl bg-themed-card border border-rose-500/30 dark:border-rose-500/25 p-5 shadow-xs transition-all hover:shadow-md hover:border-rose-500/50 group overflow-hidden bg-rose-50/20 dark:bg-rose-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              เคสที่ต้องทบทวน / แก้ไข
            </span>
            <div className="size-8 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 grid place-items-center">
              <AlertTriangle className="size-4.5" />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
              <AnimatedNumber value={problemCount} />
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              รายการ ({totalPrescriptions > 0 ? ((problemCount / totalPrescriptions) * 100).toFixed(1) : 0}%)
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
            <span>DX ไม่ตรง {fmtNum(failCount)} • ว่าง {fmtNum(noDxCount)}</span>
            <button
              type="button"
              onClick={() => onNavigate('dxwriteback')}
              className="font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <span>ไปทบทวน</span>
              <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. VISUAL ANALYTICS: DONUT / PROGRESS & TOP 5 HERBAL DRUGS                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Panel A: Audit Results Breakdown */}
        <div className="rounded-3xl bg-themed-card border border-themed p-5 sm:p-6 shadow-xs flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 grid place-items-center">
                  <Activity className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    สัดส่วนผลการตรวจสอบความถูกต้อง
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    การจับคู่รหัสโรค ICD-10 ตามข้อบ่งใช้ยาสมุนไพร
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('audit')}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>ดูตารางตรวจ</span>
                <ArrowUpRight className="size-3.5" />
              </button>
            </div>

            {/* Segmented Visual Stacked Bar */}
            <div className="mt-5 space-y-2">
              <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex shadow-inner">
                {passCount > 0 && (
                  <div
                    style={{ width: `${(passCount / totalPrescriptions) * 100}%` }}
                    className="bg-emerald-500 hover:bg-emerald-400 transition-all"
                    title={`ผ่านเกณฑ์: ${passCount} รายการ (${((passCount / totalPrescriptions) * 100).toFixed(1)}%)`}
                  />
                )}
                {failCount > 0 && (
                  <div
                    style={{ width: `${(failCount / totalPrescriptions) * 100}%` }}
                    className="bg-rose-500 hover:bg-rose-400 transition-all"
                    title={`DX ไม่ตรงข้อบ่งใช้: ${failCount} รายการ (${((failCount / totalPrescriptions) * 100).toFixed(1)}%)`}
                  />
                )}
                {noDxCount > 0 && (
                  <div
                    style={{ width: `${(noDxCount / totalPrescriptions) * 100}%` }}
                    className="bg-amber-500 hover:bg-amber-400 transition-all"
                    title={`ไม่มีรหัสวินิจฉัย (ว่าง): ${noDxCount} รายการ (${((noDxCount / totalPrescriptions) * 100).toFixed(1)}%)`}
                  />
                )}
                {noMapCount > 0 && (
                  <div
                    style={{ width: `${(noMapCount / totalPrescriptions) * 100}%` }}
                    className="bg-slate-400 hover:bg-slate-300 transition-all"
                    title={`ยังไม่ได้กำหนดเกณฑ์: ${noMapCount} รายการ (${((noMapCount / totalPrescriptions) * 100).toFixed(1)}%)`}
                  />
                )}
              </div>

              {/* Status Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="size-2 rounded-full bg-emerald-500 mx-auto mb-1" />
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">ผ่านเกณฑ์ (Pass)</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {fmtNum(passCount)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {totalPrescriptions > 0 ? ((passCount / totalPrescriptions) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <div className="size-2 rounded-full bg-rose-500 mx-auto mb-1" />
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">DX ไม่ตรงข้อบ่งใช้</div>
                  <div className="text-base font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                    {fmtNum(failCount)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {totalPrescriptions > 0 ? ((failCount / totalPrescriptions) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="size-2 rounded-full bg-amber-500 mx-auto mb-1" />
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">ไม่มีรหัสวินิจฉัย</div>
                  <div className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    {fmtNum(noDxCount)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {totalPrescriptions > 0 ? ((noDxCount / totalPrescriptions) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-500/10 border border-slate-500/20 text-center">
                  <div className="size-2 rounded-full bg-slate-400 mx-auto mb-1" />
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">ยังไม่กำหนดเกณฑ์</div>
                  <div className="text-base font-bold text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                    {fmtNum(noMapCount)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {totalPrescriptions > 0 ? ((noMapCount / totalPrescriptions) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Executive Insight Box */}
          <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2.5">
            <Sparkles className="size-4 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
            <div className="leading-relaxed">
              <strong>ข้อแนะนำเชิงบริหาร:</strong> ตรวจพบเคสที่ไม่มีรหัสโรค (No DX) ถึง{' '}
              <strong className="text-amber-600 dark:text-amber-400 font-mono">
                {totalPrescriptions > 0 ? ((noDxCount / totalPrescriptions) * 100).toFixed(1) : 0}%
              </strong>{' '}
              แนะนำให้สื่อสารแพทย์ผู้สั่งตรวจให้บันทึก PDX/DX คู่กับการสั่งจ่ายยาสมุนไพรเสมอ เพื่อให้ผ่านเกณฑ์การตรวจสอบของ สปสช.
            </div>
          </div>
        </div>

        {/* Panel B: Top 5 Prescribed Herbal Drugs */}
        <div className="rounded-3xl bg-themed-card border border-themed p-5 sm:p-6 shadow-xs flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 grid place-items-center">
                  <TrendingUp className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    5 อันดับยาสมุนไพรที่มีการสั่งใช้สูงสุด
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    เรียงตามจำนวนครั้งที่สั่งจ่ายในรอบเดือนนี้
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('drugs')}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>ดูสรุปยาทั้งหมด</span>
                <ArrowUpRight className="size-3.5" />
              </button>
            </div>

            {/* Drug Ranking List */}
            <div className="mt-4 space-y-3">
              {topHerbs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">ยังไม่มีข้อมูลการสั่งจ่ายยาในรอบนี้</div>
              ) : (
                topHerbs.map((d, index) => {
                  const drugPassPct = d.count > 0 ? (d.pass / d.count) * 100 : 0
                  const sharePct = totalPrescriptions > 0 ? (d.count / totalPrescriptions) * 100 : 0

                  return (
                    <div
                      key={d.icode}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 hover:border-teal-500/30 transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              'size-6 rounded-lg grid place-items-center text-xs font-bold shrink-0 font-mono shadow-xs',
                              index === 0 ? 'bg-amber-500 text-white shadow-amber-500/30' :
                              index === 1 ? 'bg-slate-400 text-white' :
                              index === 2 ? 'bg-amber-700 text-white' :
                              'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            )}
                          >
                            {index + 1}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                            {d.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {fmtNum(d.count)} <span className="font-normal text-[11px] text-slate-500">ครั้ง</span>
                          </span>
                          <span
                            className={cn(
                              'text-[10.5px] font-bold px-2 py-0.5 rounded-full font-mono',
                              drugPassPct >= 60
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            )}
                          >
                            ผ่าน {drugPassPct.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar showing share of total */}
                      <div className="w-full bg-slate-200/80 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-teal-500 to-cyan-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, sharePct * 2))}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Top Departments breakdown */}
          {topDepartments.length > 0 && (
            <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-teal-500" />
                  <span>แผนกที่มีการสั่งจ่ายยาสูงสุด:</span>
                </span>
                <span className="text-[10.5px] font-normal text-slate-400">สัดส่วนในรอบเดือน</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {topDepartments.map((dept) => (
                  <div key={dept.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-100/60 dark:bg-white/5">
                    <span className="truncate text-slate-600 dark:text-slate-300 font-medium" title={dept.name}>
                      {dept.name}
                    </span>
                    <span className="font-mono font-bold text-teal-600 dark:text-teal-400 shrink-0 ml-1">
                      {fmtNum(dept.count)} <span className="font-normal text-[10px] text-slate-400">ใบ</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
            สัดส่วนการใช้ยาสมุนไพรอิงตามฐานข้อมูลเวชระเบียนโรงพยาบาลพังโคน
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. QUICK LAUNCHPAD (ศูนย์ปฏิบัติการทางลัด 4 ประตู)                         */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="size-4 text-teal-600 dark:text-teal-400" />
            <span>ศูนย์ปฏิบัติการทางลัด (Quick Launchpad)</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">เข้าถึงฟังก์ชันสำคัญได้ในคลิกเดียว</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Action 1: Audit Queue */}
          <button
            type="button"
            onClick={() => onNavigate('audit')}
            className="p-5 rounded-3xl bg-themed-card border border-themed hover:border-teal-500/40 text-left transition-all hover:shadow-lg group cursor-pointer flex flex-col justify-between gap-4"
          >
            <div className="flex items-start justify-between">
              <div className="size-11 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 grid place-items-center group-hover:scale-105 transition-transform">
                <ClipboardCheck className="size-5.5" />
              </div>
              <ArrowUpRight className="size-4 text-slate-400 group-hover:text-teal-500 transition-colors" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                ตรวจสอบเวชระเบียนยาสมุนไพร
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                ดูตารางตรวจสอบจับคู่รหัสโรค ICD-10 ละเอียดทุกใบสั่งยา ({fmtNum(totalPrescriptions)} รายการ)
              </p>
            </div>
          </button>

          {/* Action 2: Drug Summary */}
          <button
            type="button"
            onClick={() => onNavigate('drugs')}
            className="p-5 rounded-3xl bg-themed-card border border-themed hover:border-cyan-500/40 text-left transition-all hover:shadow-lg group cursor-pointer flex flex-col justify-between gap-4"
          >
            <div className="flex items-start justify-between">
              <div className="size-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 grid place-items-center group-hover:scale-105 transition-transform">
                <Pill className="size-5.5" />
              </div>
              <ArrowUpRight className="size-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                สรุปรายงานการจ่ายยาและต้นทุน
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                วิเคราะห์ปริมาณจ่ายยา แยก OPD / IPD และยอดต้นทุนยาแผนไทย
              </p>
            </div>
          </button>

          {/* Action 3: Review Queue */}
          <button
            type="button"
            onClick={() => onNavigate('dxwriteback')}
            className="p-5 rounded-3xl bg-themed-card border border-rose-500/25 hover:border-rose-500/50 text-left transition-all hover:shadow-lg group cursor-pointer flex flex-col justify-between gap-4 bg-rose-50/10 dark:bg-rose-950/10"
          >
            <div className="flex items-start justify-between">
              <div className="size-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 grid place-items-center group-hover:scale-105 transition-transform">
                <Send className="size-5.5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 font-mono">
                {fmtNum(problemCount)} เคส
              </span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                ทบทวนเคสที่ไม่ตรงเกณฑ์
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                คัดกรองเคสที่มีข้อบ่งใช้ไม่ตรง เพื่อเตรียมการตรวจสอบและแก้ไขผล
              </p>
            </div>
          </button>

          {/* Action 4: Rules & Settings */}
          <button
            type="button"
            onClick={() => onNavigate('dxmap')}
            className="p-5 rounded-3xl bg-themed-card border border-themed hover:border-violet-500/40 text-left transition-all hover:shadow-lg group cursor-pointer flex flex-col justify-between gap-4"
          >
            <div className="flex items-start justify-between">
              <div className="size-11 rounded-2xl bg-violet-500/15 border border-violet-500/30 text-violet-600 dark:text-violet-400 grid place-items-center group-hover:scale-105 transition-transform">
                <Settings2 className="size-5.5" />
              </div>
              <ArrowUpRight className="size-4 text-slate-400 group-hover:text-violet-500 transition-colors" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                ตั้งค่าเกณฑ์ยา ↔ ICD-10
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                ปรับแต่งข้อบ่งใช้ของยาสมุนไพรแต่ละตัวให้ตรงตามคู่มือกรมฯ
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. RECENT PROBLEM CASES QUICK PREVIEW                                     */}
      {/* ========================================================================= */}
      {recentProblems.length > 0 && (
        <div className="rounded-3xl bg-themed-card border border-themed p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 grid place-items-center">
                <AlertTriangle className="size-4.5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  ตัวอย่างเคสที่พบปัญหาล่าสุด (รอการทบทวน)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  รายการสั่งจ่ายยาที่ไม่ตรงตามเกณฑ์ข้อบ่งใช้ ICD-10
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('dxwriteback')}
              className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>ดูคิวทบทวนทั้งหมด ({fmtNum(problemCount)})</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {recentProblems.map((r) => (
              <div
                key={r.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 flex flex-col justify-between gap-2.5 hover:border-amber-500/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {r.patient_name} <span className="font-mono text-slate-400 text-[11px]">({r.hn})</span>
                    </div>
                    <div className="text-[11px] text-teal-700 dark:text-teal-300 font-medium truncate mt-0.5">
                      💊 {r.drug_name} ({r.drug_qty} {cleanDrugUnit(r.drug_units)})
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 font-mono',
                      r.audit_result === 'FAIL'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    )}
                  >
                    {r.audit_result === 'FAIL' ? 'DX ไม่ตรง' : 'ไม่มี DX'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                  {r.audit_reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
