import { useState, useRef, useEffect } from 'react'
import type { Table } from '@tanstack/react-table'
import { SlidersHorizontal, Check } from 'lucide-react'

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>
  columnLabels?: Record<string, string>
}

export function DataTableViewOptions<TData>({
  table,
  columnLabels = {},
}: DataTableViewOptionsProps<TData>) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const columns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide())

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#45415d] bg-white dark:bg-[#292440] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-100 shadow-sm hover:bg-slate-50 dark:hover:bg-[#383250] cursor-pointer"
      >
        <SlidersHorizontal className="size-3.5 text-slate-500" />
        <span>เลือกคอลัมน์</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1.5 w-52 rounded-xl border border-slate-200 dark:border-[#45415d] bg-white dark:bg-[#1d2035] p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase px-2 py-1 border-b border-slate-100 dark:border-[#383250] mb-1">
            ซ่อน / แสดง คอลัมน์
          </div>
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {columns.map((column) => {
              const label = columnLabels[column.id] || column.id
              const isVisible = column.getIsVisible()

              return (
                <label
                  key={column.id}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) => column.toggleVisibility(!!e.target.checked)}
                    className="rounded border-slate-300 dark:border-[#74688b] size-3.5"
                    style={{ accentColor: 'var(--accent-hex)' }}
                  />
                  <span className="truncate flex-1">{label}</span>
                  {isVisible && <Check className="size-3 text-accent" />}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
