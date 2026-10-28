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
  readonly hn?: string
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
  readonly min_qty?: number
  readonly is_qty_fail?: boolean
  readonly is_interval_fail?: boolean
  readonly interval_fail?: boolean
  readonly interval_prev_date?: string | null
  readonly interval_days_diff?: number | null
  readonly interval_rule_info?: {
    readonly drug_name: string
    readonly pttype_label: string
    readonly min_days: number
  } | null
  readonly cinnamon_interval_fail?: boolean
  readonly cinnamon_prev_date?: string
  readonly cinnamon_days_diff?: number
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

export type UserRoleId = 'it' | 'thaimed' | 'doctor' | 'pharmacist' | 'general'
export type MenuPermissionMatrix = Record<string, Record<string, boolean>>

/** สิทธิ์เมนูจาก /api/permissions/menus (roles/menus/permissions ส่งมาเฉพาะ IT) */
export interface MenuPermissionsResponse {
  readonly success: true
  readonly myRole: UserRoleId
  readonly myMenus: readonly ActivePage[]
  readonly roles?: readonly { readonly id: string; readonly label: string; readonly desc: string }[]
  readonly menus?: readonly { readonly id: ActivePage; readonly label: string }[]
  readonly alwaysAllowed?: readonly ActivePage[]
  readonly permissions?: MenuPermissionMatrix
}

/** ผลวิเคราะห์รายการจ่ายยาจาก /api/audit/advice (rule-based) */
export interface HerbAuditAnalysis {
  readonly summary: string
  readonly isIpd: boolean
  readonly isThaiMed: boolean
  readonly dx: readonly string[]
  readonly criteria: { readonly modern: readonly string[]; readonly u: readonly string[] }
  readonly indication: string
  readonly missing: readonly string[]
  readonly keyErrors: readonly string[]
  readonly hosxpSteps: readonly string[]
  readonly cautions: readonly string[]
}

export interface HerbAuditAiAdvice {
  readonly summary: string
  readonly keyingError?: string
  readonly hosxpAction: string
  readonly caution?: string
  readonly aiModel?: string
}

export interface PrescriptionResponse {
  readonly success: true
  readonly data: readonly AuditRecord[]
  readonly kpi: AuditKpiMetrics
  /** KPI แยก OPD / IPD คิดจากข้อมูลก่อนกรองผลตรวจ (เวอร์ชันเก่าอาจไม่มี) */
  readonly kpiByType?: { readonly OPD: AuditKpiMetrics; readonly IPD: AuditKpiMetrics }
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
  readonly min_qty?: number
  readonly indication: string
  readonly updated_at: string
  readonly dispensing_interval_days?: number | null
  readonly dispensing_pttype_label?: string | null
  readonly dispensing_pttype_filter?: string | null
  readonly dispensing_is_active?: boolean | null
}

export interface DxMapBatchItem {
  readonly icode: string
  readonly drug_name?: string
  readonly dx_prefixes: string
  readonly min_qty?: number
  readonly indication?: string
  readonly mergeWithExisting?: boolean
}

export interface DxMapUpdate {
  readonly icode: string
  readonly drug_name?: string
  readonly dx_prefixes: string
  readonly min_qty?: number
  readonly indication: string
  readonly min_interval_days?: number
  readonly pttype_filter?: string
  readonly pttype_name_label?: string
  readonly rule_description?: string
}

export interface DxMapPreview {
  readonly success: true
  readonly icode: string
  readonly periodDays: number
  readonly min_qty?: number
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
  readonly appVersion?: string
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

export type ActivePage = 'dashboard' | 'audit' | 'healthmed' | 'claims' | 'drugs' | 'mapping' | 'dxwriteback' | 'dxmap' | 'thaimedvalue' | 'sql'

/** ตรวจการเบิก สปสช. (/api/claims/check) */
export type ClaimState = 'not_nhso' | 'no_result' | 'pending' | 'settled' | 'rejected'
export interface ClaimIcdIssue {
  readonly code: string
  readonly level: 'error' | 'warn'
  readonly dx?: string
  readonly text: string
  readonly hint: string
}
export interface ClaimVisit {
  readonly vn: string
  readonly hn: string
  readonly visit_date: string
  readonly visit_time: string | null
  readonly patient_name: string
  readonly pttype_name: string | null
  readonly hip: string | null
  readonly doctor_name: string | null
  readonly pdx: string | null
  readonly dx0: string | null
  readonly dx1: string | null
  readonly dx2: string | null
  readonly dx3: string | null
  readonly dx4: string | null
  readonly dx5: string | null
  readonly fdh_status: string | null
  readonly fdh_status_th: string | null
  readonly fdh_amount: number | null
  readonly fdh_stm_period: string | null
  readonly fdh_checked_at: string | null
  readonly fdh_errors: readonly { readonly code: string; readonly text: string }[]
  readonly icd_issues: readonly ClaimIcdIssue[]
  readonly claim_state: ClaimState
}
export interface ClaimCheckResponse {
  readonly success: true
  readonly data: readonly ClaimVisit[]
  readonly kpi: {
    readonly visits: number
    readonly ucVisits: number
    readonly icdIssueVisits: number
    readonly noResult: number
    readonly pending: number
    readonly settled: number
    readonly rejected: number
    readonly settledAmount: number
  }
  readonly meta: DateRange & { readonly fdhLastChecked: string | null }
}

export interface HealthMedOperationItem {
  readonly code: string
  readonly name: string
}

export interface HealthMedRecord {
  readonly vn: string
  readonly hn: string
  readonly visit_date: string
  readonly visit_time: string
  readonly patient_name: string
  readonly age_y: number
  readonly pttype_name: string
  readonly pttype: string
  readonly doctor_code: string
  readonly doctor_name: string
  readonly department_name: string
  readonly pdx: string
  readonly dx0?: string
  readonly dx1?: string
  readonly dx2?: string
  readonly dx3?: string
  readonly dx4?: string
  readonly dx5?: string
  readonly service_items_raw?: string
  readonly service_codes?: string
  readonly operations?: readonly HealthMedOperationItem[]
  readonly operation_codes?: readonly string[]
  readonly labor_date?: string | null
  readonly count_58130: number
  readonly count_58101: number
  readonly count_58301: number
  readonly count_58220: number
  readonly count_58131: number
  readonly count_compress?: number
  readonly is_duplicate_fail?: boolean
  readonly is_visit2_claim_fail?: boolean
  readonly claim_code?: string | null
  readonly visit_order?: number
  readonly total_day_visits?: number
  readonly first_visit_claim_code?: string | null
  readonly first_visit_vn?: string | null
  readonly first_visit_dept?: string | null
  readonly audit_result: 'PASS' | 'FAIL'
  readonly audit_reason: string
  readonly failures: readonly string[]
  readonly passes: readonly string[]
}

export interface HealthMedKpi {
  readonly total: number
  readonly pass: number
  readonly fail: number
  readonly passRate: number
  readonly duplicateFail: number
  readonly kneeFail: number
  readonly postpartumFail: number
  readonly muscleFail?: number
  readonly epFail: number
  readonly visit2ClaimFail?: number
}

export interface DispensingRule {
  readonly id?: number
  readonly drug_icode: string
  readonly drug_name: string
  readonly selected_drugs?: readonly { icode: string; drug_name: string }[]
  readonly pttype_filter: string
  readonly pttype_name_label: string
  readonly min_interval_days: number
  readonly rule_description?: string
  readonly is_active: boolean
  readonly created_at?: string
  readonly updated_at?: string
}

export interface ThaiMedDuplicateRules {
  readonly block_coexist: boolean
  readonly block_both_multiple: boolean
  readonly block_single_multiple: boolean
  readonly check_visit2_claim_code?: boolean
  readonly massage_and_compress_codes?: readonly string[]
  readonly massage_only_codes?: readonly string[]
  readonly compress_only_codes?: readonly string[]
}

export interface PttypeItem {
  readonly pttype: string
  readonly name: string
  readonly pcode?: string
}


