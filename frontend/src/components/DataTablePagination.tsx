import type { Table } from '@tanstack/react-table'
import { PaginationBar } from '@/components/PaginationBar'

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  pageSizeOptions?: number[]
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [15, 25, 50, 100, 200],
}: DataTablePaginationProps<TData>) {
  return (
    <PaginationBar
      pageIndex={table.getState().pagination.pageIndex}
      pageSize={table.getState().pagination.pageSize}
      pageCount={table.getPageCount()}
      totalRows={table.getFilteredRowModel().rows.length}
      onPageChange={(i) => table.setPageIndex(i)}
      onPageSizeChange={(n) => table.setPageSize(n)}
      pageSizeOptions={pageSizeOptions}
    />
  )
}
