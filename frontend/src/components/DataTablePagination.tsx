import type { Table } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  pageSizeOptions?: number[]
}

function getPaginationRange(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages]
  }
  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages]
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [15, 25, 50, 100, 200],
}: DataTablePaginationProps<TData>) {
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const pageCount = table.getPageCount()
  const totalRows = table.getFilteredRowModel().rows.length
  const currentPage = pageCount === 0 ? 0 : pageIndex + 1

  const startRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows)

  const paginationRange = pageCount > 0 ? getPaginationRange(currentPage, pageCount) : []

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-[#15182a] border-t border-slate-200 dark:border-[#292440] text-xs text-slate-600 dark:text-slate-200 select-none">
      {/* Left: Total Records Info & Page Size */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
        <span className="font-mono text-slate-500 dark:text-slate-400 text-xs">
          แสดง <strong className="text-slate-800 dark:text-slate-200">{startRow.toLocaleString()}–{endRow.toLocaleString()}</strong> จากทั้งหมด{' '}
          <strong className="text-slate-800 dark:text-slate-200">{totalRows.toLocaleString()}</strong> รายการ
        </span>

        {/* Page size select */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 dark:text-slate-400 hidden md:inline">ต่อหน้า:</span>
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-300 dark:border-[#383350] bg-white dark:bg-[#101326] px-2 py-1 text-xs font-mono font-medium text-slate-700 dark:text-slate-200 shadow-2xs focus:outline-none focus:ring-1 cursor-pointer"
            aria-label="จำนวนรายการต่อหน้า"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} แถว
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Modern Numbered Pagination Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
        {/* First Page (<<) */}
        <button
          type="button"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          className="size-8 rounded-lg border border-slate-200 dark:border-[#383350] bg-white dark:bg-[#1a1d32] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#282a46] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-2xs flex items-center justify-center transition active:scale-95"
          title="หน้าแรกสุด"
          aria-label="หน้าแรกสุด"
        >
          <ChevronsLeft className="size-3.5" />
        </button>

        {/* Previous Page (<) */}
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="size-8 rounded-lg border border-slate-200 dark:border-[#383350] bg-white dark:bg-[#1a1d32] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#282a46] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-2xs flex items-center justify-center transition active:scale-95"
          title="หน้าก่อนหน้า"
          aria-label="หน้าก่อนหน้า"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {/* Mobile Page Indicator (compact) */}
        <div className="sm:hidden font-mono text-xs font-medium text-slate-700 dark:text-slate-200 px-2">
          {currentPage} / {pageCount}
        </div>

        {/* Numbered Page Buttons (Desktop / Tablet) */}
        <div className="hidden sm:flex items-center gap-1">
          {paginationRange.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="size-8 flex items-center justify-center font-mono text-slate-400 dark:text-slate-500 select-none text-xs"
                >
                  …
                </span>
              )
            }

            const isCurrent = p === currentPage
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => table.setPageIndex(p - 1)}
                className={cn(
                  'size-8 rounded-lg font-mono text-xs font-bold transition flex items-center justify-center cursor-pointer',
                  isCurrent
                    ? 'btn-pill-action text-white shadow-xs scale-105 z-10'
                    : 'border border-slate-200 dark:border-[#383350] bg-white dark:bg-[#1a1d32] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#282a46] hover:text-slate-900 dark:hover:text-white shadow-2xs active:scale-95'
                )}
                aria-label={`ไปที่หน้า ${p}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {p}
              </button>
            )
          })}
        </div>

        {/* Next Page (>) */}
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="size-8 rounded-lg border border-slate-200 dark:border-[#383350] bg-white dark:bg-[#1a1d32] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#282a46] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-2xs flex items-center justify-center transition active:scale-95"
          title="หน้าถัดไป"
          aria-label="หน้าถัดไป"
        >
          <ChevronRight className="size-3.5" />
        </button>

        {/* Last Page (>>) */}
        <button
          type="button"
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={!table.getCanNextPage()}
          className="size-8 rounded-lg border border-slate-200 dark:border-[#383350] bg-white dark:bg-[#1a1d32] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#282a46] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-2xs flex items-center justify-center transition active:scale-95"
          title="หน้าสุดท้าย"
          aria-label="หน้าสุดท้าย"
        >
          <ChevronsRight className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
