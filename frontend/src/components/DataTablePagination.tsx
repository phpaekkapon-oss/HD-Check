import type { Table } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  pageSizeOptions?: number[]
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [15, 25, 50, 100],
}: DataTablePaginationProps<TData>) {
  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()
  const totalRows = table.getFilteredRowModel().rows.length

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-50 dark:bg-[#1d2035] border-t border-slate-200 dark:border-[#292440] text-xs text-slate-600 dark:text-slate-200 select-none">
      <div className="flex items-center gap-2">
        <span className="font-mono text-slate-500 dark:text-slate-300">
          แสดงผล {totalRows.toLocaleString()} รายการ
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Page size select */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-300">แสดงต่อหน้า:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value))
            }}
            className="rounded-lg border border-slate-300 dark:border-[#45415d] bg-white dark:bg-[#111326] px-2 py-1 text-xs font-mono font-medium text-slate-700 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-1 cursor-pointer"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Page counter */}
        <div className="font-mono text-slate-600 dark:text-slate-200 font-medium">
          หน้า {pageCount === 0 ? 0 : pageIndex + 1} จาก {pageCount}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#45415d] bg-white dark:bg-[#292440] text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#383250] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            title="หน้าแรก"
          >
            <ChevronsLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#45415d] bg-white dark:bg-[#292440] text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#383250] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            title="ก่อนหน้า"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#45415d] bg-white dark:bg-[#292440] text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#383250] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            title="ถัดไป"
          >
            <ChevronRight className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#45415d] bg-white dark:bg-[#292440] text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#383250] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            title="หน้าสุดท้าย"
          >
            <ChevronsRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
