import { useEffect, type FC } from 'react'
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Trash2,
  UserX,
  UserCheck,
  Power,
  RotateCcw,
  Loader2,
  X,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  detail?: string
  targetUser?: {
    loginname: string
    name?: string
    role?: string
  }
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary' | 'success'
  icon?: 'shield-alert' | 'shield-check' | 'key' | 'user-x' | 'user-check' | 'power' | 'trash' | 'reset' | 'alert'
  isLoading?: boolean
}

export const ConfirmModal: FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  detail,
  targetUser,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  variant = 'danger',
  icon,
  isLoading = false,
}) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLoading, onClose])

  if (!isOpen) return null

  // Determine icon & theme colors based on variant/icon
  const getIcon = () => {
    switch (icon) {
      case 'shield-alert':
        return <ShieldAlert className="size-6 stroke-[2.2]" />
      case 'shield-check':
        return <ShieldCheck className="size-6 stroke-[2.2]" />
      case 'key':
        return <KeyRound className="size-6 stroke-[2.2]" />
      case 'user-x':
        return <UserX className="size-6 stroke-[2.2]" />
      case 'user-check':
        return <UserCheck className="size-6 stroke-[2.2]" />
      case 'power':
        return <Power className="size-6 stroke-[2.2]" />
      case 'trash':
        return <Trash2 className="size-6 stroke-[2.2]" />
      case 'reset':
        return <RotateCcw className="size-6 stroke-[2.2]" />
      case 'alert':
      default:
        return variant === 'primary' || variant === 'success' ? (
          <ShieldCheck className="size-6 stroke-[2.2]" />
        ) : (
          <AlertTriangle className="size-6 stroke-[2.2]" />
        )
    }
  }

  const isDanger = variant === 'danger'
  const isWarning = variant === 'warning'
  const isPrimary = variant === 'primary' || variant === 'success'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={() => !isLoading && onClose()} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl z-10 text-white animate-scale-in p-6',
          'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 dark:from-[#161226] dark:via-[#130f21] dark:to-[#0c0916]',
          isDanger && 'border-rose-500/30 shadow-rose-950/40',
          isWarning && 'border-amber-500/30 shadow-amber-950/40',
          isPrimary && 'border-teal-500/30 shadow-teal-950/40'
        )}
      >
        {/* Soft radial glow */}
        <div
          className={cn(
            'pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-56 rounded-full blur-3xl opacity-30',
            isDanger && 'bg-rose-500',
            isWarning && 'bg-amber-500',
            isPrimary && 'bg-teal-500'
          )}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition disabled:opacity-50 cursor-pointer"
          aria-label="ปิด"
        >
          <X className="size-4.5" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex flex-col items-center text-center">
          <div
            className={cn(
              'size-14 rounded-2xl border flex items-center justify-center mb-4 shadow-lg ring-8',
              isDanger && 'bg-rose-500/15 border-rose-500/30 text-rose-400 ring-rose-500/5',
              isWarning && 'bg-amber-500/15 border-amber-500/30 text-amber-400 ring-amber-500/5',
              isPrimary && 'bg-teal-500/15 border-teal-500/30 text-teal-400 ring-teal-500/5'
            )}
          >
            {getIcon()}
          </div>

          <h3 id="confirm-modal-title" className="text-lg font-bold text-slate-100 tracking-tight">
            {title}
          </h3>

          {description && (
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm">
              {description}
            </p>
          )}
        </div>

        {/* Target User Info Card (if provided) */}
        {targetUser && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs text-white shrink-0 uppercase">
              {targetUser.loginname.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-white truncate">
                  {targetUser.loginname}
                </span>
                {targetUser.role && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-slate-300">
                    {targetUser.role}
                  </span>
                )}
              </div>
              {targetUser.name && (
                <p className="text-xs text-slate-400 truncate mt-0.5">{targetUser.name}</p>
              )}
            </div>
          </div>
        )}

        {/* Warning / Informational Callout */}
        {detail && (
          <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-xs text-slate-300 flex items-start gap-2.5 text-left">
            <Info className="size-4 shrink-0 text-slate-400 mt-0.5" />
            <div className="leading-relaxed opacity-90">{detail}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 min-h-11 py-2.5 px-4 rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white font-medium text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={isLoading}
            className={cn(
              'flex-1 min-h-11 py-2.5 px-4 rounded-xl font-semibold text-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-lg',
              isDanger &&
                'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-950/60 focus-visible:ring-rose-500',
              isWarning &&
                'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-amber-950/60 focus-visible:ring-amber-500',
              isPrimary &&
                'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-teal-950/60 focus-visible:ring-teal-500'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>กำลังดำเนินการ…</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
