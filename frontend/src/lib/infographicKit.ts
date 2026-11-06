import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  Baby,
  Banknote,
  BriefcaseMedical,
  Building2,
  CalendarDays,
  CircleHelp,
  Coins,
  CreditCard,
  Flower2,
  HandHeart,
  Heart,
  Hospital,
  House,
  Leaf,
  Pill,
  ShieldCheck,
  Sprout,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ThaiMedDailySummary } from '@/api/herbdx.api'
import { fmtNum } from '@/lib/format'

export const FONT = `Prompt, 'Noto Sans Thai', Sarabun, sans-serif`
export const WHITE = '#ffffff'

const ICONS = {
  users: Users,
  house: House,
  massage: HandHeart,
  herb: Pill,
  clinic: BriefcaseMedical,
  coins: Coins,
  ofc: UserRoundCheck,
  lgo: Building2,
  uc: CreditCard,
  pay: Banknote,
  sss: ShieldCheck,
  other: CircleHelp,
  calendar: CalendarDays,
  hospital: Hospital,
  leaf: Leaf,
  sprout: Sprout,
  baby: Baby,
  heart: Heart,
  flower: Flower2,
} satisfies Record<string, LucideIcon>
export type IconName = keyof typeof ICONS
export const groupIcon = (id: string): IconName => (id in ICONS ? (id as IconName) : 'other')

export type Align = 'left' | 'center' | 'right'
export type IconSet = ReadonlyMap<string, HTMLImageElement>
export type Pair = readonly [string, string]

/** ชุดสี + โครงของแต่ละสไตล์ภาพ */
export interface Theme {
  readonly id: string
  readonly label: string
  readonly hint: string
  /** สีตัวอย่างบนปุ่มเลือกสไตล์ */
  readonly swatch: string
  readonly layout: 'table' | 'dashboard' | 'cards'
  readonly w: number
  readonly h: number
  readonly bg: Pair
  readonly header: 'banner' | 'plain'
  readonly head: Pair
  readonly headInk: string
  readonly headSub: string
  /** สีเน้น (ป้ายราคา/จุดเด่น) และสีตัวอักษรบนสีเน้น */
  readonly accent: string
  readonly onAccent: string
  readonly ink: string
  readonly inkSoft: string
  readonly surface: string
  readonly surfaceAlt: string
  readonly edge: string
  /** พื้นแถวพิเศษ (ผู้รับบริการ/ออกชุมชน/ค่าบริการผู้ป่วยนอก) */
  readonly hilite: string
  readonly tableHead: Pair
  readonly tableHeadInk: string
  readonly strong: string
  readonly strongInk: string
  readonly total: Pair
  readonly totalInk: string
  /** สีตัวเลขเด่นในการ์ด */
  readonly value: string
  readonly chipBg: string
  readonly chipInk: string
  readonly chipGrad: Pair
  readonly bar: Pair
  readonly foot: Pair
  readonly footInk: string
  readonly footSoft: string
  readonly mark: readonly [IconName, IconName]
}

export interface Period {
  /** บรรทัดบน เช่น "วันศุกร์ที่" / "ประจำเดือน" */
  readonly lead: string
  /** วันที่/เดือนตัวใหญ่ */
  readonly big: string
  readonly title: string
  /** หัวข้อแผงสรุปด้านขวา */
  readonly panel: string
}

export interface Scene {
  readonly ctx: CanvasRenderingContext2D
  readonly icons: IconSet
  readonly t: Theme
  readonly s: ThaiMedDailySummary
  readonly period: Period
  readonly hospital: string
}

export const money = (n: number) => fmtNum(n, 2)
export const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)

export const iconColors = (t: Theme): readonly string[] => [...new Set([t.chipInk, WHITE, t.onAccent, t.accent, t.headInk, t.ink])]

async function loadIcon(Icon: LucideIcon, color: string): Promise<HTMLImageElement> {
  const svg = renderToStaticMarkup(createElement(Icon, { size: 96, color, strokeWidth: 2 }))
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  return img
}

/** โหลดไอคอนทุกตัวเป็นรูปล่วงหน้า (ตามสีที่ธีมใช้) เพื่อให้วาดแบบ sync ได้ */
export async function loadIcons(colors: readonly string[]): Promise<IconSet> {
  const names = Object.keys(ICONS) as IconName[]
  const entries = await Promise.all(
    names.flatMap((name) => colors.map(async (color) => [`${name}|${color}`, await loadIcon(ICONS[name], color)] as const))
  )
  return new Map(entries)
}

export async function loadFonts() {
  await Promise.all([400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 24px Prompt`, 'ก ข 0123')))
}

export function drawIcon(sc: Scene, name: IconName, color: string, cx: number, cy: number, size: number) {
  const img = sc.icons.get(`${name}|${color}`)
  if (img) sc.ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
}

export function chip(sc: Scene, name: IconName, cx: number, cy: number, d: number, bg: string | CanvasGradient, fg: string) {
  const { ctx } = sc
  ctx.beginPath()
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)
  ctx.fillStyle = bg
  ctx.fill()
  drawIcon(sc, name, fg, cx, cy, d * 0.56)
}

export function setFont(ctx: CanvasRenderingContext2D, weight: number, size: number) {
  ctx.font = `${weight} ${size}px ${FONT}`
}

/** วาดข้อความ ถ้ากว้างเกิน maxWidth จะลดขนาดตัวอักษรลงจนพอดี (ไม่ให้ล้น/ทับกัน) */
export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, align: Align, color: string, weight: number, size: number, maxWidth?: number) {
  let px = size
  setFont(ctx, weight, px)
  while (maxWidth && ctx.measureText(s).width > maxWidth && px > 12) {
    px -= 1
    setFont(ctx, weight, px)
  }
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(s, x, y)
}

/** ตัดบรรทัดตามช่องว่างให้พอดีความกว้าง */
export function wrapLines(ctx: CanvasRenderingContext2D, s: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

export function wrappedText(ctx: CanvasRenderingContext2D, s: string, cx: number, cy: number, maxWidth: number, color: string, weight: number, size: number, lineHeight: number) {
  setFont(ctx, weight, size)
  const lines = wrapLines(ctx, s, maxWidth)
  const top = cy - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((l, i) => text(ctx, l, cx, top + i * lineHeight, 'center', color, weight, size))
}

export function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

export function vGradient(ctx: CanvasRenderingContext2D, y0: number, y1: number, pair: Pair) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, pair[0])
  g.addColorStop(1, pair[1])
  return g
}

export function hGradient(ctx: CanvasRenderingContext2D, x0: number, x1: number, pair: Pair) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0)
  g.addColorStop(0, pair[0])
  g.addColorStop(1, pair[1])
  return g
}

export const SOURCE_LABEL = {
  hosxp: 'จาก HOSxP',
  manual: 'กรอกเอง',
  mixed: 'HOSxP + กรอกเอง',
  none: 'ยังไม่มีข้อมูล',
} as const
