import { useEffect, useRef, useState, type FC } from 'react'

interface AnimatedNumberProps {
  readonly value: number
  readonly duration?: number
  readonly decimals?: number
  readonly prefix?: string
  readonly suffix?: string
  readonly className?: string
  /**
   * ทิศทางที่ "ดี" ของตัวเลขนี้ ใช้เลือกสีเมื่อค่าเปลี่ยน:
   * 'up' = เพิ่มแล้วดี (เช่น % ผ่าน), 'down' = ลดแล้วดี (เช่น รายการที่ต้องแก้), 'neutral' = แค่บอกว่าเปลี่ยน
   */
  readonly goodWhen?: 'up' | 'down' | 'neutral'
  /** แสดงป้าย ▲/▼ ส่วนต่างชั่วคราวเมื่อค่าเปลี่ยนจากการอัปเดตข้อมูล */
  readonly showDelta?: boolean
}

// Ease-out cubic for natural decelerating motion
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function formatNumber(val: number, decimals: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val)
}

const DELTA_VISIBLE_MS = 2600

export const AnimatedNumber: FC<AnimatedNumberProps> = ({
  value,
  duration = 750,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
  goodWhen = 'neutral',
  showDelta = false,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0)
  const [delta, setDelta] = useState<number | null>(null)
  const displayValueRef = useRef<number>(0)
  const targetRef = useRef<number | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // ค่าเปลี่ยนจากการอัปเดตข้อมูล (ไม่นับครั้งแรกที่โหลด)
    const previousTarget = targetRef.current
    targetRef.current = value
    let deltaTimeout: ReturnType<typeof setTimeout> | undefined
    if (previousTarget !== null && previousTarget !== value) {
      setDelta(value - previousTarget)
      deltaTimeout = setTimeout(() => setDelta(null), DELTA_VISIBLE_MS)
    }

    if (prefersReducedMotion) {
      displayValueRef.current = value
      setDisplayValue(value)
      return () => {
        if (deltaTimeout) clearTimeout(deltaTimeout)
      }
    }

    const startVal = displayValueRef.current
    const diff = value - startVal
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const progress = Math.min(1, (currentTime - startTime) / duration)
      const current = startVal + diff * easeOutCubic(progress)
      displayValueRef.current = current
      setDisplayValue(current)
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        displayValueRef.current = value
        setDisplayValue(value)
      }
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (deltaTimeout) clearTimeout(deltaTimeout)
    }
  }, [value, duration])

  const isGood = delta !== null && (goodWhen === 'up' ? delta > 0 : goodWhen === 'down' ? delta < 0 : null)
  const toneClass = delta === null ? '' : isGood === null ? 'text-accent' : isGood ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'

  return (
    <span className="inline-flex items-baseline">
      <span
        className={`inline-block tabular-nums transition-[transform,color] duration-300 ${delta !== null ? `scale-[1.04] ${toneClass}` : ''} ${className ?? ''}`}
      >
        {prefix}
        {formatNumber(displayValue, decimals)}
        {suffix}
      </span>
      {showDelta && delta !== null && (
        <span
          role="status"
          className={`delta-pop pointer-events-none ml-1.5 self-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
            isGood === null ? 'bg-accent-soft text-accent' : isGood ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-500 dark:text-rose-300'
          }`}
        >
          {delta > 0 ? '▲' : '▼'} {formatNumber(Math.abs(delta), decimals)}
        </span>
      )}
    </span>
  )
}
