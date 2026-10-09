import { useRef, useEffect, type FC } from 'react'
import { Sun, Moon, Check } from 'lucide-react'
import {
  useTheme,
  ACCENT_COLORS,
  DARK_PRESETS,
  type DarkPreset,
  type AccentColorDef,
} from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

interface ThemeCustomizerPopoverProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

export const ThemeCustomizerPopover: FC<ThemeCustomizerPopoverProps> = ({ isOpen, onClose }) => {
  const { mode, darkPreset, accent, setMode, setDarkPreset, setAccent } = useTheme()
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-88 rounded-2xl bg-themed-card text-slate-800 dark:text-slate-100 p-4 border border-slate-200 dark:border-[#292440] shadow-2xl shadow-slate-900/15 dark:shadow-black/80 space-y-4 animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      {/* 1. Mode Switcher (สว่าง / มืด) */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-[#09151e] border border-slate-200 dark:border-white/5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMode('light')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer',
            mode === 'light'
              ? 'bg-white text-slate-900 shadow-md font-bold ring-1 ring-slate-200'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <Sun className="size-3.5 text-amber-500" />
          <span>สว่าง</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('dark')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer',
            mode === 'dark'
              ? 'bg-white dark:bg-[#1b2f3d] text-slate-900 dark:text-white shadow-md font-bold ring-1 ring-white/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          <Moon className="size-3.5 text-amber-500 dark:text-amber-300" />
          <span>มืด</span>
        </button>
      </div>

      {/* 2. Hospital System Themes (5 PRESETS) */}
      <div className={cn('space-y-2', mode !== 'dark' && 'opacity-40 pointer-events-none')}>
        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
          ธีมระบบโรงพยาบาลมืออาชีพ (5 THEMES)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DARK_PRESETS.map((preset) => {
            const isSelected = darkPreset === preset.id && mode === 'dark'
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDarkPreset(preset.id as DarkPreset)}
                className={cn(
                  'flex items-start gap-2.5 p-2.5 rounded-xl text-left border transition-all cursor-pointer text-xs',
                  isSelected
                    ? 'bg-[var(--sidebar-active-bg)] text-slate-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a1622] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white'
                )}
                style={isSelected ? { borderColor: accent.hex, boxShadow: `0 0 0 1px ${accent.hex}55` } : undefined}
              >
                <span className={cn('size-4 rounded-full mt-0.5 shrink-0 shadow-sm', preset.swatchBg)} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="font-bold text-[12px] truncate">{preset.label}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{preset.desc}</div>
                </div>
                {isSelected && <Check className="size-4 text-accent shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Accent Color (สีไฮไลต์ทางการแพทย์) */}
      <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider font-mono">
          <span className="text-slate-700 dark:text-slate-300">สีไฮไลต์ปุ่มและสถานะ (ACCENT)</span>
          <span className="font-semibold text-accent">
            {accent.name}
          </span>
        </div>

        {/* 6 Curated Medical Color Swatches */}
        <div className="grid grid-cols-6 gap-2">
          {ACCENT_COLORS.map((col: AccentColorDef) => {
            const isSelected = accent.id === col.id
            return (
              <button
                key={col.id}
                type="button"
                title={col.name}
                onClick={() => setAccent(col)}
                className={cn(
                  'size-9 rounded-full transition-transform cursor-pointer relative grid place-items-center active:scale-90',
                  isSelected
                    ? 'scale-110 ring-2 ring-slate-800 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-[#14172a] shadow-lg'
                    : 'hover:scale-105 opacity-90 hover:opacity-100'
                )}
                style={{
                  backgroundColor: col.hex,
                  boxShadow: isSelected ? `0 0 14px ${col.glow}` : undefined,
                }}
              >
                {isSelected && <Check className="size-4 text-white drop-shadow-md stroke-[3]" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
