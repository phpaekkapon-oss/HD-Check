import { useMemo, useState } from 'react'

/** แบ่งหน้าให้ตารางทั่วไป (ไม่ใช่ TanStack): ส่ง rows ที่กรองแล้ว คืนแถวของหน้าปัจจุบันและค่าสำหรับ PaginationBar */
export function usePagination<T>(rows: readonly T[], defaultPageSize = 15) {
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [requestedPage, setRequestedPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  // รายการเปลี่ยน (กรอง/ค้นหา) แล้วหน้าเดิมอาจเกินจำนวนหน้า จึงจำกัดไว้ที่หน้าสุดท้าย
  const pageIndex = Math.min(requestedPage, pageCount - 1)

  const pageRows = useMemo(
    () => rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [rows, pageIndex, pageSize]
  )

  return {
    pageRows,
    barProps: {
      pageIndex,
      pageSize,
      pageCount: rows.length === 0 ? 0 : pageCount,
      totalRows: rows.length,
      onPageChange: (i: number) => setRequestedPage(Math.max(0, Math.min(i, pageCount - 1))),
      onPageSizeChange: (n: number) => {
        setPageSize(n)
        setRequestedPage(0)
      },
    },
    reset: () => setRequestedPage(0),
  }
}
