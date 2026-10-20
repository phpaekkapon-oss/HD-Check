import { useState, useMemo, type FC } from 'react'
import {
  Clock,
  Plus,
  Search,
  ShieldAlert,
  Edit3,
  Trash2,
  Check,
  X,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import {
  useDispensingRules,
  useSaveDispensingRule,
  useToggleDispensingRule,
  useDeleteDispensingRule,
  usePttypes,
} from '@/hooks/useHerbDx'
import type { DispensingRule, DxMapRecord, PttypeItem } from '@/types/herbdx.types'
import { cn } from '@/lib/utils'
import { ConfirmModal } from './ConfirmModal'

interface DispensingRulesTabProps {
  readonly dxMap: readonly DxMapRecord[]
  readonly canEdit: boolean
}

interface RightPreset {
  readonly label: string
  readonly filter: string
  readonly color: string
}

const RIGHT_PRESETS: readonly RightPreset[] = [
  {
    label: 'สิทธิ UC / บัตรทอง',
    filter: 'UC,บัตรทอง,ประกันสุขภาพ,UCS',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  {
    label: 'ประกันสังคม (SSS)',
    filter: 'SSS,ประกันสังคม',
    color: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  },
  {
    label: 'ข้าราชการ / จ่ายตรง (OFC)',
    filter: 'OFC,ข้าราชการ,เบิกตรง,กรมบัญชีกลาง',
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  {
    label: 'ทุกสิทธิการรักษา (ALL)',
    filter: 'ALL',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
]

const DAY_PRESETS = [3, 5, 7, 10, 14, 15, 30]

interface SelectedDrugItem {
  icode: string
  drug_name: string
}

const NO_RULES: DispensingRule[] = []
const NO_PTTYPES: PttypeItem[] = []

export const DispensingRulesTab: FC<DispensingRulesTabProps> = ({ dxMap, canEdit }) => {
  const { data: rules = NO_RULES, isLoading } = useDispensingRules()
  const { mutate: saveRule, isPending: isSaving } = useSaveDispensingRule()
  const { mutate: toggleRule, isPending: isToggling } = useToggleDispensingRule()
  const { mutate: deleteRule, isPending: isDeleting } = useDeleteDispensingRule()

  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<DispensingRule | null>(null)

  // Modal Form State (Multi-drug selection)
  const [selectedDrugs, setSelectedDrugs] = useState<SelectedDrugItem[]>([])
  const [formIcode, setFormIcode] = useState('')
  const [formDrugName, setFormDrugName] = useState('')
  const [formPttypeLabel, setFormPttypeLabel] = useState('สิทธิ UC / บัตรทอง')
  const [formPttypeFilter, setFormPttypeFilter] = useState('UC,บัตรทอง,ประกันสุขภาพ,UCS')
  const [formIntervalDays, setFormIntervalDays] = useState(7)
  const [formDescription, setFormDescription] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)

  const [drugSearchQuery, setDrugSearchQuery] = useState('')
  const { data: pttypes = NO_PTTYPES, isLoading: isLoadingPttypes } = usePttypes()
  const [pttypeSearchQuery, setPttypeSearchQuery] = useState('')

  // Parsing current filter into tokens
  const selectedPttypeTokens = useMemo(() => {
    return formPttypeFilter
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
  }, [formPttypeFilter])

  // Check if a specific pttype item is selected
  const isPttypeSelected = (p: PttypeItem) => {
    const code = p.pttype.toLowerCase()
    const name = p.name.toLowerCase()
    return selectedPttypeTokens.some((token) => {
      const t = token.toLowerCase()
      if (t === 'all') return true
      if (t === 'uc' || t === 'ucs') {
        return name.includes('บัตรทอง') || name.includes('uc') || name.includes('ประกันสุขภาพ') || code.startsWith('u')
      }
      if (t === 'sss') {
        return name.includes('ประกันสังคม') || code.startsWith('s')
      }
      if (t === 'ofc') {
        return name.includes('ข้าราชการ') || name.includes('เบิกตรง') || name.includes('กรมบัญชีกลาง') || code.startsWith('o')
      }
      return code === t || name.includes(t)
    })
  }

  // Toggle selection for a pttype
  const handleTogglePttype = (p: PttypeItem) => {
    const code = p.pttype
    const isCurrentlySelected = isPttypeSelected(p)
    let newTokens: string[]
    if (isCurrentlySelected) {
      newTokens = selectedPttypeTokens.filter((t) => {
        const lower = t.toLowerCase()
        if (lower === code.toLowerCase()) return false
        if (lower === 'uc' || lower === 'ucs' || lower === 'sss' || lower === 'ofc' || lower === 'all') {
          return false
        }
        return true
      })
    } else {
      const cleaned = selectedPttypeTokens.filter((t) => t.toUpperCase() !== 'ALL')
      newTokens = Array.from(new Set([...cleaned, code]))
    }
    const newFilter = newTokens.join(', ')
    setFormPttypeFilter(newFilter)

    if (newTokens.length === 0) {
      setFormPttypeLabel('ทุกสิทธิการรักษา (ALL)')
    } else if (newTokens.length === 1) {
      const match = pttypes.find((item) => item.pttype === newTokens[0])
      setFormPttypeLabel(match ? `[${match.pttype}] ${match.name}` : `สิทธิรหัส ${newTokens[0]}`)
    } else if (newTokens.length <= 3) {
      const matchedNames = newTokens
        .map((t) => {
          const m = pttypes.find((item) => item.pttype === t)
          return m ? `[${m.pttype}] ${m.name.slice(0, 15)}` : t
        })
        .join(', ')
      setFormPttypeLabel(matchedNames)
    } else {
      setFormPttypeLabel(`สิทธิที่เลือก (${newTokens.length} สิทธิ)`)
    }
  }

  // Filter pttypes by search query
  const filteredPttypes = useMemo(() => {
    if (!pttypeSearchQuery.trim()) return pttypes
    const q = pttypeSearchQuery.trim().toLowerCase()
    return pttypes.filter((p) => {
      return (
        p.pttype.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        Boolean(p.pcode && p.pcode.toLowerCase().includes(q))
      )
    })
  }, [pttypes, pttypeSearchQuery])

  // Select all filtered pttypes
  const handleSelectAllFiltered = () => {
    const codes = filteredPttypes.map((p) => p.pttype)
    const cleaned = selectedPttypeTokens.filter((t) => t.toUpperCase() !== 'ALL')
    const combined = Array.from(new Set([...cleaned, ...codes]))
    setFormPttypeFilter(combined.join(', '))
    setFormPttypeLabel(`สิทธิที่เลือก (${combined.length} สิทธิ)`)
  }

  // Clear all selected pttypes
  const handleClearAllSelected = () => {
    setFormPttypeFilter('')
    setFormPttypeLabel('ทุกสิทธิการรักษา (ALL)')
  }

  // Open modal for creating new rule
  const handleOpenAddModal = () => {
    setEditingRule(null)
    setSelectedDrugs([])
    setFormIcode('')
    setFormDrugName('')
    setFormPttypeLabel('สิทธิ UC / บัตรทอง')
    setFormPttypeFilter('UC,บัตรทอง,ประกันสุขภาพ,UCS')
    setFormIntervalDays(7)
    setFormDescription('เงื่อนไขสิทธิ UC ตัดการจ่าย 7 วัน ถ้าไม่ครบ 7 วันไม่ผ่าน')
    setFormIsActive(true)
    setDrugSearchQuery('')
    setFormError(null)
    setIsModalOpen(true)
  }

  // Open modal for editing existing rule
  const handleOpenEditModal = (rule: DispensingRule) => {
    setEditingRule(rule)
    setSelectedDrugs([{ icode: rule.drug_icode, drug_name: rule.drug_name }])
    setFormIcode(rule.drug_icode)
    setFormDrugName(rule.drug_name)
    setFormPttypeLabel(rule.pttype_name_label)
    setFormPttypeFilter(rule.pttype_filter)
    setFormIntervalDays(rule.min_interval_days)
    setFormDescription(rule.rule_description || '')
    setFormIsActive(rule.is_active)
    setDrugSearchQuery('')
    setFormError(null)
    setIsModalOpen(true)
  }

  // Toggle drug selection
  const handleToggleDrug = (drug: { icode: string; drug_name: string }) => {
    setSelectedDrugs((prev) => {
      const exists = prev.some((d) => d.icode === drug.icode)
      const next = exists
        ? prev.filter((d) => d.icode !== drug.icode)
        : [...prev, { icode: drug.icode, drug_name: drug.drug_name }]

      const firstItem = next[0]
      if (next.length === 1 && firstItem) {
        setFormDrugName(firstItem.drug_name)
        setFormIcode(firstItem.icode)
        setFormDescription(`เงื่อนไข${formPttypeLabel} ตัดการจ่าย ${formIntervalDays} วัน ถ้าไม่ครบ ${formIntervalDays} วันไม่ผ่าน`)
      } else if (next.length > 1 && firstItem) {
        setFormDrugName(`${firstItem.drug_name} และอีก ${next.length - 1} รายการ`)
        setFormIcode(next.map((d) => d.icode).join(','))
        setFormDescription(`เงื่อนไข${formPttypeLabel} (${next.length} รายการยา) ตัดการจ่าย ${formIntervalDays} วัน ถ้าไม่ครบ ${formIntervalDays} วันไม่ผ่าน`)
      } else {
        setFormDrugName('')
        setFormIcode('')
      }
      return next
    })
  }

  // Select all filtered drugs
  const handleSelectAllFilteredDrugs = () => {
    const newItems = filteredDrugs.map((d) => ({ icode: d.icode, drug_name: d.drug_name }))
    setSelectedDrugs((prev) => {
      const map = new Map(prev.map((d) => [d.icode, d]))
      for (const item of newItems) {
        map.set(item.icode, item)
      }
      const next = Array.from(map.values())
      const firstItem = next[0]
      if (next.length > 0 && firstItem) {
        setFormDrugName(next.length === 1 ? firstItem.drug_name : `${firstItem.drug_name} และอีก ${next.length - 1} รายการ`)
        setFormIcode(next.map((d) => d.icode).join(','))
        setFormDescription(`เงื่อนไข${formPttypeLabel} (${next.length} รายการยา) ตัดการจ่าย ${formIntervalDays} วัน ถ้าไม่ครบ ${formIntervalDays} วันไม่ผ่าน`)
      }
      return next
    })
  }

  // Clear all selected drugs
  const handleClearAllSelectedDrugs = () => {
    setSelectedDrugs([])
    setFormIcode('')
    setFormDrugName('')
  }

  // Remove single selected drug
  const handleRemoveSelectedDrug = (icode: string) => {
    setSelectedDrugs((prev) => {
      const next = prev.filter((d) => d.icode !== icode)
      const firstItem = next[0]
      if (next.length === 1 && firstItem) {
        setFormDrugName(firstItem.drug_name)
        setFormIcode(firstItem.icode)
      } else if (next.length > 1 && firstItem) {
        setFormDrugName(`${firstItem.drug_name} และอีก ${next.length - 1} รายการ`)
        setFormIcode(next.map((d) => d.icode).join(','))
      } else {
        setFormDrugName('')
        setFormIcode('')
      }
      return next
    })
  }

  // Apply a right preset
  const handleSelectPreset = (preset: RightPreset) => {
    setFormPttypeLabel(preset.label)
    setFormPttypeFilter(preset.filter)
    if (!formDescription || formDescription.includes('ตัดการจ่าย')) {
      const drugLabel = selectedDrugs.length > 1 ? ` (${selectedDrugs.length} รายการยา)` : ''
      setFormDescription(`เงื่อนไข${preset.label}${drugLabel} ตัดการจ่าย ${formIntervalDays} วัน ถ้าไม่ครบ ${formIntervalDays} วันไม่ผ่าน`)
    }
  }

  // Apply day preset
  const handleSelectDays = (days: number) => {
    setFormIntervalDays(days)
    if (!formDescription || formDescription.includes('ตัดการจ่าย')) {
      const drugLabel = selectedDrugs.length > 1 ? ` (${selectedDrugs.length} รายการยา)` : ''
      setFormDescription(`เงื่อนไข${formPttypeLabel}${drugLabel} ตัดการจ่าย ${days} วัน ถ้าไม่ครบ ${days} วันไม่ผ่าน`)
    }
  }

  // Save form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedDrugs.length === 0) {
      setFormError('กรุณาเลือกรายการยาสมุนไพรอย่างน้อย 1 รายการ')
      return
    }
    if (formIntervalDays <= 0) {
      setFormError('รอบการจ่ายต้องมากกว่า 0 วัน')
      return
    }

    setFormError(null)
    saveRule(
      {
        id: editingRule?.id,
        drug_icode: selectedDrugs[0]?.icode ?? formIcode.trim(),
        drug_name: selectedDrugs[0]?.drug_name ?? formDrugName.trim(),
        selected_drugs: selectedDrugs,
        pttype_filter: formPttypeFilter.trim() || 'ALL',
        pttype_name_label: formPttypeLabel.trim() || 'ทุกสิทธิ',
        min_interval_days: formIntervalDays,
        rule_description: formDescription.trim(),
        is_active: formIsActive,
      },
      {
        onSuccess: () => {
          setIsModalOpen(false)
        },
        onError: (err) => {
          setFormError(err instanceof Error ? err.message : 'บันทึกเงื่อนไขไม่สำเร็จ')
        },
      }
    )
  }

  // Delete confirm dialog state
  const [deleteTargetRule, setDeleteTargetRule] = useState<DispensingRule | null>(null)

  // Handle delete
  const handleDelete = (rule: DispensingRule) => {
    if (!rule.id) return
    setDeleteTargetRule(rule)
  }

  // Filtered rules
  const filteredRules = useMemo(() => {
    if (!search.trim()) return rules
    const q = search.trim().toLowerCase()
    return rules.filter(
      (r) =>
        r.drug_icode.toLowerCase().includes(q) ||
        r.drug_name.toLowerCase().includes(q) ||
        r.pttype_name_label.toLowerCase().includes(q) ||
        r.pttype_filter.toLowerCase().includes(q) ||
        (r.rule_description && r.rule_description.toLowerCase().includes(q))
    )
  }, [rules, search])

  // Drugs available for autocomplete/multiselect
  const filteredDrugs = useMemo(() => {
    if (!drugSearchQuery.trim()) return dxMap
    const q = drugSearchQuery.trim().toLowerCase()
    return dxMap.filter(
      (d) => d.icode.toLowerCase().includes(q) || d.drug_name.toLowerCase().includes(q)
    )
  }, [dxMap, drugSearchQuery])

  return (
    <div className="space-y-4">
      {/* Information Banner */}
      <div className="rounded-2xl bg-themed-card border border-themed p-4 text-xs text-slate-600 dark:text-slate-200 flex items-start gap-3 shadow-xs">
        <div className="grid place-items-center size-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
          <Clock className="size-4.5" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <strong className="text-sm font-bold block text-slate-900 dark:text-white tracking-tight">
              ตั้งค่าเงื่อนไขรอบการจ่ายยาสมุนไพร & สิทธิการรักษา (Dispensing Interval Rules)
            </strong>
            {canEdit && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                <ShieldCheck className="size-3.5" /> บัญชีมีสิทธิ์จัดการเงื่อนไขรอบการจ่าย
              </span>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            กำหนดระยะห่างขั้นต่ำในการสั่งจ่ายซ้ำสำหรับผู้ป่วยคนเดิม (HN เดียวกัน) ตามสิทธิการรักษา เช่น{' '}
            <strong className="text-amber-700 dark:text-amber-300">ยาธาตุอบเชย ขนาดบรรจุ ขวด (120 ml.) เงื่อนไขสิทธิ UC ตัดการจ่าย 7 วัน</strong>{' '}
            หากผู้ป่วยมารับยาก่อนครบระยะเวลาที่กำหนด ระบบจะตรวจจับและระบุสถานะเป็น{' '}
            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
              จ่ายซ้ำไม่ครบ 7 วัน (สิทธิ UC)
            </span>{' '}
            ในหน้า <strong>"ตรวจสอบการจ่ายยาสมุนไพร"</strong> โดยอัตโนมัติ
          </p>
        </div>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/25 dark:bg-amber-950/20 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p>บัญชีนี้ดูเงื่อนไขรอบการจ่ายได้ แต่แก้ไขหรือบันทึกไม่ได้ (สิทธิ์แก้ไขเปิดให้ผู้ดูแลระบบ, เจ้าหน้าที่การแพทย์แผนไทย และเภสัชกร)</p>
        </div>
      )}

      {/* Toolbar / Search Header */}
      <div className="rounded-2xl bg-themed-card ring-1 ring-slate-200 dark:ring-[#292440] p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-xs dark:shadow-sm">
        <div className="relative w-full sm:flex-1 sm:max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหารหัสยา, รายการยา, สิทธิการรักษา, เงื่อนไขรอบวัน…"
            className="w-full rounded-xl bg-slate-50 dark:bg-[#101326] ring-1 ring-slate-200 dark:ring-[#34304a] pl-9 pr-3 py-1.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
          <div className="text-xs sm:text-xs text-slate-500 dark:text-slate-400 font-medium sm:shrink-0">
            เปิดใช้งาน <strong className="font-bold text-slate-800 dark:text-slate-200">{rules.filter((r) => r.is_active).length}</strong>/{rules.length} เงื่อนไข
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="btn-pill-action shrink-0 inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all touch-manipulation"
            >
              <Plus className="size-3.5" />
              <span className="sm:hidden">+ เพิ่มเงื่อนไข</span>
              <span className="hidden sm:inline">เพิ่มเงื่อนไขรอบการจ่าย</span>
            </button>
          )}
        </div>
      </div>

      {/* Table of Dispensing Rules */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100/80 dark:bg-[#1a1e36] border-b border-slate-200 dark:border-[#292440] text-slate-700 dark:text-slate-200 font-bold">
              <tr>
                <th className="py-3 px-3 text-center w-12">ลำดับ</th>
                <th className="py-3 px-3 text-center w-24">รหัสยา</th>
                <th className="py-3 px-4 min-w-[220px]">รายการยาสมุนไพร</th>
                <th className="py-3 px-4 min-w-[190px]">สิทธิการรักษาที่บังคับใช้</th>
                <th className="py-3 px-3 text-center min-w-[150px]">รอบการจ่าย (วัน)</th>
                <th className="py-3 px-4 min-w-[240px]">คำอธิบายเงื่อนไข</th>
                <th className="py-3 px-3 text-center w-24">สถานะ</th>
                {canEdit && <th className="py-3 px-3 text-center w-24">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#292440]/60">
              {isLoading ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="py-12 text-center text-slate-400">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    กำลังโหลดเงื่อนไขรอบการจ่าย…
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="py-12 text-center text-slate-400">
                    ไม่พบเงื่อนไขรอบการจ่ายที่ค้นหา
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule, idx) => {
                  const isUC = rule.pttype_filter.includes('UC') || rule.pttype_filter.includes('บัตรทอง')
                  const isSSS = rule.pttype_filter.includes('SSS') || rule.pttype_filter.includes('ประกันสังคม')
                  const isOFC = rule.pttype_filter.includes('OFC') || rule.pttype_filter.includes('ข้าราชการ')
                  const isAll = rule.pttype_filter === 'ALL'

                  const rightBadgeClass = isUC
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : isSSS
                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                      : isOFC
                        ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                        : isAll
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'

                  return (
                    <tr
                      key={rule.id ?? idx}
                      className={cn(
                        'hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors',
                        !rule.is_active && 'opacity-60 bg-slate-50/50 dark:bg-slate-900/30'
                      )}
                    >
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {rule.drug_icode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {rule.drug_name}
                        </div>
                        {(() => {
                          const matchedDx = dxMap.find((d) => d.icode === rule.drug_icode)
                          if (!matchedDx) return null
                          const codes = (matchedDx.dx_prefixes || '')
                            .split(/[,\s]+/)
                            .map((c) => c.trim())
                            .filter(Boolean)
                          if (codes.length === 0) {
                            return <div className="text-[11px] text-amber-500 italic mt-0.5">ยังไม่ได้กำหนด ICD</div>
                          }
                          const displayCodes = codes.slice(0, 4)
                          const remainingCount = codes.length - 4
                          return (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <span className="text-[10px] text-slate-400 font-medium">ICD:</span>
                              {displayCodes.map((code) => (
                                <span
                                  key={code}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700/50 font-bold"
                                >
                                  {code}
                                </span>
                              ))}
                              {remainingCount > 0 && (
                                <span
                                  title={codes.slice(4).join(', ')}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold cursor-help"
                                >
                                  +{remainingCount}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border shadow-2xs', rightBadgeClass)}>
                            {rule.pttype_name_label}
                          </span>
                          {rule.pttype_filter !== 'ALL' && (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[200px]" title={rule.pttype_filter}>
                              สิทธิ: {rule.pttype_filter}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap shadow-2xs">
                          <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
                          ตัดการจ่าย {rule.min_interval_days} วัน
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="max-w-[260px] text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {rule.rule_description || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {canEdit ? (
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => rule.id && toggleRule({ id: rule.id, isActive: !rule.is_active })}
                            className="inline-flex items-center gap-1 cursor-pointer transition-transform hover:scale-105"
                            title={rule.is_active ? 'คลิกเพื่อปิดใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}
                          >
                            {rule.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                <Check className="size-3" /> เปิด
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/15 text-slate-500 border border-slate-500/20">
                                <X className="size-3" /> ปิด
                              </span>
                            )}
                          </button>
                        ) : (
                          <span>{rule.is_active ? 'เปิด' : 'ปิด'}</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(rule)}
                              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
                              title="แก้ไขเงื่อนไข"
                            >
                              <Edit3 className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDelete(rule)}
                              className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                              title="ลบเงื่อนไข"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-[#292440] bg-white dark:bg-[#121629] p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#292440] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid place-items-center size-9 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  <Clock className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingRule ? 'แก้ไขเงื่อนไขรอบการจ่าย' : 'เพิ่มเงื่อนไขรอบการจ่ายยาสมุนไพร'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    กำหนดรอบการสั่งจ่ายขั้นต่ำตามสิทธิการรักษา และเลือกยาสมุนไพรได้หลายรายการพร้อมกัน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/25 dark:bg-rose-950/20 dark:text-rose-200">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 2-Column Responsive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Column 1: Drug Selection */}
                <div className="space-y-2.5 flex flex-col">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      1. เลือกรายการยาสมุนไพร <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-xs text-slate-400 font-medium">
                      (เลือกได้หลายรายการพร้อมกัน)
                    </span>
                  </div>

                  {/* Selected Drugs Preview Chips */}
                  {selectedDrugs.length > 0 && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        <span className="flex items-center gap-1.5">
                          <Check className="size-3.5" />
                          เลือกแล้ว: <strong>{selectedDrugs.length}</strong> รายการ
                        </span>
                        <button
                          type="button"
                          onClick={handleClearAllSelectedDrugs}
                          className="text-xs text-rose-500 hover:underline cursor-pointer"
                        >
                          ล้างที่เลือกทั้งหมด
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {selectedDrugs.map((d) => (
                          <span
                            key={d.icode}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-white dark:bg-[#1a2035] text-slate-800 dark:text-slate-200 border border-emerald-500/30 shadow-2xs"
                          >
                            <span>{d.drug_name}</span>
                            <code className="text-xs font-mono text-slate-400">({d.icode})</code>
                            <button
                              type="button"
                              onClick={() => handleRemoveSelectedDrug(d.icode)}
                              className="hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                              title="นำออก"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search and Action Buttons */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={drugSearchQuery}
                        onChange={(e) => setDrugSearchQuery(e.target.value)}
                        placeholder="ค้นหายาสมุนไพร (ชื่อยา หรือ รหัสยา)…"
                        className="w-full rounded-xl bg-slate-50 dark:bg-[#1a1f36] ring-1 ring-slate-200 dark:ring-[#34304a] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    {filteredDrugs.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllFilteredDrugs}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-pointer transition-colors"
                      >
                        เลือกที่ค้นพบ ({filteredDrugs.length})
                      </button>
                    )}
                    {selectedDrugs.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllSelectedDrugs}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-white/10 hover:bg-rose-500/20 text-slate-600 dark:text-slate-300 hover:text-rose-500 cursor-pointer transition-colors"
                      >
                        ล้าง
                      </button>
                    )}
                  </div>

                  {/* Drug Checkbox List with Synced ICD-10 Badges */}
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#34304a] divide-y divide-slate-100 dark:divide-white/5 bg-slate-50/50 dark:bg-[#101326] flex-1">
                    {filteredDrugs.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        ไม่พบยาสมุนไพรที่ตรงกับคำค้นหา
                      </div>
                    ) : (
                      filteredDrugs.map((d) => {
                        const isSelected = selectedDrugs.some((item) => item.icode === d.icode)
                        return (
                          <label
                            key={d.icode}
                            className={cn(
                              'w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-500/10 cursor-pointer transition-colors select-none',
                              isSelected && 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 font-semibold'
                            )}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleDrug(d)}
                                className="size-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-emerald-600 shrink-0"
                              />
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="truncate">{d.drug_name}</span>
                                  <span className="font-mono text-xs text-slate-400 shrink-0">({d.icode})</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {d.dx_prefixes ? (
                                    <span className="font-mono text-xs px-1 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30">
                                      ICD: {d.dx_prefixes}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">ยังไม่กำหนด ICD</span>
                                  )}
                                  {d.dispensing_interval_days && (
                                    <span className="text-xs px-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40">
                                      รอบ {d.dispensing_interval_days} วัน
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
                                เลือกแล้ว
                              </span>
                            )}
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Column 2: Rights & Interval Details */}
                <div className="space-y-3.5">
                  {/* Rights Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                        2. เลือกสิทธิการรักษา <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-xs text-slate-400 font-medium">
                        (เลือกสิทธิที่ต้องการบังคับใช้)
                      </span>
                    </div>

                    {/* Preset Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {RIGHT_PRESETS.map((p) => {
                        const isSelected = formPttypeLabel === p.label || formPttypeFilter === p.filter
                        return (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => handleSelectPreset(p)}
                            className={cn(
                              'px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                              isSelected
                                ? `${p.color} ring-2 ring-emerald-500 font-bold shadow-xs`
                                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                            )}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* HOSxP Pttype Search & Multi-select Box */}
                    <div className="rounded-xl border border-slate-200 dark:border-[#34304a] bg-slate-50/50 dark:bg-[#101326] p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={pttypeSearchQuery}
                            onChange={(e) => setPttypeSearchQuery(e.target.value)}
                            placeholder="ค้นหารหัสสิทธิ หรือชื่อสิทธิการรักษา..."
                            className="w-full rounded-lg bg-white dark:bg-[#181c30] ring-1 border-0 ring-slate-200 dark:ring-[#34304a] pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        {filteredPttypes.length > 0 && (
                          <button
                            type="button"
                            onClick={handleSelectAllFiltered}
                            className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-pointer transition-colors"
                          >
                            เลือกที่ค้นพบ ({filteredPttypes.length})
                          </button>
                        )}
                        {selectedPttypeTokens.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllSelected}
                            className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-white/10 hover:bg-rose-500/20 text-slate-600 dark:text-slate-300 hover:text-rose-500 cursor-pointer transition-colors"
                          >
                            ล้างที่เลือก
                          </button>
                        )}
                      </div>

                      {/* Scrollable list of pttypes */}
                      <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200/80 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-[#14182b]">
                        {isLoadingPttypes ? (
                          <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 className="size-4 animate-spin text-emerald-500" />
                            <span>กำลังโหลดรหัสสิทธิการรักษาจาก HOSxP…</span>
                          </div>
                        ) : filteredPttypes.length === 0 ? (
                          <div className="py-4 text-center text-xs text-slate-400">
                            ไม่พบรหัสสิทธิที่ตรงกับ "{pttypeSearchQuery}"
                          </div>
                        ) : (
                          filteredPttypes.map((p) => {
                            const checked = isPttypeSelected(p)
                            return (
                              <div
                                key={p.pttype}
                                onClick={() => handleTogglePttype(p)}
                                className={cn(
                                  'px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors select-none',
                                  checked
                                    ? 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 font-medium'
                                    : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {}}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 size-3.5 cursor-pointer shrink-0"
                                  />
                                  <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-white/10 shrink-0">
                                    [{p.pttype}]
                                  </span>
                                  <span className="truncate text-xs">{p.name}</span>
                                </div>
                                {p.pcode && (
                                  <span className="text-xs font-mono text-slate-400 shrink-0">
                                    กลุ่ม {p.pcode}
                                  </span>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>

                      {/* Selected count info & preview */}
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                        <span>
                          เลือกแล้ว: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedPttypeTokens.length}</strong> สิทธิ
                        </span>
                        <span className="text-xs text-slate-400">
                          รหัสสิทธิ HOSxP ทั้งหมด: {pttypes.length} รายการ
                        </span>
                      </div>
                    </div>

                    {/* Display Label and Raw Filter Code Fields */}
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <span className="text-xs text-slate-400 block mb-0.5 font-medium">ชื่อแสดงของสิทธิ:</span>
                        <input
                          type="text"
                          value={formPttypeLabel}
                          onChange={(e) => setFormPttypeLabel(e.target.value)}
                          placeholder="เช่น สิทธิ UC / บัตรทอง หรือ [89] UC ทั่วไป"
                          className="w-full rounded-xl bg-slate-50 dark:bg-[#1a1f36] ring-1 ring-slate-200 dark:ring-[#34304a] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block mb-0.5 font-medium">รหัสสิทธิ/คีย์เวิร์ดกรอง:</span>
                        <input
                          type="text"
                          value={formPttypeFilter}
                          onChange={(e) => setFormPttypeFilter(e.target.value)}
                          placeholder="เช่น 89, 02, UC, บัตรทอง"
                          className="w-full rounded-xl bg-slate-50 dark:bg-[#1a1f36] ring-1 ring-slate-200 dark:ring-[#34304a] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-mono"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Interval Days */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      3. กำหนดรอบการจ่าย (วัน) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {DAY_PRESETS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleSelectDays(d)}
                          className={cn(
                            'px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                            formIntervalDays === d
                              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50 font-bold ring-2 ring-amber-500 shadow-xs'
                              : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                          )}
                        >
                          {d} วัน
                        </button>
                      ))}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={formIntervalDays}
                          onChange={(e) => handleSelectDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-16 rounded-xl bg-slate-50 dark:bg-[#1a1f36] ring-1 ring-slate-200 dark:ring-[#34304a] px-2 py-1 text-center font-mono text-xs text-slate-900 dark:text-white"
                        />
                        <span className="text-xs text-slate-500">วัน</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      หากคนไข้มารับยานี้อีกครั้งก่อนครบกำหนด <strong className="text-amber-700 dark:text-amber-300">{formIntervalDays} วัน</strong> ระบบจะตัดสินเป็น <strong>"ไม่ผ่าน"</strong> ในหน้าตรวจสอบการจ่ายยาสมุนไพร
                    </p>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      4. คำอธิบาย / หมายเหตุเงื่อนไข
                    </label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="เช่น เงื่อนไขสิทธิ UC ตัดการจ่าย 7 วัน ถ้าไม่ครบ 7 วันไม่ผ่าน"
                      className="w-full rounded-xl bg-slate-50 dark:bg-[#1a1f36] ring-1 ring-slate-200 dark:ring-[#34304a] px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Status Switch */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/10">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      สถานะการเปิดใช้งานเงื่อนไขนี้
                    </span>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={cn('w-10 h-5 rounded-full transition-colors relative', formIsActive ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700')}>
                        <div className={cn('size-4 rounded-full bg-white transition-transform absolute top-0.5', formIsActive ? 'left-5.5' : 'left-0.5')} />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {formIsActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-[#292440]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-pill-action inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-xs cursor-pointer hover:brightness-105 active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  <span>{editingRule ? 'บันทึกการแก้ไข' : 'บันทึกเงื่อนไข'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modern Confirm Modal for deleting rule */}
      {deleteTargetRule && (
        <ConfirmModal
          isOpen={Boolean(deleteTargetRule)}
          title="ยืนยันการลบเงื่อนไขรอบการจ่าย"
          description={`คุณต้องการลบเงื่อนไขรอบการจ่ายของยา "${deleteTargetRule.drug_name}" ใช่หรือไม่?`}
          detail={`สิทธิที่ถูกควบคุม: ${deleteTargetRule.pttype_name_label} • ระยะเวลาตัดการจ่าย: ${deleteTargetRule.min_interval_days} วัน`}
          confirmText="ลบเงื่อนไข"
          variant="danger"
          icon="trash"
          isLoading={isDeleting}
          onClose={() => setDeleteTargetRule(null)}
          onConfirm={() => {
            if (deleteTargetRule.id) {
              deleteRule(deleteTargetRule.id, {
                onSuccess: () => setDeleteTargetRule(null),
              })
            }
          }}
        />
      )}
    </div>
  )
}
