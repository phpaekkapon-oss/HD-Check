import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { herbDxApi } from '@/api/herbdx.api'
import type { AuditFilterParams, DateRange, DxMapUpdate, DxMapBatchItem, DispensingRule, MenuPermissionMatrix, ThaiMedDuplicateRules } from '@/types/herbdx.types'

export const herbDxKeys = {
  all: ['herbdx'] as const,
  status: () => [...herbDxKeys.all, 'status'] as const,
  prescriptions: (f: AuditFilterParams) => [...herbDxKeys.all, 'prescriptions', f] as const,
  drugs: (r: DateRange) => [...herbDxKeys.all, 'drugs', r] as const,
  dxMap: () => [...herbDxKeys.all, 'dx-map'] as const,
  dispensingRules: () => [...herbDxKeys.all, 'dispensing-rules'] as const,
  healthMedSettings: () => [...herbDxKeys.all, 'healthmed-settings'] as const,
  pttypes: () => [...herbDxKeys.all, 'pttypes'] as const,
  menuPermissions: () => [...herbDxKeys.all, 'menu-permissions'] as const,
  thaiMedValue: (r: DateRange) => [...herbDxKeys.all, 'thaimed-value', r] as const,
  claims: (r: DateRange) => [...herbDxKeys.all, 'claims', r] as const,
}

/** สิทธิ์เมนูของผู้ใช้ (และตารางสิทธิ์ทั้งหมดสำหรับ IT) */
export function useMenuPermissions(enabled = true) {
  return useQuery({
    enabled,
    queryKey: herbDxKeys.menuPermissions(),
    queryFn: herbDxApi.menuPermissions,
    staleTime: 30_000,
  })
}

export function useSaveMenuPermissions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (permissions: MenuPermissionMatrix) => herbDxApi.saveMenuPermissions(permissions),
    onSuccess: () => qc.invalidateQueries({ queryKey: herbDxKeys.menuPermissions() }),
  })
}

/** ตรวจการเบิก สปสช. ของ visit แพทย์แผนไทยในช่วงวันที่ */
export function useClaimCheck(range: DateRange) {
  return useQuery({
    queryKey: herbDxKeys.claims(range),
    queryFn: () => herbDxApi.claimCheck(range),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useDbStatus() {
  return useQuery({
    queryKey: herbDxKeys.status(),
    queryFn: herbDxApi.status,
    refetchInterval: 10_000, // Poll DB status every 10s
  })
}

function shouldAutoRefetch(startDate?: string, endDate?: string): boolean {
  if (!endDate || !startDate) return true
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  const diffDays = (end - start) / (1000 * 60 * 60 * 24)
  // หากเลือกดูช่วงยาวเกิน 45 วัน (เช่น ทั้งปีงบประมาณ 365 วัน) หรือสิ้นสุดผ่านมาเกิน 7 วันแล้ว ไม่ต้อง auto-refetch รบกวนเบราว์เซอร์
  if (diffDays > 45 || end < (Date.now() - 7 * 24 * 60 * 60 * 1000)) return false
  return true
}

export function useAuditRecords(filters: AuditFilterParams, enabled = true) {
  const autoRefetch = shouldAutoRefetch(filters.startDate, filters.endDate)
  return useQuery({
    enabled,
    queryKey: herbDxKeys.prescriptions(filters),
    queryFn: () => herbDxApi.prescriptions(filters),
    placeholderData: keepPreviousData, // keep table while refetching → zero layout shift
    refetchInterval: autoRefetch ? 15_000 : false,
  })
}

export function useDrugSummaries(range: DateRange, enabled = true) {
  const autoRefetch = shouldAutoRefetch(range.startDate, range.endDate)
  return useQuery({
    enabled,
    queryKey: herbDxKeys.drugs(range),
    queryFn: () => herbDxApi.drugs(range),
    // MySQL DECIMAL fields may arrive as strings from the warehouse snapshot.
    // Normalize here so table formatting and Excel export always receive numbers.
    select: (r) => r.data.map((drug) => ({
      ...drug,
      opd_qty: Number(drug.opd_qty ?? 0),
      ipd_qty: Number(drug.ipd_qty ?? 0),
      unitcost: Number(drug.unitcost ?? 0),
      total_qty: Number(drug.total_qty ?? 0),
      total_cost: Number(drug.total_cost ?? 0),
    })),
    placeholderData: keepPreviousData,
    refetchInterval: autoRefetch ? 20_000 : false,
  })
}

export function useDxMap() {
  return useQuery({ queryKey: herbDxKeys.dxMap(), queryFn: herbDxApi.dxMap, select: (r) => r.data })
}

export function useUpdateDxMap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (u: DxMapUpdate) => herbDxApi.updateDxMap(u),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: herbDxKeys.dxMap() })
      await qc.invalidateQueries({ queryKey: [...herbDxKeys.all, 'prescriptions'] })
      await qc.invalidateQueries({ queryKey: [...herbDxKeys.all, 'drugs'] })
    },
  })
}

export function useBatchUpdateDxMap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: readonly DxMapBatchItem[]) =>
      herbDxApi.batchUpdateDxMap({ items }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: herbDxKeys.dxMap() })
      await qc.invalidateQueries({ queryKey: [...herbDxKeys.all, 'prescriptions'] })
      await qc.invalidateQueries({ queryKey: [...herbDxKeys.all, 'drugs'] })
    },
  })
}

export function useSyncHosxpMinQty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => herbDxApi.syncHosxpMinQty(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: herbDxKeys.dxMap() })
      await qc.invalidateQueries({ queryKey: [...herbDxKeys.all, 'prescriptions'] })
      await qc.invalidateQueries({ queryKey: [...herbDxKeys.all, 'drugs'] })
    },
  })
}

export function useSyncHerbDx() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (r: DateRange) => herbDxApi.sync(r),
    onSettled: () => qc.invalidateQueries({ queryKey: herbDxKeys.all }),
  })
}

export function useHealthMedAudit(filters: AuditFilterParams) {
  return useQuery({
    queryKey: [...herbDxKeys.all, 'healthmed', filters] as const,
    queryFn: () => herbDxApi.healthMedAudit(filters),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  })
}

export function useDispensingRules() {
  return useQuery({
    queryKey: herbDxKeys.dispensingRules(),
    queryFn: herbDxApi.dispensingRules,
    select: (r) => r.data,
  })
}

export function useSaveDispensingRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rule: Partial<DispensingRule>) => herbDxApi.saveDispensingRule(rule),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: herbDxKeys.dispensingRules() })
      await qc.invalidateQueries({ queryKey: [...herbDxKeys.all, 'prescriptions'] })
    },
  })
}

export function useBatchSaveDispensingRules() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rules: Partial<DispensingRule>[]) => herbDxApi.batchSaveDispensingRules(rules),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: herbDxKeys.dispensingRules() })
      await qc.invalidateQueries({ queryKey: [...herbDxKeys.all, 'prescriptions'] })
    },
  })
}

export function useToggleDispensingRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      herbDxApi.toggleDispensingRule(id, isActive),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: herbDxKeys.dispensingRules() })
      await qc.invalidateQueries({ queryKey: [...herbDxKeys.all, 'prescriptions'] })
    },
  })
}

export function useDeleteDispensingRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => herbDxApi.deleteDispensingRule(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: herbDxKeys.dispensingRules() })
      await qc.invalidateQueries({ queryKey: [...herbDxKeys.all, 'prescriptions'] })
    },
  })
}

export function useHealthMedSettings() {
  return useQuery({
    queryKey: herbDxKeys.healthMedSettings(),
    queryFn: herbDxApi.healthMedSettings,
    select: (r) => r.data,
  })
}

export function useSaveHealthMedSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rules: ThaiMedDuplicateRules) => herbDxApi.saveHealthMedSettings(rules),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: herbDxKeys.healthMedSettings() })
      await qc.invalidateQueries({ queryKey: ['healthmed'] })
    },
  })
}

export function usePttypes() {
  return useQuery({
    queryKey: herbDxKeys.pttypes(),
    queryFn: herbDxApi.pttypes,
    select: (r) => r.data,
    staleTime: 5 * 60 * 1000,
  })
}



/** มูลค่าบริการแผนกแพทย์แผนไทย (ประมาณการ) — เปิดเฉพาะผู้ดูแลระบบ */
export function useThaiMedValue(range: DateRange, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: herbDxKeys.thaiMedValue(range),
    queryFn: () => herbDxApi.thaiMedValue(range),
    staleTime: 60_000,
    retry: false,
  })
}
