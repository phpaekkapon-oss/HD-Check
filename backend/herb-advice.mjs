// Rule-based explanation of a herbal-drug audit row (no DB access, unit-testable).
// Tells staff what is missing, what was probably keyed wrong, and where to fix it in HOSxP.
import { normalizeIcdCode } from './config.mjs'
import { isThaiMedRow } from './audit-rules.mjs'

const VALID_ICD_RE = /^[A-Z]\d{2,6}$/

/** true when a and b (same length) differ by one character or one adjacent swap */
function isNearMiss(a, b) {
  if (a.length !== b.length || a === b) return false
  const diff = []
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i)
  if (diff.length === 1) return true
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]
}

export function analyzeHerbRecord(record, allowedRaw = [], indication = '') {
  const vn = String(record.vn ?? '')
  const isIpd = vn.startsWith('AN:')
  const an = isIpd ? vn.slice(3) : ''
  const isThaiMed = isThaiMedRow(record)
  const allowed = allowedRaw.map(normalizeIcdCode).filter(Boolean)
  const modernAllowed = allowed.filter((p) => !p.startsWith('U'))
  const uAllowed = allowed.filter((p) => p.startsWith('U'))
  const effectiveModern = modernAllowed.length > 0 ? modernAllowed : allowed
  const dx = [...new Set([record.pdx, record.dx0, record.dx1, record.dx2, record.dx3, record.dx4, record.dx5]
    .map(normalizeIcdCode).filter(Boolean))]
  const uDx = dx.filter((c) => c.startsWith('U'))
  const modernDx = dx.filter((c) => !c.startsWith('U'))
  const matchedModern = modernDx.filter((c) => effectiveModern.some((p) => c.startsWith(p)))
  // เฉพาะรหัส U เจาะจง (เช่น U6984) ไม่นับเกณฑ์กว้าง "U" ที่ครอบทุกรหัส
  const drugSpecificU = uDx.filter((c) => uAllowed.some((p) => p.length > 1 && c.startsWith(p)))
  const units = record.drug_units ? ` ${record.drug_units}` : ''
  const drug = record.drug_name || 'ยานี้'

  const diagLoc = isIpd
    ? `HOSxP → ระบบผู้ป่วยใน (IPD) → AN ${an} → หน้าสรุปการวินิจฉัย / ลงรหัสโรค (ICD-10)`
    : `HOSxP → ห้องตรวจแพทย์ / ระบบงานแพทย์แผนไทย → VN ${vn} (วันที่ ${record.visit_date ?? '-'}) → หน้าวินิจฉัย (Diagnosis)`
  const orderLoc = isIpd
    ? `HOSxP → ระบบผู้ป่วยใน (IPD) → AN ${an} → รายการสั่งยา`
    : `HOSxP → VN ${vn} → รายการสั่งยา / ค่าใช้จ่าย`

  const missing = []
  const keyErrors = []
  const hosxpSteps = []
  const cautions = []
  let summary = ''

  // รูปแบบรหัสผิด เช่น พิมพ์ตัว O แทนเลข 0 (ตรวจทุกผลลัพธ์ เพราะรหัสผิดรูปแบบจะไม่มีวันตรงเกณฑ์)
  for (const c of dx) {
    if (!VALID_ICD_RE.test(c)) {
      keyErrors.push(`รหัส ${c} รูปแบบไม่ถูกต้อง (หลังตัวอักษรตัวแรกต้องเป็นตัวเลขทั้งหมด) อาจพิมพ์ตัว O แทนเลข 0 หรือพิมพ์ตัวอักษรเกิน`)
    }
  }

  switch (record.audit_result) {
    case 'PASS':
      summary = `ผ่านเกณฑ์: พบรหัส ${(record.matched_dx ?? []).join(', ') || matchedModern.join(', ')} ตรงกับข้อบ่งใช้ของ${drug}`
      break

    case 'NO_DX':
      summary = isIpd
        ? `AN ${an} ยังไม่มีรหัสวินิจฉัยเลย (อาจยังไม่ได้สรุปเวชระเบียน/ลงรหัสโรค)`
        : `VN นี้ยังไม่มีรหัสวินิจฉัย (PDX/DX ว่าง)`
      missing.push(`รหัสวินิจฉัยหลัก (PDX) — สำหรับ${drug} ควรเป็นรหัสขึ้นต้นด้วย ${effectiveModern.join(', ') || '(ยังไม่ตั้งเกณฑ์)'}`)
      if (isThaiMed) missing.push(`รหัสแพทย์แผนไทย (U...)${uAllowed.length ? ` เช่น ${uAllowed.join(', ')}` : ''}`)
      hosxpSteps.push(`เปิด ${diagLoc}`)
      hosxpSteps.push('บันทึกรหัสวินิจฉัยตามอาการที่สั่งยา แล้วกดบันทึก')
      if (isIpd) cautions.push('ผู้ป่วยในที่ยัง Admit อยู่หรือยังไม่สรุปชาร์ต จะยังไม่มีรหัสวินิจฉัย ให้ตรวจซ้ำหลังสรุปเวชระเบียน')
      break

    case 'NO_MAP':
      summary = `${drug} ยังไม่ได้ตั้งเกณฑ์รหัส ICD-10 ในระบบนี้ จึงยังตรวจไม่ได้`
      hosxpSteps.push('ไม่ต้องแก้ใน HOSxP — ไปที่เมนู "ตั้งค่ายา ↔ ICD-10" ในระบบนี้ แล้วกำหนดรหัส ICD ที่ใช้คู่กับยานี้')
      break

    default: {
      // FAIL: รอบการจ่าย / จำนวนขั้นต่ำ / DX ไม่ตรง (อาจเกิดพร้อมกันหลายข้อ)
      const parts = []
      const isIntervalFail = Boolean(record.is_interval_fail || record.interval_fail || record.cinnamon_interval_fail)
      if (isIntervalFail) {
        const info = record.interval_rule_info || {}
        const minDays = info.min_days ?? 7
        parts.push(`จ่ายซ้ำไม่ครบ ${minDays} วัน`)
        missing.push(`ระยะห่างการจ่ายยาอย่างน้อย ${minDays} วัน (ครั้งก่อน ${record.interval_prev_date ?? record.cinnamon_prev_date ?? '-'} ห่าง ${record.interval_days_diff ?? record.cinnamon_days_diff ?? '-'} วัน)`)
        hosxpSteps.push(`ตรวจประวัติการจ่าย${drug}ของ HN ${record.hn} ใน HOSxP ว่าจ่ายซ้ำจริงหรือคีย์ซ้ำโดยไม่ตั้งใจ`)
        hosxpSteps.push(`ถ้าคีย์ซ้ำ ให้ยกเลิกรายการที่ ${orderLoc}`)
        cautions.push(`${info.pttype_label || 'สิทธินี้'} เบิก${drug}ได้เมื่อห่างจากครั้งก่อนครบ ${minDays} วัน`)
      }

      const minQty = Number(record.min_qty ?? 0)
      if (record.is_qty_fail && minQty > 0) {
        parts.push('จ่ายต่ำกว่าเกณฑ์ขั้นต่ำ')
        missing.push(`จำนวนยาอย่างน้อย ${minQty}${units} (จ่ายจริง ${record.drug_qty}${units})`)
        hosxpSteps.push(`แก้จำนวน${drug}เป็นอย่างน้อย ${minQty}${units} ที่ ${orderLoc} (หรือยืนยันว่าแพทย์ตั้งใจจ่ายน้อยกว่า)`)
      }

      const dxFail = matchedModern.length === 0 || (isThaiMed && uDx.length === 0)
      if (dxFail && dx.length > 0) {
        parts.push('รหัสวินิจฉัยไม่ตรงข้อบ่งใช้')
        if (matchedModern.length === 0) {
          missing.push(`รหัสแผนปัจจุบันที่ขึ้นต้นด้วย ${effectiveModern.join(', ')}${indication ? ` (ข้อบ่งใช้: ${indication})` : ''}`)
        }
        if (isThaiMed && uDx.length === 0) {
          missing.push(`รหัสแพทย์แผนไทย (U...) อย่างน้อย 1 รหัส${uAllowed.length ? ` เช่น ${uAllowed.join(', ')}` : ''}`)
        }

        // รหัสที่คล้ายเกณฑ์มาก (ต่างกัน 1 หลัก หรือสลับหลัก) -> น่าจะคีย์ผิด
        for (const c of modernDx) {
          for (const p of effectiveModern) {
            // ต้องอยู่หมวดเดียวกัน (ตัวอักษรแรกเหมือนกัน) เช่น K03 กับ K30 ไม่ใช่ O924 กับ N92
            if (p.length >= 3 && c[0] === p[0] && isNearMiss(c.slice(0, p.length), p)) {
              keyErrors.push(`คีย์ ${c} ใกล้เคียงกับรหัสตามเกณฑ์ ${p}… มาก (ต่างกัน 1 หลัก) ตรวจว่าตั้งใจคีย์ ${p}… หรือไม่`)
            }
          }
        }
        if (matchedModern.length === 0 && drugSpecificU.length > 0) {
          keyErrors.push(`มีรหัสแผนไทย ${drugSpecificU.join(', ')} ซึ่งตรงกับข้อบ่งใช้ของ${drug} แต่ไม่มีรหัสแผนปัจจุบันคู่กัน (${effectiveModern.join(', ')}) — น่าจะลืมคีย์รหัสแผนปัจจุบัน`)
        }
        if (matchedModern.length === 0 && drugSpecificU.length === 0) {
          cautions.push(`รหัสในเคสนี้ (${dx.join(', ')}) ไม่ตรงข้อบ่งใช้ของ${drug}เลย ตรวจว่าสั่งยาถูกตัว หรือแพทย์ลืมลงรหัสโรคที่เป็นเหตุผลการสั่งยา`)
        }

        hosxpSteps.push(`เปิด ${diagLoc}`)
        if (matchedModern.length === 0) {
          hosxpSteps.push(`เพิ่มรหัสวินิจฉัยรอง (DX) ตามอาการที่สั่ง${drug} โดยใช้รหัสที่ขึ้นต้นด้วย ${effectiveModern.slice(0, 4).join(', ')}`)
        }
        if (isThaiMed && uDx.length === 0) {
          hosxpSteps.push(`เพิ่มรหัสแพทย์แผนไทย (U...)${uAllowed.length ? ` เช่น ${uAllowed.join(', ')}` : ''}`)
        }
        hosxpSteps.push('กดบันทึก แล้วกด "ดึงข้อมูล HOSxP" ในระบบนี้อีกครั้งเพื่อตรวจซ้ำ')
      }

      summary = `${drug}: ${parts.join(' และ ') || 'ไม่ผ่านเกณฑ์'}`
      if (parts.length === 0) summary += ` — ${record.audit_reason ?? ''}`
    }
  }

  if (keyErrors.some((k) => k.includes('รูปแบบไม่ถูกต้อง'))) {
    hosxpSteps.unshift(`แก้รหัสที่รูปแบบผิดที่ ${diagLoc}`)
  }

  return {
    summary,
    isIpd,
    isThaiMed,
    dx,
    criteria: { modern: modernAllowed, u: uAllowed },
    indication,
    missing,
    keyErrors,
    hosxpSteps: [...new Set(hosxpSteps)],
    cautions,
  }
}
