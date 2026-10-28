import type { DispensingRule } from '@/types/herbdx.types'

export interface ParsedDispensingRuleItem {
  id?: number
  drug_icode: string
  drug_name: string
  new_min_interval_days: number
  old_min_interval_days?: number
  new_pttype_name_label: string
  old_pttype_name_label?: string
  new_pttype_filter: string
  old_pttype_filter?: string
  new_rule_description: string
  old_rule_description?: string
  new_is_active: boolean
  old_is_active?: boolean
  isNew: boolean
  isIntervalChanged: boolean
  isActiveChanged: boolean
  isPttypeChanged: boolean
  isDescriptionChanged: boolean
  hasChanges: boolean
  invalidDays: boolean
  rowNumber: number
}

export interface ParsedDispensingRulesResult {
  fileName: string
  totalRows: number
  items: ParsedDispensingRuleItem[]
  changedCount: number
  newCount: number
  unchangedCount: number
  invalidCount: number
}

/**
 * ส่งออกรายการเงื่อนไขรอบการจ่ายยาสมุนไพรเป็นไฟล์ Excel (.xlsx) แบบมืออาชีพ
 */
export async function exportDispensingRulesToExcel(
  rules: readonly DispensingRule[]
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SMART-HOSCHECK'
  wb.created = new Date()

  const now = new Date()
  const dateStr = `${now.getFullYear() + 543}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const timeFormatted = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} น.`
  const thaiDateFormatted = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear() + 543}`

  // ==========================================
  // SHEET 1: เงื่อนไขรอบการจ่ายยาสมุนไพร
  // ==========================================
  const ws = wb.addWorksheet('เงื่อนไขรอบการจ่ายยาสมุนไพร', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 5 }],
    properties: { defaultRowHeight: 22 },
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: {
      oddFooter: `&L&8SMART-HOSCHECK • ทะเบียนเงื่อนไขรอบการจ่ายยาสมุนไพร&C&8หน้า &P / &N&R&8ส่งออกเมื่อ &D &T`,
    },
  })

  const colCount = 8

  // Helper styles
  const font = (extra: Record<string, unknown> = {}) => ({
    name: 'Segoe UI',
    size: 10,
    color: { argb: 'FF1E293B' },
    ...extra,
  })
  const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } })
  const thinBorder = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } }
  const cellBorder = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }

  // 1. Title Banner
  const titleRow = ws.addRow([])
  titleRow.height = 36
  ws.mergeCells(1, 1, 1, colCount)
  const titleCell = titleRow.getCell(1)
  titleCell.value = 'SMART-HOSCHECK • ทะเบียนเงื่อนไขรอบการจ่ายยาสมุนไพร & สิทธิการรักษา (Dispensing Interval Rules)'
  titleCell.font = font({ size: 14, bold: true, color: { argb: 'FFFFFFFF' } })
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  for (let c = 1; c <= colCount; c++) titleRow.getCell(c).fill = fill('FFB45309') // Deep Amber

  // 2. Hospital & Metadata Sub-banner
  const subRow = ws.addRow([])
  subRow.height = 22
  ws.mergeCells(2, 1, 2, colCount)
  const subCell = subRow.getCell(1)
  const activeCount = rules.filter((r) => r.is_active).length
  subCell.value = `โรงพยาบาลพังโคน • ส่งออกข้อมูล ณ วันที่ ${thaiDateFormatted} เวลา ${timeFormatted} • ทั้งหมด ${rules.length} เงื่อนไข (เปิดใช้งาน ${activeCount} เงื่อนไข)`
  subCell.font = font({ size: 9.5, bold: true, color: { argb: 'FF78350F' } })
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  for (let c = 1; c <= colCount; c++) subRow.getCell(c).fill = fill('FFFEF3C7') // Light Amber

  // 3. Instruction Banner
  const guideRow = ws.addRow([])
  guideRow.height = 26
  ws.mergeCells(3, 1, 3, colCount)
  const guideCell = guideRow.getCell(1)
  guideCell.value = `💡 คำแนะนำ: แก้ไขคอลัมน์ "รอบการจ่าย (วัน)" หรือ "สถานะ" ในตารางนี้ได้เลย (ห้ามแก้รหัสยาเพื่อให้ระบบจับคู่นำเข้าได้) | นำเข้ากลับได้ที่ปุ่ม "📥 นำเข้า Excel"`
  guideCell.font = font({ size: 9, bold: true, color: { argb: 'FF92400E' } })
  guideCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  for (let c = 1; c <= colCount; c++) guideRow.getCell(c).fill = fill('FFFFFBEB') // Warm Pale Amber

  // 4. Spacer Row
  const spacerRow = ws.addRow([])
  spacerRow.height = 6

  // 5. Table Header
  const headers = [
    { header: 'ลำดับ', key: 'no', width: 8, align: 'center' as const },
    { header: 'รหัสยา (icode)', key: 'drug_icode', width: 15, align: 'center' as const },
    { header: 'รายการยาสมุนไพร', key: 'drug_name', width: 34, align: 'left' as const },
    { header: 'รอบการจ่าย (วัน) *', key: 'min_interval_days', width: 18, align: 'center' as const },
    { header: 'สิทธิการรักษาที่บังคับใช้', key: 'pttype_name_label', width: 25, align: 'left' as const },
    { header: 'ตัวกรองสิทธิ (pttype_filter)', key: 'pttype_filter', width: 28, align: 'left' as const },
    { header: 'คำอธิบายเงื่อนไข', key: 'rule_description', width: 44, align: 'left' as const },
    { header: 'สถานะ', key: 'is_active', width: 14, align: 'center' as const },
  ]

  const headerRow = ws.addRow(headers.map((h) => h.header))
  headerRow.height = 30
  headerRow.eachCell((cell, colNumber) => {
    cell.alignment = {
      vertical: 'middle',
      horizontal: headers[colNumber - 1]?.align ?? 'center',
      wrapText: true,
    }
    cell.border = cellBorder

    // Highlight editable "รอบการจ่าย (วัน)" column header
    if (colNumber === 4) {
      cell.fill = fill('FFD97706') // Amber highlight
      cell.font = font({ bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } })
    } else {
      cell.fill = fill('FF1E293B') // Slate 800 dark navy header
      cell.font = font({ bold: true, size: 10, color: { argb: 'FFFFFFFF' } })
    }
  })

  // Set Column properties
  headers.forEach((h, idx) => {
    ws.getColumn(idx + 1).width = h.width
  })

  // 6. Data Rows
  rules.forEach((rule, idx) => {
    const row = ws.addRow([
      idx + 1,
      rule.drug_icode,
      rule.drug_name,
      rule.min_interval_days,
      rule.pttype_name_label || 'สิทธิ UC / บัตรทอง',
      rule.pttype_filter || 'UC',
      rule.rule_description || `เงื่อนไข${rule.pttype_name_label || 'สิทธิ UC'} ตัดการจ่าย ${rule.min_interval_days} วัน ถ้าไม่ครบ ${rule.min_interval_days} วันไม่ผ่าน`,
      rule.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน',
    ])

    row.height = 24
    const isEven = idx % 2 === 1
    const bgArgb = isEven ? 'FFF8FAFC' : 'FFFFFFFF'

    row.eachCell((cell, colNumber) => {
      cell.border = cellBorder

      if (colNumber === 1) {
        // ลำดับ
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.font = font({ size: 9.5, color: { argb: 'FF64748B' } })
        cell.fill = fill(bgArgb)
      } else if (colNumber === 2) {
        // รหัสยา (icode)
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.font = font({ name: 'Consolas', size: 10, bold: true, color: { argb: 'FF0F172A' } })
        cell.fill = fill(bgArgb)
      } else if (colNumber === 3) {
        // รายการยาสมุนไพร
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
        cell.font = font({ size: 10, bold: true, color: { argb: 'FF0F172A' } })
        cell.fill = fill(bgArgb)
      } else if (colNumber === 4) {
        // รอบการจ่าย (วัน) - Editable target cell (Soft Amber tint)
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.font = font({ name: 'Consolas', size: 11, bold: true, color: { argb: 'FFB45309' } })
        cell.fill = fill('FFFEF3C7')
      } else if (colNumber === 5) {
        // สิทธิการรักษา
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
        cell.font = font({ size: 9.5, color: { argb: 'FF334155' } })
        cell.fill = fill(bgArgb)
      } else if (colNumber === 6) {
        // ตัวกรองสิทธิ
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
        cell.font = font({ name: 'Consolas', size: 9, color: { argb: 'FF64748B' } })
        cell.fill = fill(bgArgb)
      } else if (colNumber === 7) {
        // คำอธิบาย
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
        cell.font = font({ size: 9, color: { argb: 'FF475569' } })
        cell.fill = fill(bgArgb)
      } else if (colNumber === 8) {
        // สถานะ
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.font = font({
          size: 9.5,
          bold: true,
          color: { argb: rule.is_active ? 'FF047857' : 'FF94A3B8' },
        })
        cell.fill = fill(rule.is_active ? 'FFECFDF5' : bgArgb)
      }
    })
  })

  // Auto filter on table headers
  ws.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5 + rules.length, column: colCount },
  }

  // ==========================================
  // SHEET 2: คำแนะนำการตั้งค่าและนำเข้า
  // ==========================================
  const wsGuide = wb.addWorksheet('คำแนะนำการตั้งค่า', {
    views: [{ showGridLines: true }],
    properties: { defaultRowHeight: 22 },
  })

  const guideTitle = wsGuide.addRow(['คู่มือการตั้งค่าเงื่อนไขรอบการจ่ายยาสมุนไพร & สิทธิการรักษา (SMART-HOSCHECK)'])
  guideTitle.height = 32
  wsGuide.mergeCells(1, 1, 1, 3)
  guideTitle.getCell(1).font = font({ size: 14, bold: true, color: { argb: 'FFB45309' } })
  guideTitle.getCell(1).alignment = { vertical: 'middle' }

  wsGuide.addRow([])

  const guideItems = [
    ['หลักการทำงาน', 'ระบบจะตรวจจับประวัติการรับยาเดิมของผู้ป่วยคนเดียวกัน (HN เดียวกัน) ในช่วงวันที่ตรวจ'],
    ['', 'หากผู้ป่วยมารับยาก่อนครบระยะเวลา "รอบการจ่าย (วัน)" ที่กำหนด ระบบจะระบุสถานะเป็น "จ่ายซ้ำไม่ครบ X วัน" อัตโนมัติ'],
    ['คอลัมน์ที่แก้ไขได้', '1. รอบการจ่าย (วัน): ระบุตัวเลขจำนวนวัน เช่น 3, 5, 7, 14, 30 (ต้องมากกว่า 0 วัน)'],
    ['', '2. สถานะ: ระบุ "เปิดใช้งาน" หรือ "ปิดใช้งาน"'],
    ['', '3. สิทธิการรักษา: ระบุชื่อสิทธิ เช่น สิทธิ UC / บัตรทอง, ประกันสังคม, ข้าราชการ, ทุกสิทธิการรักษา'],
    ['', '4. คำอธิบายเงื่อนไข: ข้อความที่จะปรากฏในระบบเพื่อความชัดเจน'],
    ['ข้อควรระวัง', 'ห้ามแก้ไขคอลัมน์ "รหัสยา (icode)" เพราะระบบใช้รหัสนี้ในการค้นหาและอัปเดตข้อมูลเงื่อนไขเดิม'],
    ['ขั้นตอนการนำเข้า', '1. ทำการแก้ไขและบันทึกไฟล์ Excel นี้ (.xlsx)'],
    ['', '2. กลับไปที่หน้า "เงื่อนไขรอบการจ่าย" ในระบบ SMART-HOSCHECK'],
    ['', '3. คลิกปุ่ม "📥 นำเข้า Excel"'],
    ['', '4. เลือกไฟล์ Excel ที่บันทึกไว้ ระบบจะเปรียบเทียบและแสดงตัวอย่างรายการที่มีการเปลี่ยนแปลงให้ตรวจสอบ'],
    ['', '5. กดยืนยันบันทึกข้อมูลเพื่อนำเงื่อนไขรอบการจ่ายใหม่เข้าสู่ระบบทันที'],
  ]

  guideItems.forEach(([label, desc]) => {
    const r = wsGuide.addRow([label, desc])
    r.getCell(1).font = font({ bold: true, color: { argb: 'FFB45309' } })
    r.getCell(2).font = font({ color: { argb: 'FF334155' } })
  })

  wsGuide.getColumn(1).width = 24
  wsGuide.getColumn(2).width = 80

  // Download in browser
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `เงื่อนไขรอบการจ่ายยาสมุนไพร_${dateStr}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * อ่านและตรวจสอบไฟล์ Excel เงื่อนไขรอบการจ่ายยาสมุนไพร
 */
export async function parseDispensingRulesFromExcel(
  file: File,
  existingRules: readonly DispensingRule[]
): Promise<ParsedDispensingRulesResult> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const arrayBuffer = await file.arrayBuffer()
  await wb.xlsx.load(arrayBuffer)

  // Find sheet
  const ws = wb.worksheets.find((s) => s.name.includes('เงื่อนไข') || s.name.includes('รอบการจ่าย')) || wb.worksheets[0]
  if (!ws) {
    throw new Error('ไม่พบแผ่นงาน (Worksheet) ในไฟล์ Excel')
  }

  // Detect header row
  let headerRowNumber = -1
  let colIcode = -1
  let colName = -1
  let colDays = -1
  let colPttypeLabel = -1
  let colPttypeFilter = -1
  let colDesc = -1
  let colActive = -1

  ws.eachRow((row, rowNumber) => {
    if (headerRowNumber > 0) return
    const values = row.values as unknown[]
    if (!Array.isArray(values)) return

    values.forEach((v, colIdx) => {
      const text = String(v ?? '').trim().toLowerCase()
      if (text.includes('icode') || (text.includes('รหัส') && text.includes('ยา'))) colIcode = colIdx
      else if (text.includes('รายการยา') || text.includes('ชื่อยา') || text.includes('ยาสมุนไพร')) colName = colIdx
      else if (text.includes('รอบ') || text.includes('วัน') || text.includes('interval')) colDays = colIdx
      else if (text.includes('สิทธิการรักษา') || text.includes('ชื่อสิทธิ')) colPttypeLabel = colIdx
      else if (text.includes('ตัวกรองสิทธิ') || text.includes('pttype_filter') || text.includes('filter')) colPttypeFilter = colIdx
      else if (text.includes('คำอธิบาย') || text.includes('เงื่อนไข') || text.includes('description')) colDesc = colIdx
      else if (text.includes('สถานะ') || text.includes('is_active') || text.includes('active')) colActive = colIdx
    })

    if (colIcode > 0 && colDays > 0) {
      headerRowNumber = rowNumber
    }
  })

  if (headerRowNumber === -1 || colIcode === -1 || colDays === -1) {
    throw new Error('ไม่พบคอลัมน์ "รหัสยา (icode)" หรือ "รอบการจ่าย (วัน)" ในไฟล์ Excel กรุณาใช้ไฟล์ที่ส่งออกจากระบบ')
  }

  const existingByIcode = new Map<string, DispensingRule>()
  for (const r of existingRules) {
    if (r.drug_icode) existingByIcode.set(String(r.drug_icode).trim(), r)
  }

  const parsedItems: ParsedDispensingRuleItem[] = []

  // Read data rows
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return

    const rawIcode = row.getCell(colIcode).value
    if (rawIcode === undefined || rawIcode === null) return

    const icode = (typeof rawIcode === 'object' && rawIcode !== null && 'result' in rawIcode
      ? String((rawIcode as { result: unknown }).result ?? '')
      : String(rawIcode)
    ).trim()

    if (!icode || icode === 'icode' || icode.includes('รหัสยา') || icode.includes('ลำดับ')) return

    // Extract drug name
    const rawName = colName > 0 ? row.getCell(colName).value : ''
    const drugName = String(
      typeof rawName === 'object' && rawName !== null && 'result' in rawName
        ? (rawName as { result: unknown }).result
        : rawName ?? ''
    ).trim()

    // Extract days
    const rawDays = row.getCell(colDays).value
    const daysStr = String(
      typeof rawDays === 'object' && rawDays !== null && 'result' in rawDays
        ? (rawDays as { result: unknown }).result
        : rawDays ?? ''
    ).trim()

    const parsedDays = parseInt(daysStr.replace(/[^0-9]/g, ''), 10)
    const invalidDays = isNaN(parsedDays) || parsedDays <= 0
    const newIntervalDays = invalidDays ? 7 : parsedDays

    // Extract pttype label & filter
    const rawPttypeLabel = colPttypeLabel > 0 ? row.getCell(colPttypeLabel).value : ''
    const pttypeLabel = String(
      typeof rawPttypeLabel === 'object' && rawPttypeLabel !== null && 'result' in rawPttypeLabel
        ? (rawPttypeLabel as { result: unknown }).result
        : rawPttypeLabel ?? ''
    ).trim()

    const rawPttypeFilter = colPttypeFilter > 0 ? row.getCell(colPttypeFilter).value : ''
    const pttypeFilter = String(
      typeof rawPttypeFilter === 'object' && rawPttypeFilter !== null && 'result' in rawPttypeFilter
        ? (rawPttypeFilter as { result: unknown }).result
        : rawPttypeFilter ?? ''
    ).trim()

    // Extract description
    const rawDesc = colDesc > 0 ? row.getCell(colDesc).value : ''
    const desc = String(
      typeof rawDesc === 'object' && rawDesc !== null && 'result' in rawDesc
        ? (rawDesc as { result: unknown }).result
        : rawDesc ?? ''
    ).trim()

    // Extract active status
    const rawActive = colActive > 0 ? row.getCell(colActive).value : ''
    const activeStr = String(
      typeof rawActive === 'object' && rawActive !== null && 'result' in rawActive
        ? (rawActive as { result: unknown }).result
        : rawActive ?? ''
    ).trim().toLowerCase()

    let newIsActive = true
    if (
      activeStr === 'ปิด' ||
      activeStr === 'ปิดใช้งาน' ||
      activeStr === 'false' ||
      activeStr === '0' ||
      activeStr === 'no' ||
      activeStr === 'inactive'
    ) {
      newIsActive = false
    }

    const existing = existingByIcode.get(icode)

    const isNew = !existing
    const isIntervalChanged = existing !== undefined && existing.min_interval_days !== newIntervalDays
    const isActiveChanged = existing !== undefined && existing.is_active !== newIsActive
    const isPttypeChanged = Boolean(
      existing !== undefined &&
      ((pttypeLabel && pttypeLabel !== existing.pttype_name_label) ||
        (pttypeFilter && pttypeFilter !== existing.pttype_filter))
    )
    const isDescriptionChanged = Boolean(
      existing !== undefined && desc !== '' && desc !== existing.rule_description
    )

    const hasChanges = isNew || isIntervalChanged || isActiveChanged || isPttypeChanged || isDescriptionChanged

    parsedItems.push({
      id: existing?.id,
      drug_icode: icode,
      drug_name: drugName || existing?.drug_name || icode,
      new_min_interval_days: newIntervalDays,
      old_min_interval_days: existing?.min_interval_days,
      new_pttype_name_label: pttypeLabel || existing?.pttype_name_label || 'สิทธิ UC / บัตรทอง',
      old_pttype_name_label: existing?.pttype_name_label,
      new_pttype_filter: pttypeFilter || existing?.pttype_filter || 'UC',
      old_pttype_filter: existing?.pttype_filter,
      new_rule_description:
        desc ||
        existing?.rule_description ||
        `เงื่อนไข${pttypeLabel || existing?.pttype_name_label || 'สิทธิ UC'} ตัดการจ่าย ${newIntervalDays} วัน ถ้าไม่ครบ ${newIntervalDays} วันไม่ผ่าน`,
      old_rule_description: existing?.rule_description,
      new_is_active: newIsActive,
      old_is_active: existing?.is_active,
      isNew,
      isIntervalChanged,
      isActiveChanged,
      isPttypeChanged,
      isDescriptionChanged,
      hasChanges,
      invalidDays,
      rowNumber,
    })
  })

  const changedCount = parsedItems.filter((i) => i.hasChanges && !i.isNew && !i.invalidDays).length
  const newCount = parsedItems.filter((i) => i.isNew && !i.invalidDays).length
  const unchangedCount = parsedItems.filter((i) => !i.hasChanges && !i.invalidDays).length
  const invalidCount = parsedItems.filter((i) => i.invalidDays).length

  return {
    fileName: file.name,
    totalRows: parsedItems.length,
    items: parsedItems,
    changedCount,
    newCount,
    unchangedCount,
    invalidCount,
  }
}
