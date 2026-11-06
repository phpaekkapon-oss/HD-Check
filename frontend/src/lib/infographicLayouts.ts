import { THAI_MONTHS_SHORT, fmtNum } from '@/lib/format'
import {
  SOURCE_LABEL,
  WHITE,
  box,
  chip,
  drawIcon,
  groupIcon,
  money,
  pct,
  setFont,
  text,
  vGradient,
  wrapLines,
  wrappedText,
  type IconName,
  type Scene,
} from '@/lib/infographicKit'

type HeaderVariant = 'wide' | 'compact' | 'portrait'

function drawBackground(sc: Scene) {
  const { ctx, t } = sc
  ctx.fillStyle = vGradient(ctx, 0, t.h, t.bg)
  ctx.fillRect(0, 0, t.w, t.h)
}

/** ส่วนหัวภาพ: ชื่อโรงพยาบาล หัวเรื่อง กลุ่มงาน และกล่องวันที่ (+ช่วงเวลาให้บริการ) คืนค่า y ล่างสุดของส่วนหัว */
function drawHeader(sc: Scene, variant: HeaderVariant): number {
  const { ctx, t, period, hospital } = sc
  const banner = t.header === 'banner'
  const hh = variant === 'wide' ? 230 : variant === 'compact' ? 190 : 300
  const ink = banner ? t.headInk : t.ink
  const sub = banner ? t.headSub : t.inkSoft
  const accent = banner ? t.accent : t.chipInk

  if (banner) {
    ctx.fillStyle = vGradient(ctx, 0, hh, t.head)
    ctx.fillRect(0, 0, t.w, hh)
    ctx.globalAlpha = 0.08
    drawIcon(sc, t.mark[0], t.headInk, t.w * 0.53, hh / 2, hh * 0.95)
    drawIcon(sc, t.mark[1], t.headInk, t.w * 0.61, hh * 0.65, hh * 0.72)
    ctx.globalAlpha = 1
  }
  const logoBg = banner ? WHITE : vGradient(ctx, 0, 100, t.chipGrad)
  const logoFg = banner ? t.chipInk : WHITE

  if (variant === 'portrait') {
    chip(sc, 'hospital', 82, 62, 76, logoBg, logoFg)
    text(ctx, hospital, 134, 50, 'left', ink, 700, 38, 880)
    text(ctx, 'SMART-HOSCHECK · ระบบตรวจสอบข้อมูลการแพทย์แผนไทย', 134, 92, 'left', sub, 400, 20, 880)
    text(ctx, period.title, 48, 148, 'left', ink, 700, 54, 984)
    text(ctx, 'กลุ่มงานแพทย์แผนไทยและการแพทย์ทางเลือก', 48, 200, 'left', accent, 600, 30, 984)
    box(ctx, 48, 226, 984, 58, 29, t.surface, t.edge)
    chip(sc, 'calendar', 84, 255, 42, t.accent, t.onAccent)
    if (period.time) {
      text(ctx, `${period.lead} ${period.big}`, 390, 255, 'center', t.ink, 700, 30, 560)
      ctx.fillStyle = t.edge
      ctx.fillRect(704, 238, 2, 34)
      chip(sc, 'clock', 736, 255, 42, t.accent, t.onAccent)
      text(ctx, period.time, 902, 255, 'center', t.ink, 700, 26, 230)
    } else {
      text(ctx, `${period.lead} ${period.big}`, 566, 255, 'center', t.ink, 700, 30, 860)
    }
    return hh
  }

  const compact = variant === 'compact'
  chip(sc, 'hospital', compact ? 90 : 98, compact ? 52 : 66, compact ? 66 : 80, logoBg, logoFg)
  text(ctx, hospital, compact ? 140 : 156, compact ? 40 : 52, 'left', ink, 700, compact ? 36 : 44, 700)
  text(ctx, 'SMART-HOSCHECK · ระบบตรวจสอบข้อมูลการแพทย์แผนไทย', compact ? 140 : 156, compact ? 80 : 100, 'left', sub, 400, compact ? 20 : 24, 760)
  text(ctx, period.title, 60, compact ? 128 : 156, 'left', ink, 700, compact ? 50 : 58, 1060)
  text(ctx, 'กลุ่มงานแพทย์แผนไทยและการแพทย์ทางเลือก', 60, compact ? 168 : 208, 'left', accent, 600, compact ? 28 : 34, 1060)

  const bx = t.w - 630
  const by = compact ? 22 : 36
  const bh = compact ? 142 : 150
  box(ctx, bx, by, 590, bh, 28, t.surface, t.edge)
  if (period.time) {
    chip(sc, 'calendar', bx + 72, by + bh * 0.4, 84, t.accent, t.onAccent)
    text(ctx, period.lead, bx + 350, by + bh * 0.22, 'center', t.inkSoft, 500, 26, 440)
    text(ctx, period.big, bx + 350, by + bh * 0.52, 'center', t.ink, 700, compact ? 38 : 42, 440)
    const py = by + bh - 28
    box(ctx, bx + 130, py - 17, 440, 34, 17, t.accent)
    drawIcon(sc, 'clock', t.onAccent, bx + 160, py, 22)
    text(ctx, period.time, bx + 360, py, 'center', t.onAccent, 700, 21, 380)
  } else {
    chip(sc, 'calendar', bx + 72, by + bh / 2, 90, t.accent, t.onAccent)
    text(ctx, period.lead, bx + 340, by + bh * 0.33, 'center', t.inkSoft, 500, 28, 440)
    text(ctx, period.big, bx + 340, by + bh * 0.72, 'center', t.ink, 700, 44, 440)
  }
  return hh
}

const SERVICES: readonly { icon: IconName; lines: readonly [string, string]; short: string }[] = [
  { icon: 'leaf', lines: ['นวดไทย', 'ประคบสมุนไพร'], short: 'นวดไทย/ประคบ' },
  { icon: 'sprout', lines: ['อบสมุนไพร', 'พอกเข่า'], short: 'อบสมุนไพร/พอกเข่า' },
  { icon: 'baby', lines: ['ดูแลมารดา', 'หลังคลอด'], short: 'ดูแลหลังคลอด' },
  { icon: 'heart', lines: ['ส่งเสริมสุขภาพ', 'ภูมิปัญญาไทย'], short: 'ส่งเสริมสุขภาพ' },
  { icon: 'idea', lines: ['นวัตกรรม', '/ ชุมชน'], short: 'นวัตกรรม/ชุมชน' },
]

function drawFooter(sc: Scene, y: number) {
  const { ctx, t, hospital } = sc
  const bandH = t.h - y
  ctx.fillStyle = vGradient(ctx, y, t.h, t.foot)
  ctx.fillRect(0, y, t.w, bandH)
  if (t.w >= 1400) {
    text(ctx, 'กลุ่มงานแพทย์แผนไทยและการแพทย์ทางเลือก', 60, y + 30, 'left', t.footInk, 600, 28, 600)
    text(ctx, hospital, 60, y + 64, 'left', t.footSoft, 400, 22, 600)
    SERVICES.forEach((item, i) => {
      const cx = 700 + i * 236
      chip(sc, item.icon, cx, y + 45, 52, t.accent, t.onAccent)
      text(ctx, item.lines[0], cx + 38, y + 32, 'left', t.footInk, 600, 21, 172)
      text(ctx, item.lines[1], cx + 38, y + 60, 'left', t.footSoft, 400, 21, 172)
    })
    return
  }
  text(ctx, `กลุ่มงานแพทย์แผนไทยและการแพทย์ทางเลือก · ${hospital}`, t.w / 2, y + 32, 'center', t.footInk, 600, 24, t.w - 80)
  const cell = t.w / SERVICES.length
  SERVICES.forEach((item, i) => {
    const cx = cell * i + cell / 2
    chip(sc, item.icon, cx, y + 82, 44, t.accent, t.onAccent)
    text(ctx, item.short, cx, y + 120, 'center', t.footInk, 500, 17, cell - 12)
  })
}

/** วันที่แสดงในคอลัมน์ "วันที่": 6/11/69 · พ.ย. 69 · ช่วงวันที่ */
function dateLabelOf(sc: Scene): string {
  const { s } = sc
  const short = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return `${d}/${m}/${String((y ?? 0) + 543).slice(-2)}`
  }
  if (s.startDate === s.endDate) return short(s.startDate)
  const [y, m, d] = s.startDate.split('-').map(Number)
  const sameMonth = s.startDate.slice(0, 7) === s.endDate.slice(0, 7)
  if (sameMonth && d === 1 && new Date(y ?? 0, m ?? 1, 0).getDate() === Number(s.endDate.slice(8, 10))) {
    return `${THAI_MONTHS_SHORT[(m ?? 1) - 1] ?? ''} ${String((y ?? 0) + 543).slice(-2)}`
  }
  return `${short(s.startDate)} – ${short(s.endDate)}`
}

interface TableOpts {
  readonly x: number
  readonly y: number
  readonly cols: readonly { readonly w: number; readonly head: string }[]
  /** แสดงคอลัมน์ "วันที่" ชิดซ้าย (กว้างเท่านี้) */
  readonly dateW?: number
  readonly headH: number
  readonly maxRowH: number
  readonly opdH: number
  readonly totalH: number
  readonly bottomLimit: number
  readonly withTop: boolean
  readonly labelSize: number
  readonly valueSize: number
  /** ไอคอนเหนือหัวคอลัมน์ (ตามดัชนีคอลัมน์) */
  readonly headIcons?: readonly (IconName | null)[]
  /** ขนาดไอคอนหน้าชื่อสิทธิ (ค่าเริ่มต้น 46) */
  readonly chipSize?: number
  /** แสดงเงินที่เป็นจำนวนเต็มโดยไม่มีทศนิยม (เช่น 12,000) */
  readonly compactMoney?: boolean
}

/** ตารางสรุปตามสิทธิ + แถวผู้ป่วยใน + ค่าบริการผู้ป่วยนอก + แถวรวมทั้งสิ้น คืนค่า y ล่างสุดของแถวรวม */
function drawTable(sc: Scene, o: TableOpts): number {
  const { ctx, t, s } = sc
  const dateW = o.dateW ?? 0
  const fm = (n: number) => (o.compactMoney && Number.isInteger(n) ? fmtNum(n) : money(n))
  const bx = o.x + dateW
  const tw = o.cols.reduce((n, c) => n + c.w, 0)
  const fullW = tw + dateW
  const rows = s.groups.length + 1 + (o.withTop ? 2 : 0)
  const rowH = Math.min(o.maxRowH, Math.floor((o.bottomLimit - o.y - o.headH - o.opdH - o.totalH - 30) / rows))
  const lastIdx = o.cols.length - 1
  const lastW = o.cols[lastIdx]?.w ?? 0
  const cellX = (i: number) => bx + o.cols.slice(0, i).reduce((n, c) => n + c.w, 0)
  const colRight = (i: number) => cellX(i) + (o.cols[i]?.w ?? 0)
  const tableH = o.headH + rowH * rows + o.opdH
  const chipD = Math.min(o.chipSize ?? 46, rowH - 10)
  const labelX = cellX(0) + chipD + 28
  const labelW = (o.cols[0]?.w ?? 0) - chipD - 40

  box(ctx, o.x, o.y, fullW, tableH, 18, t.surface, t.edge)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(o.x, o.y, fullW, tableH, 18)
  ctx.clip()

  ctx.fillStyle = vGradient(ctx, o.y, o.y + o.headH, t.tableHead)
  ctx.fillRect(o.x, o.y, fullW, o.headH)
  if (dateW > 0) wrappedText(ctx, 'วันที่', o.x + dateW / 2, o.y + o.headH / 2, dateW - 16, t.tableHeadInk, 700, o.labelSize + 2, 30)
  o.cols.forEach((c, i) => {
    const icon = o.headIcons?.[i]
    if (icon) drawIcon(sc, icon, t.tableHeadInk, cellX(i) + c.w / 2, o.y + 26, 34)
    wrappedText(ctx, c.head, cellX(i) + c.w / 2, o.y + o.headH / 2 + (icon ? 22 : 0), c.w - 16, t.tableHeadInk, 700, i === 0 ? o.labelSize + 6 : o.valueSize - 6, i === 0 ? 30 : 24)
  })

  const row = (y: number, h: number, icon: IconName, label: string, sub: string | null, vals: readonly string[], opts: { fill: string; bold?: boolean; lastStrong?: boolean; dim?: boolean }) => {
    ctx.fillStyle = opts.fill
    ctx.fillRect(bx, y, tw, h)
    if (opts.lastStrong) {
      ctx.fillStyle = t.strong
      ctx.fillRect(cellX(lastIdx), y, lastW, h)
    }
    const ink = opts.dim ? t.inkSoft : t.ink
    const d = Math.min(chipD, h - 8)
    chip(sc, icon, cellX(0) + 12 + d / 2, y + h / 2, d, opts.fill === t.hilite ? t.surface : t.chipBg, t.chipInk)
    const weight = opts.bold ? 700 : 600
    setFont(ctx, weight, o.labelSize)
    const lines = !sub && ctx.measureText(label).width > labelW ? wrapLines(ctx, label, labelW) : [label]
    if (lines.length === 2) {
      text(ctx, lines[0] ?? '', labelX, y + h / 2 - 12, 'left', ink, weight, o.labelSize - 3, labelW)
      text(ctx, lines[1] ?? '', labelX, y + h / 2 + 12, 'left', ink, weight, o.labelSize - 3, labelW)
    } else {
      text(ctx, label, labelX, y + h / 2 - (sub ? 9 : 0), 'left', ink, weight, o.labelSize, labelW)
    }
    if (sub) text(ctx, sub, labelX, y + h / 2 + 17, 'left', t.inkSoft, 400, 18, labelW)
    vals.forEach((v, i) => {
      const last = i === vals.length - 1
      const onStrong = last && opts.lastStrong
      text(ctx, v, colRight(i + 1) - 22, y + h / 2, 'right', onStrong ? t.strongInk : ink, last || opts.bold ? 700 : 500, o.valueSize, (o.cols[i + 1]?.w ?? 100) - 26)
    })
    ctx.fillStyle = t.edge
    ctx.globalAlpha = 0.5
    ctx.fillRect(o.x, y + h - 1, fullW, 1)
    ctx.globalAlpha = 1
  }

  const bodyTop = o.y + o.headH
  let y = bodyTop
  if (o.withTop) {
    row(y, rowH, 'users', 'ผู้รับบริการทั้งหมด', null, [`${fmtNum(s.totals.visits)} ราย`, `${fmtNum(s.totals.servicePersons)} คน`, `${fmtNum(s.totals.drugPersons)} คน`, '–'], { fill: t.hilite, bold: true })
    y += rowH
    row(y, rowH, 'house', 'ออกชุมชน', null, [`${fmtNum(s.outreach.count)} ราย`, '–', '–', '–'], { fill: t.hilite, bold: true })
    y += rowH
  }
  s.groups.forEach((g, i) => {
    row(y, rowH, groupIcon(g.id), g.label, null, [fmtNum(g.visits), fm(g.serviceValue), fm(g.drugValue), fm(g.total)], {
      fill: i % 2 ? t.surfaceAlt : t.surface,
      lastStrong: true,
      dim: g.visits === 0,
    })
    y += rowH
  })
  row(y, rowH, 'baby', 'ผู้ป่วยใน (แม่หลังคลอด)', null, [fmtNum(s.ipd.visits), fm(s.ipd.serviceValue), fm(s.ipd.drugValue), fm(s.ipd.total)], {
    fill: s.groups.length % 2 ? t.surfaceAlt : t.surface,
    lastStrong: true,
    dim: s.ipd.visits === 0,
  })
  y += rowH
  row(
    y,
    o.opdH,
    'clinic',
    labelW < 200 ? 'ค่าบริการผู้ป่วยนอก' : 'ค่าบริการผู้ป่วยนอก 50 บาท',
    `ในเวลา ${fm(s.totals.opdFeeInHours)} · นอกเวลา ${fm(s.totals.opdFeeOutHours)}`,
    ['–', '–', '–', fm(s.totals.opdFee)],
    { fill: t.hilite, bold: true }
  )
  if (dateW > 0) {
    // ช่องวันที่ควบรวมทุกแถวข้อมูล
    ctx.fillStyle = t.surfaceAlt
    ctx.fillRect(o.x, bodyTop, dateW, tableH - o.headH)
    ctx.fillStyle = t.edge
    ctx.fillRect(o.x + dateW - 1, bodyTop, 1, tableH - o.headH)
    const dateText = dateLabelOf(sc)
    if (dateText.includes(' ')) wrappedText(ctx, dateText, o.x + dateW / 2, bodyTop + (tableH - o.headH) / 2, dateW - 12, t.ink, 700, o.labelSize, 30)
    else text(ctx, dateText, o.x + dateW / 2, bodyTop + (tableH - o.headH) / 2, 'center', t.ink, 700, o.labelSize, dateW - 8)
  }
  ctx.restore()

  const ty = o.y + tableH + 10
  box(ctx, o.x, ty, fullW, o.totalH, 18, vGradient(ctx, ty, ty + o.totalH, t.total))
  chip(sc, 'coins', o.x + 14 + (o.totalH - 22) / 2, ty + o.totalH / 2, o.totalH - 22, t.accent, t.onAccent)
  text(ctx, 'รวมทั้งสิ้น', o.x + o.totalH + 10 + (dateW > 0 ? 0 : 6), ty + o.totalH / 2, 'left', t.totalInk, 700, o.labelSize + 6, (o.cols[0]?.w ?? 200) + dateW - o.totalH - 20)
  ;[fmtNum(s.totals.visits), fm(s.totals.serviceValue), fm(s.totals.drugValue)].forEach((v, i) =>
    text(ctx, v, colRight(i + 1) - 22, ty + o.totalH / 2, 'right', t.totalInk, 700, o.valueSize, (o.cols[i + 1]?.w ?? 100) - 34)
  )
  box(ctx, cellX(lastIdx) + 8, ty + 8, lastW - 16, o.totalH - 16, 12, t.accent)
  text(ctx, fm(s.totals.grandTotal), colRight(lastIdx) - 26, ty + o.totalH / 2, 'right', t.onAccent, 800, o.valueSize + 6, lastW - 44)
  text(ctx, 'ยอดเงินเป็นประมาณการจากข้อมูล HOSxP · จำนวนคนนับไม่ซ้ำ', o.x + 6, ty + o.totalH + 16, 'left', t.inkSoft, 400, 16)
  return ty + o.totalH
}

/* ───────────── แบบที่ 1: ตาราง + การ์ดสรุปด้านขวา ───────────── */
export function layoutTable(sc: Scene) {
  const { ctx, t, s } = sc
  drawBackground(sc)
  drawHeader(sc, 'wide')
  const ty = 262
  const bottom = drawTable(sc, {
    x: 40,
    y: ty,
    dateW: 110,
    cols: [
      { w: 380, head: 'สิทธิการรักษา' },
      { w: 150, head: 'จำนวนคน (ราย)' },
      { w: 250, head: 'ค่านวด ประคบ อบ พอกเข่า หัตถการอื่นๆ (บาท)' },
      { w: 210, head: 'ค่ายาสมุนไพร (บาท)' },
      { w: 230, head: 'รวมค่าบริการทั้งหมด (บาท)' },
    ],
    headH: 104,
    maxRowH: 60,
    opdH: 62,
    totalH: 72,
    bottomLimit: 975,
    withTop: true,
    labelSize: 26,
    valueSize: 28,
  })

  const px = 1400
  const pw = 480
  box(ctx, px, ty, pw, 76, 38, vGradient(ctx, ty, ty + 76, t.head))
  text(ctx, sc.period.panel, px + pw / 2, ty + 38, 'center', t.headInk, 700, 30, pw - 40)

  const cards: readonly { icon: IconName; label: string; value: string; unit: string; gold?: boolean }[] = [
    { icon: 'users', label: 'ผู้รับบริการทั้งหมด (รวมผู้ป่วยใน)', value: fmtNum(s.totals.visits), unit: 'ราย' },
    { icon: 'house', label: 'ออกชุมชน', value: fmtNum(s.outreach.count), unit: 'ราย' },
    { icon: 'massage', label: 'ค่านวด ประคบ อบ พอกเข่า หัตถการอื่นๆ', value: money(s.totals.serviceValue), unit: 'บาท' },
    { icon: 'herb', label: 'ค่ายาสมุนไพร', value: money(s.totals.drugValue), unit: 'บาท' },
    { icon: 'clinic', label: 'ค่าบริการผู้ป่วยนอก (50 บาท)', value: money(s.totals.opdFee), unit: 'บาท' },
    { icon: 'coins', label: 'รวมค่าบริการทั้งหมด', value: money(s.totals.grandTotal), unit: 'บาท', gold: true },
  ]
  const top = ty + 90
  const gap = 10
  const cardH = Math.floor((bottom - top - gap * (cards.length - 1)) / cards.length)
  cards.forEach((c, i) => {
    const cy = top + i * (cardH + gap)
    box(ctx, px, cy, pw, cardH, 22, c.gold ? t.accent : t.surface, c.gold ? t.accent : t.edge)
    const d = Math.min(64, cardH - 20)
    chip(sc, c.icon, px + 20 + d / 2, cy + cardH / 2, d, c.gold ? t.onAccent : vGradient(ctx, cy, cy + cardH, t.chipGrad), c.gold ? t.accent : WHITE)
    const lx = px + 20 + d + 16
    const mw = pw - (lx - px) - 18
    text(ctx, c.label, lx, cy + cardH * 0.3, 'left', c.gold ? t.onAccent : t.ink, 600, 22, mw)
    text(ctx, `${c.value} ${c.unit}`, lx, cy + cardH * 0.7, 'left', c.gold ? t.onAccent : t.value, 800, 40, mw)
  })
  drawFooter(sc, 990)
}

/* ───────────── แบบที่ 2: แดชบอร์ด การ์ดตัวชี้วัด + ตาราง + กราฟสัดส่วน ───────────── */
export function layoutDashboard(sc: Scene) {
  const { ctx, t, s } = sc
  drawBackground(sc)
  const hh = drawHeader(sc, 'compact')

  const kpiY = hh + 20
  const kpiH = 130
  const kpiW = (t.w - 80 - 60) / 4
  const kpis: readonly { icon: IconName; label: string; value: string; sub: string; hot?: boolean }[] = [
    { icon: 'users', label: 'ผู้รับบริการทั้งหมด', value: `${fmtNum(s.totals.visits)} ราย`, sub: `${fmtNum(s.totals.persons)} คน (ไม่ซ้ำ) · นวด/หัตถการ ${fmtNum(s.totals.servicePersons)} คน · รับยา ${fmtNum(s.totals.drugPersons)} คน` },
    { icon: 'house', label: 'ออกชุมชน', value: `${fmtNum(s.outreach.count)} ราย`, sub: SOURCE_LABEL[s.outreach.source] },
    { icon: 'coins', label: 'รวมค่าบริการทั้งหมด', value: `${money(s.totals.grandTotal)} บาท`, sub: `รวมค่าบริการผู้ป่วยนอก ${money(s.totals.opdFee)}`, hot: true },
    { icon: 'clinic', label: 'เฉลี่ยต่อผู้รับบริการ', value: `${money(s.totals.visits > 0 ? s.totals.grandTotal / s.totals.visits : 0)} บาท`, sub: 'ค่าบริการรวม ÷ ผู้รับบริการ' },
  ]
  kpis.forEach((k, i) => {
    const x = 40 + i * (kpiW + 20)
    box(ctx, x, kpiY, kpiW, kpiH, 22, k.hot ? t.accent : t.surface, k.hot ? t.accent : t.edge)
    chip(sc, k.icon, x + 24 + 36, kpiY + kpiH / 2, 72, k.hot ? t.onAccent : vGradient(ctx, kpiY, kpiY + kpiH, t.chipGrad), k.hot ? t.accent : WHITE)
    const lx = x + 120
    const mw = kpiW - 138
    text(ctx, k.label, lx, kpiY + 30, 'left', k.hot ? t.onAccent : t.inkSoft, 600, 22, mw)
    text(ctx, k.value, lx, kpiY + 72, 'left', k.hot ? t.onAccent : t.ink, 800, 44, mw)
    text(ctx, k.sub, lx, kpiY + 108, 'left', k.hot ? t.onAccent : t.inkSoft, 400, 18, mw)
  })

  const ty = kpiY + kpiH + 20
  const bottom = drawTable(sc, {
    x: 40,
    y: ty,
    cols: [
      { w: 380, head: 'สิทธิการรักษา' },
      { w: 140, head: 'จำนวนคน (ราย)' },
      { w: 220, head: 'ค่านวด ประคบ อบ พอกเข่า หัตถการอื่นๆ (บาท)' },
      { w: 220, head: 'ค่ายาสมุนไพร (บาท)' },
      { w: 220, head: 'รวมค่าบริการ (บาท)' },
    ],
    headH: 100,
    maxRowH: 62,
    opdH: 58,
    totalH: 64,
    bottomLimit: 962,
    withTop: false,
    labelSize: 24,
    valueSize: 25,
  })

  // กราฟสัดส่วนรายได้ตามสิทธิ (รวมผู้ป่วยใน)
  const px = 1260
  const pw = t.w - 40 - px
  const ph = bottom - ty
  box(ctx, px, ty, pw, ph, 18, t.surface, t.edge)
  text(ctx, 'สัดส่วนรายได้ตามสิทธิ', px + 24, ty + 34, 'left', t.ink, 700, 28, pw - 48)
  box(ctx, px + 24, ty + 66, 18, 18, 4, t.bar[0])
  text(ctx, 'ค่านวด/หัตถการ', px + 50, ty + 75, 'left', t.inkSoft, 500, 20)
  box(ctx, px + 250, ty + 66, 18, 18, 4, t.bar[1])
  text(ctx, 'ค่ายาสมุนไพร', px + 276, ty + 75, 'left', t.inkSoft, 500, 20)

  const bars = [...s.groups, { id: 'ipd', label: 'ผู้ป่วยใน (แม่หลังคลอด)', visits: s.ipd.visits, persons: s.ipd.persons, serviceValue: s.ipd.serviceValue, drugValue: s.ipd.drugValue, total: s.ipd.total }].filter((g) => g.total > 0)
  const maxTotal = Math.max(0, ...bars.map((g) => g.total))
  if (maxTotal === 0) {
    text(ctx, 'ไม่มีรายการค่าบริการ', px + pw / 2, ty + ph / 2, 'center', t.inkSoft, 500, 26)
  } else {
    const barArea = ph - 120 - 130
    const step = Math.min(78, barArea / bars.length)
    bars.forEach((g, i) => {
      const by = ty + 112 + i * step
      text(ctx, g.label, px + 24, by, 'left', t.ink, 600, 22, pw * 0.5)
      text(ctx, `${money(g.total)} บาท`, px + pw - 24, by, 'right', t.inkSoft, 500, 21, pw * 0.42)
      const bw = pw - 48
      box(ctx, px + 24, by + 18, bw, 20, 10, t.surfaceAlt)
      const filled = (bw * g.total) / maxTotal
      const sv = pct(g.serviceValue, g.total) / 100
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(px + 24, by + 18, filled, 20, 10)
      ctx.clip()
      ctx.fillStyle = t.bar[0]
      ctx.fillRect(px + 24, by + 18, filled * sv, 20)
      ctx.fillStyle = t.bar[1]
      ctx.fillRect(px + 24 + filled * sv, by + 18, filled * (1 - sv), 20)
      ctx.restore()
    })
    const sy = ty + ph - 100
    const sum = s.totals.serviceValue + s.totals.drugValue
    text(ctx, 'สัดส่วนค่านวด/หัตถการ : ค่ายา', px + 24, sy, 'left', t.ink, 600, 22, pw - 48)
    const bw = pw - 48
    box(ctx, px + 24, sy + 20, bw, 24, 12, t.surfaceAlt)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(px + 24, sy + 20, bw, 24, 12)
    ctx.clip()
    ctx.fillStyle = t.bar[0]
    ctx.fillRect(px + 24, sy + 20, (bw * pct(s.totals.serviceValue, sum)) / 100, 24)
    ctx.fillStyle = t.bar[1]
    ctx.fillRect(px + 24 + (bw * pct(s.totals.serviceValue, sum)) / 100, sy + 20, (bw * pct(s.totals.drugValue, sum)) / 100, 24)
    ctx.restore()
    text(ctx, `${pct(s.totals.serviceValue, sum).toFixed(1)}% · ${money(s.totals.serviceValue)}`, px + 24, sy + 66, 'left', t.inkSoft, 500, 19, bw / 2)
    text(ctx, `${pct(s.totals.drugValue, sum).toFixed(1)}% · ${money(s.totals.drugValue)}`, px + pw - 24, sy + 66, 'right', t.inkSoft, 500, 19, bw / 2)
  }
  drawFooter(sc, 990)
}

/* ───────────── แบบที่ 3: การ์ดแยกตามสิทธิ (แนวนอน / แนวตั้งสำหรับส่งไลน์) ───────────── */
interface CardItem {
  readonly icon: IconName
  readonly label: string
  readonly persons: number
  /** ไม่มี = การ์ดแสดงจำนวนคนอย่างเดียว (เช่น ออกชุมชน) */
  readonly amounts?: { readonly service: number; readonly drug: number; readonly total: number }
  readonly note?: string
}

function drawCard(sc: Scene, c: CardItem, x: number, y: number, w: number, h: number, tall: boolean) {
  const { ctx, t } = sc
  box(ctx, x, y, w, h, 24, t.surface, t.edge)
  ctx.globalAlpha = c.persons === 0 && (c.amounts?.total ?? 0) === 0 ? 0.55 : 1
  const barX = x + 20
  const barW = w - 40
  const drawBar = (by: number, bh: number) => {
    if (!c.amounts) return
    box(ctx, barX, by, barW, bh, bh / 2, t.surfaceAlt)
    const sv = pct(c.amounts.service, c.amounts.total) / 100
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(barX, by, barW, bh, bh / 2)
    ctx.clip()
    ctx.fillStyle = t.bar[0]
    ctx.fillRect(barX, by, c.amounts.total > 0 ? barW * sv : 0, bh)
    ctx.fillStyle = t.bar[1]
    ctx.fillRect(barX + barW * sv, by, c.amounts.total > 0 ? barW * (1 - sv) : 0, bh)
    ctx.restore()
  }
  if (tall) {
    chip(sc, c.icon, x + 20 + 29, y + 20 + 29, 58, vGradient(ctx, y, y + 80, t.chipGrad), WHITE)
    text(ctx, c.label, x + 94, y + 49, 'left', t.ink, 700, 24, w - 112)
    text(ctx, 'ผู้รับบริการ', x + 22, y + 108, 'left', t.inkSoft, 500, 18)
    text(ctx, `${fmtNum(c.persons)} ราย`, x + 22, y + 148, 'left', t.value, 800, 52, w - 44)
    if (c.amounts) {
      text(ctx, 'ค่านวด/หัตถการ', x + 22, y + 204, 'left', t.inkSoft, 500, 20, w * 0.5)
      text(ctx, money(c.amounts.service), x + w - 22, y + 204, 'right', t.ink, 600, 24, w * 0.45)
      text(ctx, 'ค่ายาสมุนไพร', x + 22, y + 238, 'left', t.inkSoft, 500, 20, w * 0.5)
      text(ctx, money(c.amounts.drug), x + w - 22, y + 238, 'right', t.ink, 600, 24, w * 0.45)
      ctx.fillStyle = t.edge
      ctx.fillRect(x + 20, y + 258, w - 40, 1)
      text(ctx, 'รวม', x + 22, y + 292, 'left', t.inkSoft, 600, 22)
      text(ctx, `${money(c.amounts.total)} บาท`, x + w - 22, y + 292, 'right', t.ink, 800, 32, w - 110)
      drawBar(y + h - 26, 12)
    } else if (c.note) {
      text(ctx, c.note, x + 22, y + 204, 'left', t.inkSoft, 500, 20, w - 44)
    }
  } else {
    chip(sc, c.icon, x + 16 + 26, y + h / 2 - 6, 52, vGradient(ctx, y, y + h, t.chipGrad), WHITE)
    text(ctx, c.label, x + 82, y + 30, 'left', t.ink, 700, 22, w * 0.5 - 62)
    text(ctx, `${fmtNum(c.persons)} ราย`, x + 82, y + 64, 'left', t.value, 800, 28, w * 0.5 - 62)
    if (c.amounts) {
      text(ctx, money(c.amounts.total), x + w - 20, y + 38, 'right', t.ink, 800, 34, w * 0.46)
      text(ctx, `นวด ${money(c.amounts.service)} · ยา ${money(c.amounts.drug)}`, x + w - 20, y + 74, 'right', t.inkSoft, 400, 17, w * 0.5)
      drawBar(y + h - 24, 10)
    } else if (c.note) {
      text(ctx, c.note, x + w - 20, y + 50, 'right', t.inkSoft, 500, 18, w * 0.5)
    }
  }
  ctx.globalAlpha = 1
}

export function layoutCards(sc: Scene) {
  const { ctx, t, s } = sc
  const portrait = t.w < t.h
  drawBackground(sc)
  const hh = drawHeader(sc, portrait ? 'portrait' : 'wide')
  const footY = portrait ? t.h - 150 : 990
  const stats: readonly { icon: IconName; label: string; value: string }[] = [
    { icon: 'users', label: 'ผู้รับบริการทั้งหมด', value: `${fmtNum(s.totals.visits)} ราย` },
    { icon: 'house', label: 'ออกชุมชน', value: `${fmtNum(s.outreach.count)} ราย` },
    { icon: 'massage', label: 'ค่านวด/หัตถการ', value: `${money(s.totals.serviceValue)} บาท` },
    { icon: 'herb', label: 'ค่ายาสมุนไพร', value: `${money(s.totals.drugValue)} บาท` },
    { icon: 'clinic', label: 'ค่าบริการผู้ป่วยนอก 50 บาท', value: `${money(s.totals.opdFee)} บาท` },
  ]
  const items: readonly CardItem[] = [
    ...s.groups.map((g): CardItem => ({ icon: groupIcon(g.id), label: g.label, persons: g.visits, amounts: { service: g.serviceValue, drug: g.drugValue, total: g.total } })),
    { icon: 'baby', label: 'ผู้ป่วยใน (แม่หลังคลอด)', persons: s.ipd.visits, amounts: { service: s.ipd.serviceValue, drug: s.ipd.drugValue, total: s.ipd.total } },
    { icon: 'house', label: 'ออกชุมชน', persons: s.outreach.count, note: SOURCE_LABEL[s.outreach.source] },
  ]

  if (!portrait) {
    const hx = 40
    const hy = hh + 20
    const hw = 520
    const hHeight = footY - 20 - hy
    box(ctx, hx, hy, hw, hHeight, 28, vGradient(ctx, hy, hy + hHeight, t.total))
    chip(sc, 'coins', hx + 56, hy + 58, 72, t.accent, t.onAccent)
    text(ctx, 'รวมค่าบริการทั้งหมด', hx + 110, hy + 58, 'left', t.totalInk, 700, 30, hw - 130)
    text(ctx, money(s.totals.grandTotal), hx + hw / 2, hy + 158, 'center', t.accent, 800, 72, hw - 50)
    text(ctx, 'บาท', hx + hw / 2, hy + 214, 'center', t.totalInk, 600, 30)
    ctx.fillStyle = t.totalInk
    ctx.globalAlpha = 0.25
    ctx.fillRect(hx + 30, hy + 248, hw - 60, 2)
    ctx.globalAlpha = 1
    const step = Math.floor((hHeight - 270) / stats.length)
    stats.forEach((st, i) => {
      const cy = hy + 270 + i * step + step / 2
      chip(sc, st.icon, hx + 48, cy, 52, t.accent, t.onAccent)
      text(ctx, st.label, hx + 90, cy, 'left', t.totalInk, 500, 22, 220)
      text(ctx, st.value, hx + hw - 26, cy, 'right', t.totalInk, 800, 27, 180)
    })

    const gx = hx + hw + 20
    const gw = t.w - 40 - gx
    const cols = items.length > 8 ? 5 : 4
    const rows = Math.ceil(items.length / cols)
    const gap = 20
    const cw = (gw - gap * (cols - 1)) / cols
    const ch = (hHeight - gap * (rows - 1)) / rows
    items.forEach((it, i) => drawCard(sc, it, gx + (i % cols) * (cw + gap), hy + Math.floor(i / cols) * (ch + gap), cw, ch, ch >= 300))
    drawFooter(sc, footY)
    return
  }

  // แนวตั้ง 1080×1350: การ์ดรวมด้านบน + การ์ดสิทธิ 2 คอลัมน์
  const hx = 40
  const hy = hh + 20
  const hw = t.w - 80
  const hHeight = 360
  box(ctx, hx, hy, hw, hHeight, 28, vGradient(ctx, hy, hy + hHeight, t.total))
  chip(sc, 'coins', hx + 50, hy + 50, 60, t.accent, t.onAccent)
  text(ctx, 'รวมค่าบริการทั้งหมด', hx + 94, hy + 50, 'left', t.totalInk, 700, 28, hw - 130)
  text(ctx, `${money(s.totals.grandTotal)} บาท`, hx + hw / 2, hy + 122, 'center', t.accent, 800, 76, hw - 60)
  const cellW = (hw - 40 - 16 * 2) / 3
  stats.forEach((st, i) => {
    const col = i < 3 ? i : i - 3
    const row = i < 3 ? 0 : 1
    const bx = hx + 20 + col * (cellW + 16) + (row === 1 ? (cellW + 16) / 2 : 0)
    const by = hy + 178 + row * 90
    ctx.fillStyle = t.totalInk
    ctx.globalAlpha = 0.12
    ctx.beginPath()
    ctx.roundRect(bx, by, cellW, 78, 16)
    ctx.fill()
    ctx.globalAlpha = 1
    chip(sc, st.icon, bx + 34, by + 39, 46, t.accent, t.onAccent)
    text(ctx, st.label, bx + 66, by + 24, 'left', t.totalInk, 500, 17, cellW - 74)
    text(ctx, st.value, bx + 66, by + 55, 'left', t.totalInk, 800, 24, cellW - 74)
  })

  const gy = hy + hHeight + 16
  const gap = 12
  const cols = 2
  const rows = Math.ceil(items.length / cols)
  const cw = (hw - gap) / cols
  const ch = (footY - 14 - gy - gap * (rows - 1)) / rows
  items.forEach((it, i) => drawCard(sc, it, hx + (i % cols) * (cw + gap), gy + Math.floor(i / cols) * (ch + gap), cw, ch, false))
  drawFooter(sc, footY)
}

/* ───────────── แบบที่ 4: โปสเตอร์แนวตั้ง ตารางมีคอลัมน์วันที่ + การ์ดสรุปด้านขวา (ตามแบบเอกสารที่ใช้โพสต์) ───────────── */
export function layoutPoster(sc: Scene) {
  const { ctx, t, s } = sc
  drawBackground(sc)
  const hh = drawHeader(sc, 'portrait')
  const ty = hh + 28
  const bottom = drawTable(sc, {
    x: 30,
    y: ty,
    dateW: 74,
    cols: [
      { w: 220, head: 'สิทธิการรักษา' },
      { w: 84, head: 'จำนวนคน (ราย)' },
      { w: 128, head: 'ค่านวด/ประคบ อบ พอกเข่า หัตถการอื่นๆ (บาท)' },
      { w: 126, head: 'ค่ายาสมุนไพร (บาท)' },
      { w: 132, head: 'รวมค่าบริการ (บาท)' },
    ],
    headIcons: [null, 'users', 'massage', 'herb', 'coins'],
    headH: 146,
    maxRowH: 64,
    opdH: 66,
    totalH: 70,
    bottomLimit: 1186,
    withTop: true,
    labelSize: 22,
    valueSize: 24,
    chipSize: 34,
    compactMoney: true,
  })

  // การ์ดสรุปด้านขวา
  const px = 812
  const pw = 238
  box(ctx, px, ty, pw, 72, 18, t.accent)
  wrappedText(ctx, sc.period.panel.replace('ภาพรวม', 'ภาพรวม '), px + pw / 2, ty + 36, pw - 24, t.onAccent, 700, 20, 26)
  const cards: readonly { icon: IconName; label: string; value: string; gold?: boolean }[] = [
    { icon: 'users', label: 'ผู้รับบริการทั้งหมด', value: `${fmtNum(s.totals.visits)} ราย` },
    { icon: 'house', label: 'ออกชุมชน', value: `${fmtNum(s.outreach.count)} ราย` },
    { icon: 'massage', label: 'ค่านวดและหัตถการอื่นๆ', value: `${money(s.totals.serviceValue)} บาท` },
    { icon: 'herb', label: 'ค่ายาสมุนไพร', value: `${money(s.totals.drugValue)} บาท` },
    { icon: 'clinic', label: 'ค่าบริการผู้ป่วยนอก', value: `${money(s.totals.opdFee)} บาท` },
    { icon: 'coins', label: 'รวมค่าบริการทั้งหมด', value: `${money(s.totals.grandTotal)} บาท`, gold: true },
  ]
  const top = ty + 84
  const gap = 10
  const cardH = Math.floor((bottom - top - gap * (cards.length - 1)) / cards.length)
  cards.forEach((c, i) => {
    const cy = top + i * (cardH + gap)
    box(ctx, px, cy, pw, cardH, 20, c.gold ? t.accent : t.surface, c.gold ? t.accent : t.edge)
    chip(sc, c.icon, px + 14 + 22, cy + 14 + 22, 44, c.gold ? t.onAccent : vGradient(ctx, cy, cy + 60, t.chipGrad), c.gold ? t.accent : WHITE)
    wrappedText(ctx, c.label, px + 72 + (pw - 86) / 2, cy + 36, pw - 90, c.gold ? t.onAccent : t.ink, 600, 17, 22)
    text(ctx, c.value, px + pw / 2, cy + cardH - 28, 'center', c.gold ? t.onAccent : t.value, 800, 26, pw - 24)
  })

  // แผงท้ายภาพ: ชื่อกลุ่มงาน + 5 งานบริการ
  const fy = 1214
  const fh = 94
  box(ctx, 30, fy, t.w - 60, fh, 22, vGradient(ctx, fy, fy + fh, t.foot))
  text(ctx, `กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก - ${sc.hospital}`, t.w / 2, fy + 26, 'center', t.footInk, 700, 21, t.w - 100)
  const cell = (t.w - 60) / SERVICES.length
  SERVICES.forEach((item, i) => {
    const x = 30 + cell * i
    chip(sc, item.icon, x + 30, fy + 64, 38, t.accent, t.onAccent)
    text(ctx, item.lines[0], x + 56, fy + 55, 'left', t.footInk, 600, 16, cell - 62)
    text(ctx, item.lines[1], x + 56, fy + 75, 'left', t.footSoft, 400, 16, cell - 62)
  })

  // แถบล่างสุด
  const by = 1320
  ctx.fillStyle = vGradient(ctx, by, t.h, [t.foot[0], t.foot[1]])
  ctx.fillRect(0, by, t.w, t.h - by)
  text(ctx, 'SMART-HOSCHECK', t.w / 2, by + 15, 'center', t.footInk, 600, 16)
  chip(sc, 'hospital', 900, by + 15, 24, WHITE, t.chipInk)
  text(ctx, sc.hospital, 920, by + 15, 'left', t.footSoft, 500, 14, 120)
}
