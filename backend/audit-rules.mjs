// Pure herbal-drug audit rule (no DB access) so it can be unit-tested: node --test
import { MIN_QTY_APPLY_PTTYPES, THAI_MED_DOCTORS_REQUIRE_U, normalizeIcdCode } from './config.mjs'

/** เฉพาะแพทย์แผนไทย 5 ท่านที่กำหนด ต้องมีรหัส U ควบคู่กับรหัสแผนปัจจุบัน (ผู้สั่งอื่นมี ICD10 แผนปัจจุบันก็ผ่าน) */
export function isThaiMedRow(row) {
  const doctorName = String(row.doctor_name ?? '').trim()
  return THAI_MED_DOCTORS_REQUIRE_U.some((name) => doctorName.includes(name))
}

export function evaluate(row, dxMap, minQtyMap) {
  const minQty = (minQtyMap ? minQtyMap.get(row.drug_icode) : 0) || 0
  const qty = Number(row.drug_qty ?? 0)

  // 1. เกณฑ์จำนวนจ่ายขั้นต่ำใช้เฉพาะสิทธิ UC (สิทธิอื่นไม่ตรวจ)
  const pttype = String(row.pttype_name ?? '').trim().toUpperCase()
  const isPttypeExempt = !MIN_QTY_APPLY_PTTYPES.some((kw) => pttype.includes(kw.toUpperCase()))
  const isQtyFail = !isPttypeExempt && minQty > 0 && qty < minQty
  const units = row.drug_units ? ` ${row.drug_units}` : ''

  const dxList = [row.pdx, row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5]
    .map(normalizeIcdCode)
    .filter(Boolean)
  const unique = [...new Set(dxList)]

  // 2. ตรวจสอบประเภทแผนก/แพทย์: แผนกแพทย์แผนไทย หรือ แพทย์แผนปัจจุบัน
  const isThaiMed = isThaiMedRow(row)

  const uDxList = unique.filter((dx) => dx.startsWith('U'))
  const hasUDx = uDxList.length > 0
  const modernDxList = unique.filter((dx) => !dx.startsWith('U'))

  const allowed = dxMap ? (dxMap.get(row.drug_icode) ?? []) : []

  if (unique.length === 0) {
    return {
      audit_result: 'NO_DX',
      matched_dx: [],
      allowed_dx: allowed,
      min_qty: minQty,
      is_qty_fail: isQtyFail,
      audit_reason: isQtyFail
        ? `ไม่มีรหัสวินิจฉัย (PDX/DX ว่าง) และจ่ายต่ำกว่าเกณฑ์ขั้นต่ำ (${qty}/${minQty}${units})`
        : 'ไม่มีรหัสวินิจฉัย (PDX/DX ว่าง)',
    }
  }

  if (allowed.length === 0) {
    return {
      audit_result: 'NO_MAP',
      matched_dx: [],
      allowed_dx: [],
      min_qty: minQty,
      is_qty_fail: isQtyFail,
      audit_reason: isQtyFail
        ? `ยังไม่ได้กำหนด ICD และจ่ายต่ำกว่าเกณฑ์ขั้นต่ำ (${qty}/${minQty}${units})`
        : 'ยังไม่ได้กำหนด ICD ที่ใช้คู่กับยานี้',
    }
  }

  // แยกเกณฑ์ ICD ที่ตั้งไว้: รหัสแผนปัจจุบัน (ไม่ขึ้นต้นด้วย U) กับ รหัสแผนไทย (ขึ้นต้นด้วย U)
  const modernAllowed = allowed.filter((p) => !p.toUpperCase().startsWith('U'))
  const uAllowed = allowed.filter((p) => p.toUpperCase().startsWith('U'))

  // รหัสแผนปัจจุบันที่ตรงกับเกณฑ์
  const effectiveModernAllowed = modernAllowed.length > 0 ? modernAllowed : allowed
  const matchedModern = modernDxList.filter((dx) =>
    effectiveModernAllowed.some((p) => dx.startsWith(normalizeIcdCode(p)))
  )

  // รหัสแผนไทยในเคส: ยอมรับรหัส U ทุกรหัส (ตามเกณฑ์ที่แจ้งในหน้าตั้งค่า)
  // ถ้ามีรหัส U ที่ตรงกับที่ตั้งไว้ให้ยา (เช่น U6680) จะแสดงรหัสนั้นก่อน
  const specificU = uAllowed.length > 0
    ? uDxList.filter((dx) => uAllowed.some((p) => dx.startsWith(normalizeIcdCode(p))))
    : []
  const matchedU = specificU.length > 0 ? specificU : uDxList

  // 3. กฎเกณฑ์ตามประเภทผู้สั่งจ่าย:
  // - แพทย์แผนปัจจุบัน: เอาเฉพาะรหัสแผนปัจจุบันที่ตรงกับเกณฑ์ของยา (ไม่ต้องมีรหัส U เช่น U6680 ก็ผ่าน)
  // - แผนกแพทย์แผนไทย: ต้องมีทั้งรหัสแผนปัจจุบันที่ตรงเกณฑ์ + รหัสแผนไทย (ขึ้นต้นด้วย U)
  let isDxPass = false
  let failDxReason = ''
  let matchedList = []

  if (isThaiMed) {
    // แผนกแพทย์แผนไทย: ต้องมี (รหัสแผนปัจจุบัน + รหัสแผนไทย)
    const hasValidModern = matchedModern.length > 0
    const hasValidU = hasUDx

    if (hasValidModern && hasValidU) {
      isDxPass = true
      matchedList = [...matchedModern, ...matchedU]
    } else if (hasValidModern && !hasValidU) {
      isDxPass = false
      matchedList = matchedModern
      const expectedU = uAllowed.length > 0 ? uAllowed.join(', ') : 'U6680'
      failDxReason = `แผนกแพทย์แผนไทยสั่งจ่ายยานี้ ต้องระบุรหัสแผนปัจจุบัน (${matchedModern.join(', ')}) ควบคู่กับรหัสแพทย์แผนไทย (รหัสขึ้นต้นด้วย U เช่น ${expectedU})`
    } else if (!hasValidModern && hasValidU) {
      isDxPass = false
      matchedList = matchedU
      failDxReason = `แผนกแพทย์แผนไทยสั่งจ่ายยานี้ ต้องระบุรหัสแผนปัจจุบันที่ตรงกับเกณฑ์ยา (เกณฑ์: ${effectiveModernAllowed.join(', ')}) ควบคู่กับรหัสแพทย์แผนไทย (พบ ${uDxList.join(', ')})`
    } else {
      isDxPass = false
      matchedList = []
      failDxReason = `แผนกแพทย์แผนไทยสั่งจ่ายยานี้ ต้องระบุทั้งรหัสแผนปัจจุบัน (เกณฑ์: ${effectiveModernAllowed.join(', ')}) และรหัสแพทย์แผนไทย (รหัสขึ้นต้นด้วย U)`
    }
  } else {
    // แพทย์แผนปัจจุบัน: เอาเฉพาะรหัสแผนปัจจุบันที่ตรงกับเกณฑ์ของยา
    if (matchedModern.length > 0) {
      isDxPass = true
      matchedList = matchedModern
    } else {
      isDxPass = false
      matchedList = []
      failDxReason = `ไม่พบ DX แผนปัจจุบันที่ตรงกับเกณฑ์ของยาที่ตั้งไว้ (พบ ${unique.join(', ')}; เกณฑ์ ${effectiveModernAllowed.join(', ')})`
    }
  }

  // หากมียาที่มีการกำหนดจ่ายขั้นต่ำ และจ่ายน้อยกว่าเกณฑ์ (เฉพาะสิทธิที่ไม่ได้รับการยกเว้น)
  if (isQtyFail) {
    return {
      audit_result: 'FAIL',
      matched_dx: matchedList,
      allowed_dx: allowed,
      min_qty: minQty,
      is_qty_fail: true,
      audit_reason: isDxPass
        ? `จ่ายต่ำกว่าเกณฑ์ขั้นต่ำ (จ่าย ${qty}${units}, เกณฑ์กำหนดขั้นต่ำ ${minQty}${units}) เบิกเคลมไม่ผ่าน`
        : `${failDxReason} และจ่ายต่ำกว่าเกณฑ์ขั้นต่ำ (จ่าย ${qty}${units}, เกณฑ์ขั้นต่ำ ${minQty}${units})`,
    }
  }

  // เงื่อนไขรอบการจ่ายยาสมุนไพรตามสิทธิ (เช่น สิทธิ UC ยาธาตุอบเชย ตัดการจ่าย 7 วัน หรือเงื่อนไขที่กำหนดเอง)
  if (row.interval_fail || row.cinnamon_interval_fail) {
    const prevDate = row.interval_prev_date || row.cinnamon_prev_date || 'ก่อนหน้า'
    const daysDiff = row.interval_days_diff ?? row.cinnamon_days_diff ?? 0
    const ruleInfo = row.interval_rule_info || {
      drug_name: row.drug_name || 'ยาธาตุอบเชย',
      pttype_label: 'สิทธิ UC',
      min_days: 7,
    }
    const pttypeLabel = ruleInfo.pttype_label || 'สิทธิ'
    const drugName = ruleInfo.drug_name || row.drug_name || 'รายการยา'
    const minDays = ruleInfo.min_days ?? 7

    return {
      audit_result: 'FAIL',
      matched_dx: matchedList,
      allowed_dx: allowed,
      min_qty: minQty,
      is_qty_fail: false,
      is_interval_fail: true,
      interval_prev_date: prevDate,
      interval_days_diff: daysDiff,
      interval_rule_info: ruleInfo,
      cinnamon_prev_date: prevDate,
      cinnamon_days_diff: daysDiff,
      audit_reason: isDxPass
        ? `${pttypeLabel}: ${drugName} ตัดการจ่าย ${minDays} วัน (ได้รับยาครั้งก่อนหน้าเมื่อ ${prevDate} ห่างกันเพียง ${daysDiff} วัน ยังไม่ครบ ${minDays} วัน)`
        : `${failDxReason} และ${pttypeLabel} ${drugName} ได้รับยาครั้งก่อนหน้าห่างกันเพียง ${daysDiff} วัน (ไม่ครบ ${minDays} วัน)`,
    }
  }

  if (isDxPass) {
    const exemptNotice = isPttypeExempt && minQty > 0 && qty < minQty
      ? ` [เกณฑ์ขั้นต่ำใช้เฉพาะสิทธิ UC ไม่ตรวจสิทธิ: ${row.pttype_name}]`
      : ''
    const reasonText = isThaiMed
      ? `ผ่านเกณฑ์แพทย์แผนไทย: พบรหัสแผนปัจจุบัน (${matchedModern.join(', ')}) ควบคู่กับรหัสแพทย์แผนไทย (${matchedU.join(', ')})${exemptNotice}`
      : `พบ DX แผนปัจจุบันที่ตรงกับเกณฑ์ของยา (${matchedModern.join(', ')})${exemptNotice}`

    return {
      audit_result: 'PASS',
      matched_dx: matchedList,
      allowed_dx: allowed,
      min_qty: minQty,
      is_qty_fail: false,
      audit_reason: reasonText,
    }
  }

  return {
    audit_result: 'FAIL',
    matched_dx: matchedList,
    allowed_dx: allowed,
    min_qty: minQty,
    is_qty_fail: false,
    audit_reason: failDxReason,
  }
}

