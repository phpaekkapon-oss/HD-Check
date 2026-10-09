import type { AuditResult, DateRange } from '@/types/herbdx.types'
import * as XLSX from 'xlsx'

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

/** Download rows as Microsoft Excel (.xlsx) file with formatting and column auto-width */
export function downloadExcel(
  filename: string,
  headers: readonly string[],
  rows: readonly (string | number | null | undefined)[][],
  sheetName = 'ตรวจสอบการจ่ายยาสมุนไพร'
): void {
  const aoa = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Auto-fit column widths
  const colWidths = headers.map((h, colIdx) => {
    let maxLen = String(h).length
    for (const r of rows) {
      const val = r[colIdx]
      if (val !== undefined && val !== null) {
        const str = String(val)
        if (str.length > maxLen) maxLen = Math.min(str.length, 50)
      }
    }
    return { wch: Math.max(maxLen + 4, 10) }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31))

  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.csv$/i, '')}.xlsx`
  XLSX.writeFile(wb, finalFilename)
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
