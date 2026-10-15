import { useState, useMemo, useEffect, type FC } from 'react'
import { AppLayout } from '@/layouts/AppLayout'
import { AuditKpiSummary } from '@/components/AuditKpiSummary'
import { AuditFilterBar } from '@/components/AuditFilterBar'
import { AuditTable } from '@/components/AuditTable'
import { AuditCardList } from '@/components/AuditCardList'
import { DrugSummaryView } from '@/components/DrugSummaryView'
import { DxMapSettingsModal } from '@/components/DxMapSettingsModal'
import { CodeReviewQueue } from '@/components/CodeReviewQueue'
import { DxWritebackView } from '@/components/DxWritebackView'
import { SqlInspectorView } from '@/components/SqlInspectorView'
import { HealthMedAuditView } from '@/components/HealthMedAuditView'
import { HospitalHeroBanner } from '@/components/HospitalHeroBanner'
import { ExecutiveDashboardView } from '@/components/ExecutiveDashboardView'
import { AuditKpiSkeleton, AuditTableSkeleton, AuditCardListSkeleton } from '@/components/AuditSkeleton'
import { useAuditRecords, useDbStatus, useDrugSummaries, useDxMap, useSyncHerbDx } from '@/hooks/useHerbDx'
import type { ActivePage, AuditFilterParams, AuditRecord, AuditResultFilter, DateRange } from '@/types/herbdx.types'
import { AUDIT_RESULT_META, currentMonthRange, downloadExcel, fmtNum, toThaiDate, type ExcelColumn, toReporter } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { canManageHerbDx } from '@/types/auth.types'
import { PinLockProvider } from '@/context/PinLockContext'
import { LoginPage } from '@/components/LoginPage'
import { LockScreenOverlay } from '@/components/LockScreenOverlay'
import { PinSetupRequiredOverlay } from '@/components/PinSetupRequiredOverlay'

const VALID_PAGES: readonly ActivePage[] = [
  'dashboard',
  'audit',
  'healthmed',
  'drugs',
  'mapping',
  'dxwriteback',
  'dxmap',
  'sql',
]

function getInitialPage(): ActivePage {
  if (typeof window === 'undefined') return 'dashboard'
  // 1. ตรวจสอบจาก URL Hash (เช่น #healthmed)
  const hash = window.location.hash.replace(/^#\/?/, '').trim() as ActivePage
  if (VALID_PAGES.includes(hash)) {
    return hash
  }
  // 2. ตรวจสอบจาก LocalStorage ที่จำไว้ล่าสุด
  const saved = localStorage.getItem('hd_check_active_page') as ActivePage
  if (VALID_PAGES.includes(saved)) {
    return saved
  }
  return 'dashboard'
}

const DashboardView: FC = () => {
  const { user } = useAuth()
  const [activePage, setActivePage] = useState<ActivePage>(getInitialPage)
  const [configureIcode, setConfigureIcode] = useState<string | undefined>()

  // Sync hash กับ activePage เมื่อกดปุ่ม Back/Forward หรือ URL เปลี่ยน
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim() as ActivePage
      if (VALID_PAGES.includes(hash)) {
        setActivePage(hash)
      }
    }

    // ตั้งค่า Hash เริ่มต้นถ้ายังไม่มี
    if (!window.location.hash) {
      window.location.hash = activePage
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [activePage])

  const [range, setRange] = useState<DateRange>(currentMonthRange)

  const [hn, setHn] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [resultFilter, setResultFilter] = useState<AuditResultFilter>('ALL')
  const [patientTypeFilter, setPatientTypeFilter] = useState<'ALL' | 'OPD' | 'IPD'>('OPD')

  const filterParams: AuditFilterParams = {
    ...range,
    hn,
    search,
    result: resultFilter,
  }

  // TanStack Query Hooks
  const { data: status, isLoading: isStatusLoading, isError: isStatusError, error: statusErr } = useDbStatus()

  const handleRangeChange = (nextRange: DateRange) => {
    setRange(nextRange)
  }
  const handleConfigureDrug = (record: AuditRecord) => {
    setConfigureIcode(record.drug_icode)
    handlePageChange('dxmap')
  }
  const handlePageChange = (page: ActivePage) => {
    setActivePage(page)
    try {
      window.location.hash = page
      localStorage.setItem('hd_check_active_page', page)
    } catch {
      // Ignore storage errors in restricted contexts
    }
    if (page !== 'dxmap') setConfigureIcode(undefined)
  }
  const {
    data: auditResponse,
    isLoading: isAuditLoading,
    isFetching: isAuditFetching,
    isPlaceholderData: isAuditPlaceholder,
    isError: isAuditError,
    error: auditError,
    refetch: refetchAudit,
  } = useAuditRecords(filterParams)

  const filteredAuditData = useMemo<readonly AuditRecord[]>(() => {
    if (!auditResponse?.data) return []
    const data = auditResponse.data
    if (patientTypeFilter === 'OPD') {
      return data.filter((r) => !r.vn.startsWith('AN:'))
    }
    if (patientTypeFilter === 'IPD') {
      return data.filter((r) => r.vn.startsWith('AN:'))
    }
    return data
  }, [auditResponse?.data, patientTypeFilter])

  const patientCounts = useMemo(() => {
    if (!auditResponse?.data) return { all: 0, opd: 0, ipd: 0 }
    const data = auditResponse.data
    const opd = data.filter((r) => !r.vn.startsWith('AN:')).length
    const ipd = data.filter((r) => r.vn.startsWith('AN:')).length
    return { all: data.length, opd, ipd }
  }, [auditResponse?.data])

  const dynamicKpi = useMemo(() => {
    if (!auditResponse?.kpi) return undefined
    if (patientTypeFilter === 'ALL') return auditResponse.kpi
    const list = filteredAuditData
    const pass = list.filter((r) => r.audit_result === 'PASS').length
    const fail = list.filter((r) => r.audit_result === 'FAIL').length
    const noDx = list.filter((r) => r.audit_result === 'NO_DX').length
    const noMap = list.filter((r) => r.audit_result === 'NO_MAP').length
    const totalQty = list.reduce((s, r) => s + r.drug_qty, 0)
    const uniquePatients = new Set(list.map((r) => r.hn)).size
    // Same 1-decimal rounding as the server KPI, otherwise the card shows 57.943925233644855%
    const passRate = list.length > 0 ? Math.round((pass / list.length) * 1000) / 10 : 0
    return {
      total: list.length,
      pass,
      fail,
      noDx,
      noMap,
      passRate,
      totalQty,
      uniquePatients,
    }
  }, [filteredAuditData, auditResponse?.kpi, patientTypeFilter])

  const mismatchParams: AuditFilterParams = { ...range, hn: '', search: '', result: 'FAIL' }
  const { data: mismatchResponse, isLoading: isMismatchLoading } = useAuditRecords(mismatchParams)
  const { data: drugSummaries = [], isLoading: isDrugsLoading } = useDrugSummaries(range)
  const { data: dxMap = [], isLoading: isDxMapLoading } = useDxMap()
  const { mutate: triggerSync, isPending: isSyncing, data: syncResult, error: syncErr } = useSyncHerbDx()

  const handleManualSync = () => {
    triggerSync(range)
  }

  const handleExportAudit = () => {
    if (!filteredAuditData || filteredAuditData.length === 0) return
    const columns: ExcelColumn[] = [
      { header: 'ลำดับ', type: 'center', width: 7 },
      { header: 'วันที่รับบริการ', type: 'center' },
      { header: 'เวลา', type: 'center' },
      { header: 'HN', type: 'center' },
      { header: 'ชื่อผู้รับบริการ' },
      { header: 'สิทธิการรักษา', width: 28 },
      { header: 'รายการยา', width: 36 },
      { header: 'จำนวน', type: 'int', total: true },
      { header: 'หน่วยนับ', type: 'center' },
      { header: 'แผนกที่รับบริการ', width: 24 },
      { header: 'main_pdx', type: 'center' },
      { header: 'pdx', type: 'center' },
      { header: 'dx0', type: 'center' },
      { header: 'dx1', type: 'center' },
      { header: 'dx2', type: 'center' },
      { header: 'dx3', type: 'center' },
      { header: 'dx4', type: 'center' },
      { header: 'dx5', type: 'center' },
      { header: 'รหัสแพทย์', type: 'center' },
      { header: 'แพทย์ผู้สั่ง', width: 26 },
      { header: 'สถานะผลตรวจ', type: 'center', width: 14 },
      { header: 'เหตุผลการตรวจ', width: 46 },
    ]
    const rows = filteredAuditData.map((r, i) => [
      i + 1,
      toThaiDate(r.visit_date),
      r.visit_time,
      r.hn,
      r.patient_name,
      r.pttype_name,
      r.drug_name,
      r.drug_qty,
      r.drug_units || '',
      r.department_name,
      r.main_pdx,
      r.pdx,
      r.dx0,
      r.dx1,
      r.dx2,
      r.dx3,
      r.dx4,
      r.dx5,
      r.doctor_code,
      r.doctor_name,
      r.audit_result === 'PASS' ? 'ผ่าน' : AUDIT_RESULT_META[r.audit_result].short,
      r.audit_reason,
    ])
    const count = (k: AuditRecord['audit_result']) => filteredAuditData.filter((r) => r.audit_result === k).length
    const pass = count('PASS')
    void downloadExcel({
      filename: `ตรวจสอบการจ่ายยาสมุนไพร_${range.startDate}_${range.endDate}.xlsx`,
      sheetName: 'ผลตรวจการจ่ายยาสมุนไพร',
      title: 'รายงานผลตรวจสอบการจ่ายยาสมุนไพรตามข้อบ่งใช้ (ICD-10)',
      range,
      reporter: toReporter(user),
      columns,
      rows,
      summary: [
        { label: 'ใบสั่งยาทั้งหมด', value: filteredAuditData.length },
        { label: 'ผ่าน', value: pass, tone: 'good' },
        { label: 'DX ไม่ตรง', value: count('FAIL'), tone: 'bad' },
        { label: 'ไม่มี DX', value: count('NO_DX'), tone: 'bad' },
        { label: 'รอตั้งค่า', value: count('NO_MAP'), tone: 'warn' },
        { label: 'อัตราผ่าน', value: `${fmtNum((pass / filteredAuditData.length) * 100, 1)}%`, tone: 'good' },
      ],
      statusColumn: 20,
      rowTones: filteredAuditData.map((r) => (r.audit_result === 'PASS' ? 'good' : r.audit_result === 'NO_MAP' ? 'warn' : 'bad')),
    })
  }

  return (
    <AppLayout
      activePage={activePage}
      onPageChange={handlePageChange}
      status={status}
      isStatusError={isStatusError}
      statusError={statusErr instanceof Error ? statusErr.message : null}
      onSync={handleManualSync}
      isSyncing={isSyncing}
      syncResult={syncResult}
      syncError={syncErr instanceof Error ? syncErr.message : null}
    >
      {/* Page 0: ภาพรวมระบบ (Executive Dashboard) */}
      {activePage === 'dashboard' && (
        <ExecutiveDashboardView
          kpi={dynamicKpi}
          records={filteredAuditData}
          drugs={drugSummaries}
          status={status}
          range={range}
          onRangeChange={handleRangeChange}
          onNavigate={handlePageChange}
          onSync={handleManualSync}
          isSyncing={isSyncing}
          onConfigureDrug={handleConfigureDrug}
        />
      )}

      {/* Page 1: ตรวจสอบการจ่ายยาสมุนไพร (Main Audit Screen) */}
      {activePage === 'audit' && (
        <>
          {/* Welcome Hospital Hero Banner matching Reference Screenshot */}
          <HospitalHeroBanner
            status={status}
            onSync={handleManualSync}
            isSyncing={isSyncing}
          />

          {(isStatusLoading || isStatusError || isAuditLoading || (isAuditFetching && isAuditPlaceholder) || isAuditError || (auditResponse?.data.length === 0 && !isAuditFetching)) && (
            <section
              aria-live="polite"
              className={`mb-3 flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
                isAuditError || isStatusError
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  : auditResponse?.data.length === 0 && !isAuditFetching
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                    : 'border-sky-500/30 bg-sky-500/10 text-sky-100'
              }`}
            >
              <div>
                {isStatusLoading && !status ? (
                  <span>กำลังตรวจสอบการเชื่อมต่อและวันที่มีข้อมูล…</span>
                ) : isStatusError ? (
                  <span>ตรวจสอบสถานะฐานข้อมูลไม่สำเร็จ: {statusErr instanceof Error ? statusErr.message : 'โปรดลองใหม่อีกครั้ง'}</span>
                ) : isAuditError ? (
                  <span>โหลดข้อมูลช่วง {range.startDate} ถึง {range.endDate} ไม่สำเร็จ: {auditError instanceof Error ? auditError.message : 'โปรดลองใหม่อีกครั้ง'}</span>
                ) : isAuditLoading || (isAuditFetching && isAuditPlaceholder) ? (
                  <span className="inline-flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" />กำลังโหลดข้อมูลช่วง {range.startDate} ถึง {range.endDate}…</span>
                ) : (
                  <span>
                    โหลดเสร็จแล้ว แต่ไม่พบรายการในช่วง {toThaiDate(range.startDate)} ถึง {toThaiDate(range.endDate)}
                    {status?.latestVisitDate
                      ? ` · วันที่มีข้อมูลล่าสุด ${toThaiDate(status.latestVisitDate)}`
                      : ' · ระบบยังไม่ได้รับวันที่ข้อมูลล่าสุดจากหลังบ้าน หากเพิ่งแก้ระบบ ให้ปิดหน้าต่าง dev.bat แล้วเปิดใหม่'}
                    {status?.latestVisitDate ? ' · ลองเลือกช่วงวันที่ครอบคลุมวันดังกล่าว' : ''}
                  </span>
                )}
              </div>
              {isAuditError && (
                <button type="button" onClick={() => void refetchAudit()} className="shrink-0 rounded-lg border border-current/30 px-3 py-1.5 font-semibold hover:bg-white/10">
                  ลองโหลดอีกครั้ง
                </button>
              )}
            </section>
          )}

          {/* KPI Metrics Summary */}
          {isAuditLoading || isAuditPlaceholder ? (
            <AuditKpiSkeleton />
          ) : dynamicKpi ? (
            <AuditKpiSummary
              kpi={dynamicKpi}
              activeResult={resultFilter}
              onSelect={setResultFilter}
            />
          ) : null}

          {/* Desktop Unified Audit Card (Filter Toolbar + Table) */}
          <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm overflow-hidden transition-colors">
            <AuditFilterBar
              range={range}
              onRangeChange={handleRangeChange}
              hn={hn}
              onHnChange={setHn}
              search={search}
              onSearchChange={setSearch}
              result={resultFilter}
              onResultChange={setResultFilter}
              patientType={patientTypeFilter}
              onPatientTypeChange={setPatientTypeFilter}
              counts={patientCounts}
              onExport={handleExportAudit}
              canExport={Boolean(filteredAuditData && filteredAuditData.length > 0)}
              embedded
            />
            {isAuditLoading || isAuditPlaceholder ? (
              <AuditTableSkeleton embedded />
            ) : filteredAuditData ? (
              <AuditTable records={filteredAuditData} embedded onConfigureDrug={handleConfigureDrug} />
            ) : null}
          </div>

          {/* Mobile View: Standalone Filter Bar & Cards List */}
          <div className="block md:hidden space-y-3">
            <AuditFilterBar
              range={range}
              onRangeChange={handleRangeChange}
              hn={hn}
              onHnChange={setHn}
              search={search}
              onSearchChange={setSearch}
              result={resultFilter}
              onResultChange={setResultFilter}
              patientType={patientTypeFilter}
              onPatientTypeChange={setPatientTypeFilter}
              counts={patientCounts}
              onExport={handleExportAudit}
              canExport={Boolean(filteredAuditData && filteredAuditData.length > 0)}
            />
            {isAuditLoading || isAuditPlaceholder ? (
              <AuditCardListSkeleton />
            ) : filteredAuditData ? (
              <AuditCardList records={filteredAuditData} onConfigureDrug={handleConfigureDrug} />
            ) : null}
          </div>
        </>
      )}

      {/* Page 2: รายการจ่ายยาสมุนไพร & ต้นทุน (Screenshot 1) */}
      {activePage === 'drugs' && (
        <>
          {isDrugsLoading ? (
            <AuditTableSkeleton />
          ) : (
            <DrugSummaryView
              drugs={drugSummaries}
              range={range}
              onRangeChange={handleRangeChange}
              latestVisitDate={status?.latestVisitDate ?? null}
            />
          )}
        </>
      )}

      {/* Page 3: Read-only queue for missing drug codes and ICD rules */}
      {activePage === 'mapping' && (
        <CodeReviewQueue
          drugs={drugSummaries}
          dxMap={dxMap}
          mismatches={mismatchResponse?.data ?? []}
          canEdit={canManageHerbDx(user)}
          loading={isDrugsLoading || isDxMapLoading || isMismatchLoading}
        />
      )}

      {/* Page: Review a single service encounter before any HOSxP write-back */}
      {activePage === 'dxwriteback' && (
        <DxWritebackView
          records={mismatchResponse?.data ?? []}
          range={range}
          onRangeChange={handleRangeChange}
          latestVisitDate={status?.latestVisitDate ?? null}
          canEdit={canManageHerbDx(user)}
          loading={isMismatchLoading}
        />
      )}

      {/* Page: ตรวจสอบหัตถการและค่าบริการแพทย์แผนไทย */}
      {activePage === 'healthmed' && <HealthMedAuditView range={range} />}

      {/* Page 4: ตั้งค่ายาสมุนไพร ↔ ICD-10 */}
      {activePage === 'dxmap' && (
        <DxMapSettingsModal
          initialIcode={configureIcode}
        />
      )}

      {/* Page 5: SQL Query Inspector */}
      {activePage === 'sql' && <SqlInspectorView />}
    </AppLayout>
  )
}

export const App: FC = () => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return <div className="min-h-screen grid place-items-center bg-[#070b14] text-sm text-slate-300">กำลังตรวจสอบเซสชัน…</div>
  }
  return isAuthenticated ? (
    <PinLockProvider>
      <DashboardView />
      <LockScreenOverlay />
      <PinSetupRequiredOverlay />
    </PinLockProvider>
  ) : (
    <LoginPage />
  )
}

export default App
