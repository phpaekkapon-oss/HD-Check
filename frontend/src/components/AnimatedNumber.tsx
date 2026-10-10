import { useEffect, useRef, useState, type FC } from 'react'

interface AnimatedNumberProps {
  readonly value: number
  readonly duration?: number
  readonly decimals?: number
  readonly prefix?: string
  readonly suffix?: string
  readonly className?: string
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

export const AnimatedNumber: FC<AnimatedNumberProps> = ({
  value,
  duration = 750,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0)
  const [hasChanged, setHasChanged] = useState<boolean>(false)
  const displayValueRef = useRef<number>(0)
  const animFrameRef = useRef<number | null>(null)
  const isFirstMountRef = useRef<boolean>(true)

  useEffect(() => {
    // Check if reduced motion is requested
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setDisplayValue(value)
      displayValueRef.current = value
      isFirstMountRef.current = false
      return
    }

    const startVal = displayValueRef.current
    const targetVal = value
    const startTime = performance.now()
    const diff = targetVal - startVal
    const isInitialValue = isFirstMountRef.current
    isFirstMountRef.current = false
    let changeTimeout: ReturnType<typeof setTimeout> | undefined

    if (diff !== 0 && !isInitialValue) {
      setHasChanged(true)
      changeTimeout = setTimeout(() => setHasChanged(false), 800)
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = easeOutCubic(progress)
      const current = startVal + diff * eased

      displayValueRef.current = current
      setDisplayValue(current)

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        displayValueRef.current = targetVal
        setDisplayValue(targetVal)
      }
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      if (changeTimeout) clearTimeout(changeTimeout)
    }
  }, [value, duration])

  return (
    <span
      className={`inline-block tabular-nums transition-transform duration-300 ${
        hasChanged ? 'scale-105 text-emerald-500 dark:text-emerald-400' : ''
      } ${className ?? ''}`}
    >
      {prefix}
      {formatNumber(displayValue, decimals)}
      {suffix}
    </span>
  )
}
