import { normalizeIcdCode } from './config.mjs'

/**
 * รหัสค่าบริการทางการแพทย์แผนไทยที่เกี่ยวข้อง (nondrugitems)
 * 58101 = ค่านวดเพื่อการบำบัดรักษาโรค (200.-)
 * 58130 = ค่านวดและประคบสมุนไพรเพื่อการบำบัดรักษาโรค (250.-)
 * 58131 = ค่านวดและประคบสมุนไพรเพื่อการฟื้นฟูสมรรถภาพ (250.-)
 * 58220 = ค่าทับหม้อเกลือเพื่อการฟื้นฟูมารดาหลังคลอด (300.-)
 * 58301 = ค่าอบไอน้ำสมุนไพรบำบัดรักษาโรคและ/หรือฟื้นฟูโรค (120.-)
 */
export const THAI_MED_SERVICE_CODES = ['58101', '58130', '58131', '58220', '58301']

/**
 * รหัสหัตถการแพทย์แผนไทย (ICD-10-TM) ตามเกณฑ์ตรวจ:
 * 1. พอกเข่า (M179 + U5753 อายุ >= 40 ปี) ต้องครบ 4 รหัส
 */
export const REQUIRED_KNEE_OPS = ['872-78-11', '873-78-11', '874-78-11', '873-78-35']

/**
 * 2. บริบาลหญิงหลังคลอด (M6260 + U506) ต้องครบ 5 รหัส + วันคลอดในบัญชี 2
 */
export const REQUIRED_POSTPARTUM_OPS = ['900-77-12', '900-77-13', '900-77-14', '900-77-16', '900-77-30']

/**
 * 3. หัตถการสำหรับโรคกล้ามเนื้ออื่นๆ (M... + U... หรือ M6260 + U อื่นๆ)
 */
export const ALLOWED_MUSCLE_OPS = [
  '872-78-11',
  '873-78-11',
  '874-78-11',
  '873-78-35',
  '900-78-11',
  '900-78-20',
  '900-78-00',
]

/**
 * ฟังก์ชัน normalize รหัสหัตถการ (ตัดขีดและช่องว่างออกเพื่อเทียบเคียงได้อย่างแม่นยำ)
 */
export function normalizeOpCode(code) {
  return String(code ?? '').replace(/[^0-9a-zA-Z]/g, '').trim().toUpperCase()
}

/**
 * SQL สำหรับดึงข้อมูลการรับบริการแพทย์แผนไทย (เฉพาะค่าบริการ/หัตถการ ไม่รวมรายการยาสมุนไพร)
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
      ps.hipdata_code AS pttype_hipdata,
      o.doctor AS doctor_code,
      doc.name AS doctor_name,
      sp.name AS department_name,
      ov.pdx,
      ov.dx0, ov.dx1, ov.dx2, ov.dx3, ov.dx4, ov.dx5,
      -- เลขปิดสิทธิจริงจากตารางยืนยันการปิดสิทธิ (nhso_confirm_privilege)
      (
        SELECT MAX(NULLIF(TRIM(ncp.nhso_authen_code), ''))
        FROM nhso_confirm_privilege ncp
        WHERE ncp.vn = o.vn
          AND IFNULL(ncp.nhso_status, 'Y') != 'C'
      ) AS ep_code,
      -- เลข Authen / เลขปิดสิทธิใน visit_pttype
      COALESCE(
        (
          SELECT MAX(
            COALESCE(
              NULLIF(TRIM(vp.auth_code), ''),
              CASE WHEN vp.claim_code NOT LIKE 'PG%' THEN NULLIF(TRIM(vp.claim_code), '') ELSE NULL END
            )
          )
          FROM visit_pttype vp
          WHERE vp.vn = o.vn
        ),
        NULLIF(TRIM(o.anonymous_vn), ''),
        ''
      ) AS claim_code,
      -- รวบรวมรายการค่าบริการแพทย์แผนไทย (เฉพาะ nondrugitems / ค่าบริการ ไม่เอารหัสยา)
      GROUP_CONCAT(DISTINCT CONCAT(COALESCE(nd.nhso_adp_code, nd.icode), ':', COALESCE(nd.name, ''), ':', op.qty, ':', op.unitprice) SEPARATOR '||') AS service_items_raw,
      GROUP_CONCAT(DISTINCT COALESCE(nd.nhso_adp_code, nd.icode)) AS service_codes,
      -- รวมจำนวนครั้งค่าบริการ
      SUM(CASE WHEN COALESCE(nd.nhso_adp_code, nd.icode) IN ('58130', '58131') OR nd.name LIKE '%นวดและประคบ%' OR nd.name LIKE '%นวดประคบ%' THEN IFNULL(op.qty, 1) ELSE 0 END) AS count_58130,
      SUM(CASE WHEN (COALESCE(nd.nhso_adp_code, nd.icode) IN ('58101', '58102') OR nd.name LIKE '%ค่านวด%') AND nd.name NOT LIKE '%ประคบ%' THEN IFNULL(op.qty, 1) ELSE 0 END) AS count_58101,
      SUM(CASE WHEN (COALESCE(nd.nhso_adp_code, nd.icode) = '58201' OR (nd.name LIKE '%ประคบ%' AND nd.name NOT LIKE '%ความร้อน%' AND nd.name NOT LIKE '%ประคบร้อน%' AND nd.name NOT LIKE '%ประคบเย็น%' AND nd.name NOT LIKE '%กายภาพ%')) AND nd.name NOT LIKE '%นวด%' THEN IFNULL(op.qty, 1) ELSE 0 END) AS count_compress,
      SUM(CASE WHEN COALESCE(nd.nhso_adp_code, nd.icode) = '58301' OR COALESCE(nd.name, '') LIKE '%อบไอน้ำ%' OR COALESCE(nd.name, '') LIKE '%อบสมุนไพร%' THEN IFNULL(op.qty, 1) ELSE 0 END) AS count_58301,
      SUM(CASE WHEN COALESCE(nd.nhso_adp_code, nd.icode) = '58220' OR COALESCE(nd.name, '') LIKE '%ค่าทับหม้อเกลือ%' THEN IFNULL(op.qty, 1) ELSE 0 END) AS count_58220,
      SUM(CASE WHEN COALESCE(nd.nhso_adp_code, nd.icode) = '58131' OR COALESCE(nd.name, '') LIKE '%ค่านวดและประคบ%ฟื้นฟู%' THEN IFNULL(op.qty, 1) ELSE 0 END) AS count_58131
  FROM ovst o
  INNER JOIN vn_stat ov ON o.vn = ov.vn
  INNER JOIN patient pt ON o.hn = pt.hn
  LEFT JOIN health_med_service hms ON hms.vn = o.vn
  LEFT JOIN opitemrece op ON o.vn = op.vn
  LEFT JOIN nondrugitems nd ON op.icode = nd.icode 
      AND (
        COALESCE(nd.nhso_adp_code, nd.icode) IN ('58101', '58102', '58130', '58131', '58201', '58220', '58301')
        OR (nd.nhso_adp_code LIKE '58%' AND nd.nhso_adp_code NOT IN ('58001', '58002'))
        OR (nd.name LIKE '%ค่านวด%' AND nd.name NOT LIKE '%กายภาพ%')
        OR (nd.name LIKE '%ประคบ%' AND nd.name NOT LIKE '%ความร้อน%' AND nd.name NOT LIKE '%ประคบร้อน%' AND nd.name NOT LIKE '%ประคบเย็น%' AND nd.name NOT LIKE '%กายภาพ%')
        OR nd.name LIKE '%ค่าทับหม้อเกลือ%'
        OR nd.name LIKE '%ค่าอบไอน้ำ%'
        OR nd.name LIKE '%อบสมุนไพร%'
        OR nd.name LIKE '%อบไอน้ำ%'
      )
      AND COALESCE(nd.nhso_adp_code, nd.icode) NOT IN ('58001', '58002')
      AND nd.name NOT LIKE '%ฝังเข็ม%'
  LEFT JOIN pttype ps ON o.pttype = ps.pttype
  LEFT JOIN spclty sp ON o.spclty = sp.spclty
  LEFT JOIN doctor doc ON o.doctor = doc.code
  WHERE o.vstdate BETWEEN ? AND ?
    AND (
      hms.vn IS NOT NULL
      OR nd.icode IS NOT NULL
    )
  GROUP BY o.vn, o.hn, o.vstdate, o.vsttime, pt.pname, pt.fname, pt.lname, pt.birthday,
           ps.name, ps.pttype, ps.hipdata_code, o.doctor, doc.name, sp.name, ov.pdx, ov.dx0, ov.dx1, ov.dx2, ov.dx3, ov.dx4, ov.dx5,
           o.anonymous_vn
  ORDER BY o.vstdate DESC, o.vsttime DESC
`

/**
 * ประเมินผลการให้บริการแพทย์แผนไทยตามเกณฑ์ปรับปรุงใหม่:
 * 1. M179 + U5753 อายุ >= 40 ปี จับคู่ (872-78-11, 873-78-11, 874-78-11, 873-78-35) ถ้าไม่ครบ 4 รหัส ไม่ผ่าน
 *    (เฉพาะสิทธิ UC ที่ลงรหัสพอกเข่าอย่างน้อย 1 รหัส; นวดอย่างเดียว/สิทธิอื่นตรวจด้วยข้อ 2)
 * 2. เอาเฉพาะ รหัส M... U... ที่มีรหัส หัตถการ 872-78-11, 873-78-11, 874-78-11, 873-78-35, 900-78-11, 900-78-20, 900-78-00 ร่วมด้วยเท่านั้น
 * 3. ไม่เอายาสมุนไพร/รหัสยาเข้ามาตรวจในระบบหัตถการ
 * 4. M6260 + U506 เท่านั้น จับคู่กับ 900-77-12, 900-77-13, 900-77-14, 900-77-16, 900-77-30 ไม่ครบ 5 รหัส ไม่ผ่าน
 *    เชื่อมกับ วันคลอด ในระบบงานบัญชี 2 ถ้าไม่มีวันคลอด ไม่ผ่าน
 * 5. รหัส M6260 + U อื่นๆ จับคู่หัตถการ 872-78-11, 873-78-11, 874-78-11, 873-78-35, 900-78-11, 900-78-20, 900-78-00 ถือว่าเป็น โรคกล้ามเนื้ออื่นๆ ผ่านเกณฑ์
 * 6. ตรวจสอบคิดค่าบริการซ้ำซ้อน:
 *    - ค่านวดและประคบ, ค่านวด, ค่าประคบ (3 ค่านี้ถ้าอยู่ด้วยกันไม่ผ่าน)
 *    - ค่านวดและประคบ 2 ครั้งไม่ผ่าน
 */
export function evaluateHealthMedAudit(row, duplicateRuleConfig = null) {
  const dxList = [
    row.pdx, row.dx0, row.dx1, row.dx2, row.dx3, row.dx4, row.dx5,
    ...(Array.isArray(row.all_dx) ? row.all_dx : []),
  ]
    .map(normalizeIcdCode)
    .filter(Boolean)
  const uniqueDx = [...new Set(dxList)]
  const age = Number(row.age_y ?? 0)
  const pttypeName = String(row.pttype_name ?? '')
  const hipdata = String(row.pttype_hipdata ?? '').trim().toUpperCase()

  // สิทธิที่ไม่ใช่ UC ชัดเจน (ข้าราชการ/เบิกตรง/ประกันสังคม/อปท.)
  const nonUcKeywords = ['กรมบัญชีกลาง', 'เบิกจ่ายตรง', 'เบิกตรง', 'ประกันสังคม', 'อปท', 'ข้าราชการ', 'ครูเอกชน', 'ต่างด้าว']
  const isExplicitNonUc =
    ['OFC', 'LGO', 'SSS', 'BKK', 'CSH', 'PVT', 'BMT', 'OFE', 'A2', 'AL', 'NRD'].includes(hipdata) ||
    nonUcKeywords.some((kw) => pttypeName.includes(kw))

  // สิทธิ UC ทุกประเภทย่อย (ผู้สูงอายุ, อสม., ผู้พิการ, บัตรทอง, 30บาท ฯลฯ)
  const isUc =
    !isExplicitNonUc &&
    (hipdata === 'UCS' ||
      pttypeName.includes('ประกันสุขภาพ') ||
      pttypeName.includes('บัตรทอง') ||
      pttypeName.includes('UC') ||
      pttypeName.includes('30บาท') ||
      pttypeName.includes('ผู้สูงอายุ') ||
      pttypeName.includes('ผู้มีรายได้น้อย') ||
      pttypeName.includes('ผู้พิการ') ||
      pttypeName.includes('อาสาสมัครสาธารณสุข') ||
      pttypeName.includes('อสม'))

  const count58130 = Number(row.count_58130 ?? row.count_both ?? 0)
  const count58101 = Number(row.count_58101 ?? row.count_massage ?? 0)
  const countCompress = Number(row.count_compress ?? row.count_58201 ?? 0)
  const count58301 = Number(row.count_58301 ?? 0)
  const count58220 = Number(row.count_58220 ?? 0)
  const count58131 = Number(row.count_58131 ?? 0)

  const rawServices = String(row.service_items_raw ?? '')

  // Fallback checks from raw services string if count columns did not capture
  const hasBothFromRaw = rawServices.includes('58130') || rawServices.includes('58131') || rawServices.includes('นวดและประคบ') || rawServices.includes('นวดประคบ')
  const hasMassageFromRaw = (rawServices.includes('58101') || rawServices.includes('58102') || rawServices.includes('ค่านวด')) && !rawServices.includes('นวดและประคบ')
  const hasCompressFromRaw = (rawServices.includes('58201') || (rawServices.includes('ประคบ') && !rawServices.includes('ความร้อน') && !rawServices.includes('ประคบร้อน') && !rawServices.includes('กายภาพ'))) && !rawServices.includes('นวดและประคบ')
  const hasSteamFromRaw = rawServices.includes('58301') || rawServices.includes('อบไอน้ำ') || rawServices.includes('อบสมุนไพร')

  const effectiveCountBoth = Math.max(count58130, hasBothFromRaw ? 1 : 0)
  const effectiveCountMassage = Math.max(count58101, hasMassageFromRaw ? 1 : 0)
  const effectiveCountCompress = Math.max(countCompress, hasCompressFromRaw ? 1 : 0)
  const effectiveCountSteam = Math.max(count58301, hasSteamFromRaw ? 1 : 0)

  // Normalized operation codes set
  const operations = Array.isArray(row.operations) ? row.operations : []
  const opCodesList = (row.operation_codes || operations.map((op) => op.code || op)).map(String)
  const normalizedOpSet = new Set(opCodesList.map(normalizeOpCode))

  const failures = []
  const passes = []

  // -------------------------------------------------------------
  // กฎข้อที่ 1: ตรวจสอบการคิดค่าบริการซ้ำซ้อน (Duplicate Billing)
  // 1. ค่านวดและประคบ  2. ค่านวด  3. ค่าประคบ (3 ค่านี้อยู่ด้วยกันไม่ผ่าน)
  // 4. นวดและประคบ 2 ครั้งไม่ผ่าน
  // -------------------------------------------------------------
  const blockCoexist = duplicateRuleConfig?.block_coexist !== false
  const blockBothMultiple = duplicateRuleConfig?.block_both_multiple !== false
  const blockSingleMultiple = duplicateRuleConfig?.block_single_multiple !== false

  // 4. นวดและประคบ 2 ครั้งไม่ผ่าน
  if (blockBothMultiple && effectiveCountBoth >= 2) {
    failures.push('คิดค่าบริการซ้ำ: พบค่านวดและประคบ 2 ครั้งในครั้งเดียว (ไม่อนุญาตให้คิด 2 ครั้ง)')
  }

  // 1, 2, 3. สามค่านี้ (ค่านวดและประคบ, ค่านวด, ค่าประคบ) ถ้าอยู่ด้วยกันไม่ผ่าน
  if (blockCoexist) {
    const presentCategories = []
    if (effectiveCountBoth > 0) presentCategories.push('ค่านวดและประคบ')
    if (effectiveCountMassage > 0) presentCategories.push('ค่านวด')
    if (effectiveCountCompress > 0) presentCategories.push('ค่าประคบ')

    if (presentCategories.length >= 2) {
      failures.push(`คิดค่าบริการซ้ำ: พบ ${presentCategories.join(' ร่วมกับ ')} ในครั้งเดียวกัน (ห้ามคิดค่าบริการซ้ำซ้อนร่วมกัน)`)
    }
  }

  // นวดเดี่ยว หรือ ประคบเดี่ยว ซ้ำ 2 ครั้ง
  if (blockSingleMultiple) {
    if (effectiveCountMassage >= 2) {
      failures.push('คิดค่าบริการซ้ำ: พบค่านวดเพื่อการบำบัดรักษาโรค (58101) 2 ครั้งในครั้งเดียว')
    }
    if (effectiveCountCompress >= 2) {
      failures.push('คิดค่าบริการซ้ำ: พบค่าประคบสมุนไพรเพื่อการบำบัดรักษาโรค (58201) 2 ครั้งในครั้งเดียว')
    }
  }

  // 5. สิทธิ UC: ประคบสมุนไพร และ อบสมุนไพร ไม่ให้ทำใน visit เดียวกัน
  // เช่น [58130] ค่านวดและประคบสมุนไพร หรือ [58201] ค่าประคบสมุนไพร ร่วมกับ [58301] ค่าอบไอน้ำสมุนไพร
  const blockCompressSteamUc = duplicateRuleConfig?.block_compress_steam_uc !== false
  const serviceCodes = String(row.service_codes ?? '')
  const hasCompress =
    effectiveCountCompress > 0 ||
    effectiveCountBoth > 0 ||
    serviceCodes.includes('58130') ||
    serviceCodes.includes('58131') ||
    serviceCodes.includes('58201') ||
    opCodesList.some((c) => c.startsWith('900-78-20'))

  const hasSteam =
    effectiveCountSteam > 0 ||
    serviceCodes.includes('58301') ||
    opCodesList.some((c) => c.startsWith('900-78-3'))

  if (blockCompressSteamUc && isUc && hasCompress && hasSteam) {
    failures.push('คิดค่าบริการซ้ำ: ผู้ป่วยสิทธิ UC ห้ามทำประคบสมุนไพร (58201/58130) ร่วมกับอบสมุนไพร (58301) ใน Visit เดียวกัน (สปสช. ไม่อนุญาตให้เบิกจ่ายร่วมกัน)')
  }

  // -------------------------------------------------------------
  // กฎข้อที่ 2: ตรวจสอบรหัสปิดสิทธิ์ EP... (เฉพาะสิทธิ UC)
  // -------------------------------------------------------------
  const hasEpCloseCode = uniqueDx.some((dx) => dx.startsWith('EP')) || rawServices.includes('EP')
  if (isUc && hasEpCloseCode) {
    failures.push('พบรหัสปิดสิทธิ (EP...) ในผู้ป่วยสิทธิ UC ไม่ผ่านการเคลม')
  }

  // -------------------------------------------------------------
  // กฎข้อที่ 3 (ข้อ 1 จากผู้ใช้): M179 + U5753 อายุ 40 ปีขึ้นไป จับคู่ 4 รหัสหัตถการ
  // ( 872-78-11, 873-78-11, 874-78-11, 873-78-35 ) ถ้าไม่ครบ 4 รหัส ไม่ผ่าน
  // -------------------------------------------------------------
  const hasM179 = uniqueDx.includes('M179')
  const hasU5753 = uniqueDx.includes('U5753')
  const hasAnyKneeOp = REQUIRED_KNEE_OPS.some((req) => normalizedOpSet.has(normalizeOpCode(req)))

  // ใช้เกณฑ์พอกเข่าเฉพาะสิทธิ UC ที่ลงรหัสพอกเข่าอย่างน้อย 1 ใน 4 รหัส
  // เคสนวดอย่างเดียว หรือสิทธิอื่น (ข้าราชการ, ประกันสังคม ฯลฯ) ตรวจด้วยเกณฑ์โรคกล้ามเนื้อทั่วไป (M + U + หัตถการ)
  const isKneeCase = hasAnyKneeOp && isUc
  if (isKneeCase) {
    if (!hasM179 || !hasU5753) {
      failures.push('โรคข้อเข่าเสื่อม/พอกเข่า ต้องจับคู่รหัสทั้ง M179 และ U5753 ร่วมกัน')
    }
    if (age < 40) {
      failures.push(`เกณฑ์การพอกเข่า/ข้อเข่าเสื่อม ต้องมีอายุ 40 ปีขึ้นไป (ปัจจุบันอายุ ${age} ปี)`)
    }
    const missingKneeOps = REQUIRED_KNEE_OPS.filter((req) => !normalizedOpSet.has(normalizeOpCode(req)))
    if (missingKneeOps.length > 0) {
      failures.push(`พอกเข่า (M179+U5753) ต้องมีรหัสหัตถการครบทั้ง 4 รหัส (872-78-11, 873-78-11, 874-78-11, 873-78-35) ขาดรหัส: ${missingKneeOps.join(', ')}`)
    }
    if (hasM179 && hasU5753 && age >= 40 && missingKneeOps.length === 0) {
      passes.push('งานพอกเข่า: ครบคู่ M179 + U5753, อายุ 40 ปีขึ้นไป และครบทั้ง 4 รหัสหัตถการ')
    }
  }

  // -------------------------------------------------------------
  // กฎข้อที่ 4 (ข้อ 4 & 5 จากผู้ใช้):
  // 4. M6260 + U506 เท่านั้น จับคู่กับ 900-77-12, 900-77-13, 900-77-14, 900-77-16, 900-77-30 ไม่ครบ 5 รหัส ไม่ผ่าน
  //    เชื่อมกับ วันคลอด ในระบบงานบัญชี 2 ถ้าไม่มีวันคลอด ไม่ผ่าน
  // 5. รหัส M6260 + U อื่นๆ จับคู่หัตถการ 872-78-11, 873-78-11, 874-78-11, 873-78-35, 900-78-11, 900-78-20, 900-78-00 ถือว่าเป็น โรคกล้ามเนื้ออื่นๆ ผ่านเกณฑ์
  // -------------------------------------------------------------
  const hasM6260 = uniqueDx.includes('M6260')
  const hasU506 = uniqueDx.includes('U506')
  const hasAnyPostpartumOp = REQUIRED_POSTPARTUM_OPS.some((req) => normalizedOpSet.has(normalizeOpCode(req)))
  const isPostpartumService = count58220 > 0 || count58131 > 0 || hasAnyPostpartumOp

  // กรณีบริบาลหญิงหลังคลอด: มี U506 หรือ มีหัตถการ/ค่าบริการบริบาลหลังคลอด
  if (hasU506 || isPostpartumService) {
    if (!hasM6260) failures.push('บริบาลหญิงหลังคลอด ขาดรหัส M6260')
    if (!hasU506) failures.push('บริบาลหญิงหลังคลอด ขาดรหัส U506')

    // ตรวจสอบรหัสหัตถการ 5 รหัส
    const missingPostpartumOps = REQUIRED_POSTPARTUM_OPS.filter((req) => !normalizedOpSet.has(normalizeOpCode(req)))
    if (missingPostpartumOps.length > 0) {
      failures.push(`บริบาลหญิงหลังคลอด ต้องมีรหัสหัตถการครบทั้ง 5 รหัส (900-77-12, 900-77-13, 900-77-14, 900-77-16, 900-77-30) ขาดรหัส: ${missingPostpartumOps.join(', ')}`)
    }

    // ตรวจสอบวันคลอดในระบบงานบัญชี 2
    if (!row.labor_date) {
      failures.push('ไม่มีวันคลอดในระบบงานบัญชี 2 (ไม่พบข้อมูลวันคลอดหญิงหลังคลอด)')
    }

    if (hasM6260 && hasU506 && missingPostpartumOps.length === 0 && row.labor_date) {
      passes.push(`บริบาลหญิงหลังคลอด: ครบคู่ M6260 + U506, ครบ 5 รหัสหัตถการ และมีวันคลอดในบัญชี 2 (${row.labor_date})`)
    }
  } else if (hasM6260 && !hasU506) {
    // ข้อ 5: M6260 + U อื่นๆ ถือว่าเป็น "โรคกล้ามเนื้ออื่นๆ"
    const otherUDx = uniqueDx.filter((dx) => dx.startsWith('U') && dx !== 'U506')
    const hasAllowedMuscleOp = ALLOWED_MUSCLE_OPS.some((req) => normalizedOpSet.has(normalizeOpCode(req)))

    if (otherUDx.length === 0) {
      failures.push('รหัส M6260 ต้องมีรหัสวินิจฉัยแพทย์แผนไทย (รหัส U...) ร่วมด้วย')
    }
    if (!hasAllowedMuscleOp && count58101 === 0 && count58130 === 0 && count58301 === 0) {
      failures.push('โรคกล้ามเนื้ออื่นๆ (M6260) ต้องมีรหัสหัตถการร่วมด้วย (872-78-11, 873-78-11, 874-78-11, 873-78-35, 900-78-11, 900-78-20, 900-78-00)')
    }
    if (otherUDx.length > 0 && (hasAllowedMuscleOp || count58101 > 0 || count58130 > 0 || count58301 > 0)) {
      passes.push(`โรคกล้ามเนื้ออื่นๆ (M6260 + ${otherUDx.join(',')}): ผ่านเกณฑ์`)
    }
  }

  // -------------------------------------------------------------
  // กฎข้อที่ 5 (ข้อ 2 จากผู้ใช้): โรคกล้ามเนื้อทั่วไป (M... + U...)
  // เอาเฉพาะ รหัส M... U... ที่มีรหัส หัตถการ 872-78-11, 873-78-11, 874-78-11, 873-78-35, 900-78-11, 900-78-20, 900-78-00 ร่วมด้วยเท่านั้น
  // -------------------------------------------------------------
  const isPostpartumCase = hasU506 || isPostpartumService
  const isM6260Handled = hasM6260 && !hasU506

  if (!isKneeCase && !isPostpartumCase && !isM6260Handled) {
    const hasAnyM = uniqueDx.some((dx) => dx.startsWith('M'))
    const hasAnyU = uniqueDx.some((dx) => dx.startsWith('U'))
    const hasAllowedMuscleOp = ALLOWED_MUSCLE_OPS.some((req) => normalizedOpSet.has(normalizeOpCode(req)))

    if (!hasAnyM) failures.push('ต้องมีรหัสวินิจฉัยโรคกล้ามเนื้อ (รหัส M...)')
    if (!hasAnyU) failures.push('ต้องมีรหัสวินิจฉัยแพทย์แผนไทย (รหัส U...) ร่วมด้วย')
    if (!hasAllowedMuscleOp && count58101 === 0 && count58130 === 0 && count58301 === 0) {
      failures.push('รหัส M... และ U... ต้องมีรหัสหัตถการร่วมด้วย (872-78-11, 873-78-11, 874-78-11, 873-78-35, 900-78-11, 900-78-20, 900-78-00)')
    }

    if (hasAnyM && hasAnyU && (hasAllowedMuscleOp || count58101 > 0 || count58130 > 0 || count58301 > 0)) {
      passes.push('จับคู่รหัส M... และ U... พร้อมหัตถการถูกต้อง')
    }
  }

  // -------------------------------------------------------------
  // กฎข้อที่ 7 (ตามคำขอแผนกแพทย์แผนไทย):
  // ตรวจสอบสถานะการปิดสิทธิ (EP) และกรณีเปิด Visit 2 (visit_order >= 2)
  // -------------------------------------------------------------
  const checkVisit2Claim = duplicateRuleConfig?.check_visit2_claim_code !== false
  const visitOrder = Number(row.visit_order ?? 1)
  const currEp = String(row.ep_code ?? '').trim()
  const currClaim = String(row.claim_code ?? '').trim()
  const effectiveClaim = currEp || currClaim
  const firstClaim = String(row.first_visit_claim_code ?? '').trim()
  const isDupWithFirst = visitOrder >= 2 && Boolean(effectiveClaim) && Boolean(firstClaim) && effectiveClaim.toUpperCase() === firstClaim.toUpperCase()
  const closeStatus = row.claim_close_status || (
    isDupWithFirst
      ? 'VISIT2_DUP'
      : effectiveClaim.toUpperCase().startsWith('EP')
      ? 'CLOSED'
      : effectiveClaim.toUpperCase().startsWith('PP')
      ? 'OPEN_ONLY'
      : 'NONE'
  )
  const isClaimClosed = closeStatus === 'CLOSED'
  let isVisit2ClaimFail = false

  if (checkVisit2Claim && visitOrder >= 2) {
    if (closeStatus === 'VISIT2_DUP' || isDupWithFirst) {
      isVisit2ClaimFail = true
      failures.push(`Visit 2 แผนกแพทย์แผนไทย: เลขปิดสิทธิ (${effectiveClaim}) ซ้ำกับ Visit 1 (ต้องเป็นคนละเลขจึงจะผ่านเกณฑ์)`)
    } else if (closeStatus === 'OPEN_ONLY') {
      isVisit2ClaimFail = true
      failures.push(`Visit 2 แผนกแพทย์แผนไทย: เปิดสิทธิแล้ว (${effectiveClaim}) แต่ยังไม่ได้กดปิดสิทธิ (ยังไม่มีเลข EP)`)
    } else if (closeStatus === 'NONE' || !effectiveClaim) {
      isVisit2ClaimFail = true
      failures.push('Visit 2 แผนกแพทย์แผนไทย: ไม่มีเลขปิดสิทธิ (ต้องขอ Authen/ปิดสิทธิใหม่สำหรับ Visit 2)')
    } else {
      passes.push(`Visit 2 แผนกแพทย์แผนไทย: ปิดสิทธิแล้ว (${effectiveClaim}) เป็นคนละเลขกับ Visit 1 (${firstClaim || '-'}) ถูกต้องตามเกณฑ์`)
    }
  } else if (row.claim_close_status && !isClaimClosed) {
    // กรณี Visit 1 ที่ยังไม่ได้ปิดสิทธิ (มีเฉพาะเลข PP เปิดสิทธิ หรือไม่มีเลขเลย)
    if (closeStatus === 'OPEN_ONLY') {
      failures.push(`ยังไม่ปิดสิทธิ: เปิดสิทธิแล้ว (${currClaim}) แต่ยังไม่ได้กดปิดสิทธิ (ยังไม่มีเลข EP)`)
    } else {
      failures.push('ยังไม่ปิดสิทธิ: ไม่พบเลขเปิดสิทธิ (PP) และเลขปิดสิทธิ (EP) ในระบบ')
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
    operations,
    operation_codes: opCodesList,
    labor_date: row.labor_date || null,
    is_duplicate_fail: failures.some((f) => f.includes('คิดค่าบริการซ้ำ')),
    is_visit2_claim_fail: isVisit2ClaimFail,
    is_claim_closed: isClaimClosed,
    claim_close_status: closeStatus,
    ep_code: currEp || null,
    visit_order: visitOrder,
    total_day_visits: Number(row.total_day_visits ?? visitOrder),
    claim_code: currClaim || null,
    first_visit_claim_code: row.first_visit_claim_code || null,
    first_visit_vn: row.first_visit_vn || null,
    first_visit_dept: row.first_visit_dept || null,
    service_items_count: {
      count_58101: count58101,
      count_58130: count58130,
      count_58131: count58131,
      count_58220: count58220,
      count_58301: count58301,
      count_compress: countCompress,
    },
  }
}

export const DEFAULT_DUPLICATE_RULES = {
  block_coexist: true,
  block_both_multiple: true,
  block_single_multiple: true,
  check_visit2_claim_code: true,
  block_compress_steam_uc: true,
}

export async function getDuplicateRules(dwPool) {
  try {
    const [rows] = await dwPool.query(
      "SELECT setting_value FROM dw_hd_check_system_settings WHERE setting_key = 'thai_med_duplicate_rules' LIMIT 1"
    )
    if (rows.length > 0 && rows[0].setting_value) {
      return { ...DEFAULT_DUPLICATE_RULES, ...JSON.parse(rows[0].setting_value) }
    }
  } catch (err) {
    console.error('Error reading thai_med_duplicate_rules:', err)
  }
  return DEFAULT_DUPLICATE_RULES
}

export async function saveDuplicateRules(dwPool, rules) {
  const merged = { ...DEFAULT_DUPLICATE_RULES, ...rules }
  await dwPool.query(
    `INSERT INTO dw_hd_check_system_settings (setting_key, setting_value)
     VALUES ('thai_med_duplicate_rules', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
    [JSON.stringify(merged)]
  )
  return { success: true, data: merged }
}

