/**
 * HerbDx — strict types shared by API client, hooks and components.
 */

export const AUDIT_RESULTS = ['PASS', 'FAIL', 'NO_DX', 'NO_MAP'] as const
export type AuditResult = (typeof AUDIT_RESULTS)[number]

/** PROBLEM = every non-PASS row */
export type AuditResultFilter = AuditResult | 'ALL' | 'PROBLEM'

export interface DateRange {
  readonly startDate: string // YYYY-MM-DD
  readonly endDate: string
}

/** คลีนหน่วยนับยาให้สั้นกระชับ ไม่รกสายตา เช่น "ขวด (120 ml.)" -> "ขวด", "เม็ด (SP.)" -> "เม็ด" */
export function cleanDrugUnit(unit?: string): string {
  if (!unit) return ''
  const trimmed = unit.trim()
  const clean = trimmed.replace(/\s*\(.*?\)\s*/g, '').trim()
  if (clean === 'แค็บซูล') return 'แคปซูล'
  return clean || trimmed
}

export interface AuditFilterParams extends DateRange {
  readonly hn: string
  readonly search: string
  readonly result: AuditResultFilter
}

export interface AuditRecord {
  readonly id: number
  readonly vn: string
  readonly visit_date: string
  readonly visit_time: string
  readonly hn: string
  readonly patient_name: string
  readonly pttype_name: string
  readonly drug_icode: string
  readonly drug_name: string
  readonly drug_qty: number
  readonly drug_units?: string
  readonly department_name: string
  readonly main_pdx: string
  readonly pdx: string
  readonly dx0: string
  readonly dx1: string
  readonly dx2: string
  readonly dx3: string
  readonly dx4: string
  readonly dx5: string
  readonly doctor_code: string
  readonly doctor_name: string
  readonly audit_result: AuditResult
  readonly audit_reason: string
  readonly matched_dx: readonly string[]
  readonly allowed_dx: readonly string[]
}

export interface AuditKpiMetrics {
  readonly total: number
  readonly pass: number
  readonly fail: number
  readonly noDx: number
  readonly noMap: number
  readonly passRate: number
  readonly totalQty: number
  readonly uniquePatients: number
}

export interface PrescriptionResponse {
  readonly success: true
  readonly data: readonly AuditRecord[]
  readonly kpi: AuditKpiMetrics
  readonly meta: { readonly total: number } & DateRange
}

export interface DrugSummaryRecord {
  readonly icode: string
  readonly name: string
  readonly units?: string
  readonly opd_qty: number
  readonly ipd_qty: number
  readonly unitcost: number
  readonly total_qty: number
  readonly total_cost: number
  readonly nhso_adp_code: string
}

export interface DrugSummaryResponse {
  readonly success: true
  readonly data: readonly DrugSummaryRecord[]
  readonly meta: { readonly total: number } & DateRange
}

export interface DxMapRecord {
  readonly icode: string
  readonly drug_name: string
  readonly dx_prefixes: string
  readonly indication: string
  readonly updated_at: string
}

export interface DxMapUpdate {
  readonly icode: string
  readonly dx_prefixes: string
  readonly indication: string
}

export interface DxMapPreview {
  readonly success: true
  readonly icode: string
  readonly periodDays: number
  readonly total: number
  readonly pass: number
  readonly fail: number
  readonly noDx: number
  readonly noMap: number
  readonly frequentDx: readonly { readonly code: string; readonly count: number; readonly matches: boolean }[]
}

export interface SyncLogEntry {
  readonly at: string
  readonly status: 'SUCCESS' | 'ERROR'
  readonly message: string | null
  readonly trigger_type: 'MANUAL' | 'AUTO'
  readonly start_date: string
  readonly end_date: string
}

export interface DbStatus {
  readonly status: 'online'
  readonly host: string
  readonly database: string
  readonly totalPrescriptions: number
  readonly totalDrugs: number
  readonly latestVisitDate: string | null
  readonly lastSync: SyncLogEntry | null
  readonly isSyncing: boolean
  readonly syncEnabled: boolean
  readonly autoSyncMinutes: number
}

export interface SyncResult extends DateRange {
  readonly success: true
  readonly skipped?: boolean
  readonly preservedExisting?: boolean
  readonly warning?: string
  readonly reason?: string
  readonly trigger: 'MANUAL' | 'AUTO'
  readonly totalPrescriptions: number
  readonly totalDrugs: number
  readonly durationMs: number
  readonly timestamp: string
}

export type ActivePage = 'audit' | 'drugs' | 'mapping' | 'dxwriteback' | 'dxmap' | 'sql'
