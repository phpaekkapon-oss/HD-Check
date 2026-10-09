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

const qs = (params: Record<string, string>) => new URLSearchParams(params).toString()

export const herbDxApi = {
  status: () => request<DbStatus>('/api/status'),

  prescriptions: (f: AuditFilterParams) =>
    request<PrescriptionResponse>(
      `/api/prescriptions?${qs({ startDate: f.startDate, endDate: f.endDate, hn: f.hn, search: f.search, result: f.result })}`
    ),

  drugs: (r: DateRange) =>
    request<DrugSummaryResponse>(`/api/drugs?${qs({ startDate: r.startDate, endDate: r.endDate })}`),

  dxMap: () => request<{ success: true; data: readonly DxMapRecord[] }>('/api/dx-map'),

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
}
