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
  Sparkles,
  Loader2,
} from 'lucide-react'
import {
  useDispensingRules,
  useSaveDispensingRule,
  useToggleDispensingRule,
  useDeleteDispensingRule,
} from '@/hooks/useHerbDx'
import type { DispensingRule, DxMapRecord } from '@/types/herbdx.types'
import { cn } from '@/lib/utils'

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

const DAY_PRESETS = [3, 5, 7, 10, 14, 30]

export const DispensingRulesTab: FC<DispensingRulesTabProps> = ({ dxMap, canEdit }) => {
  const { data: rules = [], isLoading } = useDispensingRules()
  const { mutate: saveRule, isPending: isSaving } = useSaveDispensingRule()
  const { mutate: toggleRule, isPending: isToggling } = useToggleDispensingRule()
  const { mutate: deleteRule, isPending: isDeleting } = useDeleteDispensingRule()

  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<DispensingRule | null>(null)

  // Modal Form State
  const [formIcode, setFormIcode] = useState('')
  const [formDrugName, setFormDrugName] = useState('')
  const [formPttypeLabel, setFormPttypeLabel] = useState('สิทธิ UC / บัตรทอง')
  const [formPttypeFilter, setFormPttypeFilter] = useState('UC,บัตรทอง,ประกันสุขภาพ,UCS')
  const [formIntervalDays, setFormIntervalDays] = useState(7)
  const [formDescription, setFormDescription] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)

  const [drugSearchQuery, setDrugSearchQuery] = useState('')

  // Open modal for creating new rule
  const handleOpenAddModal = () => {
    setEditingRule(null)
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
    setFormIcode(rule.drug_icode)
    setFormDrugName(rule.drug_name)
    setFormPttypeLabel(rule.pttype_name_label)
    setFormPttypeFilter(rule.pttype_filter)
    setFormIntervalDays(rule.min_interval_days)
    setFormDescription(rule.rule_description || '')
    setFormIsActive(rule.is_active)
    setDrugSearchQuery(rule.drug_name)
    setFormError(null)
    setIsModalOpen(true)
  }

  // Apply a right preset
  const handleSelectPreset = (preset: RightPreset) => {
    setFormPttypeLabel(preset.label)
    setFormPttypeFilter(preset.filter)
    if (!formDescription || formDescription.includes('ตัดการจ่าย')) {
      setFormDescription(`เงื่อนไข${preset.label} ตัดการจ่าย ${formIntervalDays} วัน ถ้าไม่ครบ ${formIntervalDays} วันไม่ผ่าน`)
    }
  }

  // Apply day preset
  const handleSelectDays = (days: number) => {
    setFormIntervalDays(days)
    if (!formDescription || formDescription.includes('ตัดการจ่าย')) {
      setFormDescription(`เงื่อนไข${formPttypeLabel} ตัดการจ่าย ${days} วัน ถ้าไม่ครบ ${days} วันไม่ผ่าน`)
    }
  }

  // Save form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formIcode.trim() || !formDrugName.trim()) {
      setFormError('กรุณาเลือกรายการยาสมุนไพร')
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
        drug_icode: formIcode.trim(),
        drug_name: formDrugName.trim(),
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

  // Handle delete
  const handleDelete = (rule: DispensingRule) => {
    if (!rule.id) return
    const confirmed = window.confirm(
      `ยืนยันการลบเงื่อนไขรอบการจ่าย:\n"${rule.drug_name} (${rule.pttype_name_label} ตัดการจ่าย ${rule.min_interval_days} วัน)" หรือไม่?`
    )
    if (confirmed) {
      deleteRule(rule.id)
    }
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

  // Drugs available for autocomplete
  const filteredDrugs = useMemo(() => {
    if (!drugSearchQuery.trim()) return dxMap.slice(0, 10)
    const q = drugSearchQuery.trim().toLowerCase()
    return dxMap.filter(
      (d) => d.icode.toLowerCase().includes(q) || d.drug_name.toLowerCase().includes(q)
    ).slice(0, 15)
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
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
                <Sparkles className="size-3.5" /> บัญชีมีสิทธิ์จัดการเงื่อนไขรอบการจ่าย
              </span>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            กำหนดระยะห่างขั้นต่ำในการสั่งจ่ายซ้ำสำหรับผู้ป่วยคนเดิม (HN เดียวกัน) ตามสิทธิการรักษา เช่น{' '}
            <strong className="text-amber-700 dark:text-amber-300">ยาธาตุอบเชย ขนาดบรรจุ ขวด (120 ml.) เงื่อนไขสิทธิ UC ตัดการจ่าย 7 วัน</strong>{' '}
            หากผู้ป่วยมารับยาก่อนครบระยะเวลาที่กำหนด ระบบจะตรวจจับและระบุสถานะเป็น{' '}
            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
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
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium sm:shrink-0">
            เปิดใช้งาน {rules.filter((r) => r.is_active).length} จาก {rules.length} เงื่อนไข
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="btn-pill-action shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all"
            >
              <Plus className="size-3.5" />
              <span>เพิ่มเงื่อนไขรอบการจ่าย</span>
            </button>
          )}
        </div>
      </div>

      {/* Table of Dispensing Rules */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-[#1d2035] border-b border-slate-200 dark:border-[#292440] text-slate-700 dark:text-slate-300 font-bold">
              <tr>
                <th className="py-2.5 px-3 text-center w-12">ลำดับ</th>
                <th className="py-2.5 px-3 w-24">รหัสยา</th>
                <th className="py-2.5 px-3 min-w-[160px]">รายการยาสมุนไพร</th>
                <th className="py-2.5 px-3 min-w-[180px]">สิทธิการรักษาที่บังคับใช้</th>
                <th className="py-2.5 px-3 text-center min-w-[140px]">รอบการจ่าย (วัน)</th>
                <th className="py-2.5 px-3 min-w-[220px]">คำอธิบายเงื่อนไข</th>
                <th className="py-2.5 px-3 text-center w-24">สถานะ</th>
                {canEdit && <th className="py-2.5 px-3 text-center w-28">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#292440]/60">
              {isLoading ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="py-8 text-center text-slate-400">
                    <Loader2 className="size-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    กำลังโหลดเงื่อนไขรอบการจ่าย…
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="py-8 text-center text-slate-400">
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
                        'hover:bg-slate-50 dark:hover:bg-white/5 transition-colors',
                        !rule.is_active && 'opacity-60 bg-slate-50/50 dark:bg-slate-900/30'
                      )}
                    >
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {rule.drug_icode}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                        {rule.drug_name}
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border', rightBadgeClass)}>
                            {rule.pttype_name_label}
                          </span>
                          {rule.pttype_filter !== 'ALL' && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[200px]" title={rule.pttype_filter}>
                              คีย์เวิร์ด: {rule.pttype_filter}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                          <Clock className="size-3 text-amber-600 dark:text-amber-400" />
                          ตัดการจ่าย {rule.min_interval_days} วัน
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {rule.rule_description || '-'}
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
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                <Check className="size-3" /> เปิด
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/15 text-slate-500 border border-slate-500/20">
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
                              <Edit3 className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDelete(rule)}
                              className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                              title="ลบเงื่อนไข"
                            >
                              <Trash2 className="size-3.5" />
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
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-[#292440] bg-white dark:bg-[#121629] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#292440] pb-3">
              <div className="flex items-center gap-2">
                <div className="grid place-items-center size-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  <Clock className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingRule ? 'แก้ไขเงื่อนไขรอบการจ่าย' : 'เพิ่มเงื่อนไขรอบการจ่ายยาสมุนไพร'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
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

              {/* Drug Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  1. เลือกรายการยาสมุนไพร <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={drugSearchQuery}
                      onChange={(e) => setDrugSearchQuery(e.target.value)}
                      placeholder="พิมพ์เพื่อค้นหายาสมุนไพรในระบบ (เช่น อบเชย, ขมิ้นชัน)…"
                      className="w-full rounded-xl bg-slate-50 dark:bg-[#1a1f36] ring-1 ring-slate-200 dark:ring-[#34304a] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2"
                    />
                  </div>

                  {/* Drug options dropdown list */}
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#34304a] divide-y divide-slate-100 dark:divide-white/5 bg-slate-50/50 dark:bg-[#101326]">
                    {filteredDrugs.map((d) => {
                      const isSelected = formIcode === d.icode
                      return (
                        <button
                          key={d.icode}
                          type="button"
                          onClick={() => {
                            setFormIcode(d.icode)
                            setFormDrugName(d.drug_name)
                            setDrugSearchQuery(d.drug_name)
                            if (!formDescription || formDescription.includes('ตัดการจ่าย')) {
                              setFormDescription(`เงื่อนไข${formPttypeLabel} ตัดการจ่าย ${formIntervalDays} วัน ถ้าไม่ครบ ${formIntervalDays} วันไม่ผ่าน`)
                            }
                          }}
                          className={cn(
                            'w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-emerald-500/10 cursor-pointer transition-colors',
                            isSelected && 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold'
                          )}
                        >
                          <div>
                            <span className="font-semibold">{d.drug_name}</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-400">({d.icode})</span>
                          </div>
                          {isSelected && <Check className="size-3 text-emerald-600" />}
                        </button>
                      )
                    })}
                  </div>
                  {formIcode && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                      ✓ เลือกยา: <strong className="font-bold">{formDrugName}</strong> (รหัส: <code className="font-mono">{formIcode}</code>)
                    </div>
                  )}
                </div>
              </div>

              {/* Rights / Benefits Preset Chips */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  2. เลือกสิทธิการรักษา <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {RIGHT_PRESETS.map((p) => {
                    const isSelected = formPttypeLabel === p.label
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
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">ชื่อแสดงของสิทธิ:</span>
                    <input
                      type="text"
                      value={formPttypeLabel}
                      onChange={(e) => setFormPttypeLabel(e.target.value)}
                      placeholder="เช่น สิทธิ UC / บัตรทอง"
                      className="w-full rounded-xl bg-slate-50 dark:bg-[#1a1f36] ring-1 ring-slate-200 dark:ring-[#34304a] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">คีย์เวิร์ดกรองสิทธิ (คั่นด้วยจุลภาค):</span>
                    <input
                      type="text"
                      value={formPttypeFilter}
                      onChange={(e) => setFormPttypeFilter(e.target.value)}
                      placeholder="เช่น UC, บัตรทอง, ประกันสุขภาพ"
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
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50 font-bold ring-2 ring-amber-500'
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
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

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#292440]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-pill-action inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs cursor-pointer hover:brightness-105 active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  <span>{editingRule ? 'บันทึกการแก้ไข' : 'บันทึกเงื่อนไข'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
