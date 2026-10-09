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
import { downloadCsv, fmtNum } from '@/lib/format'
import { AnimatedNumber } from '@/components/AnimatedNumber'

interface DrugSummaryViewProps {
  readonly drugs: readonly DrugSummaryRecord[]
  readonly range: DateRange
  readonly onRangeChange: (r: DateRange) => void
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

export const DrugSummaryView: FC<DrugSummaryViewProps> = ({ drugs, range, onRangeChange }) => {
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'total_qty', desc: true }, // Default sort by highest total quantity
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const filteredData = useMemo(() => {
    if (!search.trim()) return drugs
    const q = search.toLowerCase()
    return drugs.filter(
      (d) =>
        d.icode.includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.nhso_adp_code.includes(q)
    )
  }, [drugs, search])

  const columns = useMemo<ColumnDef<DrugSummaryRecord>[]>(
    () => [
      {
        id: 'index',
        header: () => <div className="text-center w-8">ลำดับ</div>,
        cell: ({ row }) => (
          <div className="text-center font-mono text-slate-400 dark:text-slate-400 text-[11px]">
            {row.index + 1}
          </div>
        ),
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
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {row.original.name}
          </span>
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
          <DataTableColumnHeader column={column} title="จำนวน" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-[#1d2035] px-2 py-0.5 rounded">
            {fmtNum(row.original.total_qty)}
          </div>
        ),
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

  const grandTotalQty = filteredData.reduce((s, d) => s + d.total_qty, 0)
  const grandTotalCost = filteredData.reduce((s, d) => s + d.total_cost, 0)
  const totalOpd = filteredData.reduce((s, d) => s + d.opd_qty, 0)
  const totalIpd = filteredData.reduce((s, d) => s + d.ipd_qty, 0)

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
    downloadCsv(`สรุปการจ่ายยาสมุนไพร_${range.startDate}_${range.endDate}.csv`, headers, rows)
  }

  return (
    <div className="space-y-4">
      {/* Metric summary banner with smooth gradients */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-themed-card border-themed border p-3.5 sm:p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">จ่ายผู้ป่วยนอก (OPD)</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-cyan-600 dark:text-cyan-400 mt-1 tracking-tight">
            <AnimatedNumber value={totalOpd} suffix=" หน่วย" />
          </div>
          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">บริการผู้ป่วยนอก</div>
        </div>
        <div className="rounded-2xl bg-themed-card border-themed border p-3.5 sm:p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">จ่ายผู้ป่วยใน (IPD)</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-1 tracking-tight">
            <AnimatedNumber value={totalIpd} suffix=" หน่วย" />
          </div>
          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">บริการหอผู้ป่วยใน</div>
        </div>
        <div className="rounded-2xl bg-themed-card border-themed border p-3.5 sm:p-4 shadow-xs">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
            <Pill className="size-3.5 text-accent" /> รวมจำนวนที่จ่ายทั้งหมด
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-accent mt-1 tracking-tight">
            <AnimatedNumber value={grandTotalQty} suffix=" หน่วย" />
          </div>
          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">รวมทุกขนานยา</div>
        </div>
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

      {/* Filter toolbar */}
      <div className="rounded-2xl bg-themed-card border-themed border p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <DateRangeFields range={range} onChange={onRangeChange} />

          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหารหัสยา, ชื่อยา, รหัส 24 หลัก…"
              className="w-full rounded-xl bg-slate-50 dark:bg-[#101326] border border-slate-200 dark:border-[#34304a] pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 shadow-2xs"
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

      {/* Main Shadcn Data Table (Desktop View) */}
      <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm overflow-hidden transition-colors">
        <Table>
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
        <DataTablePagination table={table} pageSizeOptions={[15, 25, 50, 100]} />
      </div>

      {/* Mobile Drug Cards List View */}
      <div className="block md:hidden space-y-3">
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
