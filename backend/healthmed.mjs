import { normalizeIcdCode } from './config.mjs'

/**
 * รหัสค่าบริการทางการแพทย์แผนไทยที่เกี่ยวข้อง
 * 58101 = ค่านวดเพื่อการบำบัดรักษาโรค (200.-)
 * 58130 = ค่านวดและประคบสมุนไพรเพื่อการบำบัดรักษาโรค (250.-)
 * 58131 = ค่านวดและประคบสมุนไพรเพื่อการฟื้นฟูสมรรถภาพ (250.-)
 * 58220 = ค่าทับหม้อเกลือเพื่อการฟื้นฟูมารดาหลังคลอด (300.-)
 * 58301 = ค่าอบไอน้ำสมุนไพรบำบัดรักษาโรคและ/หรือฟื้นฟูโรค (120.-)
 */
export const THAI_MED_SERVICE_CODES = ['58101', '58130', '58131', '58220', '58301']

/**
 * SQL สำหรับดึงข้อมูลการรับบริการแพทย์แผนไทย ทั้งหัตถการและค่าบริการ
 */
export const HEALTH_MED_AUDIT_SQL = `
  SELECT 
      o.vn,
      o.hn,
      o.vstdate AS visit_date,
      o.vsttime AS visit_time,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS patient_name,
      TIMESTAMPDIFF(YEAR, pt.birthday, o.vstdate) AS age_y,
      ps.name AS pttype_name,
      ps.pttype,
      o.doctor AS doctor_code,
      doc.name AS doctor_name,
      sp.name AS department_name,
      ov.pdx,
      ov.dx0, ov.dx1, ov.dx2, ov.dx3, ov.dx4, ov.dx5,
      -- รวบรวมรายการค่าบริการแพทย์แผนไทยใน visit นี้
      GROUP_CONCAT(DISTINCT CONCAT(IFNULL(d.did, IFNULL(d.nhso_adp_code, d.icode)), ':', d.name, ':', op.qty, ':', op.unitprice) SEPARATOR '||') AS service_items_raw,
      GROUP_CONCAT(DISTINCT IFNULL(d.did, IFNULL(d.nhso_adp_code, d.icode))) AS service_codes,
      COUNT(CASE WHEN IFNULL(d.did, IFNULL(d.nhso_adp_code, d.icode)) = '58130' THEN 1 END) AS count_58130,
      COUNT(CASE WHEN IFNULL(d.did, IFNULL(d.nhso_adp_code, d.icode)) = '58101' THEN 1 END) AS count_58101,
      COUNT(CASE WHEN IFNULL(d.did, IFNULL(d.nhso_adp_code, d.icode)) = '58301' THEN 1 END) AS count_58301,
      COUNT(CASE WHEN IFNULL(d.did, IFNULL(d.nhso_adp_code, d.icode)) = '58220' THEN 1 END) AS count_58220,
      COUNT(CASE WHEN IFNULL(d.did, IFNULL(d.nhso_adp_code, d.icode)) = '58131' THEN 1 END) AS count_58131
  FROM ovst o
  INNER JOIN vn_stat ov ON o.vn = ov.vn
  INNER JOIN patient pt ON o.hn = pt.hn
  INNER JOIN opitemrece op ON o.vn = op.vn
  INNER JOIN drugitems d ON op.icode = d.icode
  LEFT JOIN pttype ps ON o.pttype = ps.pttype
  LEFT JOIN spclty sp ON o.spclty = sp.spclty
  LEFT JOIN doctor doc ON o.doctor = doc.code
  WHERE o.vstdate BETWEEN ? AND ?
    AND (
      -- เฉพาะ visit ที่มีรายการค่าบริการแพทย์แผนไทย หรือแผนกแพทย์แผนไทย
      (sp.name LIKE '%แพทย์แผนไทย%' OR sp.spclty = '16')
      OR IFNULL(d.did, IFNULL(d.nhso_adp_code, d.icode)) IN ('58101', '58130', '58131', '58220', '58301')
      OR d.name LIKE '%ค่านวด%'
      OR d.name LIKE '%ค่าประคบ%'
      OR d.name LIKE '%ค่าทับหม้อเกลือ%'
      OR d.name LIKE '%ค่าอบไอน้ำ%'
    )
  GROUP BY o.vn, o.hn, o.vstdate, o.vsttime, pt.pname, pt.fname, pt.lname, pt.birthday,
           ps.name, ps.pttype, o.doctor, doc.name, sp.name, ov.pdx, ov.dx0, ov.dx1, ov.dx2, ov.dx3, ov.dx4, ov.dx5
  ORDER BY o.vstdate DESC, o.vsttime DESC
`

/**
 * ประเมินผลการให้บริการแพทย์แผนไทยตามเกณฑ์ 5 งาน + กฎซ้ำซ้อน + ปิดสิทธิ์ EP
 */
export function evaluateHealthMedAudit(row) {
  const dxList = [row.pdx, row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5]
    .map(normalizeIcdCode)
    .filter(Boolean)
  const uniqueDx = [...new Set(dxList)]
  const age = Number(row.age_y ?? 0)
  const pttypeName = String(row.pttype_name ?? '')
  const isUc = pttypeName.includes('ประกันสุขภาพ') || pttypeName.includes('บัตรทอง') || pttypeName.includes('UC') || String(row.pttype ?? '').startsWith('U')

  const count58130 = Number(row.count_58130 ?? 0)
  const count58101 = Number(row.count_58101 ?? 0)
  const count58301 = Number(row.count_58301 ?? 0)
  const count58220 = Number(row.count_58220 ?? 0)
  const count58131 = Number(row.count_58131 ?? 0)

  const rawServices = String(row.service_items_raw ?? '')
  const serviceCodes = String(row.service_codes ?? '').split(',').map((s) => s.trim())

  const failures = []
  const passes = []

  // -------------------------------------------------------------
  // กฎข้อที่ 1: ตรวจสอบการคิดค่าบริการซ้ำซ้อน (Duplicate Billing)
  // -------------------------------------------------------------
  if (count58130 >= 2) {
    failures.push('ค่านวดและประคบ (58130) ซ้ำกัน 2 ครั้งในครั้งเดียว')
  }
  if (count58101 >= 2) {
    failures.push('ค่านวดเพื่อการบำบัดรักษาโรค (58101) ซ้ำกัน 2 ครั้งในครั้งเดียว')
  }
  if (count58130 >= 1 && count58101 >= 1) {
    failures.push('คิดทั้งค่านวดและประคบ (58130) และค่านวดเดี่ยว (58101) ซ้ำซ้อนกัน')
  }

  // -------------------------------------------------------------
  // กฎข้อที่ 2: ตรวจสอบรหัสปิดสิทธิ์ EP... (เฉพาะสิทธิ UC)
  // -------------------------------------------------------------
  const hasEpCloseCode = uniqueDx.some((dx) => dx.startsWith('EP')) || rawServices.includes('EP')
  if (isUc && hasEpCloseCode) {
    failures.push('พบรหัสปิดสิทธิ (EP...) ในผู้ป่วยสิทธิ UC ไม่ผ่านการเคลม')
  }

  // -------------------------------------------------------------
  // กฎข้อที่ 3: งานที่ 1 & 2 — โรคข้อเข่าเสื่อม / พอกเข่า (M179 + U5753 และอายุ 40 ปีขึ้นไป)
  // -------------------------------------------------------------
  const hasM179 = uniqueDx.includes('M179')
  const hasU5753 = uniqueDx.includes('U5753')
  const isKneeProcedure = count58101 > 0 || count58130 > 0

  if (hasM179 || hasU5753) {
    if (!hasM179 || !hasU5753) {
      failures.push('โรคข้อเข่าเสื่อม/พอกเข่า ต้องจับคู่รหัสทั้ง M179 และ U5753 ร่วมกัน')
    }
    if (age < 40) {
      failures.push(`เกณฑ์การพอกเข่า/ข้อเข่าเสื่อม ต้องมีอายุ 40 ปีขึ้นไป (ปัจจุบันอายุ ${age} ปี)`)
    }
    if (hasM179 && hasU5753 && age >= 40 && isKneeProcedure) {
      passes.push('งานที่ 1-2: ครบคู่ M179 + U5753 และอายุ 40 ปีขึ้นไป')
    }
  }

  // -------------------------------------------------------------
  // กฎข้อที่ 4: งานที่ 5 — บริบาลหญิงหลังคลอด (M6260 + U506 + รหัสคลอด)
  // ค่าบริการ: 58220 (ทับหม้อเกลือ), 58131 (นวดประคบหลังคลอด), 58301 (อบไอน้ำ)
  // -------------------------------------------------------------
  const isPostpartumService = count58220 > 0 || count58131 > 0 || (count58301 > 0 && uniqueDx.includes('U506'))
  const hasM6260 = uniqueDx.includes('M6260')
  const hasU506 = uniqueDx.includes('U506')
  const hasDeliveryCode = uniqueDx.some((dx) => dx.startsWith('O8') || dx.startsWith('Z39'))

  if (isPostpartumService || hasM6260 || hasU506) {
    if (!hasM6260) failures.push('บริบาลหญิงหลังคลอด ขาดรหัส M6260')
    if (!hasU506) failures.push('บริบาลหญิงหลังคลอด ขาดรหัส U506')
    if (!hasDeliveryCode) failures.push('บริบาลหญิงหลังคลอด ต้องมีรหัสการคลอด (กลุ่ม O หรือ Z39)')
    if (hasM6260 && hasU506 && hasDeliveryCode) {
      passes.push('งานที่ 5: ครบคู่ M6260 + U506 + รหัสคลอดบุตร')
    }
  }

  // -------------------------------------------------------------
  // กฎข้อที่ 5: งานที่ 3 — งานนวด/ประคบทั่วไป ต้องมีทั้ง M... และ U...
  // -------------------------------------------------------------
  const hasAnyM = uniqueDx.some((dx) => dx.startsWith('M'))
  const hasAnyU = uniqueDx.some((dx) => dx.startsWith('U'))
  if ((count58101 > 0 || count58130 > 0) && !hasM179 && !isPostpartumService) {
    if (!hasAnyM) failures.push('ค่านวด/ประคบ ต้องมีรหัสวินิจฉัยโรคกล้ามเนื้อ (รหัส M...)')
    if (!hasAnyU) failures.push('ค่านวด/ประคบ ต้องมีรหัสวินิจฉัยแพทย์แผนไทย (รหัส U...) ร่วมด้วย')
    if (hasAnyM && hasAnyU) {
      passes.push('งานที่ 3: จับคู่รหัส M... และ U... ถูกต้อง')
    }
  }

  // -------------------------------------------------------------
  // สรุปผลการประเมิน
  // -------------------------------------------------------------
  const auditResult = failures.length > 0 ? 'FAIL' : 'PASS'
  const auditReason = failures.length > 0 ? failures.join(' • ') : passes.length > 0 ? passes.join(' • ') : 'ผ่านตามเกณฑ์มาตรฐาน'

  return {
    audit_result: auditResult,
    failures,
    passes,
    audit_reason: auditReason,
    has_m179: hasM179,
    has_u5753: hasU5753,
    age,
    service_items_count: {
      count_58101: count58101,
      count_58130: count58130,
      count_58131: count58131,
      count_58220: count58220,
      count_58301: count58301,
    },
  }
}
