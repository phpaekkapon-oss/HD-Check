import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { herbDxApi } from '@/api/herbdx.api'
import type { AuditFilterParams, DateRange, DxMapUpdate, DispensingRule, ThaiMedDuplicateRules } from '@/types/herbdx.types'

export const herbDxKeys = {
  all: ['herbdx'] as const,
  status: () => [...herbDxKeys.all, 'status'] as const,
  prescriptions: (f: AuditFilterParams) => [...herbDxKeys.all, 'prescriptions', f] as const,
  drugs: (r: DateRange) => [...herbDxKeys.all, 'drugs', r] as const,
  dxMap: () => [...herbDxKeys.all, 'dx-map'] as const,
  dispensingRules: () => [...herbDxKeys.all, 'dispensing-rules'] as const,
  healthMedSettings: () => [...herbDxKeys.all, 'healthmed-settings'] as const,
  pttypes: () => [...herbDxKeys.all, 'pttypes'] as const,
}

export function useDbStatus() {
  return useQuery({
    queryKey: herbDxKeys.status(),
    queryFn: herbDxApi.status,
    refetchInterval: 10_000, // Poll DB status every 10s
  })
}

export function useAuditRecords(filters: AuditFilterParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: herbDxKeys.prescriptions(filters),
    queryFn: () => herbDxApi.prescriptions(filters),
    placeholderData: keepPreviousData, // keep table while refetching → zero layout shift
    refetchInterval: 10_000, // Auto-fetch fresh prescriptions & metrics every 10s
  })
}

export function useDrugSummaries(range: DateRange) {
  return useQuery({
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
    refetchInterval: 15_000, // Auto-fetch drug summaries every 15s
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


