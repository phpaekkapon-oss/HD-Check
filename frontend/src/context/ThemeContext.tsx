import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'
export type DarkPreset = 'herbal' | 'clinical' | 'modern' | 'executive' | 'violet'

export interface AccentColorDef {
  readonly id: string
  readonly name: string
  readonly hex: string
  readonly titleBarHex: string
  readonly foreground: string
  readonly darkText: string
  readonly glow: string
  readonly activeRing: string
  readonly gradient: string
}

export const ACCENT_COLORS: readonly AccentColorDef[] = [
  // แถวที่ 1: โทนเย็นทางการแพทย์และทันสมัย (6 สี - ทุกสีตัวหนังสือขาวคมชัด 100%)
  { id: 'violet', name: 'ม่วงทันสมัย (Violet)', hex: '#9333ea', titleBarHex: '#7e22ce', foreground: '#ffffff', darkText: '#d8b4fe', glow: 'rgba(147, 51, 234, 0.35)', activeRing: 'ring-violet-400', gradient: 'from-violet-600 to-fuchsia-500' },
  { id: 'indigo', name: 'ครามพรีเมียม (Indigo)', hex: '#4f46e5', titleBarHex: '#4338ca', foreground: '#ffffff', darkText: '#a5b4fc', glow: 'rgba(79, 70, 229, 0.35)', activeRing: 'ring-indigo-400', gradient: 'from-indigo-600 to-violet-500' },
  { id: 'blue', name: 'น้ำเงินทางการ (Blue)', hex: '#2563eb', titleBarHex: '#1d4ed8', foreground: '#ffffff', darkText: '#93c5fd', glow: 'rgba(37, 99, 235, 0.35)', activeRing: 'ring-blue-400', gradient: 'from-blue-600 to-indigo-500' },
  { id: 'sky', name: 'ฟ้าคราม (Sky)', hex: '#0284c7', titleBarHex: '#0369a1', foreground: '#ffffff', darkText: '#7dd3fc', glow: 'rgba(2, 132, 199, 0.35)', activeRing: 'ring-sky-400', gradient: 'from-sky-600 to-cyan-500' },
  { id: 'cyan', name: 'ฟ้าคลินิก (Cyan)', hex: '#0891b2', titleBarHex: '#0e7490', foreground: '#ffffff', darkText: '#67e8f9', glow: 'rgba(8, 145, 178, 0.35)', activeRing: 'ring-cyan-400', gradient: 'from-cyan-600 to-blue-500' },
  { id: 'teal', name: 'ทีลการแพทย์ (Teal)', hex: '#0d9488', titleBarHex: '#0f766e', foreground: '#ffffff', darkText: '#5eead4', glow: 'rgba(13, 148, 136, 0.35)', activeRing: 'ring-teal-400', gradient: 'from-teal-600 to-cyan-500' },

  // แถวที่ 2: โทนธรรมชาติและสมุนไพรสดใส (6 สี - ปรับความลึกสีให้ตัวหนังสือเป็นสีขาวคมชัด ไม่ดำ)
  { id: 'emerald', name: 'เขียวสมุนไพร (Emerald)', hex: '#059669', titleBarHex: '#047857', foreground: '#ffffff', darkText: '#6ee7b7', glow: 'rgba(5, 150, 105, 0.35)', activeRing: 'ring-emerald-400', gradient: 'from-emerald-600 to-teal-500' },
  { id: 'green', name: 'เขียวธรรมชาติ (Green)', hex: '#16a34a', titleBarHex: '#15803d', foreground: '#ffffff', darkText: '#86efac', glow: 'rgba(22, 163, 74, 0.35)', activeRing: 'ring-green-400', gradient: 'from-green-600 to-emerald-500' },
  { id: 'lime', name: 'เขียวมะนาว (Lime)', hex: '#65a30d', titleBarHex: '#4d7c0f', foreground: '#ffffff', darkText: '#bef264', glow: 'rgba(101, 163, 13, 0.35)', activeRing: 'ring-lime-400', gradient: 'from-lime-600 to-emerald-500' },
  { id: 'amber', name: 'อำพันทอง (Amber)', hex: '#d97706', titleBarHex: '#b45309', foreground: '#ffffff', darkText: '#fcd34d', glow: 'rgba(217, 119, 6, 0.35)', activeRing: 'ring-amber-400', gradient: 'from-amber-600 to-orange-500' },
  { id: 'orange', name: 'ส้มสดใส (Orange)', hex: '#ea580c', titleBarHex: '#c2410c', foreground: '#ffffff', darkText: '#fdba74', glow: 'rgba(234, 88, 12, 0.35)', activeRing: 'ring-orange-400', gradient: 'from-orange-600 to-amber-500' },
  { id: 'rose', name: 'กุหลาบเวชกรรม (Rose)', hex: '#e11d48', titleBarHex: '#be123c', foreground: '#ffffff', darkText: '#fda4af', glow: 'rgba(225, 29, 72, 0.35)', activeRing: 'ring-rose-400', gradient: 'from-rose-600 to-pink-500' },
]

export interface DarkPresetDef {
  readonly id: DarkPreset
  readonly label: string
  readonly desc: string
  readonly swatchBg: string
  readonly defaultAccent: string
}

export const DARK_PRESETS: readonly DarkPresetDef[] = [
  { id: 'violet', label: '💜 โมเดิร์นม่วง (Modern Violet)', desc: 'กรมท่าเข้มตัดม่วง สดใสแบบระบบใหม่', swatchBg: 'bg-violet-500', defaultAccent: 'violet' },
  { id: 'herbal', label: '🌿 แพทย์แผนไทย (Herbal Emerald)', desc: 'เขียวสมุนไพรการแพทย์ มาตรฐานสูงสุด', swatchBg: 'bg-emerald-500', defaultAccent: 'emerald' },
  { id: 'clinical', label: '🏥 HOSxP คลาสสิก (Clinical Teal)', desc: 'ทีลการแพทย์โรงพยาบาล สบายตา คมชัด', swatchBg: 'bg-teal-500', defaultAccent: 'teal' },
  { id: 'modern', label: '🔷 คลินิกทันสมัย (Modern Cyan)', desc: 'สีฟ้าคลินิกยุคใหม่ ไฮเทค ลื่นไหล', swatchBg: 'bg-cyan-500', defaultAccent: 'cyan' },
  { id: 'executive', label: '💼 ผู้บริหารราชการ (Executive Blue)', desc: 'น้ำเงินกรมท่า หรูหรา เป็นทางการ', swatchBg: 'bg-blue-500', defaultAccent: 'blue' },
]

interface ThemeContextType {
  readonly mode: ThemeMode
  readonly darkPreset: DarkPreset
  readonly accent: AccentColorDef
  readonly setMode: (m: ThemeMode) => void
  readonly toggleMode: () => void
  readonly setDarkPreset: (p: DarkPreset) => void
  readonly setAccent: (a: AccentColorDef) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const DEFAULT_ACCENT: AccentColorDef = ACCENT_COLORS[0]! // Emerald (#10b981)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme_mode_v4') as ThemeMode
      if (saved === 'light' || saved === 'dark') return saved
    }
    return 'dark'
  })

  const [darkPreset, setDarkPresetState] = useState<DarkPreset>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme_dark_preset_v4') as DarkPreset
      if (saved && DARK_PRESETS.some((p) => p.id === saved)) return saved
    }
    return 'violet'
  })

  const [accentId, setAccentId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme_accent_v4')
      if (saved && ACCENT_COLORS.some((a) => a.id === saved)) return saved
    }
    return 'violet'
  })

  const currentAccent: AccentColorDef =
    ACCENT_COLORS.find((a) => a.id === accentId) ?? DEFAULT_ACCENT

  useLayoutEffect(() => {
    const root = document.documentElement
    if (mode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    root.setAttribute('data-theme-mode', mode)
    root.setAttribute('data-dark-preset', darkPreset)
    root.setAttribute('data-accent', currentAccent.id)
    root.style.setProperty('--accent-hex', currentAccent.hex)
    root.style.setProperty('--accent-foreground', currentAccent.foreground)
    root.style.setProperty('--accent-text', mode === 'dark' ? currentAccent.darkText : currentAccent.hex)
    root.style.setProperty('--accent-glow', currentAccent.glow)
    // Professional Linear/Vercel Luxury sidebar variables
    root.style.setProperty(
      '--sidebar-active-bg',
      mode === 'dark'
        ? `linear-gradient(90deg, color-mix(in srgb, ${currentAccent.hex} 18%, transparent) 0%, color-mix(in srgb, ${currentAccent.hex} 7%, transparent) 100%)`
        : `linear-gradient(90deg, color-mix(in srgb, ${currentAccent.hex} 14%, white) 0%, color-mix(in srgb, ${currentAccent.hex} 5%, white) 100%)`
    )
    root.style.setProperty(
      '--sidebar-bg',
      mode === 'dark'
        ? `color-mix(in srgb, #0b0f19 92%, ${currentAccent.hex} 8%)`
        : '#ffffff'
    )
    root.style.setProperty(
      '--sidebar-border',
      mode === 'dark'
        ? `color-mix(in srgb, ${currentAccent.hex} 15%, rgba(255, 255, 255, 0.08))`
        : '#e2e8f0'
    )

    // Update PWA window title bar theme-color dynamically with calibrated luminance (guarantees crisp white text for all 12 colors)
    let themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.setAttribute('name', 'theme-color')
      document.head.appendChild(themeColorMeta)
    }
    themeColorMeta.setAttribute('content', currentAccent.titleBarHex)

    // Update Favicon and Title Bar Icon to match chosen accent color dynamically
    try {
      const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${currentAccent.hex}"/>
            <stop offset="100%" stop-color="${currentAccent.darkText}"/>
          </linearGradient>
          <filter id="fShadow">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.3"/>
          </filter>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#bgGrad)"/>
        <g transform="translate(16, 16) scale(1.33)" filter="url(#fShadow)">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" fill="#ffffff" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" stroke="${currentAccent.hex}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg>`

      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgFavicon)}`
      const iconLinks = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')
      iconLinks.forEach((link) => {
        link.href = svgDataUrl
      })
    } catch (_) {}

    localStorage.setItem('theme_mode_v4', mode)
    localStorage.setItem('theme_dark_preset_v4', darkPreset)
    localStorage.setItem('theme_accent_v4', currentAccent.id)
  }, [mode, darkPreset, currentAccent])

  const setMode = (m: ThemeMode) => setModeState(m)
  const toggleMode = () => setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  const setDarkPreset = (p: DarkPreset) => {
    setDarkPresetState(p)
    const presetDef = DARK_PRESETS.find((d) => d.id === p)
    if (presetDef) {
      setAccentId(presetDef.defaultAccent)
    }
  }
  const setAccent = (a: AccentColorDef) => setAccentId(a.id)

  return (
    <ThemeContext.Provider
      value={{
        mode,
        darkPreset,
        accent: currentAccent,
        setMode,
        toggleMode,
        setDarkPreset,
        setAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
