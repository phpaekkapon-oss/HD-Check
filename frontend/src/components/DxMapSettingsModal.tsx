import { Fragment, useEffect, useRef, useState, useMemo, type FC } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from '@tanstack/react-table'
import { Edit3, Check, X, Search, Info, FlaskConical, ShieldAlert, Plus, Loader2, BadgeCheck, Clock, Layers } from 'lucide-react'
import { DispensingRulesTab } from '@/components/DispensingRulesTab'
import { ThaiMedRulesTab } from '@/components/ThaiMedRulesTab'
import { herbDxApi } from '@/api/herbdx.api'
import { useAuth } from '@/context/AuthContext'
import { useDxMap, useUpdateDxMap } from '@/hooks/useHerbDx'
import type { DxMapPreview, DxMapRecord } from '@/types/herbdx.types'
import { canManageHerbDx } from '@/types/auth.types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTableColumnHeader } from '@/components/DataTableColumnHeader'
import { DataTablePagination } from '@/components/DataTablePagination'
import { cn } from '@/lib/utils'

interface DxMapSettingsModalProps {
  readonly initialIcode?: string
}

function PreviewStat({ label, value, tone }: { readonly label: string; readonly value: number; readonly tone: 'neutral' | 'green' | 'red' | 'amber' }) {
  const toneClass = {
    neutral: 'text-slate-800 dark:text-slate-100',
    green: 'text-emerald-700 dark:text-emerald-300',
    red: 'text-rose-700 dark:text-rose-300',
    amber: 'text-amber-700 dark:text-amber-300',
  }[tone]
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2.5 py-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-base font-bold tabular-nums ${toneClass}`}>{value.toLocaleString('th-TH')}</p>
    </div>
  )
}

// ค่าว่างต้องเป็นอาร์เรย์ตัวเดิมเสมอ: ถ้าสร้าง [] ใหม่ทุก render ตาราง (TanStack) จะ reset แล้ว render วนไม่จบจนหน้าเว็บค้าง
const NO_DX_MAP: DxMapRecord[] = []

export type SettingsTabId = 'dxmap' | 'interval' | 'healthmed'

const SETTINGS_TABS: readonly {
  readonly id: SettingsTabId
  readonly label: string
  readonly hint: string
  readonly badge: string
  readonly icon: typeof Info
  readonly activeGradient: string
  readonly hoverBorder: string
  readonly iconTint: string
  readonly badgeTint: string
}[] = [
  {
    id: 'dxmap',
    label: 'เกณฑ์จับคู่รหัส ICD-10',
    hint: 'ยา ↔ ICD-10 & จ่ายขั้นต่ำ',
    badge: '',
    icon: Info,
    activeGradient: 'from-emerald-600 to-teal-500',
    hoverBorder: 'hover:border-emerald-400',
    iconTint: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    badgeTint: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  },
  {
    id: 'interval',
    label: 'เงื่อนไขรอบการจ่าย',
    hint: 'ตามสิทธิการรักษา',
    badge: 'UC 7 วัน',
    icon: Clock,
    activeGradient: 'from-amber-500 to-orange-500',
    hoverBorder: 'hover:border-amber-400',
    iconTint: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    badgeTint: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  },
  {
    id: 'healthmed',
    label: 'เกณฑ์ค่าบริการแพทย์แผนไทย',
    hint: 'ตรวจคิดค่าบริการซ้ำ',
    badge: 'คิดซ้ำ',
    icon: Layers,
    activeGradient: 'from-violet-600 to-fuchsia-500',
    hoverBorder: 'hover:border-violet-400',
    iconTint: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    badgeTint: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  },
]

/** แท็บหลักของหน้าตั้งค่าเกณฑ์: แต่ละแท็บมีสีประจำตัว แท็บที่เลือกเป็นพื้นไล่สีเข้มตัวอักษรขาว */
export const SettingsTabBar: FC<{
  readonly active: SettingsTabId
  readonly onChange: (id: SettingsTabId) => void
  readonly dxMapCount: number
}> = ({ active, onChange, dxMapCount }) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="tablist" aria-label="หมวดตั้งค่าเกณฑ์">
      {SETTINGS_TABS.map((t) => {
        const selected = active === t.id
        const Icon = t.icon
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.id)}
            className={cn(
              'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all cursor-pointer select-none active:scale-[0.98] touch-manipulation',
              selected
                ? cn('bg-gradient-to-r text-white shadow-md border-transparent', t.activeGradient)
                : cn('bg-white dark:bg-[#161a30] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-100 hover:-translate-y-0.5 hover:shadow-sm', t.hoverBorder)
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', selected ? 'bg-white/20 text-white' : t.iconTint)}>
                <Icon className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight">{t.label}</span>
                <span className={cn('mt-0.5 block truncate text-[11px] leading-tight', selected ? 'text-white/85' : 'text-slate-500 dark:text-slate-400')}>{t.hint}</span>
              </span>
            </span>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', selected ? 'bg-white/25 text-white' : t.badgeTint)}>
              {t.id === 'dxmap' ? dxMapCount : t.badge}
            </span>
          </button>
        )
      })}
    </div>
)

export const DxMapSettingsModal: FC<DxMapSettingsModalProps> = ({ initialIcode }) => {
  const { user } = useAuth()
  const canEdit = canManageHerbDx(user)
  const { data: dxMap = NO_DX_MAP, isLoading } = useDxMap()
  const { mutate: updateMap, isPending } = useUpdateDxMap()

  const [activeTab, setActiveTab] = useState<SettingsTabId>('dxmap')
  const [editingIcode, setEditingIcode] = useState<string | null>(null)
  const [prefixes, setPrefixes] = useState('')
  const [minQty, setMinQty] = useState<number>(0)
  const [indication, setIndication] = useState('')
  const [intervalDays, setIntervalDays] = useState<number>(0)
  const [pttypeLabel, setPttypeLabel] = useState('สิทธิ UC / บัตรทอง')
  const [search, setSearch] = useState(initialIcode ?? '')
  const initializedIcode = useRef<string | undefined>(undefined)
  const [sorting, setSorting] = useState<SortingState>([])
  const [preview, setPreview] = useState<DxMapPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [periodDays, setPeriodDays] = useState(90)
  const [saveError, setSaveError] = useState<string | null>(null)
  const broadPrefixes = prefixes.split(/[ ,\s]+/).map((prefix) => prefix.trim()).filter((prefix) => prefix.length === 1)

  // State for adding a new herbal drug from HOSxP
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addSearchQuery, setAddSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<readonly { icode: string; name: string; units?: string }[]>([])
  const [isSearchingDrugs, setIsSearchingDrugs] = useState(false)
  const [selectedDrug, setSelectedDrug] = useState<{ icode: string; name: string; units?: string } | null>(null)
  const [newPrefixes, setNewPrefixes] = useState('')
  const [newMinQty, setNewMinQty] = useState<number>(0)
  const [newIndication, setNewIndication] = useState('')
  const [newIntervalDays, setNewIntervalDays] = useState<number>(0)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAddModalOpen || !addSearchQuery.trim()) {
      setSearchResults([])
      setIsSearchingDrugs(false)
      return
    }
    const timer = setTimeout(async () => {
      setIsSearchingDrugs(true)
      try {
        const res = await herbDxApi.searchDrugs(addSearchQuery.trim())
        setSearchResults(res.data)
      } catch (err) {
        console.error(err)
        setSearchResults([])
      } finally {
        setIsSearchingDrugs(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [addSearchQuery, isAddModalOpen])

  const handleSelectDrugToAdd = (drug: { icode: string; name: string; units?: string }) => {
    setSelectedDrug(drug)
    const existing = dxMap.find((item) => item.icode === drug.icode)
    if (existing) {
      setNewPrefixes(existing.dx_prefixes)
      setNewMinQty(existing.min_qty ?? 0)
      setNewIndication(existing.indication)
      setNewIntervalDays(existing.dispensing_interval_days ?? 0)
    } else {
      setNewPrefixes('')
      setNewMinQty(0)
      setNewIndication('')
      setNewIntervalDays(0)
    }
    setAddError(null)
  }

  const handleSaveNewDrug = () => {
    if (!selectedDrug) return
    setAddError(null)
    updateMap(
      {
        icode: selectedDrug.icode,
        drug_name: selectedDrug.name,
        dx_prefixes: newPrefixes,
        min_qty: newMinQty,
        indication: newIndication,
        min_interval_days: newIntervalDays,
        pttype_filter: 'UC,บัตรทอง,ประกันสุขภาพ,UCS',
        pttype_name_label: 'สิทธิ UC / บัตรทอง',
      },
      {
        onSuccess: () => {
          setIsAddModalOpen(false)
          setSelectedDrug(null)
          setAddSearchQuery('')
          setNewPrefixes('')
          setNewMinQty(0)
          setNewIndication('')
          setNewIntervalDays(0)
        },
        onError: (err) => {
          setAddError(err instanceof Error ? err.message : 'บันทึกเกณฑ์ไม่สำเร็จ')
        },
      }
    )
  }

  useEffect(() => {
    if (!initialIcode || isLoading || initializedIcode.current === initialIcode) return
    initializedIcode.current = initialIcode
    const item = dxMap.find((entry) => entry.icode === initialIcode)
    if (!item) return

    setSearch(initialIcode)
    setEditingIcode(item.icode)
    setPrefixes(item.dx_prefixes)
    setMinQty(item.min_qty ?? 0)
    setIndication(item.indication)
    setIntervalDays(item.dispensing_interval_days ?? 0)
    setPttypeLabel(item.dispensing_pttype_label || 'สิทธิ UC / บัตรทอง')
    setPreview(null)
    setPreviewError(null)
  }, [dxMap, initialIcode, isLoading])

  const handleStartEdit = (item: DxMapRecord) => {
    setEditingIcode(item.icode)
    setPrefixes(item.dx_prefixes)
    setMinQty(item.min_qty ?? 0)
    setIndication(item.indication)
    setIntervalDays(item.dispensing_interval_days ?? 0)
    setPttypeLabel(item.dispensing_pttype_label || 'สิทธิ UC / บัตรทอง')
    setPreview(null)
    setPreviewError(null)
    setPeriodDays(90)
  }

  const handlePreview = async (icode: string, candidatePrefixes = prefixes) => {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      setPreview(await herbDxApi.previewDxMap(icode, candidatePrefixes, periodDays))
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'ทดลองเกณฑ์ไม่สำเร็จ')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSave = () => {
    if (!editingIcode) return
    setSaveError(null)
    updateMap(
      {
        icode: editingIcode,
        dx_prefixes: prefixes,
        min_qty: minQty,
        indication,
        min_interval_days: intervalDays,
        pttype_filter: 'UC,บัตรทอง,ประกันสุขภาพ,UCS',
        pttype_name_label: pttypeLabel,
      },
      {
        onSuccess: () => setEditingIcode(null),
        onError: (error) => setSaveError(error instanceof Error ? error.message : 'บันทึกเกณฑ์ไม่สำเร็จ'),
      }
    )
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return dxMap
    const q = search.trim().normalize('NFC').toLocaleLowerCase()
    return dxMap.filter(
      (item) =>
        item.icode.normalize('NFC').toLocaleLowerCase().includes(q) ||
        item.drug_name.normalize('NFC').toLocaleLowerCase().includes(q) ||
        item.dx_prefixes.normalize('NFC').toLocaleLowerCase().includes(q) ||
        item.indication.normalize('NFC').toLocaleLowerCase().includes(q)
    )
  }, [dxMap, search])

  const [expandedDxRows, setExpandedDxRows] = useState<Set<string>>(new Set())
  const toggleExpandDx = (icode: string) => {
    setExpandedDxRows((prev) => {
      const next = new Set(prev)
      if (next.has(icode)) next.delete(icode)
      else next.add(icode)
      return next
    })
  }

  const columns = useMemo<ColumnDef<DxMapRecord>[]>(
    () => [
      {
        id: 'index',
        header: () => <div className="text-center w-10">ลำดับ</div>,
        cell: ({ row, table }) => {
          const pageIndex = table.getState().pagination.pageIndex
          const pageSize = table.getState().pagination.pageSize
          return (
            <div className="text-center font-mono text-slate-400 dark:text-slate-400 text-xs font-semibold">
              {pageIndex * pageSize + row.index + 1}
            </div>
          )
        },
        enableSorting: false,
      },
      {
        accessorKey: 'icode',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="รหัสยา" />
        ),
        cell: ({ row }) => (
          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
            {row.original.icode}
          </span>
        ),
      },
      {
        accessorKey: 'drug_name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="รายการยาสมุนไพร" />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900 dark:text-white">
            {row.original.drug_name}
          </span>
        ),
      },
      {
        accessorKey: 'dx_prefixes',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="รหัส ICD-10 ที่อนุญาต (คั่นด้วยจุลภาค)"
            className="min-w-[380px] lg:min-w-[460px]"
          />
        ),
        cell: ({ row }) => {
          const item = row.original
          const isEditing = editingIcode === item.icode
          if (isEditing) {
            const editCodes = prefixes
              ? prefixes
                  .split(',')
                  .map((p) => p.trim())
                  .filter(Boolean)
              : []

            const handleRemoveCode = (codeToRemove: string) => {
              const remaining = editCodes.filter(
                (c) => c.toUpperCase() !== codeToRemove.toUpperCase()
              )
              setPrefixes(remaining.join(', '))
              setPreview(null)
            }

            return (
              <div className="min-w-[380px] lg:min-w-[460px] max-w-[600px] space-y-2 py-1">
                {/* แถบชิปรหัส ICD-10 พร้อมปุ่ม ✕ สำหรับคลิกลบออกทีละรหัสได้ทันที */}
                {editCodes.length > 0 ? (
                  <div className="p-2 rounded-xl bg-slate-100/90 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>รหัสปัจจุบัน (<strong>{editCodes.length}</strong> รหัส) • คลิก ✕ เพื่อลบออก</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPrefixes('')
                          setPreview(null)
                        }}
                        className="text-[11px] text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        ลบทั้งหมด
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {editCodes.map((p) => {
                        const isU = p.toUpperCase().startsWith('U')
                        return (
                          <span
                            key={p}
                            className={cn(
                              'inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md text-xs font-mono font-bold border transition-all shadow-2xs',
                              isU
                                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                            )}
                          >
                            <span>{p}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCode(p)}
                              title={`คลิกเพื่อลบรหัส ${p}`}
                              className="size-4 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500 dark:hover:bg-rose-600 transition-colors cursor-pointer"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-rose-500 dark:text-rose-400 italic px-1">
                    ยังไม่มีรหัส (พิมพ์รหัสในช่องด้านล่าง เช่น K30, R14, U6680)
                  </div>
                )}

                {/* กล่องข้อความแบบกว้างและหลายบรรทัด สำหรับพิมพ์เพิ่ม ลบ หรือวางหลายรหัส */}
                <div className="space-y-1">
                  <textarea
                    rows={2}
                    value={prefixes}
                    onChange={(e) => {
                      setPrefixes(e.target.value)
                      setPreview(null)
                    }}
                    placeholder="พิมพ์รหัส ICD-10 คั่นด้วยจุลภาค เช่น K30, R14, U6680"
                    className="w-full min-h-[56px] rounded-xl border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-3 py-2 font-mono text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y leading-relaxed"
                    autoFocus
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                    <span>คั่นรหัสด้วยจุลภาค (,) พิมพ์รหัสเดี่ยวหรือคำนำหน้ากลุ่มโรคได้</span>
                    <span className="hidden sm:inline text-slate-400">ขยายความสูงได้จากมุมขวาล่าง</span>
                  </div>
                </div>
              </div>
            )
          }
          const allCodes = item.dx_prefixes
            ? item.dx_prefixes.split(',').map((p) => p.trim()).filter(Boolean)
            : []
          if (allCodes.length === 0) {
            return (
              <div className="min-w-[380px] lg:min-w-[460px]">
                <span className="text-rose-500 italic text-xs">ยังไม่กำหนดรหัส</span>
              </div>
            )
          }
          const isExpanded = expandedDxRows.has(item.icode)
          const MAX_VISIBLE = 8
          const visibleCodes = isExpanded ? allCodes : allCodes.slice(0, MAX_VISIBLE)
          const remainingCount = allCodes.length - MAX_VISIBLE

          return (
            <div className="min-w-[380px] lg:min-w-[460px] max-w-[600px]">
              <div className="flex flex-wrap items-center gap-1 font-mono">
                {visibleCodes.map((p) => {
                  const isU = p.toUpperCase().startsWith('U')
                  return (
                    <span
                      key={p}
                      className={cn(
                        'px-1.5 py-0.5 rounded text-xs font-semibold border transition-all',
                        isU
                          ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                      )}
                    >
                      {p}
                    </span>
                  )
                })}
                {remainingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleExpandDx(item.icode)}
                    title={isExpanded ? 'คลิกเพื่อย่อ' : `คลิกเพื่อดูทั้งหมด (${allCodes.join(', ')})`}
                    className="px-1.5 py-0.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-white/10 cursor-pointer transition-colors"
                  >
                    {isExpanded ? 'ย่อลง' : `+${remainingCount}`}
                  </button>
                )}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'min_qty',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="จ่ายขั้นต่ำ" className="justify-center" />
        ),
        cell: ({ row }) => {
          const item = row.original
          const isEditing = editingIcode === item.icode
          if (isEditing) {
            return (
              <div className="flex items-center justify-center">
                <input
                  type="number"
                  min="0"
                  value={minQty}
                  onChange={(e) => setMinQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="0"
                  className="w-16 rounded-lg border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-2 py-1 font-mono text-center text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2"
                />
              </div>
            )
          }
          return (
            <div className="flex items-center justify-center font-mono">
              {item.min_qty && item.min_qty > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                  ≥ {item.min_qty}
                </span>
              ) : (
                <span className="text-slate-400 text-xs">-</span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'indication',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ข้อบ่งใช้ / สรรพคุณ" className="min-w-[180px]" />
        ),
        cell: ({ row }) => {
          const item = row.original
          const isEditing = editingIcode === item.icode
          if (isEditing) {
            return (
              <div className="min-w-[180px] max-w-[280px]">
                <textarea
                  rows={2}
                  value={indication}
                  onChange={(e) => setIndication(e.target.value)}
                  placeholder="ข้อบ่งใช้ของยา"
                  className="w-full rounded-lg border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 resize-y"
                />
              </div>
            )
          }
          return (
            <div className="min-w-[180px] max-w-[280px]">
              <span className="text-slate-600 dark:text-slate-300 line-clamp-3">
                {item.indication || '-'}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'dispensing_interval_days',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="รอบการจ่าย & สิทธิ" className="justify-center" />
        ),
        cell: ({ row }) => {
          const item = row.original
          const isEditing = editingIcode === item.icode
          if (isEditing) {
            return (
              <div className="flex flex-col gap-1 items-center">
                <div className="flex items-center gap-1">
                  {[0, 7, 15].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setIntervalDays(d)}
                      className={cn(
                        'px-1.5 py-0.5 rounded text-xs font-bold border cursor-pointer transition-all',
                        intervalDays === d
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50 ring-1 ring-amber-500'
                          : 'bg-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-white border-slate-200 dark:border-white/10'
                      )}
                    >
                      {d === 0 ? 'ไม่ระบุ' : `${d} วัน`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0"
                    className="w-12 rounded-lg border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-1 py-0.5 font-mono text-center text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1"
                  />
                  <span className="text-xs text-slate-400">วัน</span>
                </div>
              </div>
            )
          }
          return (
            <div className="flex items-center justify-center">
              {item.dispensing_interval_days && item.dispensing_interval_days > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 whitespace-nowrap">
                  <Clock className="size-3 text-amber-500" />
                  {item.dispensing_interval_days} วัน ({item.dispensing_pttype_label || 'UC'})
                </span>
              ) : (
                <span className="text-slate-400 text-xs">-</span>
              )}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-center w-24">จัดการ</div>,
        cell: ({ row }) => {
          const item = row.original
          const isEditing = editingIcode === item.icode
          if (isEditing) {
            return (
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSave}
                  className="btn-pill-action p-1 rounded-lg text-white cursor-pointer"
                  title="บันทึก"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingIcode(null)
                    setPreview(null)
                    setPreviewError(null)
                  }}
                  className="p-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/20 cursor-pointer"
                  title="ยกเลิก"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )
          }
          if (!canEdit) {
            return (
              <div className="text-center whitespace-nowrap">
                <span className="text-xs text-slate-400 dark:text-slate-400">ดูอย่างเดียว</span>
              </div>
            )
          }
          return (
            <div className="text-center whitespace-nowrap">
              <button
                type="button"
                onClick={() => handleStartEdit(item)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white cursor-pointer font-medium text-xs transition-colors"
              >
                <Edit3 className="size-3" /> แก้ไข
              </button>
            </div>
          )
        },
        enableSorting: false,
      },
    ],
    [editingIcode, prefixes, indication, isPending, canEdit, expandedDxRows]
  )

  const table = useReactTable({
    data: filtered as DxMapRecord[],
    columns,
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="space-y-4 pb-20 sm:pb-6">
      <SettingsTabBar active={activeTab} onChange={setActiveTab} dxMapCount={dxMap.length} />

      {activeTab === 'interval' ? (
        <DispensingRulesTab dxMap={dxMap} canEdit={canEdit} />
      ) : activeTab === 'healthmed' ? (
        <ThaiMedRulesTab canEdit={canEdit} />
      ) : (
        <>
          {/* Informational Banner with Hospital Gradient */}
          <div className="rounded-2xl bg-themed-card border border-themed p-4 text-xs text-slate-600 dark:text-slate-200 flex items-start gap-3 shadow-xs">
        <div className="grid place-items-center size-8 rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 shrink-0 mt-0.5">
          <Info className="size-4.5" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <strong className="text-sm font-bold block text-slate-900 dark:text-white tracking-tight">
              เกณฑ์การจับคู่ยาสมุนไพรกับรหัสการวินิจฉัยโรค (ICD-10 / ICD-10-TM)
            </strong>
            {canEdit && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                <BadgeCheck className="size-3.5" /> บัญชีมีสิทธิ์จัดการเกณฑ์ (แพทย์แผนไทย / Admin)
              </span>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            ระบบจะตรวจสอบว่าการสั่งจ่ายยานั้น มีรหัส PDX หรือ DX0-DX5 ที่ขึ้นต้นด้วยคำนำหน้าที่กำหนดไว้หรือไม่ (เช่น ระบุ <code className="font-mono bg-teal-950 text-teal-300 px-1.5 py-0.5 rounded font-bold border border-teal-500/30">M</code> จะครอบคลุมทุกรหัสโรคกล้ามเนื้อ M00-M99) แพทย์ พยาบาล และผู้สั่งอื่นๆ ผ่านเมื่อมีรหัสแผนปัจจุบัน (ICD10) ตรงเกณฑ์ ไม่ต้องมีรหัส U ส่วน<strong className="text-slate-800 dark:text-slate-100 font-bold">แพทย์แผนไทย 5 ท่านที่กำหนด</strong>ต้องมีรหัสแผนปัจจุบันตรงเกณฑ์ <strong className="text-emerald-700 dark:text-emerald-300 font-bold">ควบคู่กับ</strong>รหัสแพทย์แผนไทยที่ขึ้นต้นด้วย <code className="font-mono bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">U</code> ตัวใดก็ได้ (มีแต่รหัส U อย่างเดียวไม่ผ่าน)
          </p>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            สีในตารางผลตรวจ: <strong className="text-emerald-700 dark:text-emerald-300">เขียว = รหัสตรงเกณฑ์</strong>, <strong className="text-rose-700 dark:text-rose-300">แดง = รหัสไม่ตรง</strong>, <strong className="text-amber-700 dark:text-amber-300">เหลือง = ยังไม่มีเกณฑ์ให้ตรวจ</strong> ส่วนรหัส ICD สีเขียวในหน้านี้คือรหัสที่อนุญาต
          </p>
        </div>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/25 dark:bg-amber-950/20 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p>บัญชีนี้ดูเกณฑ์ได้ แต่แก้ไขหรือบันทึกไม่ได้ (สิทธิ์แก้ไขเปิดให้ผู้ดูแลระบบ, เจ้าหน้าที่การแพทย์แผนไทย และเภสัชกร)</p>
        </div>
      )}
      {saveError && (
        <div role="alert" className="rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:border-rose-500/25 dark:bg-rose-950/20 dark:text-rose-200">
          บันทึกไม่สำเร็จ: {saveError}
        </div>
      )}

      {/* Search & Action Header */}
      <div className="rounded-2xl bg-themed-card ring-1 ring-slate-200 dark:ring-[#292440] p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-xs dark:shadow-sm">
        <div className="relative w-full sm:flex-1 sm:max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหารหัสยา, ชื่อยาสมุนไพร, ข้อบ่งใช้…"
            className="w-full rounded-xl bg-slate-50 dark:bg-[#101326] ring-1 ring-slate-200 dark:ring-[#34304a] pl-9 pr-3 py-1.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
          <div className="text-xs sm:text-xs text-slate-500 dark:text-slate-400 font-medium sm:shrink-0">
            ทั้งหมด <strong className="font-bold text-slate-800 dark:text-slate-200">{dxMap.length}</strong> รายการ
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setSelectedDrug(null)
                setAddSearchQuery('')
                setSearchResults([])
                setNewPrefixes('')
                setNewIndication('')
                setAddError(null)
                setIsAddModalOpen(true)
              }}
              className="btn-pill-action shrink-0 inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs cursor-pointer hover:brightness-105 active:scale-95 transition-all touch-manipulation"
            >
              <Plus className="size-3.5" />
              <span className="sm:hidden">+ เพิ่มรายการยา</span>
              <span className="hidden sm:inline">ตั้งค่าเพิ่มรายการยา</span>
            </button>
          )}
        </div>
      </div>

      {/* Settings Grid with Shadcn Data Table */}
      <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm overflow-hidden space-y-0 transition-colors">
        {/* Table Toolbar Header with Shadcn title */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-[#1d2035] border-b border-slate-200 dark:border-[#292440]">
          <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">ตารางข้อมูล</span>
            <span className="text-slate-400 dark:text-slate-400">•</span>
            <span>คลิกหัวคอลัมน์เพื่อเรียงลำดับ</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            ค้นพบ {filtered.length} จาก {dxMap.length} รายการ
          </div>
        </div>

        {/* Scrollable table container */}
        <Table containerClassName="max-h-[68dvh] sm:min-h-[420px] overflow-auto">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-slate-200 dark:border-[#292440] bg-slate-100 dark:bg-[#1d2035]">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-slate-700 dark:text-slate-300 font-bold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-slate-400">
                  กำลังโหลดข้อมูลการตั้งค่า…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-slate-400">
                  ไม่พบรายการยาที่ค้นหา
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const item = row.original
                const isEditing = editingIcode === item.icode

                return (
                  <Fragment key={item.icode}>
                    <TableRow className={cn('hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-slate-100 dark:border-[#292440]/70', isEditing && 'bg-violet-50/40 dark:bg-violet-950/20')}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2.5 px-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isEditing && (
                      <TableRow className="bg-violet-50/60 dark:bg-violet-950/15 border-b border-violet-200 dark:border-violet-500/25">
                        <TableCell colSpan={columns.length} className="px-4 py-4">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">ทดลองเกณฑ์กับประวัติการจ่ายยานี้</span>
                              <select
                                value={periodDays}
                                onChange={(e) => { setPeriodDays(Number(e.target.value)); setPreview(null) }}
                                className="rounded-lg border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
                              >
                                <option value={30}>30 วันล่าสุด</option>
                                <option value={90}>90 วันล่าสุด</option>
                                <option value={365}>365 วันล่าสุด</option>
                                <option value={0}>ข้อมูลทั้งหมด</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => void handlePreview(item.icode)}
                                disabled={previewLoading}
                                className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60 cursor-pointer"
                              >
                                <FlaskConical className="size-3.5" /> {previewLoading ? 'กำลังคำนวณ…' : 'ทดลองเกณฑ์'}
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              ผลนี้เป็นการจำลองจากข้อมูลย้อนหลังเพื่อช่วยตรวจผลกระทบ ไม่ใช่คำแนะนำว่ารหัสใดถูกต้องทางคลินิก กรุณายืนยันรหัสกับข้อบ่งใช้และแนวทางที่หน่วยงานรับรองก่อนบันทึก
                            </p>
                            {broadPrefixes.length > 0 && (
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                คำนำหน้า {broadPrefixes.join(', ')} เป็นรหัสกว้าง อาจครอบคลุมหลายโรค ควรตรวจรายการรหัสที่ระบบจำลองให้ละเอียดก่อนบันทึก
                              </p>
                            )}
                            {previewError && <p className="text-xs font-medium text-rose-600 dark:text-rose-300">{previewError}</p>}
                            {preview && preview.icode === item.icode && (
                              <div className="space-y-3 rounded-xl border border-violet-200 dark:border-violet-500/25 bg-white/80 dark:bg-[#101326]/80 p-3">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                  <PreviewStat label={`รายการใน ${preview.periodDays || 'ทุก'} วัน`} value={preview.total} tone="neutral" />
                                  <PreviewStat label="ผ่าน" value={preview.pass} tone="green" />
                                  <PreviewStat label="ไม่ผ่าน" value={preview.fail} tone="red" />
                                  <PreviewStat label="ไม่มี DX" value={preview.noDx} tone="amber" />
                                  <PreviewStat label="ยังไม่มีเกณฑ์" value={preview.noMap} tone="amber" />
                                </div>
                                <div>
                                  <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">รหัสวินิจฉัยที่พบในประวัติ (สูงสุด 12 รหัส)</p>
                                  <p className="mb-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">รหัสที่พบบ่อยเป็นข้อมูลประกอบเท่านั้น ไม่ได้ยืนยันข้อบ่งใช้ ห้ามเพิ่มเกณฑ์จากความถี่อย่างเดียว</p>
                                  {preview.frequentDx.length ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {preview.frequentDx.map(({ code, count, matches }) => (
                                        <span key={code} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs ${matches ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-300'}`}>
                                          {code} · {count} ครั้ง · {matches ? 'ตรงกับเกณฑ์ทดลอง' : 'ไม่ตรง'}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">ไม่พบประวัติยานี้ในช่วงเวลาที่เลือก</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Shadcn Data Table Pagination */}
        <DataTablePagination table={table} pageSizeOptions={[10, 15, 25, 50, 100]} />
      </div>

      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-themed bg-themed-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูลการตั้งค่า…</div>
        ) : table.getRowModel().rows.length === 0 ? (
          <div className="rounded-2xl border border-themed bg-themed-card p-6 text-center text-sm text-slate-500 dark:text-slate-400">ไม่พบรายการยาที่ค้นหา</div>
        ) : table.getRowModel().rows.map((row) => {
          const item = row.original
          const isEditing = editingIcode === item.icode
          return (
            <article key={item.icode} className="rounded-2xl border border-themed bg-themed-card p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold leading-snug text-slate-900 dark:text-white break-words">{item.drug_name}</h3>
                  <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">รหัสยา {item.icode}</p>
                </div>
                {!isEditing && (
                  canEdit ? (
                    <button type="button" onClick={() => handleStartEdit(item)} className="h-8 sm:h-9 shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all touch-manipulation">
                      <Edit3 className="size-3.5 text-slate-500 dark:text-slate-400" /> แก้ไข
                    </button>
                  ) : <span className="shrink-0 text-xs text-slate-400">ดูอย่างเดียว</span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3 border-t border-slate-100 dark:border-white/10 pt-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">รหัส ICD-10 ที่อนุญาต</span>
                      {prefixes && (
                        <button
                          type="button"
                          onClick={() => { setPrefixes(''); setPreview(null) }}
                          className="text-[11px] text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          ลบทั้งหมด
                        </button>
                      )}
                    </div>
                    {(() => {
                      const mCodes = prefixes ? prefixes.split(',').map((p) => p.trim()).filter(Boolean) : []
                      if (mCodes.length === 0) return null
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-100/90 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] max-h-32 overflow-y-auto">
                          {mCodes.map((p) => {
                            const isU = p.toUpperCase().startsWith('U')
                            return (
                              <span
                                key={p}
                                className={cn(
                                  'inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md text-xs font-mono font-bold border',
                                  isU
                                    ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40'
                                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                                )}
                              >
                                <span>{p}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rem = mCodes.filter((c) => c.toUpperCase() !== p.toUpperCase())
                                    setPrefixes(rem.join(', '))
                                    setPreview(null)
                                  }}
                                  className="size-4 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500 cursor-pointer"
                                  title={`คลิกลบรหัส ${p}`}
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )
                    })()}
                    <textarea
                      rows={2}
                      value={prefixes}
                      onChange={(e) => { setPrefixes(e.target.value); setPreview(null) }}
                      placeholder="เช่น M, S หรือ K30, R14, U6680"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-3 py-2 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                    />
                    <p className="text-[11px] text-slate-400">แตะปุ่ม ✕ ที่รหัสเพื่อลบออกได้ทันที หรือพิมพ์แก้ไขในช่องข้อความ</p>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">ข้อบ่งใช้ / สรรพคุณ</span>
                    <textarea
                      rows={2}
                      value={indication}
                      onChange={(e) => setIndication(e.target.value)}
                      placeholder="ระบุข้อบ่งใช้ของยา"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 resize-y"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={isPending} onClick={handleSave} className="btn-pill-action min-h-11 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold disabled:opacity-50 touch-manipulation"><Check className="size-4" /> บันทึก</button>
                    <button type="button" onClick={() => { setEditingIcode(null); setPreview(null); setPreviewError(null) }} className="min-h-11 rounded-xl border border-slate-200 dark:border-white/10 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300 touch-manipulation">ยกเลิก</button>
                  </div>
                  <div className="rounded-xl border border-violet-200 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-950/15 p-3 space-y-2.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">ทดลองเกณฑ์กับประวัติย้อนหลัง</p>
                    <div className="flex gap-2">
                      <select value={periodDays} onChange={(e) => { setPeriodDays(Number(e.target.value)); setPreview(null) }} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-2 text-sm text-slate-800 dark:text-slate-100">
                        <option value={30}>30 วันล่าสุด</option><option value={90}>90 วันล่าสุด</option><option value={365}>365 วันล่าสุด</option><option value={0}>ข้อมูลทั้งหมด</option>
                      </select>
                      <button type="button" onClick={() => void handlePreview(item.icode)} disabled={previewLoading} className="min-h-11 shrink-0 rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white disabled:opacity-50 touch-manipulation"><FlaskConical className="mr-1 inline size-3.5" />{previewLoading ? 'กำลังทดลอง…' : 'ทดลอง'}</button>
                    </div>
                    {broadPrefixes.length > 0 && <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">รหัส {broadPrefixes.join(', ')} ครอบคลุมกว้าง ควรตรวจผลทดลองก่อนบันทึก</p>}
                    {previewError && <p className="text-xs text-rose-600 dark:text-rose-300">{previewError}</p>}
                    {preview?.icode === item.icode && (
                      <div className="grid grid-cols-2 gap-2">
                        <p className="col-span-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">รหัสที่พบบ่อยเป็นข้อมูลประกอบเท่านั้น ไม่ได้ยืนยันข้อบ่งใช้ ห้ามเพิ่มเกณฑ์จากความถี่อย่างเดียว</p>
                        <PreviewStat label={`รายการใน ${preview.periodDays || 'ทุก'} วัน`} value={preview.total} tone="neutral" />
                        <PreviewStat label="ผ่าน" value={preview.pass} tone="green" />
                        <PreviewStat label="ไม่ผ่าน" value={preview.fail} tone="red" />
                        <PreviewStat label="ไม่มี DX" value={preview.noDx} tone="amber" />
                        <PreviewStat label="ยังไม่มีเกณฑ์" value={preview.noMap} tone="amber" />
                        {preview.frequentDx.map(({ code, count, matches }) => (
                          <div key={code} className="col-span-2 flex items-center justify-between gap-2 rounded-lg bg-white/70 dark:bg-black/20 px-2.5 py-2 text-xs">
                            <span className="min-w-0 font-mono text-slate-700 dark:text-slate-200">{code} · {count} ครั้ง · {matches ? 'ตรงเกณฑ์' : 'ไม่ตรง'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 border-t border-slate-100 dark:border-white/10 pt-3">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">รหัส ICD-10 ที่อนุญาต</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.dx_prefixes ? item.dx_prefixes.split(',').map((prefix) => <span key={prefix} className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-300">{prefix.trim()}</span>) : <span className="text-xs italic text-rose-500">ยังไม่กำหนดรหัส</span>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">ข้อบ่งใช้ / สรรพคุณ</p>
                    <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 break-words">{item.indication || '-'}</p>
                  </div>
                </div>
              )}
            </article>
          )
        })}
        <DataTablePagination table={table} pageSizeOptions={[10, 15, 25, 50]} />
      </div>

      {/* Modal: เพิ่มรายการยาและกำหนดเกณฑ์ใหม่ */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#181b2e] border border-slate-200 dark:border-[#2d284a] shadow-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="grid place-items-center size-8 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                  <Plus className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    ตั้งค่าเพิ่มรายการยา / เกณฑ์ ICD-10
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ค้นหาและกำหนดยาสมุนไพรจากฐานข้อมูล HOSxP
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="size-4.5" />
              </button>
            </div>

            {addError && (
              <div className="rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/25 dark:bg-rose-950/20 dark:text-rose-200">
                {addError}
              </div>
            )}

            {!selectedDrug ? (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    ค้นหายาจาก HOSxP (drugitems)
                  </span>
                  <div className="relative">
                    <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={addSearchQuery}
                      onChange={(e) => setAddSearchQuery(e.target.value)}
                      placeholder="พิมพ์ชื่อยา หรือรหัสยา เช่น ขมิ้น, ฟ้าทะลาย, 1540012..."
                      className="w-full rounded-xl border border-slate-300 dark:border-[#34304a] bg-slate-50 dark:bg-[#101326] pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      autoFocus
                    />
                    {isSearchingDrugs && (
                      <Loader2 className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 animate-spin" />
                    )}
                  </div>
                </label>

                {searchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto border border-slate-200 dark:border-[#2d284a] rounded-xl p-1 bg-slate-50/50 dark:bg-black/20">
                    <p className="px-2 py-1 text-xs font-semibold text-slate-400">
                      พบ {searchResults.length} รายการ (คลิกเพื่อเลือก)
                    </p>
                    {searchResults.map((d) => {
                      const isExisting = dxMap.some((item) => item.icode === d.icode)
                      return (
                        <button
                          key={d.icode}
                          type="button"
                          onClick={() => handleSelectDrugToAdd(d)}
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30 flex items-center justify-between text-xs cursor-pointer transition-colors group"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-300">
                                {d.name}
                              </p>
                              {isExisting && (
                                <span className="text-xs px-1.5 py-0.2 rounded font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-300/50 dark:border-emerald-500/30">
                                  มีในระบบแล้ว
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-mono text-slate-400">
                              รหัส: {d.icode} {d.units ? `• หน่วย: ${d.units}` : ''}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded transition-colors',
                              isExisting
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 group-hover:bg-amber-600 group-hover:text-white'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 group-hover:bg-violet-600 group-hover:text-white'
                            )}
                          >
                            {isExisting ? 'แก้ไขเกณฑ์' : 'เลือก'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {addSearchQuery.trim() && !isSearchingDrugs && searchResults.length === 0 && (
                  <p className="text-center py-6 text-xs text-slate-400">
                    ไม่พบรายการยาที่ตรงกับ "{addSearchQuery}" ใน HOSxP
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Drug Card */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-500/25">
                  <div>
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                      รายการยาที่เลือก
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedDrug.name}
                    </h3>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      รหัส: {selectedDrug.icode} {selectedDrug.units ? `• หน่วย: ${selectedDrug.units}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDrug(null)}
                    className="text-xs text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                  >
                    เปลี่ยนยา
                  </button>
                </div>

                {/* Duplicate Notification Banner */}
                {dxMap.some((item) => item.icode === selectedDrug.icode) ? (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
                    <Info className="size-4 shrink-0 mt-0.5 text-amber-500" />
                    <div className="space-y-0.5">
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        ยานี้มีอยู่ในรายการเกณฑ์แล้ว (จะไม่เกิดรายการซ้ำ)
                      </p>
                      <p className="text-xs text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                        ระบบได้ดึงเกณฑ์เดิมมาให้เรียบร้อยแล้ว การกดบันทึกจะเป็นการ <strong>"อัปเดตแก้ไขเกณฑ์เดิม"</strong> ของยานี้ จะไม่มีรายการซ้ำซ้อนในตารางอย่างแน่นอน
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs">
                    <BadgeCheck className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                    <div className="space-y-0.5">
                      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                        รายการยาใหม่จาก HOSxP
                      </p>
                      <p className="text-xs text-emerald-700/90 dark:text-emerald-300/90 leading-relaxed">
                        ยังไม่เคยตั้งค่าในระบบ เมื่อบันทึกแล้วระบบจะเพิ่มเข้าสู่ตารางเกณฑ์ตรวจและดึงมาประมวลผลทันที
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      รหัส ICD-10 ที่อนุญาต (คั่นด้วยจุลภาค)
                    </span>
                    {newPrefixes && (
                      <button
                        type="button"
                        onClick={() => setNewPrefixes('')}
                        className="text-[11px] text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        ลบทั้งหมด
                      </button>
                    )}
                  </div>
                  {(() => {
                    const nCodes = newPrefixes ? newPrefixes.split(',').map((p) => p.trim()).filter(Boolean) : []
                    if (nCodes.length === 0) return null
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-100/90 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] max-h-28 overflow-y-auto">
                        {nCodes.map((p) => {
                          const isU = p.toUpperCase().startsWith('U')
                          return (
                            <span
                              key={p}
                              className={cn(
                                'inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md text-xs font-mono font-bold border',
                                isU
                                  ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                              )}
                            >
                              <span>{p}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const rem = nCodes.filter((c) => c.toUpperCase() !== p.toUpperCase())
                                  setNewPrefixes(rem.join(', '))
                                }}
                                className="size-4 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500 cursor-pointer"
                                title={`คลิกลบรหัส ${p}`}
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )
                  })()}
                  <textarea
                    rows={2}
                    value={newPrefixes}
                    onChange={(e) => setNewPrefixes(e.target.value)}
                    placeholder="เช่น M, S หรือ K30, R14, U6680"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#34304a] bg-slate-50 dark:bg-[#101326] px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                    autoFocus
                  />
                  <span className="text-xs text-slate-400 block">
                    ใส่คำนำหน้า เช่น <code className="text-teal-500">M</code> (ครอบคลุม M00-M99) หรือระบุเฉพาะรหัส เช่น <code className="text-teal-500">K30, R14</code> (คลิก ✕ ที่รหัสเพื่อลบออกได้)
                  </span>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    เกณฑ์จ่ายขั้นต่ำ (หน่วยตามยา เช่น 3 ขวด หรือ 42 แคปซูล)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={newMinQty}
                    onChange={(e) => setNewMinQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0 (ไม่กำหนดขั้นต่ำ)"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#34304a] bg-slate-50 dark:bg-[#101326] px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <span className="text-xs text-slate-400 block">
                    หากจ่ายน้อยกว่าเกณฑ์ ระบบจะตรวจเป็นสีแดง (ไม่ผ่าน) เพราะจะเบิกเคลมไม่ผ่าน
                  </span>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    ข้อบ่งใช้ / สรรพคุณทางคลินิก
                  </span>
                  <input
                    type="text"
                    value={newIndication}
                    onChange={(e) => setNewIndication(e.target.value)}
                    placeholder="เช่น ปวดเมื่อยกล้ามเนื้อ, ท้องอืด ท้องเฟ้อ"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#34304a] bg-slate-50 dark:bg-[#101326] px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </label>

                {/* Synced Dispensing Interval Setting */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      รอบการจ่ายยาสมุนไพร & สิทธิ (Dispensing Interval)
                    </span>
                    <span className="text-xs text-slate-400">
                      (ซิ้งไปยังแท็บรอบการจ่ายอัตโนมัติ)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { days: 0, label: 'ไม่กำหนดรอบ' },
                      { days: 7, label: '7 วัน (สิทธิ UC)' },
                      { days: 15, label: '15 วัน (สิทธิ UC)' },
                    ].map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setNewIntervalDays(opt.days)}
                        className={cn(
                          'px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer',
                          newIntervalDays === opt.days
                            ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50 ring-2 ring-amber-500 font-bold'
                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={newIntervalDays}
                        onChange={(e) => setNewIntervalDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        placeholder="0"
                        className="w-16 rounded-xl border border-slate-300 dark:border-[#34304a] bg-slate-50 dark:bg-[#101326] px-2 py-1 text-center font-mono text-xs text-slate-900 dark:text-white"
                      />
                      <span className="text-xs text-slate-400">วัน</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    หากระบุ เช่น 7 วัน หรือ 15 วัน ระบบจะผูกเงื่อนไขรอบการจ่ายในแท็บ "เงื่อนไขรอบการจ่าย & สิทธิการรักษา" ให้พร้อมกันทันที
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false)
                      setSelectedDrug(null)
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleSaveNewDrug}
                    className="btn-pill-action inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                  >
                    <Check className="size-3.5" />
                    <span>
                      {isPending
                        ? 'กำลังบันทึก…'
                        : dxMap.some((item) => item.icode === selectedDrug.icode)
                          ? 'บันทึกแก้ไขเกณฑ์เดิม'
                          : 'บันทึกเพิ่มรายการยา'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}
