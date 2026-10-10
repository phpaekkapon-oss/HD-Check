import { useState, useMemo, type FC } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
} from '@tanstack/react-table'
import { Download, Search, DollarSign, Pill } from 'lucide-react'
import type { DateRange, DrugSummaryRecord } from '@/types/herbdx.types'
import { cleanDrugUnit } from '@/types/herbdx.types'
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
import { DataTableViewOptions } from '@/components/DataTableViewOptions'
import { DateRangeFields } from '@/components/AuditFilterBar'
import { downloadExcel, fmtNum, toThaiDateShort } from '@/lib/format'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { cn } from '@/lib/utils'

interface DrugSummaryViewProps {
  readonly drugs: readonly DrugSummaryRecord[]
  readonly range: DateRange
  readonly onRangeChange: (r: DateRange) => void
  readonly latestVisitDate?: string | null
}

const DRUG_COLUMN_LABELS: Record<string, string> = {
  index: 'ลำดับ',
  icode: 'รหัสยา',
  name: 'รายการยา',
  opd_qty: 'จ่ายผู้ป่วยนอก',
  ipd_qty: 'จ่ายผู้ป่วยใน',
  unitcost: 'ราคาต้นทุน',
  total_qty: 'รวมจำนวน',
  total_cost: 'รวมต้นทุน',
  nhso_adp_code: 'รหัส 24 หลัก',
}

export const DrugSummaryView: FC<DrugSummaryViewProps> = ({ drugs, range, onRangeChange, latestVisitDate }) => {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'OPD' | 'IPD'>('ALL')
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'total_qty', desc: true }, // Default sort by highest total quantity
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const filteredData = useMemo(() => {
    let list = drugs
    if (filterType === 'OPD') {
      list = list.filter((d) => d.opd_qty > 0)
    } else if (filterType === 'IPD') {
      list = list.filter((d) => d.ipd_qty > 0)
    }
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (d) =>
        d.icode.includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.nhso_adp_code.includes(q)
    )
  }, [drugs, search, filterType])

  const columns = useMemo<ColumnDef<DrugSummaryRecord>[]>(
    () => [
      {
        id: 'index',
        header: () => <div className="text-center w-8">ลำดับ</div>,
        cell: ({ row, table }) => {
          const pageIndex = table.getState().pagination.pageIndex
          const pageSize = table.getState().pagination.pageSize
          return (
            <div className="text-center font-mono text-slate-400 dark:text-slate-400 text-[11px]">
              {pageIndex * pageSize + row.index + 1}
            </div>
          )
        },
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'icode',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="รหัสยา" />
        ),
        cell: ({ row }) => (
          <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#101326] text-slate-800 dark:text-slate-100">
            {row.original.icode}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="รายการยา" />
        ),
        cell: ({ row }) => (
          <div className="flex flex-col py-0.5">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {row.original.name}
            </span>
            {row.original.units ? (
              <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                ขนาดบรรจุ: {row.original.units}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'opd_qty',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="จ่ายผู้ป่วยนอก" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono text-cyan-800 dark:text-cyan-300 font-medium">
            {fmtNum(row.original.opd_qty)}
          </div>
        ),
      },
      {
        accessorKey: 'ipd_qty',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="จ่ายผู้ป่วยใน" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono text-indigo-800 dark:text-indigo-300 font-medium">
            {fmtNum(row.original.ipd_qty)}
          </div>
        ),
      },
      {
        accessorKey: 'unitcost',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ราคาต้นทุน" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono text-slate-600 dark:text-slate-300">
            {row.original.unitcost.toFixed(2)}
          </div>
        ),
      },
      {
        accessorKey: 'total_qty',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="จำนวนรวม" className="justify-end" />
        ),
        cell: ({ row }) => {
          const shortUnit = cleanDrugUnit(row.original.units)
          return (
            <div className="text-right font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-[#1d2035] px-2 py-0.5 rounded whitespace-nowrap">
              <span>{fmtNum(row.original.total_qty)}</span>
              {shortUnit ? (
                <span className="text-xs font-normal font-sans text-slate-500 dark:text-slate-400 ml-1.5">
                  {shortUnit}
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: 'total_cost',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="รวมต้นทุน" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
            {fmtNum(row.original.total_cost, 2)}
          </div>
        ),
      },
      {
        accessorKey: 'nhso_adp_code',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="รหัส 24 หลัก" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-slate-600 dark:text-slate-300 text-[11px] whitespace-nowrap">
            {row.original.nhso_adp_code || '-'}
          </span>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredData as DrugSummaryRecord[],
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const grandTotalQty = useMemo(() => drugs.reduce((s, d) => s + d.total_qty, 0), [drugs])
  const grandTotalCost = useMemo(() => drugs.reduce((s, d) => s + d.total_cost, 0), [drugs])
  const totalOpd = useMemo(() => drugs.reduce((s, d) => s + d.opd_qty, 0), [drugs])
  const totalIpd = useMemo(() => drugs.reduce((s, d) => s + d.ipd_qty, 0), [drugs])
  const hasNoDispensingInRange = drugs.length > 0 && drugs.every((drug) => drug.total_qty === 0)

  const goToLatestDispensingMonth = () => {
    if (!latestVisitDate) return
    const [yearText, monthText] = latestVisitDate.split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    if (!year || !month) return
    const lastDay = new Date(year, month, 0).getDate()
    onRangeChange({
      startDate: `${yearText}-${monthText}-01`,
      endDate: `${yearText}-${monthText}-${String(lastDay).padStart(2, '0')}`,
    })
  }

  const handleExport = () => {
    const headers = [
      'ลำดับ',
      'รหัสยา',
      'รายการยา',
      'จ่ายผู้ป่วยนอก',
      'จ่ายผู้ป่วยใน',
      'ราคาต้นทุน',
      'จำนวน',
      'รวมต้นทุน',
      'รหัส 24 หลัก',
    ]
    const rows = filteredData.map((d, i) => [
      i + 1,
      d.icode,
      d.name,
      d.opd_qty,
      d.ipd_qty,
      d.unitcost.toFixed(2),
      d.total_qty,
      d.total_cost.toFixed(2),
      d.nhso_adp_code,
    ])
    downloadExcel(`สรุปการจ่ายยาสมุนไพร_${range.startDate}_${range.endDate}.xlsx`, headers, rows, 'สรุปการจ่ายยาสมุนไพร')
  }

  return (
    <div className="space-y-4">
      {/* Metric summary banner with interactive filtering */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilterType((prev) => (prev === 'OPD' ? 'ALL' : 'OPD'))}
          className={cn(
            'text-left rounded-2xl bg-themed-card border-themed border p-3.5 sm:p-4 shadow-xs transition-all hover:scale-[1.01] cursor-pointer focus:outline-none',
            filterType === 'OPD' && 'ring-2 ring-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/15 border-cyan-500/50'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">จ่ายผู้ป่วยนอก (OPD)</div>
            {filterType === 'OPD' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500 text-white font-bold">กำลังกรอง</span>
            )}
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-cyan-600 dark:text-cyan-400 mt-1 tracking-tight">
            <AnimatedNumber value={totalOpd} suffix=" หน่วย" />
          </div>
          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">บริการผู้ป่วยนอก (คลิกเพื่อกรอง)</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterType((prev) => (prev === 'IPD' ? 'ALL' : 'IPD'))}
          className={cn(
            'text-left rounded-2xl bg-themed-card border-themed border p-3.5 sm:p-4 shadow-xs transition-all hover:scale-[1.01] cursor-pointer focus:outline-none',
            filterType === 'IPD' && 'ring-2 ring-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/50'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">จ่ายผู้ป่วยใน (IPD)</div>
            {filterType === 'IPD' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500 text-white font-bold">กำลังกรอง</span>
            )}
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-1 tracking-tight">
            <AnimatedNumber value={totalIpd} suffix=" หน่วย" />
          </div>
          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">บริการหอผู้ป่วยใน (คลิกเพื่อกรอง)</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterType('ALL')}
          className={cn(
            'text-left rounded-2xl bg-themed-card border-themed border p-3.5 sm:p-4 shadow-xs transition-all hover:scale-[1.01] cursor-pointer focus:outline-none',
            filterType === 'ALL' && 'ring-2 ring-accent/60 bg-accent/5'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
              <Pill className="size-3.5 text-accent" /> รวมจำนวนที่จ่ายทั้งหมด
            </div>
            {filterType === 'ALL' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-white font-bold">แสดงทั้งหมด</span>
            )}
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-accent mt-1 tracking-tight">
            <AnimatedNumber value={grandTotalQty} suffix=" หน่วย" />
          </div>
          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">รวมทุกขนานยา (คลิกดูทั้งหมด)</div>
        </button>

        <div className="rounded-2xl bg-themed-card border-themed border p-3.5 sm:p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
            <DollarSign className="size-3.5 text-amber-600 dark:text-amber-400" /> รวมต้นทุนยาสมุนไพร
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-1 tracking-tight">
            <AnimatedNumber value={grandTotalCost} decimals={2} prefix="฿" />
          </div>
          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">คำนวณจากราคาต้นทุน</div>
        </div>
      </div>

      {filterType !== 'ALL' && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#14172a] border border-slate-200 dark:border-[#292440] text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              กำลังกรองตาราง: {filterType === 'OPD' ? '💊 เฉพาะยาที่มีการจ่ายผู้ป่วยนอก (OPD)' : '🏥 เฉพาะยาที่มีการจ่ายผู้ป่วยใน (IPD)'}
            </span>
            <span className="text-slate-400">({filteredData.length} รายการ)</span>
          </div>
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className="text-xs font-semibold text-accent hover:underline cursor-pointer"
          >
            ล้างตัวกรอง (แสดงทั้งหมด)
          </button>
        </div>
      )}

      {hasNoDispensingInRange && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <span>
            พบรายการยาสมุนไพรที่เปิดใช้งาน {drugs.length} รายการ แต่ไม่มีการจ่ายในช่วง {toThaiDateShort(range.startDate)} ถึง {toThaiDateShort(range.endDate)}
            {latestVisitDate ? ` · พบการจ่ายล่าสุด ${toThaiDateShort(latestVisitDate)}` : ''}
          </span>
          {latestVisitDate && (
            <button type="button" onClick={goToLatestDispensingMonth} className="shrink-0 rounded-lg border border-amber-200/30 px-3 py-1.5 font-semibold hover:bg-amber-100/10">
              ไปยังเดือนที่มีจ่ายล่าสุด
            </button>
          )}
        </div>
      )}

      {/* Main Shadcn Data Table (Desktop View - Unified Card) */}
      <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm overflow-hidden transition-colors">
        {/* Integrated Table Toolbar Header */}
        <div className="p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-[#1d2035]/70 border-b border-slate-200 dark:border-[#292440]">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            <DateRangeFields range={range} onChange={onRangeChange} />

            <div className="relative flex-1 min-w-[200px]">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหารหัสยา, ชื่อยา, รหัส 24 หลัก…"
                className="w-full rounded-xl bg-white dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 shadow-2xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DataTableViewOptions table={table} columnLabels={DRUG_COLUMN_LABELS} />
            <button
              type="button"
              onClick={handleExport}
              className="btn-pill-action inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold active:scale-95 transition cursor-pointer shadow-sm"
            >
              <Download className="size-4 text-white" /> Export Excel
            </button>
          </div>
        </div>

        <Table containerClassName="max-h-[68vh] min-h-[420px] overflow-auto">
          <TableHeader className="bg-slate-50 dark:bg-[#1d2035]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-slate-200 dark:border-[#292440] hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-slate-700 dark:text-slate-300 font-bold text-xs py-3">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  ไม่พบรายการยาตามคำค้นหา
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-slate-100 dark:border-[#292440]/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-800 dark:text-slate-200">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Shadcn Data Table Pagination */}
        <DataTablePagination table={table} pageSizeOptions={[15, 25, 50, 100, 200]} />
      </div>

      {/* Mobile Drug Cards List View */}
      <div className="block md:hidden space-y-3">
        {/* Mobile Filter Toolbar */}
        <div className="rounded-2xl bg-themed-card border-themed border p-3 flex flex-col gap-2.5 shadow-xs">
          <DateRangeFields range={range} onChange={onRangeChange} />
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหารหัสยา, ชื่อยา, รหัส 24 หลัก…"
              className="w-full rounded-xl bg-slate-50 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1"
            />
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="btn-pill-action flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold active:scale-95 transition cursor-pointer shadow-sm w-full"
          >
            <Download className="size-4 text-white" /> Export Excel
          </button>
        </div>
        {table.getRowModel().rows.length === 0 ? (
          <div className="rounded-2xl bg-themed-card border-themed border p-8 text-center text-slate-500 dark:text-slate-400">
            ไม่พบรายการยาตามคำค้นหา
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const d = row.original
            return (
              <div key={d.icode} className="rounded-2xl bg-themed-card p-4 border border-themed shadow-xs space-y-3 text-slate-800 dark:text-slate-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5 truncate">
                      <Pill className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{d.name}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      รหัส: {d.icode} {d.nhso_adp_code ? `• 24 หลัก: ${d.nhso_adp_code}` : ''}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg ring-1 ring-emerald-600/20 dark:ring-emerald-500/30 shrink-0">
                    รวม {fmtNum(d.total_qty)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-[#292440] text-xs">
                  <div className="rounded-xl bg-slate-50 dark:bg-[#101326] p-2">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">ผู้ป่วยนอก (OPD)</span>
                    <span className="font-mono font-semibold text-cyan-700 dark:text-cyan-400">{fmtNum(d.opd_qty)} หน่วย</span>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-[#101326] p-2">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">ผู้ป่วยใน (IPD)</span>
                    <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-400">{fmtNum(d.ipd_qty)} หน่วย</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-[#292440] text-slate-600 dark:text-slate-300">
                  <span>ต้นทุน: <strong className="font-mono text-slate-800 dark:text-slate-200">฿{fmtNum(d.unitcost, 2)}</strong></span>
                  <span>รวมต้นทุน: <strong className="font-mono text-amber-700 dark:text-amber-400 font-bold">฿{fmtNum(d.total_cost, 2)}</strong></span>
                </div>
              </div>
            )
          })
        )}
        <DataTablePagination table={table} pageSizeOptions={[10, 25, 50]} />
      </div>
    </div>
  )
}
