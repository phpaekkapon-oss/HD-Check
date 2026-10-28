import type { DxMapRecord } from '@/types/herbdx.types'

/**
 * รูปแบบรหัส ICD-10 หรือคำนำหน้ากลุ่มโรค:
 * ตัวอักษรภาษาอังกฤษ 1 ตัว ตามด้วยตัวเลข 0-6 หลัก (เช่น M, K30, U6680, A090)
 */
export const DX_PREFIX_RE = /^[A-Z]\d{0,6}$/

export interface ParsedDxMapItem {
  icode: string
  drug_name: string
  new_dx_prefixes: string
  old_dx_prefixes: string
  new_codes: string[]
  old_codes: string[]
  added_codes: string[]
  removed_codes: string[]
  unchanged_codes: string[]
  invalid_codes: string[]
  new_min_qty?: number
  old_min_qty?: number
  new_indication?: string
  old_indication?: string
  hasChanges: boolean
  isNotFound: boolean
  rowNumber: number
}

export interface ParsedDxMapResult {
  fileName: string
  totalRows: number
  items: ParsedDxMapItem[]
  changedCount: number
  unchangedCount: number
  notFoundCount: number
  invalidCount: number
}

/**
 * แยกและทำความสะอาดรหัส ICD-10 จากสตริง
 */
export function cleanIcdCodes(raw: string | undefined | null): { valid: string[]; invalid: string[] } {
  if (!raw) return { valid: [], invalid: [] }
  const parts = String(raw)
    .split(/[,\s\n\r;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)

  const valid: string[] = []
  const invalid: string[] = []

  for (const code of parts) {
    if (DX_PREFIX_RE.test(code)) {
      if (!valid.includes(code)) valid.push(code)
    } else {
      if (!invalid.includes(code)) invalid.push(code)
    }
  }

  return { valid, invalid }
}

/**
 * ส่งออกรายการเกณฑ์จับคู่รหัส ICD-10 ยาสมุนไพรเป็นไฟล์ Excel (.xlsx) แบบมืออาชีพ
 */
export async function exportDxMapToExcel(items: readonly DxMapRecord[]): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SMART-HOSCHECK'
  wb.created = new Date()

  const now = new Date()
  const dateStr = `${now.getFullYear() + 543}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const timeFormatted = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} น.`
  const thaiDateFormatted = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear() + 543}`

  // ==========================================
  // SHEET 1: ทะเบียนเกณฑ์จับคู่รหัส ICD-10 ยาสมุนไพร
  // ==========================================
  const ws = wb.addWorksheet('เกณฑ์ ICD-10 ยาสมุนไพร', {
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
      oddFooter: `&L&8SMART-HOSCHECK • ทะเบียนเกณฑ์ ICD-10 ยาสมุนไพร&C&8หน้า &P / &N&R&8ส่งออกเมื่อ &D &T`,
    },
  })

  const colCount = 9

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
  titleCell.value = 'SMART-HOSCHECK • ทะเบียนเกณฑ์จับคู่รหัสโรค (ICD-10) กับยาสมุนไพร'
  titleCell.font = font({ size: 15, bold: true, color: { argb: 'FFFFFFFF' } })
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  for (let c = 1; c <= colCount; c++) titleRow.getCell(c).fill = fill('FF0F766E') // Deep Teal

  // 2. Hospital & Metadata Sub-banner
  const subRow = ws.addRow([])
  subRow.height = 22
  ws.mergeCells(2, 1, 2, colCount)
  const subCell = subRow.getCell(1)
  subCell.value = `โรงพยาบาลพังโคน • ส่งออกข้อมูล ณ วันที่ ${thaiDateFormatted} เวลา ${timeFormatted} • ทั้งหมด ${items.length} รายการ`
  subCell.font = font({ size: 9.5, bold: true, color: { argb: 'FF134E4A' } })
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  for (let c = 1; c <= colCount; c++) subRow.getCell(c).fill = fill('FFCCFBF1') // Soft Teal Light

  // 3. Instruction Banner
  const guideRow = ws.addRow([])
  guideRow.height = 26
  ws.mergeCells(3, 1, 3, colCount)
  const guideCell = guideRow.getCell(1)
  guideCell.value = `💡 คำแนะนำ: แก้ไขรหัสในคอลัมน์สีเขียว "รหัส ICD-10 ที่อนุญาต" โดยคั่นด้วยเครื่องหมายจุลภาค (,) เช่น K30, R14, U6680 | ห้ามแก้ไข "รหัสยา (icode)" เพื่อให้ระบบจับคู่นำเข้าได้ถูกต้อง`
  guideCell.font = font({ size: 9, bold: true, color: { argb: 'FF92400E' } })
  guideCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  for (let c = 1; c <= colCount; c++) guideRow.getCell(c).fill = fill('FFFEF3C7') // Soft Amber

  // 4. Spacer Row
  const spacerRow = ws.addRow([])
  spacerRow.height = 8

  // 5. Table Headers Row
  const headers = [
    { key: 'no', label: 'ลำดับ', width: 8, align: 'center' },
    { key: 'icode', label: 'รหัสยา (icode)', width: 15, align: 'center' },
    { key: 'name', label: 'รายการยาสมุนไพร', width: 34, align: 'left' },
    { key: 'dx', label: 'รหัส ICD-10 ที่อนุญาต (แก้ไขที่นี่ คั่นด้วย ,)', width: 48, align: 'left' },
    { key: 'count', label: 'จำนวนรหัส', width: 12, align: 'center' },
    { key: 'min_qty', label: 'จ่ายขั้นต่ำ (UC)', width: 15, align: 'center' },
    { key: 'indication', label: 'ข้อบ่งใช้ / สรรพคุณ', width: 38, align: 'left' },
    { key: 'interval', label: 'รอบจ่าย (วัน)', width: 14, align: 'center' },
    { key: 'pttype', label: 'สิทธิการรักษา', width: 22, align: 'center' },
  ]

  const headerRow = ws.addRow(headers.map((h) => h.label))
  headerRow.height = 28
  headers.forEach((h, idx) => {
    const colIdx = idx + 1
    const cell = headerRow.getCell(colIdx)
    const isDxCol = h.key === 'dx'
    cell.font = font({ size: 10, bold: true, color: { argb: 'FFFFFFFF' } })
    cell.fill = fill(isDxCol ? 'FF065F46' : 'FF1E293B') // Highlight ICD column with deep forest emerald
    cell.alignment = { vertical: 'middle', horizontal: h.align as 'left' | 'center', wrapText: true }
    cell.border = cellBorder
    ws.getColumn(colIdx).width = h.width
  })

  // 6. Data Rows
  items.forEach((item, index) => {
    const codes = item.dx_prefixes
      ? item.dx_prefixes.split(',').map((p) => p.trim()).filter(Boolean)
      : []

    const rowData = [
      index + 1,
      item.icode,
      item.drug_name,
      codes.join(', '),
      codes.length,
      item.min_qty && item.min_qty > 0 ? item.min_qty : 0,
      item.indication || '',
      item.dispensing_interval_days && item.dispensing_interval_days > 0 ? item.dispensing_interval_days : '-',
      item.dispensing_pttype_label || (item.dispensing_interval_days ? 'สิทธิ UC / บัตรทอง' : '-'),
    ]

    const row = ws.addRow(rowData)
    row.height = codes.length > 10 ? 32 : 22
    const isEven = index % 2 === 1

    headers.forEach((h, colIdx) => {
      const cell = row.getCell(colIdx + 1)
      cell.border = cellBorder
      cell.alignment = {
        vertical: 'middle',
        horizontal: h.align as 'left' | 'center',
        wrapText: h.key === 'dx' || h.key === 'indication',
      }

      if (h.key === 'dx') {
        // Editable Column: Distinct soft emerald background
        cell.fill = fill('FFF0FDF4')
        cell.font = font({ size: 9.5, bold: true, color: { argb: 'FF065F46' }, name: 'Consolas' })
      } else if (h.key === 'icode') {
        cell.fill = fill(isEven ? 'FFF8FAFC' : 'FFFFFFFF')
        cell.font = font({ size: 9.5, bold: true, color: { argb: 'FF334155' }, name: 'Consolas' })
      } else if (h.key === 'name') {
        cell.fill = fill(isEven ? 'FFF8FAFC' : 'FFFFFFFF')
        cell.font = font({ size: 10, bold: true, color: { argb: 'FF0F172A' } })
      } else {
        cell.fill = fill(isEven ? 'FFF8FAFC' : 'FFFFFFFF')
        cell.font = font({ size: 9.5 })
      }
    })
  })

  // Enable Auto-Filter on header row (row 5)
  ws.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5 + items.length, column: colCount },
  }

  // ==========================================
  // SHEET 2: คำแนะนำการใช้งาน & รูปแบบรหัส
  // ==========================================
  const wsGuide = wb.addWorksheet('วิธีใช้งานและคำแนะนำ', {
    views: [{ showGridLines: true }],
    properties: { defaultRowHeight: 22 },
  })

  const guideTitle = wsGuide.addRow(['คู่มือการแก้ไขและนำเข้าเกณฑ์ ICD-10 ยาสมุนไพร'])
  guideTitle.height = 32
  wsGuide.mergeCells(1, 1, 1, 6)
  guideTitle.getCell(1).font = font({ size: 14, bold: true, color: { argb: 'FFFFFFFF' } })
  guideTitle.getCell(1).fill = fill('FF0F766E')
  guideTitle.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  const guideItems = [
    ['', ''],
    ['1. คอลัมน์ที่สามารถแก้ไขได้', 'สามารถแก้ไขรหัสในคอลัมน์ "รหัส ICD-10 ที่อนุญาต (แก้ไขที่นี่ คั่นด้วย ,)" ได้อย่างอิสระ'],
    ['', 'หากต้องการแก้ไขข้อบ่งใช้ หรือจำนวนจ่ายขั้นต่ำ ก็สามารถปรับเปลี่ยนในไฟล์นี้ได้เช่นกัน'],
    ['2. ข้อห้ามสำคัญ', 'ห้ามแก้ไขรหัสยา (icode) ในคอลัมน์ B เด็ดขาด เนื่องจากระบบใช้รหัสนี้ในการจับคู่กับยาในระบบ HOSxP'],
    ['', 'ห้ามลบคอลัมน์ หรือเปลี่ยนชื่อหัวตารางแถวที่ 5'],
    ['3. รูปแบบรหัส ICD-10 ที่ถูกต้อง', 'ระบุรหัสเดี่ยว เช่น: K30, R14, U6680, A090, M545'],
    ['', 'ระบุคำนำหน้ากลุ่มโรค เช่น: M (ครอบคลุม M00-M99), K (ครอบคลุม K00-K93)'],
    ['', 'คั่นแต่ละรหัสด้วยเครื่องหมายจุลภาค (,) เช่น: K30, K259, R14, U6680'],
    ['4. ข้อควรระวัง', 'ระวังการพิมพ์ตัวอักษรโอ (O) แทนตัวเลขศูนย์ (0) เช่น U504O จะไม่ถูกต้อง ที่ถูกต้องคือ U5040'],
    ['5. การนำเข้าไฟล์กลับเข้าสู่ระบบ', '1. บันทึก (Save) ไฟล์ Excel นี้เมื่อแก้ไขเสร็จสิ้น'],
    ['', '2. กลับไปที่หน้า "ตั้งค่ายา ↔ ICD-10" ในระบบ SMART-HOSCHECK'],
    ['', '3. คลิกปุ่ม "📥 นำเข้า Excel" ที่แถบเครื่องมือ'],
    ['', '4. เลือกไฟล์ Excel ที่แก้ไขแล้ว ระบบจะตรวจสอบและแสดงรายการที่มีการเปลี่ยนแปลงให้ดูเปรียบเทียบ'],
    ['', '5. ตรวจสอบความถูกต้องและกดยืนยันบันทึกข้อมูลเข้าสู่ระบบ'],
  ]

  guideItems.forEach(([label, desc]) => {
    const r = wsGuide.addRow([label, desc])
    r.getCell(1).font = font({ bold: true, color: { argb: 'FF0F766E' } })
    r.getCell(2).font = font({ color: { argb: 'FF334155' } })
  })

  wsGuide.getColumn(1).width = 28
  wsGuide.getColumn(2).width = 75

  // Trigger download in browser
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `เกณฑ์จับคู่รหัสโรค_ICD10_ยาสมุนไพร_${dateStr}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * อ่านและตรวจสอบไฟล์ Excel เกณฑ์จับคู่รหัส ICD-10
 */
export async function parseDxMapFromExcel(
  file: File,
  existingMap: readonly DxMapRecord[]
): Promise<ParsedDxMapResult> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const arrayBuffer = await file.arrayBuffer()
  await wb.xlsx.load(arrayBuffer)

  // Find sheet (first sheet or sheet containing 'เกณฑ์')
  const ws = wb.worksheets.find((s) => s.name.includes('เกณฑ์')) || wb.worksheets[0]
  if (!ws) {
    throw new Error('ไม่พบแผ่นงาน (Worksheet) ในไฟล์ Excel')
  }

  // Scan for header row
  let headerRowNumber = -1
  let colIcode = -1
  let colDx = -1
  let colName = -1
  let colMinQty = -1
  let colIndication = -1

  ws.eachRow((row, rowNumber) => {
    if (headerRowNumber > 0) return
    const values = row.values as unknown[]
    if (!Array.isArray(values)) return

    values.forEach((v, colIdx) => {
      const text = String(v ?? '').trim().toLowerCase()
      if (text.includes('icode') || (text.includes('รหัส') && text.includes('ยา'))) colIcode = colIdx
      else if (text.includes('icd') || text.includes('dx_prefixes') || text.includes('รหัสที่อนุญาต')) colDx = colIdx
      else if (text.includes('รายการยา') || text.includes('ชื่อยา') || text.includes('ยาสมุนไพร')) colName = colIdx
      else if (text.includes('จ่ายขั้นต่ำ') || text.includes('min_qty')) colMinQty = colIdx
      else if (text.includes('ข้อบ่งใช้') || text.includes('สรรพคุณ') || text.includes('indication')) colIndication = colIdx
    })

    if (colIcode > 0 && colDx > 0) {
      headerRowNumber = rowNumber
    }
  })

  if (headerRowNumber === -1 || colIcode === -1 || colDx === -1) {
    throw new Error('ไม่พบคอลัมน์ "รหัสยา (icode)" หรือ "รหัส ICD-10" ในไฟล์ Excel กรุณาใช้ไฟล์ที่ส่งออกจากระบบ')
  }

  const existingMapByIcode = new Map(existingMap.map((item) => [String(item.icode).trim(), item]))
  const parsedItems: ParsedDxMapItem[] = []

  // Read data rows
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return

    const rawIcode = row.getCell(colIcode).value
    if (rawIcode === undefined || rawIcode === null) return

    // Cell value can be object (e.g. rich text or formula) or primitive
    const icode = (typeof rawIcode === 'object' && rawIcode !== null && 'result' in rawIcode
      ? String((rawIcode as { result: unknown }).result ?? '')
      : String(rawIcode)
    ).trim()

    if (!icode || icode === 'icode' || icode.includes('รหัสยา')) return

    const rawDx = row.getCell(colDx).value
    const dxString = (typeof rawDx === 'object' && rawDx !== null && 'result' in rawDx
      ? String((rawDx as { result: unknown }).result ?? '')
      : String(rawDx ?? '')
    ).trim()

    const rawName = colName > 0 ? row.getCell(colName).value : ''
    const drugName = String(typeof rawName === 'object' && rawName !== null && 'result' in rawName ? (rawName as { result: unknown }).result : rawName ?? '').trim()

    const rawMinQty = colMinQty > 0 ? row.getCell(colMinQty).value : undefined
    const minQty = rawMinQty !== undefined && rawMinQty !== null && rawMinQty !== '' ? Math.max(0, parseInt(String(rawMinQty), 10) || 0) : undefined

    const rawIndication = colIndication > 0 ? row.getCell(colIndication).value : undefined
    const indication = rawIndication !== undefined ? String(rawIndication).trim() : undefined

    const { valid: newCodes, invalid: invalidCodes } = cleanIcdCodes(dxString)
    const existing = existingMapByIcode.get(icode)

    const oldCodes = existing?.dx_prefixes
      ? cleanIcdCodes(existing.dx_prefixes).valid
      : []

    const addedCodes = newCodes.filter((c) => !oldCodes.includes(c))
    const removedCodes = oldCodes.filter((c) => !newCodes.includes(c))
    const unchangedCodes = newCodes.filter((c) => oldCodes.includes(c))

    const isCodeChanged = addedCodes.length > 0 || removedCodes.length > 0
    const isMinQtyChanged = minQty !== undefined && existing?.min_qty !== undefined && minQty !== existing.min_qty
    const isIndicationChanged = indication !== undefined && existing?.indication !== undefined && indication !== existing.indication

    const hasChanges = isCodeChanged || isMinQtyChanged || isIndicationChanged
    const isNotFound = !existing

    parsedItems.push({
      icode,
      drug_name: drugName || existing?.drug_name || icode,
      new_dx_prefixes: newCodes.join(', '),
      old_dx_prefixes: oldCodes.join(', '),
      new_codes: newCodes,
      old_codes: oldCodes,
      added_codes: addedCodes,
      removed_codes: removedCodes,
      unchanged_codes: unchangedCodes,
      invalid_codes: invalidCodes,
      new_min_qty: minQty,
      old_min_qty: existing?.min_qty,
      new_indication: indication,
      old_indication: existing?.indication,
      hasChanges,
      isNotFound,
      rowNumber,
    })
  })

  const changedCount = parsedItems.filter((i) => i.hasChanges && !i.isNotFound).length
  const unchangedCount = parsedItems.filter((i) => !i.hasChanges && !i.isNotFound).length
  const notFoundCount = parsedItems.filter((i) => i.isNotFound).length
  const invalidCount = parsedItems.filter((i) => i.invalid_codes.length > 0).length

  return {
    fileName: file.name,
    totalRows: parsedItems.length,
    items: parsedItems,
    changedCount,
    unchangedCount,
    notFoundCount,
    invalidCount,
  }
}
