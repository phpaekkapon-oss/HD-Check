import { useEffect, useRef, type ClipboardEvent, type FC, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  readonly value: string
  readonly onChange: (value: string) => void
  /** Called once all digits are filled (typed or pasted) */
  readonly onComplete?: (value: string) => void
  readonly length?: number
  readonly disabled?: boolean
  readonly invalid?: boolean
  readonly autoFocus?: boolean
  readonly label?: string
}

/** Segmented one-time-code input: one box per digit, auto-advance, paste, Backspace/arrow navigation */
export const OtpInput: FC<OtpInputProps> = ({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = false,
  label = 'รหัสยืนยัน',
}) => {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const focusAt = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))]
    el?.focus()
    el?.select()
  }

  useEffect(() => {
    if (autoFocus && !disabled) focusAt(Math.min(value.length, length - 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled])

  // ล้างค่าแล้ว (เช่น รหัสผิด) -> กลับไปช่องแรก
  useEffect(() => {
    if (value === '' && !disabled) focusAt(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, disabled])

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    if (clean.length === length) onComplete?.(clean)
    return clean
  }

  const handleInput = (i: number, raw: string) => {
    let incoming = raw.replace(/\D/g, '')
    if (!incoming) return
    // พิมพ์ทับช่องที่มีเลขอยู่แล้ว (ไม่ได้เลือกข้อความไว้) -> ใช้เฉพาะตัวที่พิมพ์ใหม่
    if (incoming.length === 2 && digits[i] && incoming.includes(digits[i])) {
      incoming = incoming.charAt(0) === digits[i] ? incoming.charAt(1) : incoming.charAt(0)
    }
    // พิมพ์ทับ หรือ autofill จาก SMS/แอปที่ใส่มาทีเดียวหลายหลัก
    const next = (value.slice(0, i) + incoming).slice(0, length)
    const clean = commit(next)
    focusAt(clean.length >= length ? length - 1 : clean.length)
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) {
        commit(value.slice(0, i) + value.slice(i + 1))
        focusAt(i)
      } else if (i > 0) {
        commit(value.slice(0, i - 1) + value.slice(i))
        focusAt(i - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusAt(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusAt(i + 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const clean = commit(e.clipboardData.getData('text'))
    focusAt(clean.length >= length ? length - 1 : clean.length)
  }

  return (
    <div role="group" aria-label={label} className={cn('flex items-center justify-center gap-2 sm:gap-2.5', invalid && 'animate-shake')}>
      {digits.map((d, i) => (
        <span key={i} className="contents">
          {i === length / 2 && length % 2 === 0 && (
            <span aria-hidden className="h-0.5 w-2.5 rounded-full bg-white/20" />
          )}
          <input
            ref={(el) => {
              refs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            aria-label={`${label} หลักที่ ${i + 1}`}
            disabled={disabled}
            value={d}
            onFocus={(e) => e.target.select()}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              'size-11 sm:size-12 rounded-xl border bg-white/[0.04] text-center font-mono text-xl sm:text-2xl font-semibold text-white caret-transparent transition',
              'focus:outline-hidden focus:border-violet-400 focus:bg-white/[0.08] focus:ring-4 focus:ring-violet-500/20',
              'disabled:opacity-50',
              invalid ? 'border-rose-400/70 bg-rose-500/[0.06]' : d ? 'border-white/30' : 'border-white/12'
            )}
          />
        </span>
      ))}
    </div>
  )
}
