import { useEffect, useState, useMemo, type FC } from 'react'
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
import { CheckCircle2, AlertCircle, FileQuestion, HelpCircle, Maximize2, Minimize2, Settings2 } from 'lucide-react'
import type { AuditRecord } from '@/types/herbdx.types'
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
import { cn } from '@/lib/utils'
import { toThaiDate } from '@/lib/format'

interface AuditTableProps {
  readonly records: readonly AuditRecord[]
  readonly embedded?: boolean
  readonly onConfigureDrug?: (record: AuditRecord) => void
}

function DxCodeCell({ code, record }: { readonly code: string; readonly record: AuditRecord }) {
  const normalizedCode = code.trim().toUpperCase().replace(/\./g, '')
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

  const isMatched = record.matched_dx.some((dx) => dx.toUpperCase().replace(/\./g, '') === normalizedCode)
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

export const AuditTable: FC<AuditTableProps> = ({ records, embedded = false, onConfigureDrug }) => {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    dx2: true,
    dx3: false,
    dx4: false,
    dx5: false,
    doctor_code: true,
  })
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded])

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
            <div className="flex flex-col py-0.5">
              <span className={cn(
                'font-semibold whitespace-nowrap',
                isProblem ? 'text-rose-950 dark:text-rose-300 font-bold' :
                  isPass ? 'text-emerald-800 dark:text-emerald-300 font-bold' :
                    'text-slate-800 dark:text-slate-100'
              )}>
                {row.original.drug_name}
              </span>
              {row.original.drug_units ? (
                <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  ขนาดบรรจุ: {row.original.drug_units}
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: 'drug_qty',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="จำนวน" className="justify-center" />
        ),
        cell: ({ row }) => {
          const shortUnit = cleanDrugUnit(row.original.drug_units)
          return (
            <div className="flex items-center justify-center gap-1.5 font-mono whitespace-nowrap">
              <span className="text-sm font-bold text-slate-850 dark:text-slate-100">
                {row.original.drug_qty}
              </span>
              {shortUnit ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium font-sans bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                  {shortUnit}
                </span>
              ) : null}
            </div>
          )
        },
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
                'px-1.5 py-0.5 rounded text-[11px] font-mono font-bold text-slate-800 dark:text-slate-100',
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
          return onConfigureDrug ? (
            <button
              type="button"
              onClick={() => onConfigureDrug(r)}
              className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
              title="เปิดหน้าตั้งค่าเกณฑ์ ICD-10 สำหรับยานี้"
            >
              <Settings2 className="size-3" /> ตั้งค่า
            </button>
          ) : (
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
    [onConfigureDrug]
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

  return (
    <div
      className={cn(
        'space-y-0 transition-colors overflow-hidden',
        expanded && 'fixed inset-2 z-[70] flex flex-col rounded-2xl border border-slate-200 bg-themed-card shadow-2xl dark:border-[#292440] sm:inset-4',
        !embedded && 'rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm'
      )}
    >
      {/* Table Toolbar Header with Column Toggle */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50/80 dark:bg-[#1d2035]/80 border-b border-slate-200 dark:border-[#292440]">
        <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <span className="font-semibold text-slate-900 dark:text-white">Shadcn Data Table</span>
          <span className="text-slate-400 dark:text-slate-500">•</span>
          <span>คลิกหัวคอลัมน์เพื่อเรียงลำดับ (Sort)</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {records.length.toLocaleString('th-TH')} รายการ
          </span>
          {!embedded && <button type="button" onClick={() => setExpanded((value) => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-themed px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-200 dark:hover:bg-white/5" aria-label={expanded ? 'ย่อมุมมองตาราง' : 'ขยายตารางเต็มหน้าจอ'} title={expanded ? 'ย่อมุมมอง (Esc)' : 'ขยายตารางเต็มหน้าจอ'}>
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            <span className="hidden sm:inline">{expanded ? 'ย่อมุมมอง' : 'ขยายตาราง'}</span>
          </button>}
          <DataTableViewOptions table={table} columnLabels={COLUMN_LABELS} />
        </div>
      </div>

      {/* Main Shadcn Data Table with sticky header and vertical scroll */}
      {expanded && <div className="border-b border-themed px-4 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">มุมมองเต็มหน้าจอ · เลื่อนแนวนอนเพื่อดูคอลัมน์ที่เหลือ · กด Esc เพื่อย่อ</div>}
      <Table className={expanded ? 'min-w-max' : undefined} containerClassName={expanded ? 'min-h-0 flex-1 overflow-auto' : 'max-h-[68vh] min-h-[420px] overflow-auto'}>
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
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center text-slate-500 dark:text-slate-400">
                <div className="flex flex-col items-center justify-center gap-1.5 py-8">
                  <AlertCircle className="size-8 text-amber-500 mb-1" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา</span>
                  <span className="text-xs text-slate-400">โปรดลองเลือกช่วงวันที่ใหม่ หรือปรับตัวกรองค้นหา</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => {
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
            })
          )}
        </TableBody>
      </Table>

      {/* Shadcn Data Table Pagination */}
      <DataTablePagination table={table} pageSizeOptions={[15, 25, 50, 100, 200]} />
    </div>
  )
}
