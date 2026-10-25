import type { FC } from 'react'
import { Banknote, ShieldAlert } from 'lucide-react'
import type { DateRange } from '@/types/herbdx.types'
import { useThaiMedValue } from '@/hooks/useHerbDx'
import { fmtNum } from '@/lib/format'

interface ThaiMedValueCardProps {
  readonly range: DateRange
}

const baht = (n: number) => fmtNum(n, 2)

/** มูลค่าบริการแผนกแพทย์แผนไทย (ประมาณการ) — แสดงเฉพาะ IT/ผู้ดูแลระบบ/ผู้ดูแลแผนไทย และไม่แสดงข้อมูลรายแพทย์ */
export const ThaiMedValueCard: FC<ThaiMedValueCardProps> = ({ range }) => {
  const { data, isLoading, isError } = useThaiMedValue(range, true)

  return (
    <div className="rounded-2xl p-4 bg-themed-card border border-themed shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Banknote className="size-4 text-accent" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">มูลค่าบริการแผนกแพทย์แผนไทย</h3>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            ประมาณการ
          </span>
        </div>
        <span className="text-[11px] text-slate-400">เห็นเฉพาะ IT / ผู้ดูแลแผนไทย</span>
      </div>

      {isLoading && <p className="text-xs text-slate-400">กำลังดึงข้อมูลจาก HOSxP…</p>}
      {isError && <p className="text-xs text-rose-500">ดึงข้อมูลมูลค่าบริการไม่สำเร็จ</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
              <div className="text-[11px] text-slate-500">มูลค่าบริการรวม (บาท)</div>
              <div className="text-xl font-extrabold tabular-nums text-accent">{baht(data.totalValue)}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
              <div className="text-[11px] text-slate-500">จำนวน visit ที่มีค่าบริการ</div>
              <div className="text-xl font-extrabold tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(data.visits)}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
              <div className="text-[11px] text-slate-500">ต้นทุนในระบบ (บาท)</div>
              <div className="text-xl font-extrabold tabular-nums text-slate-800 dark:text-slate-100">{baht(data.totalCost)}</div>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <div className="text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-1">
                <ShieldAlert className="size-3" />
                ยาสมุนไพรที่ไม่ผ่านเกณฑ์ (บาท)
              </div>
              <div className="text-xl font-extrabold tabular-nums text-rose-600 dark:text-rose-300">{baht(data.atRiskValue)}</div>
              <div className="text-[11px] text-rose-700/70 dark:text-rose-300/70">{fmtNum(data.atRiskItems)} รายการ (ผู้ป่วยนอก)</div>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {data.groups.map((g) => {
              const pct = data.totalValue > 0 ? (g.value / data.totalValue) * 100 : 0
              return (
                <div key={g.income_group} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-700 dark:text-slate-300" title={g.income_group}>{g.income_group}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {fmtNum(g.items)} รายการ · <strong className="text-slate-800 dark:text-slate-100">{baht(g.value)}</strong> ({fmtNum(pct, 1)}%)
                    </span>
                  </div>
                  <div className="h-1.5 mt-1 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            ประมาณการจากมูลค่ารายการที่คิดใน HOSxP (sum_price) ของผู้ป่วยนอกแผนกแพทย์แผนไทย ไม่ใช่เงินที่ได้รับจริงจากกองทุน
            ส่วนยาไม่ผ่านเกณฑ์ตรวจตามเกณฑ์ DX และจำนวนขั้นต่ำ ไม่รวมกฎรอบการจ่ายซ้ำ
          </p>
        </>
      )}
    </div>
  )
}
