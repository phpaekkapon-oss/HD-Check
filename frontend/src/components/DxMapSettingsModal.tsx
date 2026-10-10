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
import { Edit3, Check, X, Search, Info, FlaskConical } from 'lucide-react'
import { herbDxApi } from '@/api/herbdx.api'
import { useDxMap, useUpdateDxMap } from '@/hooks/useHerbDx'
import type { DxMapPreview, DxMapRecord } from '@/types/herbdx.types'
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
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-base font-bold tabular-nums ${toneClass}`}>{value.toLocaleString('th-TH')}</p>
    </div>
  )
}

export const DxMapSettingsModal: FC<DxMapSettingsModalProps> = ({ initialIcode }) => {
  const { data: dxMap = [], isLoading } = useDxMap()
  const { mutate: updateMap, isPending } = useUpdateDxMap()

  const [editingIcode, setEditingIcode] = useState<string | null>(null)
  const [prefixes, setPrefixes] = useState('')
  const [indication, setIndication] = useState('')
  const [search, setSearch] = useState(initialIcode ?? '')
  const initializedIcode = useRef<string | undefined>(undefined)
  const [sorting, setSorting] = useState<SortingState>([])
  const [preview, setPreview] = useState<DxMapPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [periodDays, setPeriodDays] = useState(90)
  const broadPrefixes = prefixes.split(/[ ,\s]+/).map((prefix) => prefix.trim()).filter((prefix) => prefix.length === 1)

  useEffect(() => {
    if (!initialIcode || isLoading || initializedIcode.current === initialIcode) return
    initializedIcode.current = initialIcode
    const item = dxMap.find((entry) => entry.icode === initialIcode)
    if (!item) return

    setSearch(initialIcode)
    setEditingIcode(item.icode)
    setPrefixes(item.dx_prefixes)
    setIndication(item.indication)
    setPreview(null)
    setPreviewError(null)
  }, [dxMap, initialIcode, isLoading])

  const handleStartEdit = (item: DxMapRecord) => {
    setEditingIcode(item.icode)
    setPrefixes(item.dx_prefixes)
    setIndication(item.indication)
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
    updateMap(
      { icode: editingIcode, dx_prefixes: prefixes, indication },
      { onSuccess: () => setEditingIcode(null) }
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
          <DataTableColumnHeader column={column} title="รหัส ICD-10 ที่อนุญาต (คั่นด้วยจุลภาค)" />
        ),
        cell: ({ row }) => {
          const item = row.original
          const isEditing = editingIcode === item.icode
          if (isEditing) {
            return (
              <input
                type="text"
                value={prefixes}
                onChange={(e) => {
                  setPrefixes(e.target.value)
                  setPreview(null)
                }}
                placeholder="เช่น M, S หรือ K30, R14"
                className="w-full rounded-lg border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-2 py-1 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2"
                autoFocus
              />
            )
          }
          return (
            <div className="flex flex-wrap gap-1 font-mono">
              {item.dx_prefixes ? (
                item.dx_prefixes.split(',').map((p) => (
                  <span
                    key={p}
                    className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-semibold"
                  >
                    {p.trim()}
                  </span>
                ))
              ) : (
                <span className="text-rose-500 italic">ยังไม่กำหนดรหัส</span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'indication',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ข้อบ่งใช้ / สรรพคุณ" />
        ),
        cell: ({ row }) => {
          const item = row.original
          const isEditing = editingIcode === item.icode
          if (isEditing) {
            return (
              <input
                type="text"
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                placeholder="ข้อบ่งใช้ของยา"
                className="w-full rounded-lg border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2"
              />
            )
          }
          return (
            <span className="text-slate-600 dark:text-slate-300">
              {item.indication || '-'}
            </span>
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
    [editingIcode, prefixes, indication, isPending]
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
    <div className="space-y-4">
      {/* Informational Banner with Hospital Gradient */}
      <div className="rounded-2xl bg-themed-card border border-themed p-4 text-xs text-slate-600 dark:text-slate-200 flex items-start gap-3 shadow-xs">
        <div className="grid place-items-center size-8 rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 shrink-0 mt-0.5">
          <Info className="size-4.5" />
        </div>
        <div className="space-y-1">
          <strong className="text-sm font-bold block text-slate-900 dark:text-white tracking-tight">
            เกณฑ์การจับคู่ยาสมุนไพรกับรหัสการวินิจฉัยโรค (ICD-10 / ICD-10-TM)
          </strong>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            ระบบจะตรวจสอบว่าการสั่งจ่ายยานั้น มีรหัส PDX หรือ DX0-DX5 ที่ขึ้นต้นด้วยคำนำหน้าที่กำหนดไว้หรือไม่ (เช่น ระบุ <code className="font-mono bg-teal-950 text-teal-300 px-1.5 py-0.5 rounded font-bold border border-teal-500/30">M</code> จะครอบคลุมทุกรหัสโรคกล้ามเนื้อ M00-M99) หรือหากมีรหัสแพทย์แผนไทยที่ขึ้นต้นด้วย <code className="font-mono bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">U</code> ระบบจะให้ <strong className="text-emerald-700 dark:text-emerald-300 font-bold">ผ่านเกณฑ์อัตโนมัติ</strong>
          </p>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            สีในตารางผลตรวจ: <strong className="text-emerald-700 dark:text-emerald-300">เขียว = รหัสตรงเกณฑ์</strong>, <strong className="text-rose-700 dark:text-rose-300">แดง = รหัสไม่ตรง</strong>, <strong className="text-amber-700 dark:text-amber-300">เหลือง = ยังไม่มีเกณฑ์ให้ตรวจ</strong> ส่วนรหัส ICD สีเขียวในหน้านี้คือรหัสที่อนุญาต
          </p>
        </div>
      </div>

      {/* Search Header */}
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
        <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium sm:shrink-0">
          ตั้งค่าทั้งหมด {dxMap.length} รายการ
        </div>
      </div>

      {/* Settings Grid with Shadcn Data Table */}
      <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm overflow-hidden space-y-0 transition-colors">
        {/* Table Toolbar Header with Shadcn title */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-[#1d2035] border-b border-slate-200 dark:border-[#292440]">
          <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">Shadcn Data Table</span>
            <span className="text-slate-400 dark:text-slate-500">•</span>
            <span>คลิกหัวคอลัมน์เพื่อเรียงลำดับ (Sort)</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            ค้นพบ {filtered.length} จาก {dxMap.length} รายการ
          </div>
        </div>

        {/* Scrollable table container */}
        <Table containerClassName="max-h-[68vh] min-h-[420px] overflow-auto">
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
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              ผลนี้เป็นการจำลองจากข้อมูลย้อนหลังเพื่อช่วยตรวจผลกระทบ ไม่ใช่คำแนะนำว่ารหัสใดถูกต้องทางคลินิก กรุณายืนยันรหัสกับข้อบ่งใช้และแนวทางที่หน่วยงานรับรองก่อนบันทึก
                            </p>
                            {broadPrefixes.length > 0 && (
                              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
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
                                  <p className="mb-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">รหัสวินิจฉัยที่พบในประวัติ (สูงสุด 12 รหัส)</p>
                                  <p className="mb-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">รหัสที่พบบ่อยเป็นข้อมูลประกอบเท่านั้น ไม่ได้ยืนยันข้อบ่งใช้ ห้ามเพิ่มเกณฑ์จากความถี่อย่างเดียว</p>
                                  {preview.frequentDx.length ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {preview.frequentDx.map(({ code, count, matches }) => (
                                        <span key={code} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] ${matches ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-300'}`}>
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
                  <button type="button" onClick={() => handleStartEdit(item)} className="min-h-11 shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 touch-manipulation">
                    <Edit3 className="size-3.5" /> แก้ไข
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3 border-t border-slate-100 dark:border-white/10 pt-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">รหัส ICD-10 ที่อนุญาต</span>
                    <input type="text" value={prefixes} onChange={(e) => { setPrefixes(e.target.value); setPreview(null) }} placeholder="เช่น M, S หรือ K30, R14" className="w-full min-h-11 rounded-xl border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-3 font-mono text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">ข้อบ่งใช้ / สรรพคุณ</span>
                    <input type="text" value={indication} onChange={(e) => setIndication(e.target.value)} placeholder="ระบุข้อบ่งใช้ของยา" className="w-full min-h-11 rounded-xl border border-slate-300 dark:border-[#34304a] bg-white dark:bg-[#101326] px-3 text-base sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2" />
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
                    {broadPrefixes.length > 0 && <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">รหัส {broadPrefixes.join(', ')} ครอบคลุมกว้าง ควรตรวจผลทดลองก่อนบันทึก</p>}
                    {previewError && <p className="text-xs text-rose-600 dark:text-rose-300">{previewError}</p>}
                    {preview?.icode === item.icode && (
                      <div className="grid grid-cols-2 gap-2">
                        <p className="col-span-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">รหัสที่พบบ่อยเป็นข้อมูลประกอบเท่านั้น ไม่ได้ยืนยันข้อบ่งใช้ ห้ามเพิ่มเกณฑ์จากความถี่อย่างเดียว</p>
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
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">รหัส ICD-10 ที่อนุญาต</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.dx_prefixes ? item.dx_prefixes.split(',').map((prefix) => <span key={prefix} className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 font-mono text-xs font-semibold text-emerald-800 dark:text-emerald-300">{prefix.trim()}</span>) : <span className="text-xs italic text-rose-500">ยังไม่กำหนดรหัส</span>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">ข้อบ่งใช้ / สรรพคุณ</p>
                    <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 break-words">{item.indication || '-'}</p>
                  </div>
                </div>
              )}
            </article>
          )
        })}
        <DataTablePagination table={table} pageSizeOptions={[10, 15, 25, 50]} />
      </div>
    </div>
  )
}
