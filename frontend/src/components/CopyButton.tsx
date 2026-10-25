import { useState, type FC, type MouseEvent } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrivacy } from '@/context/PrivacyContext'

interface CopyButtonProps {
  readonly text: string
  readonly title?: string
  readonly className?: string
  readonly iconSize?: string
  readonly showTooltip?: boolean
  /** ข้อมูลระบุตัวผู้ป่วย: ซ่อนปุ่มคัดลอกเมื่อเปิดโหมดปกปิดข้อมูล */
  readonly sensitive?: boolean
}

export const CopyButton: FC<CopyButtonProps> = ({
  text,
  title = 'คัดลอก',
  className,
  iconSize = 'size-3.5',
  showTooltip = true,
  sensitive = false,
}) => {
  const [copied, setCopied] = useState(false)
  const { hidden } = usePrivacy()

  const handleCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!text) return

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  if (sensitive && hidden) return null

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? 'คัดลอกแล้ว!' : title}
        aria-label={copied ? 'คัดลอกแล้ว' : title}
        className={cn(
          'inline-flex items-center justify-center p-1 rounded-md transition-all cursor-pointer',
          'text-slate-400 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-300',
          'hover:bg-slate-100 dark:hover:bg-white/10 active:scale-90',
          copied && 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
          className
        )}
      >
        {copied ? (
          <Check className={cn(iconSize, 'text-emerald-600 dark:text-emerald-400 transition-transform scale-110')} />
        ) : (
          <Copy className={cn(iconSize, 'transition-transform')} />
        )}
      </button>

      {/* Floating mini tooltip confirmation badge */}
      {showTooltip && copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-1.5 py-0.5 rounded text-xs font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
          คัดลอกแล้ว!
        </span>
      )}
    </div>
  )
}
