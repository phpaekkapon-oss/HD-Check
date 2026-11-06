import type { ThaiMedDailySummary } from '@/api/herbdx.api'
import { THAI_MONTHS_FULL, toThaiDate, toThaiDateLong } from '@/lib/format'
import { layoutCards, layoutDashboard, layoutPoster, layoutTable } from '@/lib/infographicLayouts'
import { INFOGRAPHIC_STYLES } from '@/lib/infographicStyles'
import { iconColors, loadFonts, loadIcons, type Period, type Scene } from '@/lib/infographicKit'

const WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const


const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate()

/** ข้อความช่วงเวลาบนภาพ: วันเดียว / ทั้งเดือน / ช่วงวันที่ */
export function periodOf(s: ThaiMedDailySummary): Period {
  if (s.startDate === s.endDate) {
    const d = new Date(`${s.startDate}T00:00:00`)
    return {
      lead: `วัน${WEEKDAYS[d.getDay()] ?? ''}ที่`,
      big: toThaiDateLong(s.startDate).replace(' พ.ศ.', ''),
      title: 'สรุปผลการดำเนินงานประจำวัน',
      time: s.timeRange ? `เวลา ${s.timeRange.from} – ${s.timeRange.to} น.` : undefined,
      panel: 'ภาพรวมผลการดำเนินงานประจำวัน',
    }
  }
  const [y, m, d] = s.startDate.split('-').map(Number)
  const fullMonth = s.startDate.slice(0, 7) === s.endDate.slice(0, 7) && d === 1 && s.endDate === `${s.startDate.slice(0, 7)}-${String(lastDayOf(y ?? 0, m ?? 0)).padStart(2, '0')}`
  if (fullMonth) {
    return {
      lead: 'ประจำเดือน',
      big: `${THAI_MONTHS_FULL[(m ?? 1) - 1] ?? ''} ${(y ?? 0) + 543}`,
      title: 'สรุปผลการดำเนินงานประจำเดือน',
      panel: 'ภาพรวมผลการดำเนินงานประจำเดือน',
    }
  }
  return {
    lead: 'ช่วงวันที่',
    big: `${toThaiDate(s.startDate)} – ${toThaiDate(s.endDate)}`,
    title: 'สรุปผลการดำเนินงานตามช่วงวันที่',
    panel: 'ภาพรวมผลการดำเนินงานตามช่วงวันที่',
  }
}

/**
 * วาดภาพสรุปผลการดำเนินงานด้วย Canvas ตามสไตล์ที่เลือก
 * ไอคอนใช้ชุด lucide เดียวกับตัวโปรแกรม — มีเฉพาะยอดรวมระดับกลุ่มงาน ไม่มีข้อมูลรายบุคคล
 */
export async function renderInfographic(s: ThaiMedDailySummary, hospitalName: string, styleId: string): Promise<Blob> {
  const t = INFOGRAPHIC_STYLES.find((x) => x.id === styleId) ?? INFOGRAPHIC_STYLES[0]
  if (!t) throw new Error('ไม่พบสไตล์ภาพ')
  const [, icons] = await Promise.all([loadFonts(), loadIcons(iconColors(t))])
  const canvas = document.createElement('canvas')
  canvas.width = t.w
  canvas.height = t.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('เบราว์เซอร์นี้สร้างภาพไม่ได้')

  const sc: Scene = { ctx, icons, t, s, period: periodOf(s), hospital: hospitalName }
  if (t.layout === 'table') layoutTable(sc)
  else if (t.layout === 'dashboard') layoutDashboard(sc)
  else if (t.layout === 'poster') layoutPoster(sc)
  else layoutCards(sc)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('สร้างไฟล์ภาพไม่สำเร็จ'))), 'image/png')
  })
}

export const infographicFilename = (s: ThaiMedDailySummary, styleId: string): string =>
  s.startDate === s.endDate ? `thaimed-daily-${s.startDate}-${styleId}.png` : `thaimed-summary-${s.startDate}_${s.endDate}-${styleId}.png`

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
