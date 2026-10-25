import { useMemo, useState, type FC } from 'react'
import { Box, Loader2, Square } from 'lucide-react'
import type { ThaiMedValueDaily } from '@/api/herbdx.api'
import { fmtNum, toThaiDate } from '@/lib/format'
import { cn } from '@/lib/utils'

type Bucket = 'day' | 'week' | 'month'

interface Point {
  readonly key: string
  readonly label: string
  readonly title: string
  readonly value: number
  readonly drug: number
  readonly service: number
  readonly visits: number
}

const W = 1200
const H = 300
const PAD = { left: 58, right: 74, top: 30, bottom: 36 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const COLOR = {
  service: { front: 'url(#tmServiceGrad)', side: '#5b21b6', top: '#c4b5fd', dot: '#7c3aed' },
  drug: { front: 'url(#tmDrugGrad)', side: '#0f766e', top: '#5eead4', dot: '#0d9488' },
} as const

/** ช่วงสั้นแสดงรายวัน ช่วงกลางรวมเป็นสัปดาห์ ช่วงยาวรวมเป็นเดือน ให้แท่งไม่แน่นจนอ่านไม่ออก */
const pickBucket = (days: number): Bucket => (days <= 62 ? 'day' : days <= 200 ? 'week' : 'month')

const parseDate = (iso: string) => new Date(`${iso}T00:00:00`)
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const monthShort = (d: Date) => d.toLocaleDateString('th-TH', { month: 'short' })

function aggregate(daily: readonly ThaiMedValueDaily[], bucket: Bucket): Point[] {
  const map = new Map<string, Point & { first: string; last: string }>()
  for (const d of daily) {
    const date = parseDate(d.date)
    let key = d.date
    let label = String(date.getDate())
    if (bucket === 'week') {
      const monday = new Date(date)
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
      key = isoOf(monday)
      label = `${monday.getDate()}/${monday.getMonth() + 1}`
    } else if (bucket === 'month') {
      key = d.date.slice(0, 7)
      label = monthShort(date)
    }
    const prev = map.get(key)
    map.set(key, {
      key,
      label,
      title: '',
      value: (prev?.value ?? 0) + d.value,
      drug: (prev?.drug ?? 0) + d.drugValue,
      service: (prev?.service ?? 0) + d.serviceValue,
      visits: (prev?.visits ?? 0) + d.visits,
      first: prev?.first ?? d.date,
      last: d.date,
    })
  }
  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ first, last, ...p }) => ({
      ...p,
      title: bucket === 'day' ? toThaiDate(first) : `${toThaiDate(first)} – ${toThaiDate(last)}`,
    }))
}

/** แกนสวยๆ: แบ่ง 4 ช่อง ขั้นละ 1/2/2.5/3/4/5/6/8 × 10^n เลือกขั้นเล็กสุดที่ครอบค่าสูงสุด (ไม่ปล่อยที่ว่างเหนือแท่งมากเกินไป) */
function niceMax(max: number): number {
  if (max <= 0) return 1
  const raw = max / 4
  const exp = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = ([1, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * exp >= raw) ?? 10) * exp
  return step * 4
}

const compact = (n: number): string => {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

const BUCKET_LABEL: Record<Bucket, { title: string; unit: string }> = {
  day: { title: 'มูลค่ารายวัน', unit: 'วัน' },
  week: { title: 'มูลค่ารายสัปดาห์', unit: 'สัปดาห์' },
  month: { title: 'มูลค่ารายเดือน', unit: 'เดือน' },
}

interface ThaiMedValueChartProps {
  readonly daily: readonly ThaiMedValueDaily[]
  readonly startDate: string
  readonly endDate: string
  /** กำลังดึงข้อมูลช่วงที่เลือก (แสดงโครงกราฟแทนข้อความ "ไม่มีข้อมูล") */
  readonly loading?: boolean
  readonly error?: boolean
}

/** โครงกราฟระหว่างโหลด: แท่งกะพริบเบาๆ พร้อมข้อความ ไม่ให้เข้าใจผิดว่าไม่มีข้อมูล */
const ChartSkeleton: FC = () => (
  <div role="status" aria-live="polite" className="rounded-xl border border-slate-200/70 dark:border-white/5 bg-slate-50/70 dark:bg-[#070b14]/50 p-4">
    <div className="flex h-44 items-end gap-3 px-6">
      {[45, 70, 55, 85, 60, 75, 50, 90, 65, 80, 55, 70].map((h, i) => (
        <div key={i} className="flex-1 animate-pulse rounded-t bg-slate-200 dark:bg-white/10" style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
    <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <Loader2 className="size-3.5 animate-spin" /> กำลังดึงข้อมูลจาก HOSxP… ช่วงยาวอาจใช้เวลาสักครู่
    </p>
  </div>
)

/** กราฟแท่งซ้อน ยา / บริการ-หัตถการ (ประมาณการ) สไตล์เดียวกับกราฟ 3 มิติหน้าแรก */
export const ThaiMedValueChart: FC<ThaiMedValueChartProps> = ({ daily, startDate, endDate, loading = false, error = false }) => {
  const [is3D, setIs3D] = useState(true)
  const [hovered, setHovered] = useState<number | null>(null)

  const days = Math.max(1, Math.round((parseDate(endDate).getTime() - parseDate(startDate).getTime()) / 86_400_000) + 1)
  const bucket = pickBucket(days)

  const points = useMemo(() => aggregate(daily, bucket), [daily, bucket])
  const stats = useMemo(() => {
    const total = points.reduce((s, p) => s + p.value, 0)
    const peakIdx = points.reduce((best, p, i) => (p.value > (points[best]?.value ?? -1) ? i : best), 0)
    return { total, avg: points.length ? total / points.length : 0, peakIdx }
  }, [points])

  const max = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const slot = points.length > 0 ? PLOT_W / points.length : PLOT_W
  // แท่งกว้างราว 45% ของช่อง (ช่องว่างมากกว่าแท่ง) และไม่เกิน 28 หน่วย: ไม่อ้วนเมื่อมีแท่งน้อย เช่น 12 เดือน
  const barW = Math.min(28, Math.max(6, slot * 0.45))
  const dx = is3D ? Math.min(8, barW * 0.3) : 0
  const dy = is3D ? -dx * 0.8 : 0
  const y0 = PAD.top + PLOT_H
  const yOf = (v: number) => y0 - (v / max) * PLOT_H
  const avgY = yOf(stats.avg)
  const hoveredPoint = hovered !== null ? points[hovered] : undefined
  const hoveredCx = hovered !== null ? PAD.left + hovered * slot + slot / 2 + dx / 2 : 0
  const labelEvery = Math.max(1, Math.ceil(points.length / 16))

  return (
    <div className="rounded-2xl p-4 bg-themed-card border border-themed shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{BUCKET_LABEL[bucket].title} (บาท)</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            แยกค่ายา กับ ค่าบริการ/หัตถการ · ประมาณการจากมูลค่าที่คิดใน HOSxP
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="size-2.5 rounded-sm" style={{ background: COLOR.drug.dot }} />ค่ายา
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="size-2.5 rounded-sm" style={{ background: COLOR.service.dot }} />บริการ/หัตถการ
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="h-0 w-4 border-t-2 border-dashed border-amber-500" />เฉลี่ย
          </span>
          <button
            type="button"
            onClick={() => setIs3D((v) => !v)}
            aria-pressed={is3D}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-semibold transition cursor-pointer',
              is3D
                ? 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                : 'border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            )}
            title={is3D ? 'สลับเป็นกราฟ 2 มิติ' : 'สลับเป็นกราฟ 3 มิติ'}
          >
            {is3D ? <Box className="size-3.5" /> : <Square className="size-3.5" />}
            {is3D ? '3 มิติ' : '2 มิติ'}
          </button>
        </div>
      </div>

      {points.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">รวมช่วงที่เลือก</div>
            <div className="text-sm font-extrabold tabular-nums text-slate-800 dark:text-slate-100">{fmtNum(stats.total, 2)}</div>
          </div>
          <div className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">เฉลี่ยต่อ{BUCKET_LABEL[bucket].unit}</div>
            <div className="text-sm font-extrabold tabular-nums text-amber-600 dark:text-amber-400">{fmtNum(stats.avg, 2)}</div>
          </div>
          <div className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">สูงสุด · {points[stats.peakIdx]?.title}</div>
            <div className="text-sm font-extrabold tabular-nums text-violet-700 dark:text-violet-300">
              {fmtNum(points[stats.peakIdx]?.value ?? 0, 2)}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <ChartSkeleton />
      ) : error ? (
        <p className="py-10 text-center text-xs text-rose-500">ดึงข้อมูลกราฟไม่สำเร็จ ลองเลือกช่วงวันที่ใหม่อีกครั้ง</p>
      ) : points.length === 0 ? (
        <p className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">ไม่มีข้อมูลในช่วงวันที่เลือก</p>
      ) : (
        <div className="relative rounded-xl border border-slate-200/70 dark:border-white/5 bg-slate-50/70 dark:bg-[#070b14]/50 p-2">
          <svg
            key={`${startDate}-${endDate}-${is3D}`}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto select-none overflow-visible"
            role="img"
            aria-label={`กราฟแท่ง${BUCKET_LABEL[bucket].title}แยกค่ายาและค่าบริการ`}
          >
            <defs>
              <linearGradient id="tmServiceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
              <linearGradient id="tmDrugGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#0f766e" />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = PAD.top + PLOT_H * (1 - pct)
              return (
                <g key={pct}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + PLOT_W}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeDasharray={pct === 0 ? undefined : '3 3'}
                  />
                  <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" className="text-[11px] fill-slate-500 dark:fill-slate-400 tabular-nums">
                    {compact(max * pct)}
                  </text>
                </g>
              )
            })}
            <text x={PAD.left - 8} y={PAD.top - 12} textAnchor="end" className="text-[11px] fill-slate-500 dark:fill-slate-400 font-medium">
              บาท
            </text>

            {points.map((p, i) => {
              const cx = PAD.left + i * slot + slot / 2
              const x = cx - barW / 2
              const drugH = (p.drug / max) * PLOT_H
              const svcH = (p.service / max) * PLOT_H
              const drugY = y0 - drugH
              const svcY = drugY - svcH
              const isHover = hovered === i
              const isPeak = i === stats.peakIdx
              const topIsService = svcH > 0.5
              return (
                <g
                  key={p.key}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                >
                  <rect x={cx - slot / 2} y={PAD.top - 6} width={slot} height={PLOT_H + 12} fill="transparent" />
                  {isHover && (
                    <rect x={cx - slot / 2} y={PAD.top - 6} width={slot} height={PLOT_H + 12} className="fill-violet-500/10" />
                  )}
                  {is3D && p.value > 0 && <ellipse cx={cx + dx / 2} cy={y0 + 2} rx={barW * 0.75} ry={2.5} fill="#000" opacity={isHover ? 0.45 : 0.28} />}
                  <g className="bar-grow" style={{ animationDelay: `${Math.min(i * 25, 500)}ms`, opacity: isHover ? 1 : 0.94 }}>
                    {drugH > 0 && (
                      <g>
                        <rect x={x} y={drugY} width={barW} height={drugH} fill={COLOR.drug.front} rx={!is3D && !topIsService ? 3 : 0} />
                        {is3D && (
                          <polygon
                            points={`${x + barW},${drugY} ${x + barW + dx},${drugY + dy} ${x + barW + dx},${drugY + drugH + dy} ${x + barW},${drugY + drugH}`}
                            fill={COLOR.drug.side}
                          />
                        )}
                        {is3D && !topIsService && (
                          <polygon
                            points={`${x},${drugY} ${x + dx},${drugY + dy} ${x + barW + dx},${drugY + dy} ${x + barW},${drugY}`}
                            fill={COLOR.drug.top}
                          />
                        )}
                      </g>
                    )}
                    {topIsService && (
                      <g>
                        <rect x={x} y={svcY} width={barW} height={svcH} fill={COLOR.service.front} rx={!is3D ? 3 : 0} />
                        {is3D && (
                          <polygon
                            points={`${x + barW},${svcY} ${x + barW + dx},${svcY + dy} ${x + barW + dx},${svcY + svcH + dy} ${x + barW},${svcY + svcH}`}
                            fill={COLOR.service.side}
                          />
                        )}
                        {is3D && (
                          <polygon
                            points={`${x},${svcY} ${x + dx},${svcY + dy} ${x + barW + dx},${svcY + dy} ${x + barW},${svcY}`}
                            fill={COLOR.service.top}
                          />
                        )}
                      </g>
                    )}
                  </g>
                  {isPeak && points.length > 1 && (
                    <g>
                      <rect x={cx + dx / 2 - 17} y={yOf(p.value) - 26} width={34} height={15} rx={7.5} fill="#7c3aed" />
                      <text x={cx + dx / 2} y={yOf(p.value) - 15.5} textAnchor="middle" className="text-[10px] fill-white font-bold">
                        สูงสุด
                      </text>
                    </g>
                  )}
                  {(i % labelEvery === 0 || i === points.length - 1) && (
                    <text
                      x={cx + dx / 2}
                      y={y0 + 18}
                      textAnchor="middle"
                      className={cn('text-[11px] tabular-nums', isHover ? 'fill-violet-600 dark:fill-violet-300 font-bold' : 'fill-slate-500 dark:fill-slate-400')}
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              )
            })}

            <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={avgY} y2={avgY} stroke="#d97706" strokeWidth="1.4" strokeDasharray="5 4" />
            <g>
              <rect x={PAD.left + PLOT_W + 6} y={avgY - 8.5} width={64} height={16} rx={8} className="fill-amber-500/90" />
              <text x={PAD.left + PLOT_W + 38} y={avgY + 3} textAnchor="middle" className="text-[10px] fill-white font-bold tabular-nums">
                เฉลี่ย {compact(stats.avg)}
              </text>
            </g>
          </svg>

          {hoveredPoint && (
            <div
              className="pointer-events-none absolute z-10 min-w-[190px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] shadow-lg"
              style={{
                left: `${Math.min(86, Math.max(14, (hoveredCx / W) * 100))}%`,
                top: '8px',
                transform: 'translateX(-50%)',
              }}
            >
              <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">{hoveredPoint.title}</div>
              <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: COLOR.drug.dot }} />ค่ายา</span>
                <span className="tabular-nums">{fmtNum(hoveredPoint.drug, 2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: COLOR.service.dot }} />บริการ/หัตถการ</span>
                <span className="tabular-nums">{fmtNum(hoveredPoint.service, 2)}</span>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-4 font-bold text-slate-800 dark:text-slate-100">
                <span>รวม</span>
                <span className="tabular-nums">{fmtNum(hoveredPoint.value, 2)} บาท</span>
              </div>
              <div className="text-slate-500 dark:text-slate-400 tabular-nums">{fmtNum(hoveredPoint.visits)} visit</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
