// Pure herbal-drug audit rule (no DB access) so it can be unit-tested: node --test
import { MIN_QTY_EXEMPT_PTTYPES, THAI_MED_DOCTORS_REQUIRE_U, normalizeIcdCode } from './config.mjs'

export function evaluate(row, dxMap, minQtyMap) {
  const minQty = (minQtyMap ? minQtyMap.get(row.drug_icode) : 0) || 0
  const qty = Number(row.drug_qty ?? 0)

  // 1. ตรวจสอบสิทธิที่ได้รับการยกเว้นเกณฑ์การจ่ายขั้นต่ำ
  const pttype = String(row.pttype_name ?? '').trim()
  const isPttypeExempt = MIN_QTY_EXEMPT_PTTYPES.some((kw) => pttype.includes(kw))
  const isQtyFail = !isPttypeExempt && minQty > 0 && qty < minQty
  const units = row.drug_units ? ` ${row.drug_units}` : ''

  const dxList = [row.pdx, row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5]
    .map(normalizeIcdCode)
    .filter(Boolean)
  const unique = [...new Set(dxList)]

  // 2. ตรวจสอบแพทย์แผนไทย 5 ท่านที่ต้องมีรหัสการวินิจฉัยแพทย์แผนไทย (รหัสขึ้นต้นด้วย U)
  const doctorName = String(row.doctor_name ?? '').trim()
  const isTargetThaiMedDoctor = THAI_MED_DOCTORS_REQUIRE_U.some((name) => doctorName.includes(name))
  const hasUDx = unique.some((dx) => dx.startsWith('U'))

  if (unique.length === 0) {
    return {
      audit_result: 'NO_DX',
      matched_dx: [],
      allowed_dx: [],
      min_qty: minQty,
      is_qty_fail: isQtyFail,
      audit_reason: isQtyFail
        ? `ไม่มีรหัสวินิจฉัย (PDX/DX ว่าง) และจ่ายต่ำกว่าเกณฑ์ขั้นต่ำ (${qty}/${minQty}${units})`
        : 'ไม่มีรหัสวินิจฉัย (PDX/DX ว่าง)',
    }
  }

  const allowed = dxMap.get(row.drug_icode) ?? []
  const matched = unique.filter((dx) => allowed.some((p) => dx.startsWith(normalizeIcdCode(p))))

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

  // หากเป็นแพทย์แผนไทย 5 ท่านนี้ ต้องมีรหัสวินิจฉัยแผนไทย (รหัส U เช่น U57.., U66..) ร่วมด้วยเสมอ
  if (isTargetThaiMedDoctor && !hasUDx) {
    return {
      audit_result: 'FAIL',
      matched_dx: matched,
      allowed_dx: allowed,
      min_qty: minQty,
      is_qty_fail: isQtyFail,
      audit_reason: `แพทย์แผนไทย (${doctorName}) สั่งจ่ายยา ต้องระบุรหัสวินิจฉัยแพทย์แผนไทย (รหัสขึ้นต้นด้วย U เช่น U57, U66) ร่วมด้วย`,
    }
  }

  // หากมียาที่มีการกำหนดจ่ายขั้นต่ำ และจ่ายน้อยกว่าเกณฑ์ (เฉพาะสิทธิที่ไม่ได้รับการยกเว้น)
  if (isQtyFail) {
    return {
      audit_result: 'FAIL',
      matched_dx: matched,
      allowed_dx: allowed,
      min_qty: minQty,
      is_qty_fail: true,
      audit_reason: matched.length > 0
        ? `จ่ายต่ำกว่าเกณฑ์ขั้นต่ำ (จ่าย ${qty}${units}, เกณฑ์กำหนดขั้นต่ำ ${minQty}${units}) เบิกเคลมไม่ผ่าน`
        : `ไม่พบ DX ที่ตรงกับเกณฑ์ และจ่ายต่ำกว่าเกณฑ์ขั้นต่ำ (จ่าย ${qty}${units}, เกณฑ์ขั้นต่ำ ${minQty}${units}) เบิกเคลมไม่ผ่าน`,
    }
  }

  if (matched.length > 0) {
    const exemptNotice = isPttypeExempt && minQty > 0 && qty < minQty
      ? ` [ยกเว้นเกณฑ์ขั้นต่ำสำหรับสิทธิ: ${pttype}]`
      : ''
    return {
      audit_result: 'PASS',
      matched_dx: matched,
      allowed_dx: allowed,
      min_qty: minQty,
      is_qty_fail: false,
      audit_reason: `พบ DX ที่ตรงกับเกณฑ์ของยาที่ตั้งไว้${exemptNotice}`,
    }
  }

  return {
    audit_result: 'FAIL',
    matched_dx: [],
    allowed_dx: allowed,
    min_qty: minQty,
    is_qty_fail: false,
    audit_reason: `ไม่พบ DX ที่ตรงกับเกณฑ์ของยาที่ตั้งไว้ (พบ ${unique.join(', ')}; เกณฑ์ ${allowed.join(', ')})`,
  }
}
