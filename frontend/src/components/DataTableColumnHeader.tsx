import type { Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn('font-bold', className)}>{title}</div>
  }

  const isSorted = column.getIsSorted()

  return (
    <div
      onClick={() => column.toggleSorting(isSorted === 'asc')}
      className={cn(
        'flex items-center gap-1.5 cursor-pointer select-none group font-bold hover:text-slate-900 dark:hover:text-white',
        className
      )}
    >
      <span>{title}</span>
      {isSorted === 'desc' ? (
        <ArrowDown className="size-3.5 text-accent" />
      ) : isSorted === 'asc' ? (
        <ArrowUp className="size-3.5 text-accent" />
      ) : (
        <ArrowUpDown className="size-3 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 opacity-60 group-hover:opacity-100" />
      )}
    </div>
  )
}
