import type {
  AuditFilterParams,
  DateRange,
  DbStatus,
  DrugSummaryResponse,
  DxMapRecord,
  DxMapPreview,
  DxMapUpdate,
  PrescriptionResponse,
  SyncResult,
  HealthMedRecord,
  HealthMedKpi,
  DispensingRule,
  ThaiMedDuplicateRules,
  PttypeItem,
} from '@/types/herbdx.types'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const isErrorEnvelope = (v: unknown): v is { error: string } =>
  typeof v === 'object' && v !== null && 'error' in v && typeof (v as { error: unknown }).error === 'string'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new ApiError('เชื่อมต่อ API Server ไม่ได้ (npm run server)', 0)
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(isErrorEnvelope(body) ? body.error : `HTTP ${res.status}`, res.status)
  }
  return body as T
}

const qs = (params: Record<string, string | undefined>) => {
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) clean[k] = v
  }
  return new URLSearchParams(clean).toString()
}

export const herbDxApi = {
  status: () => request<DbStatus>('/api/status'),

  prescriptions: (f: AuditFilterParams) =>
    request<PrescriptionResponse>(
      `/api/prescriptions?${qs({ startDate: f.startDate, endDate: f.endDate, hn: f.hn || '', search: f.search, result: f.result })}`
    ),

  drugs: (r: DateRange) =>
    request<DrugSummaryResponse>(`/api/drugs?${qs({ startDate: r.startDate, endDate: r.endDate })}`),

  dxMap: () => request<{ success: true; data: readonly DxMapRecord[] }>('/api/dx-map'),

  searchDrugs: (q: string) =>
    request<{ success: true; data: readonly { icode: string; name: string; units?: string }[] }>(
      `/api/dx-map/search-drugs?q=${encodeURIComponent(q)}`
    ),

  updateDxMap: ({ icode, ...body }: DxMapUpdate) =>
    request<{ success: true } & DxMapUpdate>(`/api/dx-map/${encodeURIComponent(icode)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  previewDxMap: (icode: string, dx_prefixes: string, periodDays: number) =>
    request<DxMapPreview>(`/api/dx-map/${encodeURIComponent(icode)}/preview`, {
      method: 'POST',
      body: JSON.stringify({ dx_prefixes, periodDays }),
    }),

  sync: (r: DateRange) => request<SyncResult>('/api/sync', { method: 'POST', body: JSON.stringify(r) }),

  healthMedAudit: (f: AuditFilterParams) =>
    request<{
      success: true
      data: readonly HealthMedRecord[]
      kpi: HealthMedKpi
      meta: { total: number; startDate: string; endDate: string }
    }>(
      `/api/healthmed/audit?${qs({ startDate: f.startDate, endDate: f.endDate, search: f.search || '', result: f.result || 'ALL' })}`
    ),

  healthMedAiAdvisor: (record: Partial<HealthMedRecord>) =>
    request<{
      success: true
      advice: {
        summary: string
        hosxpAction: string
        caution: string
        aiModel?: string
      }
      source: string
    }>('/api/healthmed/ai-advisor', {
      method: 'POST',
      body: JSON.stringify(record),
    }),

  aiChat: (message: string, history?: Array<{ role: 'user' | 'model'; content: string }>) =>
    request<{
      success: boolean
      reply: string
      model?: string
      timestamp?: string
      error?: string
    }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),

  dispensingRules: () =>
    request<{ success: true; data: readonly DispensingRule[] }>('/api/dispensing-rules'),

  saveDispensingRule: (rule: Partial<DispensingRule>) =>
    request<{ success: true; id: number }>('/api/dispensing-rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    }),

  toggleDispensingRule: (id: number, isActive: boolean) =>
    request<{ success: true }>(`/api/dispensing-rules/${id}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    }),

  deleteDispensingRule: (id: number) =>
    request<{ success: true }>(`/api/dispensing-rules/${id}`, {
      method: 'DELETE',
    }),

  healthMedSettings: () =>
    request<{ success: true; data: ThaiMedDuplicateRules }>('/api/healthmed/settings'),

  saveHealthMedSettings: (rules: ThaiMedDuplicateRules) =>
    request<{ success: true; data: ThaiMedDuplicateRules }>('/api/healthmed/settings', {
      method: 'POST',
      body: JSON.stringify(rules),
    }),

  pttypes: () =>
    request<{ success: true; data: readonly PttypeItem[] }>('/api/pttypes'),
}
