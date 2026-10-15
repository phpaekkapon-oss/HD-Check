import type { AuditResult, DateRange } from '@/types/herbdx.types'
import type { CellRichTextValue, Fill, Font, RichText } from 'exceljs'

const pad = (n: number): string => String(n).padStart(2, '0')

export function currentMonthRange(now: Date = new Date()): DateRange {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const last = new Date(y, m, 0).getDate()
  return { startDate: `${y}-${pad(m)}-01`, endDate: `${y}-${pad(m)}-${pad(last)}` }
}

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
] as const

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
] as const

/** '2026-10-01' → '01/10/2569' (Buddhist Era, like HOSxP) */
export function toThaiDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${Number(y) + 543}`
}

/** '2026-10-01' → '1 ต.ค. 2569' */
export function toThaiDateShort(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  const mIdx = Number(m) - 1
  return `${Number(d)} ${THAI_MONTHS_SHORT[mIdx] ?? m} ${Number(y) + 543}`
}

/** '2026-10-01' → '1 ตุลาคม พ.ศ. 2569' */
export function toThaiDateLong(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  const mIdx = Number(m) - 1
  return `${Number(d)} ${THAI_MONTHS_FULL[mIdx] ?? m} พ.ศ. ${Number(y) + 543}`
}

export function toThaiDateTime(iso: string): string {
  const [date, time = ''] = iso.split('T')
  const timeFormatted = time ? `${time.slice(0, 5)} น.` : ''
  return `${toThaiDate(date ?? '')} ${timeFormatted}`.trim()
}

/** '15:30:53' → '15:30:53 น.' */
export function toThaiTime(timeStr: string): string {
  if (!timeStr) return '-'
  return `${timeStr} น.`
}

export const fmtNum = (n: number, digits = 0): string =>
  n.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const AUDIT_RESULT_META: Record<AuditResult, { label: string; short: string; badge: string; row: string }> = {
  PASS: {
    label: 'ผ่าน — DX ตรงข้อบ่งใช้',
    short: 'ผ่าน',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    row: '',
  },
  FAIL: {
    label: 'ไม่ผ่าน — DX ไม่ตรงข้อบ่งใช้ยา',
    short: 'DX ไม่ตรง',
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    row: 'bg-rose-50/80 hover:bg-rose-100/70 shadow-[inset_3px_0_0_0_var(--color-rose-500)]',
  },
  NO_DX: {
    label: 'ไม่ผ่าน — ไม่มีรหัสวินิจฉัย',
    short: 'ไม่มี DX',
    badge: 'bg-rose-100 text-rose-800 ring-rose-600/30',
    row: 'bg-rose-100/80 hover:bg-rose-100 shadow-[inset_3px_0_0_0_var(--color-rose-600)]',
  },
  NO_MAP: {
    label: 'รอตั้งค่า — ยังไม่กำหนด ICD ของยานี้',
    short: 'รอตั้งค่า',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    row: 'bg-amber-50/70 hover:bg-amber-50 shadow-[inset_3px_0_0_0_var(--color-amber-400)]',
  },
}

/* ---------------- Excel report export ---------------- */

export type ExcelCellValue = string | number | null | undefined
/** text: left · center: short codes (HN, ICD) · int/decimal/money: right-aligned numbers */
export type ExcelColumnType = 'text' | 'center' | 'int' | 'decimal' | 'money'
export type ExcelTone = 'good' | 'bad' | 'warn'

export interface ExcelColumn {
  readonly header: string
  readonly type?: ExcelColumnType
  /** Fixed width in characters; omitted = fit to content */
  readonly width?: number
  /** Add a SUM in the totals row */
  readonly total?: boolean
}

export interface ExcelSummaryItem {
  readonly label: string
  readonly value: string | number
  readonly tone?: ExcelTone
}

export interface ExcelReporter {
  readonly name: string
  readonly position: string
  readonly loginname: string
}

/** Map the signed-in user to the report's "ผู้รายงาน" (position falls back to the HOSxP group) */
export const toReporter = (
  user: { name: string; position?: string; groupname?: string; loginname: string } | null | undefined
): ExcelReporter | undefined =>
  user ? { name: user.name, position: user.position || user.groupname || '-', loginname: user.loginname } : undefined

export interface ExcelReport {
  readonly filename: string
  readonly sheetName: string
  readonly title: string
  readonly range?: DateRange
  /** Signed-in user who exports the report (shown at the top and in the signature block) */
  readonly reporter?: ExcelReporter
  readonly columns: readonly ExcelColumn[]
  readonly rows: readonly (readonly ExcelCellValue[])[]
  /** KPI line printed above the table */
  readonly summary?: readonly ExcelSummaryItem[]
  /** Column whose cell is coloured by rowTones (e.g. audit result) */
  readonly statusColumn?: number
  readonly rowTones?: readonly (ExcelTone | undefined)[]
}

const HOSPITAL_LINE = 'โรงพยาบาลพังโคน จ.สกลนคร • กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก'
// Windows' Thai UI font (Vista+); Excel substitutes gracefully where it is missing
const XL_FONT = 'Leelawadee UI'
const XL = {
  brand: 'FF0F766E',
  brandDark: 'FF134E4A',
  brandSoft: 'FFF0FDFA',
  ink: 'FF1E293B',
  muted: 'FF64748B',
  border: 'FFCBD5E1',
  zebra: 'FFF8FAFC',
  white: 'FFFFFFFF',
} as const
const TONE: Record<ExcelTone, { fill: string; font: string }> = {
  good: { fill: 'FFD1FAE5', font: 'FF065F46' },
  bad: { fill: 'FFFFE4E6', font: 'FF9F1239' },
  warn: { fill: 'FFFEF3C7', font: 'FF92400E' },
}
const NUM_FMT: Partial<Record<ExcelColumnType, string>> = {
  int: '#,##0',
  decimal: '#,##0.##',
  money: '#,##0.00',
}

/** Visible width of Thai text: vowels/tone marks above or below a consonant take no column */
const displayLength = (s: string): number => s.replace(/[ัิ-ฺ็-๎]/g, '').length

const nowThai = (): string => {
  const d = new Date()
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `${toThaiDateShort(iso)} เวลา ${pad(d.getHours())}:${pad(d.getMinutes())} น.`
}

/**
 * Build a styled .xlsx report (title band, KPI line, coloured header, zebra rows, status colours,
 * totals, frozen header, filters, A4 landscape print setup) and download it.
 * exceljs is loaded on demand so it stays out of the main bundle.
 */
export async function downloadExcel(report: ExcelReport): Promise<void> {
  try {
    const { default: ExcelJS } = await import('exceljs')
    const { columns, rows } = report
    const colCount = columns.length

    const wb = new ExcelJS.Workbook()
    wb.creator = 'SMART-HOSCHECK'
    wb.created = new Date()
    const ws = wb.addWorksheet(report.sheetName.replace(/[\\/?*[\]:]/g, ' ').substring(0, 31), {
      views: [{ showGridLines: false }],
      properties: { defaultRowHeight: 20 },
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 },
      },
      headerFooter: {
        oddFooter: `&L&8SMART-HOSCHECK • ${report.title}&C&8หน้า &P / &N&R&8พิมพ์เมื่อ &D &T`,
      },
    })

    const font = (extra: Partial<Font> = {}): Partial<Font> => ({
      name: XL_FONT,
      size: 10,
      color: { argb: XL.ink },
      ...extra,
    })
    const fill = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
    const thin = { style: 'thin' as const, color: { argb: XL.border } }
    const box = { top: thin, left: thin, bottom: thin, right: thin }

    // A full-width band row (title / sub-titles)
    const band = (value: string | CellRichTextValue, height: number, style: {
      font: Partial<Font>
      fill?: string
    }) => {
      const row = ws.addRow([])
      row.height = height
      ws.mergeCells(row.number, 1, row.number, colCount)
      const cell = row.getCell(1)
      cell.value = value
      cell.font = style.font
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      if (style.fill) for (let c = 1; c <= colCount; c++) row.getCell(c).fill = fill(style.fill)
      return row
    }

    band(report.title, 34, { font: font({ size: 16, bold: true, color: { argb: XL.white } }), fill: XL.brand })
    band(HOSPITAL_LINE, 22, { font: font({ size: 10.5, bold: true, color: { argb: XL.brandDark } }), fill: XL.brandSoft })
    // Label/value line: muted label, bold value, separated by a light divider
    const infoLine = (pairs: readonly (readonly [string, string])[]) => {
      const rt: RichText[] = []
      pairs.forEach(([label, value], i) => {
        if (i > 0) rt.push({ text: '      |      ', font: font({ color: { argb: XL.border } }) })
        rt.push({ text: `${label}  `, font: font({ size: 10, color: { argb: XL.muted } }) })
        rt.push({ text: value, font: font({ size: 10.5, bold: true, color: { argb: XL.ink } }) })
      })
      return band({ richText: rt }, 22, { font: font(), fill: XL.brandSoft })
    }
    if (report.reporter) {
      infoLine([
        ['ผู้รายงาน', report.reporter.name],
        ['ตำแหน่ง', report.reporter.position],
        ['รหัสผู้ใช้', report.reporter.loginname],
      ])
    }
    infoLine([
      ...(report.range
        ? ([['ช่วงข้อมูล', `${toThaiDateShort(report.range.startDate)} – ${toThaiDateShort(report.range.endDate)}`]] as const)
        : []),
      ['ส่งออกเมื่อ', nowThai()],
      ['จำนวน', `${fmtNum(rows.length)} รายการ`],
    ])

    if (report.summary?.length) {
      const richText: RichText[] = []
      report.summary.forEach((item, i) => {
        if (i > 0) richText.push({ text: '      •      ', font: font({ color: { argb: XL.border } }) })
        richText.push({ text: `${item.label}  `, font: font({ size: 10, color: { argb: XL.muted } }) })
        richText.push({
          text: typeof item.value === 'number' ? fmtNum(item.value) : item.value,
          font: font({ size: 11, bold: true, color: { argb: item.tone ? TONE[item.tone].font : XL.brandDark } }),
        })
      })
      band({ richText }, 24, { font: font(), fill: XL.white })
    }
    ws.addRow([]).height = 6

    // Header
    const headerRow = ws.addRow(columns.map((c) => c.header))
    headerRow.height = 30
    headerRow.eachCell((cell) => {
      cell.font = font({ bold: true, color: { argb: XL.white } })
      cell.fill = fill(XL.brandDark)
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = { ...box, top: { style: 'thin', color: { argb: XL.brandDark } } }
    })
    const headerRowNo = headerRow.number

    // Data
    rows.forEach((values, rIdx) => {
      const row = ws.addRow(
        columns.map((col, cIdx) => {
          const v = values[cIdx]
          if (v === null || v === undefined || v === '') return null
          if (col.type && NUM_FMT[col.type]) {
            const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
            return Number.isFinite(n) ? n : v
          }
          return v
        })
      )
      const zebra = rIdx % 2 === 1
      const tone = report.rowTones?.[rIdx]
      columns.forEach((col, cIdx) => {
        const cell = row.getCell(cIdx + 1)
        const type = col.type ?? 'text'
        cell.font = font()
        cell.border = box
        cell.alignment = {
          vertical: 'middle',
          horizontal: NUM_FMT[type] ? 'right' : type === 'center' ? 'center' : 'left',
          wrapText: type === 'text',
        }
        if (NUM_FMT[type]) cell.numFmt = NUM_FMT[type]!
        if (cIdx === report.statusColumn && tone) {
          cell.fill = fill(TONE[tone].fill)
          cell.font = font({ bold: true, color: { argb: TONE[tone].font } })
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        } else if (zebra) {
          cell.fill = fill(XL.zebra)
        }
      })
    })
    const lastDataRow = headerRowNo + rows.length

    // Totals
    if (rows.length > 0 && columns.some((c) => c.total)) {
      const labelCol = Math.max(0, columns.findIndex((c) => (c.type ?? 'text') === 'text'))
      const totalRow = ws.addRow([])
      totalRow.height = 24
      columns.forEach((col, cIdx) => {
        const cell = totalRow.getCell(cIdx + 1)
        if (col.total) {
          const letter = ws.getColumn(cIdx + 1).letter
          const sum = rows.reduce((s, r) => s + (Number(r[cIdx]) || 0), 0)
          cell.value = { formula: `SUM(${letter}${headerRowNo + 1}:${letter}${lastDataRow})`, result: sum }
          cell.numFmt = NUM_FMT[col.type ?? 'int'] ?? NUM_FMT.int!
          cell.alignment = { vertical: 'middle', horizontal: 'right' }
        } else if (cIdx === labelCol) {
          cell.value = 'รวมทั้งสิ้น'
          cell.alignment = { vertical: 'middle', horizontal: 'right' }
        }
        cell.font = font({ bold: true, size: 10.5, color: { argb: XL.brandDark } })
        cell.fill = fill(XL.brandSoft)
        cell.border = { ...box, top: { style: 'double', color: { argb: XL.brand } }, bottom: { style: 'medium', color: { argb: XL.brand } } }
      })
    }

    // Signature block (right half of the sheet), as on an official report
    const tailCol = Math.min(colCount, Math.max(1, Math.floor(colCount / 2)) + 1)
    const sigLine = (text: string, opts: { bold?: boolean; height?: number; color?: string; top?: boolean } = {}) => {
      const row = ws.addRow([])
      row.height = opts.height ?? 20
      if (tailCol < colCount) ws.mergeCells(row.number, tailCol, row.number, colCount)
      const cell = row.getCell(tailCol)
      cell.value = text
      cell.font = font({ bold: opts.bold, color: { argb: opts.color ?? XL.ink } })
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      if (opts.top) cell.border = { top: { style: 'hair', color: { argb: XL.muted } } }
    }
    ws.addRow([]).height = 14
    if (report.reporter) {
      sigLine('ลงชื่อ ...........................................................  ผู้รายงาน', { height: 34 })
      sigLine(`( ${report.reporter.name} )`, { bold: true })
      sigLine(`ตำแหน่ง ${report.reporter.position}`)
      const today = new Date()
      sigLine(
        `วันที่ ${toThaiDateShort(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`)}`,
        { color: XL.muted }
      )
    }
    const footNote = ws.addRow([])
    footNote.height = 28
    ws.mergeCells(footNote.number, 1, footNote.number, colCount)
    footNote.getCell(1).value = 'เอกสารฉบับนี้สร้างโดยระบบ SMART-HOSCHECK • ข้อมูลเพื่อการตรวจสอบภายในโรงพยาบาล'
    footNote.getCell(1).font = font({ size: 8.5, italic: true, color: { argb: XL.muted } })
    footNote.getCell(1).alignment = { vertical: 'bottom', horizontal: 'left', indent: 1 }

    // Column widths fitted to content (sampled for very large exports)
    const sample = rows.length > 3000 ? rows.filter((_, i) => i % Math.ceil(rows.length / 3000) === 0) : rows
    columns.forEach((col, cIdx) => {
      let width = col.width
      if (!width) {
        const isNum = !!NUM_FMT[col.type ?? 'text']
        let max = Math.min(displayLength(col.header), 18) // headers wrap, so they needn't set the width alone
        for (const r of sample) {
          const v = r[cIdx]
          if (v === null || v === undefined) continue
          const len = isNum && typeof v === 'number' ? fmtNum(v, col.type === 'money' ? 2 : 0).length : displayLength(String(v))
          if (len > max) max = len
        }
        width = Math.min(Math.max(max + 3, 7), 48)
      }
      ws.getColumn(cIdx + 1).width = width
    })

    ws.views = [{ state: 'frozen', ySplit: headerRowNo, showGridLines: false, activeCell: `A${headerRowNo + 1}` }]
    if (rows.length > 0) {
      ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: lastDataRow, column: colCount } }
    }
    ws.pageSetup.printTitlesRow = `${headerRowNo}:${headerRowNo}`

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = report.filename.endsWith('.xlsx') ? report.filename : `${report.filename}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    console.error('[EXCEL EXPORT]', err)
    window.alert('ส่งออกไฟล์ Excel ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
  }
}

/** Download rows as UTF-8 CSV with BOM (opens correctly in Thai Excel) */
export function downloadCsv(filename: string, headers: readonly string[], rows: readonly (readonly (string | number)[])[]): void {
  const esc = (v: string | number): string => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
