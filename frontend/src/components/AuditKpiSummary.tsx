import type { FC } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, FileQuestion, Settings2, Users } from 'lucide-react'
import type { AuditKpiMetrics, AuditResultFilter } from '@/types/herbdx.types'
import { cn } from '@/lib/utils'
import { fmtNum } from '@/lib/format'
import { AnimatedNumber } from '@/components/AnimatedNumber'

interface AuditKpiSummaryProps {
  readonly kpi: AuditKpiMetrics
  readonly activeResult: AuditResultFilter
  readonly onSelect: (r: AuditResultFilter) => void
}

export const AuditKpiSummary: FC<AuditKpiSummaryProps> = ({ kpi, activeResult, onSelect }) => {
  const cards: readonly {
    id: AuditResultFilter
    label: string
    value: number
    sub: string
    icon: typeof Users
    iconBg: string
    valueColor: string
    subColor: string
    activeBorder: string
    activeShadow: string
    activeBg: string
    hoverBorder: string
    rate?: number
  }[] = [
    {
      id: 'ALL',
      label: 'รายการสั่งจ่ายทั้งหมด',
      value: kpi.total,
      sub: `${fmtNum(kpi.uniquePatients)} ราย · ${fmtNum(kpi.totalQty)} หน่วย`,
      icon: ClipboardList,
      iconBg: 'bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-500/30',
      valueColor: 'text-slate-900 dark:text-white',
      subColor: 'text-slate-500 dark:text-slate-400',
      activeBorder: 'border-indigo-500 dark:border-indigo-400',
      activeShadow: 'shadow-[0_0_0_3px_rgba(99,102,241,0.12),0_2px_8px_rgba(99,102,241,0.12)]',
      activeBg: 'bg-indigo-500/[0.06] dark:bg-indigo-950/40',
      hoverBorder: 'hover:border-indigo-400/60 dark:hover:border-indigo-500/40',
    },
    {
      id: 'PASS',
      label: 'ผ่านเกณฑ์ (รหัสโรคตรงข้อบ่งใช้)',
      value: kpi.pass,
      sub: `${kpi.passRate}% ของทั้งหมด`,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/30',
      valueColor: 'text-emerald-600 dark:text-emerald-400',
      subColor: 'text-emerald-700/80 dark:text-emerald-400/80',
      activeBorder: 'border-emerald-500 dark:border-emerald-400',
      activeShadow: 'shadow-[0_0_0_3px_rgba(16,185,129,0.12),0_2px_8px_rgba(16,185,129,0.12)]',
      activeBg: 'bg-emerald-500/[0.06] dark:bg-emerald-950/40',
      hoverBorder: 'hover:border-emerald-400/60 dark:hover:border-emerald-500/40',
      rate: kpi.passRate,
    },
    {
      id: 'FAIL',
      label: 'รหัสโรคไม่ตรงข้อบ่งใช้',
      value: kpi.fail,
      sub: 'ต้องแก้ไขรหัสวินิจฉัย',
      icon: AlertTriangle,
      iconBg: 'bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-500/30',
      valueColor: 'text-rose-600 dark:text-rose-400',
      subColor: 'text-rose-700/80 dark:text-rose-400/80',
      activeBorder: 'border-rose-500 dark:border-rose-400',
      activeShadow: 'shadow-[0_0_0_3px_rgba(244,63,94,0.12),0_2px_8px_rgba(244,63,94,0.12)]',
      activeBg: 'bg-rose-500/[0.06] dark:bg-rose-950/40',
      hoverBorder: 'hover:border-rose-400/60 dark:hover:border-rose-500/40',
    },
    {
      id: 'NO_DX',
      label: 'ไม่มีรหัสวินิจฉัย',
      value: kpi.noDx,
      sub: 'PDX / DX ว่าง',
      icon: FileQuestion,
      iconBg: 'bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/30',
      valueColor: 'text-amber-600 dark:text-amber-400',
      subColor: 'text-amber-700/80 dark:text-amber-400/80',
      activeBorder: 'border-amber-500 dark:border-amber-400',
      activeShadow: 'shadow-[0_0_0_3px_rgba(245,158,11,0.12),0_2px_8px_rgba(245,158,11,0.12)]',
      activeBg: 'bg-amber-500/[0.06] dark:bg-amber-950/40',
      hoverBorder: 'hover:border-amber-400/60 dark:hover:border-amber-500/40',
    },
    {
      id: 'NO_MAP',
      label: 'ยังไม่กำหนดเกณฑ์ ICD-10',
      value: kpi.noMap,
      sub: 'กำหนดในเมนูตั้งค่า',
      icon: Settings2,
      iconBg: 'bg-slate-500/15 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-500/30',
      valueColor: 'text-slate-700 dark:text-slate-300',
      subColor: 'text-slate-500 dark:text-slate-400',
      activeBorder: 'border-slate-400 dark:border-slate-300',
      activeShadow: 'shadow-[0_0_0_3px_rgba(148,163,184,0.12),0_2px_8px_rgba(148,163,184,0.12)]',
      activeBg: 'bg-slate-500/[0.06] dark:bg-slate-900/40',
      hoverBorder: 'hover:border-slate-400/60 dark:hover:border-slate-500/40',
    },
  ]

  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map((card) => {
        const isSelected = activeResult === card.id
        const isAllCard = card.id === 'ALL'
        const Icon = card.icon

        return (
          <button
            key={card.id}
            id={`kpi-${card.id.toLowerCase()}`}
            type="button"
            onClick={() => onSelect(isSelected && card.id !== 'ALL' ? 'ALL' : card.id)}
            className={cn(
              'rounded-2xl p-3.5 text-left transition-all duration-200 cursor-pointer relative overflow-hidden group',
              'border flex flex-col justify-between min-h-[132px]',
              'backdrop-blur-md',
              isSelected
                ? cn(card.activeBorder, card.activeShadow, card.activeBg, '-translate-y-0.5')
                : cn(
                    'bg-white/95 dark:bg-[#0c1424]/90 border-slate-200/90 dark:border-white/10 shadow-2xs hover:shadow-md hover:-translate-y-0.5',
                    card.hoverBorder
                  ),
              // Mobile layout balance
              isAllCard && 'col-span-2 sm:col-span-1'
            )}
          >
            {/* Top row: Label & Icon */}
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                  {card.label}
                </span>
                <div className={cn('size-8 rounded-lg grid place-items-center group-hover:scale-110 transition-transform shrink-0 border', card.iconBg)}>
                  <Icon className="size-4" />
                </div>
              </div>

              {/* Metric Value */}
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={cn('text-3xl sm:text-[32px] font-bold tabular-nums tracking-normal font-sans leading-none', card.valueColor)}>
                  <AnimatedNumber value={card.value} />
                </span>
                {card.rate !== undefined && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                    {card.rate}%
                  </span>
                )}
              </div>
            </div>

            {/* Bottom row: Subtext or Active Badge */}
            <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs gap-1">
              <span className={cn('truncate font-medium', card.subColor)}>
                {card.sub}
              </span>
              {isSelected && (
                <span className="shrink-0 flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs">
                  <span className="size-1 rounded-full bg-emerald-400 animate-pulse" />
                  เลือก
                </span>
              )}
            </div>
          </button>
        )
      })}
    </section>
  )
}
