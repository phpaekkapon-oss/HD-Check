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
import { CheckCircle2, AlertCircle, FileQuestion, HelpCircle } from 'lucide-react'
import type { AuditRecord } from '@/types/herbdx.types'
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
import { cn } from '@/lib/utils'
import { toThaiDate } from '@/lib/format'

interface AuditTableProps {
  readonly records: readonly AuditRecord[]
}

function DxCodeCell({ code, record }: { readonly code: string; readonly record: AuditRecord }) {
  const normalizedCode = code.trim().toUpperCase()
  if (!normalizedCode) {
    return (
      <span
        title={record.audit_result === 'NO_DX' ? 'ไม่มีรหัสวินิจฉัยในช่องนี้' : undefined}
        className={record.audit_result === 'NO_DX' ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}
      >
        —
      </span>
    )
  }

  const isMatched = record.matched_dx.some((dx) => dx.toUpperCase() === normalizedCode)
  const colorClass = isMatched
    ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300'
    : record.audit_result === 'FAIL'
      ? 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300'
      : record.audit_result === 'NO_MAP'
        ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300'
        : 'border-transparent bg-transparent text-slate-600 dark:text-slate-300'
  const title = isMatched
    ? 'รหัสนี้ตรงกับเกณฑ์ที่กำหนด'
    : record.audit_result === 'FAIL'
      ? 'รหัสนี้ไม่ตรงกับเกณฑ์ของยา'
      : record.audit_result === 'NO_MAP'
        ? 'ยังไม่มีเกณฑ์ ICD ของยานี้ให้ตรวจเทียบ'
        : 'รหัสวินิจฉัย'

  return (
    <span title={title} className={cn('inline-flex rounded px-1.5 py-0.5 font-mono text-[11px] font-bold', colorClass)}>
      {code}
    </span>
  )
}

const COLUMN_LABELS: Record<string, string> = {
  index: 'ลำดับ',
  visit_date: 'วันที่รับบริการ',
  visit_time: 'เวลา',
  hn: 'HN',
  patient_name: 'ชื่อผู้รับบริการ',
  pttype_name: 'สิทธิการรักษา',
  drug_name: 'รายการยา',
  drug_qty: 'จำนวน',
  department_name: 'แผนกที่รับบริการ',
  main_pdx: 'main_pdx',
  pdx: 'pdx',
  dx0: 'dx0',
  dx1: 'dx1',
  dx2: 'dx2',
  dx3: 'dx3',
  dx4: 'dx4',
  dx5: 'dx5',
  doctor_code: 'รหัสแพทย์',
  doctor_name: 'แพทย์ผู้สั่ง',
  audit_result: 'สถานะผลตรวจ',
}

export const AuditTable: FC<AuditTableProps> = ({ records }) => {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    dx2: true,
    dx3: false,
    dx4: false,
    dx5: false,
    doctor_code: true,
  })

  // Define Shadcn Data Table columns with strict types
  const columns = useMemo<ColumnDef<AuditRecord>[]>(
    () => [
      {
        id: 'index',
        header: () => <div className="text-center w-8">ลำดับ</div>,
        cell: ({ row, table }) => {
          const pageIndex = table.getState().pagination.pageIndex
          const pageSize = table.getState().pagination.pageSize
          return (
            <div className="text-center font-mono text-slate-500 dark:text-slate-400 text-[11px]">
              {pageIndex * pageSize + row.index + 1}
            </div>
          )
        },
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'visit_date',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="วันที่รับบริการ" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
            {toThaiDate(row.original.visit_date)}
          </span>
        ),
      },
      {
        accessorKey: 'visit_time',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="เวลา" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]">
            {row.original.visit_time}
          </span>
        ),
      },
      {
        accessorKey: 'hn',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="HN" />
        ),
        cell: ({ row }) => (
          <span className="font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
            {row.original.hn}
          </span>
        ),
      },
      {
        accessorKey: 'patient_name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ชื่อผู้รับบริการ" />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-slate-900 dark:text-white whitespace-nowrap">
            {row.original.patient_name}
          </span>
        ),
      },
      {
        accessorKey: 'pttype_name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="สิทธิการรักษา" />
        ),
        cell: ({ row }) => (
          <span className="text-slate-600 dark:text-slate-300 max-w-[170px] truncate block" title={row.original.pttype_name}>
            {row.original.pttype_name}
          </span>
        ),
      },
      {
        accessorKey: 'drug_name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="รายการยา" />
        ),
        cell: ({ row }) => {
          const isProblem = row.original.audit_result === 'FAIL' || row.original.audit_result === 'NO_DX'
          const isPass = row.original.audit_result === 'PASS'
          return (
            <span className={cn(
              'font-semibold whitespace-nowrap',
              isProblem ? 'text-rose-950 dark:text-rose-300 font-bold' :
                isPass ? 'text-emerald-800 dark:text-emerald-300 font-bold' :
                  'text-slate-800 dark:text-slate-100'
            )}>
              {row.original.drug_name}
            </span>
          )
        },
      },
      {
        accessorKey: 'drug_qty',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="จำนวน" className="justify-center" />
        ),
        cell: ({ row }) => (
          <div className="text-center font-mono font-bold text-slate-800 dark:text-slate-100">
            {row.original.drug_qty}
          </div>
        ),
      },
      {
        accessorKey: 'department_name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="แผนกที่รับบริการ" />
        ),
        cell: ({ row }) => (
          <span className="text-slate-600 dark:text-slate-300 whitespace-nowrap">
            {row.original.department_name}
          </span>
        ),
      },
      {
        accessorKey: 'main_pdx',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="main_pdx" className="justify-center" />
        ),
        cell: ({ row }) => {
          const val = row.original.main_pdx
          if (!val) return <span className="text-rose-500 font-bold">-</span>
          return (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[11px] font-mono font-bold',
                val.startsWith('U') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'
              )}
            >
              {val}
            </span>
          )
        },
      },
      {
        accessorKey: 'pdx',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="pdx" className="justify-center" />
        ),
        cell: ({ row }) => (
          <DxCodeCell code={row.original.pdx} record={row.original} />
        ),
      },
      {
        accessorKey: 'dx0',
        header: 'dx0',
        cell: ({ row }) => <DxCodeCell code={row.original.dx0} record={row.original} />,
      },
      {
        accessorKey: 'dx1',
        header: 'dx1',
        cell: ({ row }) => <DxCodeCell code={row.original.dx1} record={row.original} />,
      },
      {
        accessorKey: 'dx2',
        header: 'dx2',
        cell: ({ row }) => <DxCodeCell code={row.original.dx2} record={row.original} />,
      },
      {
        accessorKey: 'dx3',
        header: 'dx3',
        cell: ({ row }) => <DxCodeCell code={row.original.dx3} record={row.original} />,
      },
      {
        accessorKey: 'dx4',
        header: 'dx4',
        cell: ({ row }) => <DxCodeCell code={row.original.dx4} record={row.original} />,
      },
      {
        accessorKey: 'dx5',
        header: 'dx5',
        cell: ({ row }) => <DxCodeCell code={row.original.dx5} record={row.original} />,
      },
      {
        accessorKey: 'doctor_code',
        header: 'รหัส',
        cell: ({ row }) => (
          <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
            {row.original.doctor_code}
          </span>
        ),
      },
      {
        accessorKey: 'doctor_name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="แพทย์ผู้สั่ง" />
        ),
        cell: ({ row }) => (
          <span className="text-slate-700 dark:text-slate-300 whitespace-nowrap" title={row.original.doctor_name}>
            {row.original.doctor_name}
          </span>
        ),
      },
      {
        accessorKey: 'audit_result',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="สถานะผลตรวจ" className="justify-center" />
        ),
        cell: ({ row }) => {
          const r = row.original
          if (r.audit_result === 'PASS') {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 whitespace-nowrap">
                <CheckCircle2 className="size-3 text-emerald-600" /> ผ่านเกณฑ์
              </span>
            )
          }
          if (r.audit_result === 'FAIL') {
            return (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30 whitespace-nowrap"
                title={r.audit_reason}
              >
                <AlertCircle className="size-3 text-rose-600" /> DX ไม่ตรงข้อบ่งใช้
              </span>
            )
          }
          if (r.audit_result === 'NO_DX') {
            return (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-200 text-rose-900 border border-rose-400 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/40 font-mono whitespace-nowrap"
                title={r.audit_reason}
              >
                <FileQuestion className="size-3 text-rose-700" /> ไม่มี DX
              </span>
            )
          }
          return (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 whitespace-nowrap"
              title={r.audit_reason}
            >
              <HelpCircle className="size-3 text-amber-600" /> รอตั้งค่า
            </span>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: records as AuditRecord[],
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

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card p-12 text-center shadow-xs dark:shadow-sm">
        <AlertCircle className="mx-auto size-10 text-amber-500 mb-3" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">โปรดลองเลือกช่วงวันที่ใหม่ หรือปรับตัวกรองค้นหา</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm overflow-hidden space-y-0 transition-colors">
      {/* Table Toolbar Header with Column Toggle */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-[#1d2035] border-b border-slate-200 dark:border-[#292440]">
        <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <span className="font-semibold text-slate-900 dark:text-white">Shadcn Data Table</span>
          <span className="text-slate-400 dark:text-slate-500">•</span>
          <span>คลิกหัวคอลัมน์เพื่อเรียงลำดับ (Sort)</span>
        </div>
        <DataTableViewOptions table={table} columnLabels={COLUMN_LABELS} />
      </div>

      {/* Main Shadcn Data Table with sticky header and vertical scroll */}
      <Table containerClassName="max-h-[68vh] min-h-[420px] overflow-auto">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-slate-200 dark:border-[#292440] bg-slate-50 dark:bg-[#1d2035]">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-slate-700 dark:text-slate-300 font-semibold">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map((row) => {
            const isNoDx = row.original.audit_result === 'NO_DX'
            const isFail = row.original.audit_result === 'FAIL'
            const isNoMap = row.original.audit_result === 'NO_MAP'
            const isPass = row.original.audit_result === 'PASS'

            const rowClass = cn(
              'transition-colors border-slate-100 dark:border-[#292440]/70 text-slate-800 dark:text-slate-200',
              isNoDx && 'bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border-l-4 border-l-rose-600',
              isFail && 'bg-rose-50/50 hover:bg-rose-100/50 dark:bg-rose-950/15 dark:hover:bg-rose-950/30 border-l-4 border-l-rose-500',
              isNoMap && 'bg-amber-50/60 hover:bg-amber-100/60 dark:bg-amber-950/15 dark:hover:bg-amber-950/30 border-l-4 border-l-amber-500 dark:border-l-amber-400',
              isPass && 'bg-emerald-50/50 hover:bg-emerald-100/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/35 border-l-4 border-l-emerald-500'
            )

            return (
              <TableRow key={row.id} className={rowClass}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Shadcn Data Table Pagination */}
      <DataTablePagination table={table} pageSizeOptions={[15, 25, 50, 100, 200]} />
    </div>
  )
}
