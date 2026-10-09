import type { FC } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, FileQuestion, Settings2, Users } from 'lucide-react'
import type { AuditKpiMetrics, AuditResultFilter } from '@/types/herbdx.types'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import { fmtNum } from '@/lib/format'
import { AnimatedNumber } from '@/components/AnimatedNumber'

interface AuditKpiSummaryProps {
  readonly kpi: AuditKpiMetrics
  readonly activeResult: AuditResultFilter
  readonly onSelect: (r: AuditResultFilter) => void
}

export const AuditKpiSummary: FC<AuditKpiSummaryProps> = ({ kpi, activeResult, onSelect }) => {
  const { accent } = useTheme()

  const cards: readonly {
    id: AuditResultFilter
    label: string
    value: number
    sub: string
    icon: typeof Users
    cardBg: string
    iconStyle: string
    valueColor: string
    barGradient?: string
  }[] = [
    {
      id: 'ALL',
      label: 'รายการจ่ายยาทั้งหมด',
      value: kpi.total,
      sub: `${fmtNum(kpi.uniquePatients)} ราย · ${fmtNum(kpi.totalQty)} หน่วย`,
      icon: ClipboardList,
      cardBg: 'hover:border-teal-500/50',
      iconStyle: 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30',
      valueColor: 'text-slate-900 dark:text-white',
    },
    {
      id: 'PASS',
      label: 'ผ่าน (DX ตรงข้อบ่งใช้)',
      value: kpi.pass,
      sub: `${kpi.passRate}% ของทั้งหมด`,
      icon: CheckCircle2,
      cardBg: 'hover:border-emerald-500/50',
      iconStyle: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
      valueColor: 'text-emerald-600 dark:text-emerald-400',
      barGradient: 'bg-gradient-to-r from-teal-500 to-emerald-500',
    },
    {
      id: 'FAIL',
      label: 'DX ไม่ตรงข้อบ่งใช้',
      value: kpi.fail,
      sub: 'ต้องแก้ไขรหัสวินิจฉัย',
      icon: AlertTriangle,
      cardBg: 'hover:border-rose-500/50',
      iconStyle: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
      valueColor: 'text-rose-600 dark:text-rose-400',
    },
    {
      id: 'NO_DX',
      label: 'ไม่มีรหัสวินิจฉัย',
      value: kpi.noDx,
      sub: 'PDX / DX ว่าง',
      icon: FileQuestion,
      cardBg: 'hover:border-rose-500/50',
      iconStyle: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
      valueColor: 'text-rose-600 dark:text-rose-400',
    },
    {
      id: 'NO_MAP',
      label: 'ยังไม่ตั้งค่า ICD',
      value: kpi.noMap,
      sub: 'กำหนดในเมนูตั้งค่า',
      icon: Settings2,
      cardBg: 'hover:border-amber-500/50',
      iconStyle: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
      valueColor: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <section className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
      {cards.map((card) => {
        const selected = activeResult === card.id
        const isAllCard = card.id === 'ALL'
        const Icon = card.icon

        return (
          <button
            key={card.id}
            id={`kpi-${card.id.toLowerCase()}`}
            type="button"
            onClick={() => onSelect(selected && card.id !== 'ALL' ? 'ALL' : card.id)}
            className={cn(
              'text-left rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] relative overflow-hidden',
              'bg-themed-card border-themed text-slate-900 dark:text-white shadow-xs dark:shadow-sm',
              isAllCard && 'col-span-2 sm:col-span-1'
            )}
            style={
              selected
                ? {
                    borderColor: accent.hex,
                    boxShadow: `0 0 0 2px ${accent.hex}, 0 4px 20px ${accent.glow}`,
                  }
                : undefined
            }
          >
            <div className="flex items-start gap-3">
              {/* Squircle Glowing Icon Box on Left (Matching Screenshot) */}
              <div
                className={cn(
                  'grid place-items-center size-11 rounded-2xl shrink-0 transition-transform shadow-xs',
                  card.iconStyle
                )}
              >
                <Icon className="size-5" />
              </div>

              {/* Metric Content on Right */}
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {card.label}
                </span>

                <div className={cn('text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight my-0.5', card.valueColor)}>
                  <AnimatedNumber value={card.value} />
                </div>

                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400 truncate font-medium">
                  <span
                    className={cn(
                      'size-1.5 rounded-full shrink-0',
                      card.id === 'PASS' ? 'bg-emerald-500' :
                      card.id === 'FAIL' || card.id === 'NO_DX' ? 'bg-rose-500' :
                      card.id === 'NO_MAP' ? 'bg-amber-500' : 'bg-teal-500'
                    )}
                  />
                  <span className="truncate">
                    {card.id === 'ALL' ? (
                      <>
                        <AnimatedNumber value={kpi.uniquePatients} /> ราย ·{' '}
                        <AnimatedNumber value={kpi.totalQty} /> หน่วย
                      </>
                    ) : card.id === 'PASS' ? (
                      <>
                        <AnimatedNumber value={kpi.passRate} decimals={1} suffix="%" /> ของทั้งหมด
                      </>
                    ) : (
                      card.sub
                    )}
                  </span>
                </div>
              </div>
            </div>

            {card.id === 'PASS' && (
              <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-black/40 overflow-hidden ring-1 ring-slate-200 dark:ring-white/10">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', card.barGradient)}
                  style={{ width: `${Math.min(100, kpi.passRate)}%` }}
                />
              </div>
            )}
          </button>
        )
      })}
    </section>
  )
}
