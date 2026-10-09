import { useState, type FC } from 'react'
import { AppLayout } from '@/layouts/AppLayout'
import { AuditKpiSummary } from '@/components/AuditKpiSummary'
import { AuditFilterBar } from '@/components/AuditFilterBar'
import { AuditTable } from '@/components/AuditTable'
import { AuditCardList } from '@/components/AuditCardList'
import { DrugSummaryView } from '@/components/DrugSummaryView'
import { DxMapSettingsModal } from '@/components/DxMapSettingsModal'
import { SqlInspectorView } from '@/components/SqlInspectorView'
import { HospitalHeroBanner } from '@/components/HospitalHeroBanner'
import { AuditKpiSkeleton, AuditTableSkeleton, AuditCardListSkeleton } from '@/components/AuditSkeleton'
import { useAuditRecords, useDbStatus, useDrugSummaries, useSyncHerbDx } from '@/hooks/useHerbDx'
import type { ActivePage, AuditFilterParams, AuditResultFilter, DateRange } from '@/types/herbdx.types'
import { downloadExcel, toThaiDate } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { PinLockProvider } from '@/context/PinLockContext'
import { LoginPage } from '@/components/LoginPage'
import { LockScreenOverlay } from '@/components/LockScreenOverlay'

const DashboardView: FC = () => {
  const [activePage, setActivePage] = useState<ActivePage>('audit')

  // Default dates matching HOSxP screenshot (October 2569 / 2026)
  const [range, setRange] = useState<DateRange>({
    startDate: '2026-10-01',
    endDate: '2026-10-31',
  })

  const [hn, setHn] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [resultFilter, setResultFilter] = useState<AuditResultFilter>('ALL')

  const filterParams: AuditFilterParams = {
    ...range,
    hn,
    search,
    result: resultFilter,
  }

  // TanStack Query Hooks
  const { data: status, isError: isStatusError, error: statusErr } = useDbStatus()
  const { data: auditResponse, isLoading: isAuditLoading } = useAuditRecords(filterParams)
  const { data: drugSummaries = [], isLoading: isDrugsLoading } = useDrugSummaries(range)
  const { mutate: triggerSync, isPending: isSyncing, data: syncResult, error: syncErr } = useSyncHerbDx()

  const handleManualSync = () => {
    triggerSync(range)
  }

  const handleExportAudit = () => {
    if (!auditResponse || auditResponse.data.length === 0) return
    const headers = [
      'ลำดับ',
      'วันที่รับบริการ',
      'เวลา',
      'HN',
      'ชื่อผู้รับบริการ',
      'สิทธิการรักษา',
      'รายการยา',
      'จำนวน',
      'แผนกที่รับบริการ',
      'main_pdx',
      'pdx',
      'dx0',
      'dx1',
      'dx2',
      'dx3',
      'dx4',
      'dx5',
      'รหัสแพทย์',
      'แพทย์ผู้สั่ง',
      'สถานะผลตรวจ',
      'เหตุผลการตรวจ',
    ]
    const rows = auditResponse.data.map((r, i) => [
      i + 1,
      toThaiDate(r.visit_date),
      r.visit_time,
      r.hn,
      r.patient_name,
      r.pttype_name,
      r.drug_name,
      r.drug_qty,
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
      r.audit_result === 'PASS' ? 'ผ่าน' : 'ไม่ผ่าน',
      r.audit_reason,
    ])
    downloadExcel(`ตรวจสอบการจ่ายยาสมุนไพร_${range.startDate}_${range.endDate}.xlsx`, headers, rows, 'ผลตรวจการจ่ายยาสมุนไพร')
  }

  return (
    <AppLayout
      activePage={activePage}
      onPageChange={setActivePage}
      status={status}
      isStatusError={isStatusError}
      statusError={statusErr instanceof Error ? statusErr.message : null}
      onSync={handleManualSync}
      isSyncing={isSyncing}
      syncResult={syncResult}
      syncError={syncErr instanceof Error ? syncErr.message : null}
    >
      {/* Page 1: ตรวจสอบการจ่ายยาสมุนไพร (Main Audit Screen) */}
      {activePage === 'audit' && (
        <>
          {/* Welcome Hospital Hero Banner matching Reference Screenshot */}
          <HospitalHeroBanner
            status={status}
            onSync={handleManualSync}
            isSyncing={isSyncing}
          />

          {/* KPI Metrics Summary */}
          {isAuditLoading || !auditResponse ? (
            <AuditKpiSkeleton />
          ) : (
            <AuditKpiSummary
              kpi={auditResponse.kpi}
              activeResult={resultFilter}
              onSelect={setResultFilter}
            />
          )}

          {/* Filter Controls Bar (Buddhist Era Date Picker, HN, Search, Quick Tabs, Export) */}
          <AuditFilterBar
            range={range}
            onRangeChange={setRange}
            hn={hn}
            onHnChange={setHn}
            search={search}
            onSearchChange={setSearch}
            result={resultFilter}
            onResultChange={setResultFilter}
            onExport={handleExportAudit}
            canExport={Boolean(auditResponse && auditResponse.data.length > 0)}
          />

          {/* Audit Grid (Desktop Table / Mobile Card List) */}
          {isAuditLoading ? (
            <>
              <div className="hidden md:block">
                <AuditTableSkeleton />
              </div>
              <div className="block md:hidden">
                <AuditCardListSkeleton />
              </div>
            </>
          ) : auditResponse ? (
            <>
              <div className="hidden md:block">
                <AuditTable records={auditResponse.data} />
              </div>
              <div className="block md:hidden">
                <AuditCardList records={auditResponse.data} />
              </div>
            </>
          ) : null}
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
              onRangeChange={setRange}
            />
          )}
        </>
      )}

      {/* Page 3: ตั้งค่ายาสมุนไพร ↔ ICD-10 */}
      {activePage === 'dxmap' && <DxMapSettingsModal />}

      {/* Page 4: SQL Query Inspector */}
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
    </PinLockProvider>
  ) : (
    <LoginPage />
  )
}

export default App
