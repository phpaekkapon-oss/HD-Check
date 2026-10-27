// Run: npm test --prefix backend   (no database needed)
import { test } from 'node:test'
import assert from 'node:assert/strict'

// config.mjs requires DB env vars at import time; the rule itself never touches the DB
process.env.DB_HOST ??= 'test'
process.env.DB_USER ??= 'test'
process.env.DB_PASSWORD ??= 'test'
const { evaluate } = await import('./audit-rules.mjs')

const dxMap = new Map([
  ['H1', ['K30', 'R10']],
  ['H2', []],
])
const minQtyMap = new Map([['H1', 10]])
const run = (row) => evaluate({ drug_icode: 'H1', drug_qty: 20, pttype_name: 'UC', ...row }, dxMap, minQtyMap)

test('PASS when a diagnosis matches an allowed prefix', () => {
  const r = run({ pdx: 'K30' })
  assert.equal(r.audit_result, 'PASS')
  assert.deepEqual(r.matched_dx, ['K30'])
})

test('ICD matching ignores dots and case, and matches by prefix', () => {
  assert.equal(run({ pdx: 'k30.9' }).audit_result, 'PASS')
  assert.equal(run({ dx3: 'R10.4' }).audit_result, 'PASS')
})

test('FAIL when diagnoses exist but none match', () => {
  const r = run({ pdx: 'J00' })
  assert.equal(r.audit_result, 'FAIL')
  assert.deepEqual(r.matched_dx, [])
})

test('NO_DX when every diagnosis column is empty', () => {
  assert.equal(run({}).audit_result, 'NO_DX')
  assert.equal(run({ pdx: ' ', dx0: null }).audit_result, 'NO_DX')
})

test('NO_MAP when the drug has no ICD configured', () => {
  assert.equal(evaluate({ drug_icode: 'H2', drug_qty: 5, pdx: 'K30' }, dxMap, minQtyMap).audit_result, 'NO_MAP')
  assert.equal(evaluate({ drug_icode: 'UNKNOWN', drug_qty: 5, pdx: 'K30' }, dxMap, minQtyMap).audit_result, 'NO_MAP')
})

test('NO_DX takes priority over NO_MAP', () => {
  assert.equal(evaluate({ drug_icode: 'H2', drug_qty: 5 }, dxMap, minQtyMap).audit_result, 'NO_DX')
})

test('FAIL when quantity is below the minimum for a non-exempt right', () => {
  const r = run({ pdx: 'K30', drug_qty: 5 })
  assert.equal(r.audit_result, 'FAIL')
  assert.equal(r.is_qty_fail, true)
})

test('exact minimum quantity passes', () => {
  assert.equal(run({ pdx: 'K30', drug_qty: 10 }).audit_result, 'PASS')
})

test('exempt right skips the minimum quantity rule', () => {
  const r = run({ pdx: 'K30', drug_qty: 1, pttype_name: 'ประกันสังคม' })
  assert.equal(r.audit_result, 'PASS')
  assert.equal(r.is_qty_fail, false)
})

test('no minimum configured means quantity is not checked', () => {
  const r = evaluate({ drug_icode: 'H1', drug_qty: 1, pdx: 'K30' }, dxMap, new Map())
  assert.equal(r.audit_result, 'PASS')
})

test('target Thai-medicine doctor needs a U-code diagnosis', () => {
  const doctors = [
    'นางสาวนภัสกร มวลชัยภูมิ',
    'นายศาสตรา คำมุลตรี',
    'นางสาวแคทริยา แสนหูม',
    'นางสาวศุภาวรรณ ลูกเงาะ',
    'นางสาวกชวรรณ ดวงแก้ว',
  ]
  for (const doc of doctors) {
    assert.equal(run({ pdx: 'K30', doctor_name: doc }).audit_result, 'FAIL', `${doc} should fail without U-code`)
    assert.equal(run({ pdx: 'K30', dx0: 'U57.1', doctor_name: doc }).audit_result, 'PASS', `${doc} should pass with U-code`)
  }
  // other doctors are unaffected
  assert.equal(run({ pdx: 'K30', doctor_name: 'แพทย์ทั่วไป' }).audit_result, 'PASS')
})

test('Listed Thai-medicine doctor requires both modern ICD (K30) and Thai med U-code (U6680)', () => {
  // แพทย์แผนไทยที่กำหนด คีย์ K30 แต่ไม่คีย์ U6680 -> ไม่ผ่าน (FAIL)
  const failThaiMed = run({ pdx: 'K30', doctor_name: 'นางสาวแคทริยา แสนหูม' })
  assert.equal(failThaiMed.audit_result, 'FAIL')
  assert.match(failThaiMed.audit_reason, /รหัสแพทย์แผนไทย/)

  // แผนกแพทย์แผนไทย คีย์ K30 และคีย์ U6680 -> ผ่าน (PASS)
  const passThaiMed = run({ pdx: 'K30', dx0: 'U6680', doctor_name: 'นางสาวแคทริยา แสนหูม' })
  assert.equal(passThaiMed.audit_result, 'PASS')
  assert.deepEqual(passThaiMed.matched_dx, ['K30', 'U6680'])

  // แผนกแพทย์แผนไทย คีย์เฉพาะ U6680 แต่ไม่คีย์ K30 -> ไม่ผ่าน (FAIL)
  const missingModernThaiMed = run({ pdx: 'U6680', doctor_name: 'นางสาวแคทริยา แสนหูม' })
  assert.equal(missingModernThaiMed.audit_result, 'FAIL')
  assert.match(missingModernThaiMed.audit_reason, /รหัสแผนปัจจุบัน/)

  // แผนกแพทย์แผนไทย คีย์ K30 และรหัส U อื่น (เช่น U5753 ของโรคเข่า) -> ผ่าน (PASS) ยอมรับรหัส U ทุกรหัส
  const otherUThaiMed = run({ pdx: 'M179', dx0: 'K30', dx1: 'U5753', doctor_name: 'นางสาวแคทริยา แสนหูม' })
  assert.equal(otherUThaiMed.audit_result, 'PASS')
  assert.deepEqual(otherUThaiMed.matched_dx, ['K30', 'U5753'])

  // แพทย์แผนปัจจุบัน (เช่น OPD) คีย์ K30 ไม่คีย์ U6680 -> ผ่าน (PASS)
  const passModernDoctor = run({ pdx: 'K30', department_name: 'ผู้ป่วยนอก (OPD)' })
  assert.equal(passModernDoctor.audit_result, 'PASS')
  assert.deepEqual(passModernDoctor.matched_dx, ['K30'])
})

test('Thai-medicine department/doctor outside the 5 named doctors does not need a U-code', () => {
  assert.equal(run({ pdx: 'K30', department_name: 'แพทย์แผนไทย' }).audit_result, 'PASS')
  assert.equal(run({ pdx: 'K30', doctor_name: 'พท.ปภาวี ใจดี' }).audit_result, 'PASS')
})

test('Other departments (ER, Warfarin, OPD) do NOT require code U and pass with modern ICD', () => {
  const depts = ['ห้อง ER', 'คลินิก Wafarine', 'จุดซักประวัติ OPD', 'อายุรกรรม', 'โสต ศอ นาสิก', 'ศัลยกรรม']
  for (const dept of depts) {
    // แพทย์ทั่วไปในแผนกอื่น สั่งจ่ายยาธาตุอบเชย (K30) โดยไม่มีรหัส U -> ต้องผ่าน (PASS)
    const r = run({ pdx: 'K30', department_name: dept, doctor_name: 'นางยุภาพร พานทอง' })
    assert.equal(r.audit_result, 'PASS', `${dept} should pass without U-code`)
    assert.deepEqual(r.matched_dx, ['K30'])

    // แม้แพทย์จะเป็น 1 ใน 5 แพทย์แผนไทย แต่สั่งจ่ายในแผนกอื่น -> ไม่ต้องมีรหัส U ก็ผ่าน (PASS)
    const rDoc = run({ pdx: 'K30', department_name: dept, doctor_name: 'นางสาวแคทริยา แสนหูม' })
    assert.equal(rDoc.audit_result, 'PASS', `${dept} with named doc should pass without U-code`)
  }
})

test('Minimum quantity applies only to UC rights', () => {
  for (const pt of ['UC30บาท(UCS) 12-59 ปีในเขต', 'UC Walk In ในจังหวัด มี ท', 'ODS_UC  มี ท.', 'บัตรทองฉุกเฉิน ต่างจังหวัด มี ท.']) {
    const r = run({ pdx: 'K30', drug_qty: 5, pttype_name: pt })
    assert.equal(r.audit_result, 'FAIL', pt)
    assert.equal(r.is_qty_fail, true, pt)
  }
  for (const pt of ['ผู้พิการ รพ.พังโคน', 'สิทธิเบิกกรมบัญชีกลาง', 'ชำระเงินเอง', 'ประกันสังคมในเครือข่าย รพ.สกลนคร', 'สิทธิว่าง / มาตรา 8']) {
    const r = run({ pdx: 'K30', drug_qty: 5, pttype_name: pt })
    assert.equal(r.audit_result, 'PASS', pt)
    assert.equal(r.is_qty_fail, false, pt)
  }
})

const { evaluateHealthMedAudit } = await import('./healthmed.mjs')

test('HealthMed - M179 + U5753 age >= 40 with all 4 knee operations passes', () => {
  const r = evaluateHealthMedAudit({
    pdx: 'M179',
    dx0: 'U5753',
    age_y: 45,
    pttype_hipdata: 'UCS',
    operation_codes: ['872-78-11', '873-78-11', '874-78-11', '873-78-35'],
    count_58130: 1,
  })
  assert.equal(r.audit_result, 'PASS')
})

test('HealthMed - M179 + U5753 fails if missing any of the 4 knee operations', () => {
  const r = evaluateHealthMedAudit({
    pdx: 'M179',
    dx0: 'U5753',
    age_y: 45,
    pttype_hipdata: 'UCS',
    operation_codes: ['872-78-11', '873-78-11', '874-78-11'], // missing 873-78-35
    count_58130: 1,
  })
  assert.equal(r.audit_result, 'FAIL')
  assert.match(r.audit_reason, /873-78-35/)
})

test('HealthMed - M179 + U5753 fails if age < 40', () => {
  const r = evaluateHealthMedAudit({
    pdx: 'M179',
    dx0: 'U5753',
    age_y: 39,
    pttype_hipdata: 'UCS',
    operation_codes: ['872-78-11', '873-78-11', '874-78-11', '873-78-35'],
    count_58130: 1,
  })
  assert.equal(r.audit_result, 'FAIL')
  assert.match(r.audit_reason, /40 ปีขึ้นไป/)
})

test('HealthMed - M179 + U5753 massage only (no knee code) uses general M+U rule', () => {
  // นวดอย่างเดียว ไม่มีรหัสพอกเข่า -> ไม่ใช้เกณฑ์พอกเข่า ตรวจด้วยเกณฑ์ M + U + หัตถการ (อายุไม่เกี่ยว)
  const young = evaluateHealthMedAudit({
    pdx: 'M179',
    dx0: 'U5753',
    age_y: 27,
    operation_codes: ['900-78-11', '900-78-20'],
    count_58130: 1,
  })
  assert.equal(young.audit_result, 'PASS')

  // นวดอย่างเดียวแต่ไม่มีรหัส U -> ไม่ผ่านตามเกณฑ์ทั่วไป ไม่ใช่เกณฑ์พอกเข่า
  const noU = evaluateHealthMedAudit({ pdx: 'M179', age_y: 64, operation_codes: ['900-78-11'], count_58130: 1 })
  assert.equal(noU.audit_result, 'FAIL')
  assert.doesNotMatch(noU.audit_reason, /เข่า/)
  assert.match(noU.audit_reason, /รหัส U/)
})

test('HealthMed - M6260 + U506 postpartum passes with all 5 operations and labor_date', () => {
  const r = evaluateHealthMedAudit({
    pdx: 'M6260',
    dx0: 'U506',
    operation_codes: ['900-77-12', '900-77-13', '900-77-14', '900-77-16', '900-77-30'],
    labor_date: '2026-08-12',
    count_58220: 1,
  })
  assert.equal(r.audit_result, 'PASS')
})

test('HealthMed - M6260 + U506 fails without labor_date from account 2', () => {
  const r = evaluateHealthMedAudit({
    pdx: 'M6260',
    dx0: 'U506',
    operation_codes: ['900-77-12', '900-77-13', '900-77-14', '900-77-16', '900-77-30'],
    labor_date: null,
    count_58220: 1,
  })
  assert.equal(r.audit_result, 'FAIL')
  assert.match(r.audit_reason, /ไม่มีวันคลอดในระบบงานบัญชี 2/)
})

test('HealthMed - M6260 + U506 fails if missing any of 5 operations', () => {
  const r = evaluateHealthMedAudit({
    pdx: 'M6260',
    dx0: 'U506',
    operation_codes: ['900-77-12', '900-77-13', '900-77-14', '900-77-16'], // missing 900-77-30
    labor_date: '2026-08-12',
    count_58220: 1,
  })
  assert.equal(r.audit_result, 'FAIL')
  assert.match(r.audit_reason, /900-77-30/)
})

test('HealthMed - M6260 + U other (not U506) passes as other muscle condition', () => {
  const r = evaluateHealthMedAudit({
    pdx: 'M6260',
    dx0: 'U5720',
    operation_codes: ['900-78-11', '900-78-20'],
    count_58130: 1,
  })
  assert.equal(r.audit_result, 'PASS')
  assert.match(r.audit_reason, /โรคกล้ามเนื้ออื่นๆ/)
})

test('HealthMed - General muscle M... + U... requires allowed procedure', () => {
  const passRecord = evaluateHealthMedAudit({
    pdx: 'M7911',
    dx0: 'U5720',
    operation_codes: ['900-78-11'],
    count_58130: 1,
  })
  assert.equal(passRecord.audit_result, 'PASS')

  const failRecord = evaluateHealthMedAudit({
    pdx: 'M7911',
    dx0: 'U5720',
    operation_codes: ['123-45-67'], // not an allowed procedure
    count_58130: 0,
  })
  assert.equal(failRecord.audit_result, 'FAIL')
})

test('Cinnamon drug (1490024) under UC fails when dispensed within 7 days', () => {
  const r = evaluate(
    {
      drug_icode: '1490024',
      drug_name: 'ยาธาตุอบเชย',
      drug_qty: 3,
      pttype_name: 'UC30บาท(UCS) 12-59 ปีในเขต',
      pdx: 'K30',
      cinnamon_interval_fail: true,
      cinnamon_prev_date: '2026-10-01',
      cinnamon_days_diff: 4,
    },
    new Map([['1490024', ['K30']]]),
    new Map()
  )
  assert.equal(r.audit_result, 'FAIL')
  assert.equal(r.is_interval_fail, true)
  assert.match(r.audit_reason, /ตัดการจ่าย 7 วัน/)
  assert.match(r.audit_reason, /ไม่ครบ 7 วัน/)
})

test('Custom dispensing interval rule (e.g. SSS 14 days) fails when within interval', () => {
  const r = evaluate(
    {
      drug_icode: '1540012',
      drug_name: 'ขมิ้นชัน',
      drug_qty: 30,
      pttype_name: 'ประกันสังคม',
      pdx: 'K30',
      interval_fail: true,
      interval_prev_date: '2026-10-10',
      interval_days_diff: 5,
      interval_rule_info: {
        drug_name: 'ขมิ้นชัน',
        pttype_label: 'สิทธิประกันสังคม',
        min_days: 14,
      },
    },
    new Map([['1540012', ['K30']]]),
    new Map()
  )
  assert.equal(r.audit_result, 'FAIL')
  assert.equal(r.is_interval_fail, true)
  assert.match(r.audit_reason, /ตัดการจ่าย 14 วัน/)
  assert.match(r.audit_reason, /สิทธิประกันสังคม/)
  assert.match(r.audit_reason, /ห่างกันเพียง 5 วัน/)
})

test('HealthMed duplicate - massage & compress 2 times fails', () => {
  const r = evaluateHealthMedAudit({
    pdx: 'M7911',
    dx0: 'U5720',
    operation_codes: ['900-78-11'],
    count_58130: 2,
  })
  assert.equal(r.audit_result, 'FAIL')
  assert.equal(r.is_duplicate_fail, true)
  assert.match(r.audit_reason, /พบค่านวดและประคบ 2 ครั้ง/)
})

test('HealthMed duplicate - coexistence of (นวดและประคบ + นวด + ประคบ) fails', () => {
  // Test both + massage
  const r1 = evaluateHealthMedAudit({
    pdx: 'M7911',
    dx0: 'U5720',
    operation_codes: ['900-78-11'],
    count_58130: 1,
    count_58101: 1,
  })
  assert.equal(r1.audit_result, 'FAIL')
  assert.equal(r1.is_duplicate_fail, true)
  assert.match(r1.audit_reason, /ค่านวดและประคบ ร่วมกับ ค่านวด/)

  // Test both + compress
  const r2 = evaluateHealthMedAudit({
    pdx: 'M7911',
    dx0: 'U5720',
    operation_codes: ['900-78-11'],
    count_58130: 1,
    count_compress: 1,
  })
  assert.equal(r2.audit_result, 'FAIL')
  assert.equal(r2.is_duplicate_fail, true)
  assert.match(r2.audit_reason, /ค่านวดและประคบ ร่วมกับ ค่าประคบ/)

  // Test massage + compress
  const r3 = evaluateHealthMedAudit({
    pdx: 'M7911',
    dx0: 'U5720',
    operation_codes: ['900-78-11'],
    count_58101: 1,
    count_compress: 1,
  })
  assert.equal(r3.audit_result, 'FAIL')
  assert.equal(r3.is_duplicate_fail, true)
  assert.match(r3.audit_reason, /ค่านวด ร่วมกับ ค่าประคบ/)

  // Test all 3
  const r4 = evaluateHealthMedAudit({
    pdx: 'M7911',
    dx0: 'U5720',
    operation_codes: ['900-78-11'],
    count_58130: 1,
    count_58101: 1,
    count_compress: 1,
  })
  assert.equal(r4.audit_result, 'FAIL')
  assert.equal(r4.is_duplicate_fail, true)
  assert.match(r4.audit_reason, /ค่านวดและประคบ ร่วมกับ ค่านวด ร่วมกับ ค่าประคบ/)
})



const { analyzeHerbRecord } = await import('./herb-advice.mjs')

test('Herb advice - drug-specific U present but modern code missing is flagged as a keying slip', () => {
  // ยาธรณีสัณฑฆาต (K59, U6984) แต่เคสมี M7911, R14, U5733, U6984
  const a = analyzeHerbRecord(
    { vn: '691014084', drug_name: 'ยาธรณีสัณฑฆาต', department_name: 'แพทย์แผนไทย', audit_result: 'FAIL',
      pdx: 'M7911', dx0: 'R14', dx1: 'U5733', dx2: 'U6984' },
    ['K59', 'U6984'],
  )
  assert.match(a.missing.join(), /K59/)
  assert.match(a.keyErrors.join(), /U6984.*ลืมคีย์รหัสแผนปัจจุบัน/)
  assert.match(a.hosxpSteps.join(), /VN 691014084/)
})

test('Herb advice - malformed code (letter O for zero) and near-miss code are detected', () => {
  const a = analyzeHerbRecord(
    { vn: 'AN:690001', drug_name: 'ยาทดสอบ', department_name: 'IPD: ตึกเด็ก', audit_result: 'FAIL', pdx: 'K03', dx0: 'U504O' },
    ['K30'],
  )
  assert.equal(a.isIpd, true)
  assert.match(a.keyErrors.join(), /U504O รูปแบบไม่ถูกต้อง/)
  assert.match(a.keyErrors.join(), /K03 ใกล้เคียงกับรหัสตามเกณฑ์ K30/)
  assert.match(a.hosxpSteps.join(), /AN 690001/)

  // ต่างหมวด (O924 กับ N92) ไม่ใช่การคีย์ผิด และเกณฑ์ "U" กว้างๆ ไม่นับเป็นรหัส U เจาะจงของยา
  const b = analyzeHerbRecord(
    { vn: '2', drug_name: 'ยาประสะไพล', department_name: 'แพทย์แผนไทย', audit_result: 'FAIL', pdx: 'M6260', dx0: 'O924', dx1: 'U771' },
    ['N94', 'N92', 'U'],
  )
  assert.doesNotMatch(b.keyErrors.join(), /O924/)
  assert.doesNotMatch(b.keyErrors.join(), /ลืมคีย์/)
})

test('Herb advice - interval fail explains previous dispensing date', () => {
  const a = analyzeHerbRecord(
    { vn: '1', hn: '000132293', drug_name: 'ยาธาตุอบเชย', department_name: 'แพทย์แผนไทย', audit_result: 'FAIL',
      pdx: 'M7911', dx0: 'K259', dx1: 'U6680', is_interval_fail: true, interval_prev_date: '2026-10-08', interval_days_diff: 4,
      interval_rule_info: { drug_name: 'ยาธาตุอบเชย', pttype_label: 'สิทธิ UC', min_days: 7 } },
    ['K259', 'U6680'],
  )
  assert.match(a.summary, /จ่ายซ้ำไม่ครบ 7 วัน/)
  assert.doesNotMatch(a.summary, /รหัสวินิจฉัยไม่ตรง/)
  assert.match(a.missing.join(), /2026-10-08/)
})

test('HealthMed - knee rule applies only to UC (hipdata UCS, incl. elderly right) not other rights', () => {
  const kneeIncomplete = { pdx: 'M179', dx0: 'U5753', age_y: 70, operation_codes: ['872-78-11', '900-78-20'], count_58130: 1 }
  // ผู้สูงอายุ (pttype 77) เป็น UCS -> ใช้เกณฑ์พอกเข่า -> ไม่ครบ 4 รหัส ไม่ผ่าน
  const uc = evaluateHealthMedAudit({ ...kneeIncomplete, pttype: '77', pttype_name: 'ผู้สูงอายุ', pttype_hipdata: 'UCS' })
  assert.equal(uc.audit_result, 'FAIL')
  assert.match(uc.audit_reason, /873-78-35/)
  // ข้าราชการ (OFC) -> ไม่ใช้เกณฑ์พอกเข่า ตรวจด้วย M + U + หัตถการ -> ผ่าน
  const ofc = evaluateHealthMedAudit({ ...kneeIncomplete, pttype: '23', pttype_name: 'สิทธิเบิกกรมบัญชีกลาง', pttype_hipdata: 'OFC' })
  assert.equal(ofc.audit_result, 'PASS')
})

const { buildCopilotKb, offlineAnswer } = await import('./copilot-knowledge.mjs')
const copilotKb = buildCopilotKb({
  dxMapRows: [
    { icode: '1490024', drug_name: 'ยาธาตุอบเชย', dx_prefixes: 'K30,R14,U6680', min_qty: 3, indication: 'ท้องอืด' },
    { icode: '1540011', drug_name: 'ยาประคบ (ลูกประคบ)', dx_prefixes: 'M,S,U', min_qty: 0, indication: 'ปวดเมื่อย' },
  ],
  dispensingRules: [{ drug_icode: '1490024', min_interval_days: 7, pttype_name_label: 'สิทธิ UC' }],
  opRows: [{ code: '873-78-35', name: 'การพอกยาสมุนไพร แบบราชสำนัก ที่หัวเข่า - 78 (พอกเข่า)' }],
})

test('Copilot offline - answers from real criteria for drug, ICD code and procedure questions', () => {
  const drug = offlineAnswer(copilotKb, 'ยาธาตุอบเชย ตัดการจ่ายกี่วัน')
  assert.match(drug, /K30, R14/)
  assert.match(drug, /อย่างน้อย 7 วัน/)
  assert.match(drug, /จ่ายขั้นต่ำ:\*\* 3/)

  assert.match(offlineAnswer(copilotKb, 'K30 ใช้ยาอะไรได้'), /ยาธาตุอบเชย/)
  assert.match(offlineAnswer(copilotKb, 'r14 ใช้ยาอะไร'), /ยาธาตุอบเชย/)

  const op = offlineAnswer(copilotKb, '873-78-35 คืออะไร')
  assert.match(op, /การพอกยาสมุนไพร แบบราชสำนัก ที่หัวเข่า \(พอกเข่า\)/)
  assert.match(op, /4 รหัสพอกเข่า/)
})

test('Copilot offline - topic questions are not hijacked by drug names', () => {
  assert.match(offlineAnswer(copilotKb, 'นวดและประคบ 2 ครั้งได้ไหม'), /คิดค่าบริการซ้ำ/)
  assert.match(offlineAnswer(copilotKb, 'เกณฑ์พอกเข่าต้องอายุเท่าไหร่'), /สิทธิ UC[\s\S]*40 ปีขึ้นไป/)
  assert.match(offlineAnswer(copilotKb, 'รหัส EP แก้อย่างไร'), /รหัสปิดสิทธิ/)
  assert.match(offlineAnswer(copilotKb, 'ลูกประคบใช้รหัสอะไร'), /ยาประคบ \(ลูกประคบ\)/)
})

const perm = await import('./permissions.mjs')

test('Thai-med value card - only IT or a user the IT switched on can view it', () => {
  const thaiMedStaff = { loginname: 'staff', groupname: 'แพทย์แผนไทย', position: 'นักการแพทย์แผนไทย' }
  assert.equal(perm.canViewThaiMedValue(null, false), false)
  assert.equal(perm.canViewThaiMedValue(thaiMedStaff, false), false, 'Thai-med group alone is not enough')
  assert.equal(perm.canViewThaiMedValue({ ...thaiMedStaff, thaimed_admin_enabled: false }, false), false)
  assert.equal(perm.canViewThaiMedValue({ ...thaiMedStaff, thaimed_admin_enabled: true }, false), true)
  assert.equal(perm.canViewThaiMedValue({ ...thaiMedStaff, thaimed_admin_enabled: 1 }, false), true)
  assert.equal(perm.canViewThaiMedValue({ loginname: 'it' }, true), true, 'IT always can')
})

test('Menu permissions - roles resolve IT > Thai-med > pharmacist > general', () => {
  assert.equal(perm.resolveRole({ position: 'นักวิชาการคอมพิวเตอร์' }, true), 'it')
  assert.equal(perm.resolveRole({ groupname: 'doctor', position: 'แพทย์แผนไทยปฏิบัติการ' }, false), 'thaimed')
  assert.equal(perm.resolveRole({ groupname: 'ผู้ดูแลระบบ_ระดับที่_3', entryposition: 'นักการแพทย์แผนไทย' }, false), 'thaimed')
  assert.equal(perm.resolveRole({ groupname: 'doctor', position: 'นายแพทย์ปฏิบัติการ' }, false), 'doctor')
  assert.equal(perm.resolveRole({ groupname: 'doctor', position: 'นักกายภาพบำบัด' }, false), 'doctor')
  assert.equal(perm.resolveRole({ position: 'เภสัชกรชำนาญการ' }, false), 'pharmacist')
  assert.equal(perm.resolveRole({ position: 'พยาบาลวิชาชีพ' }, false), 'general')
})

test('Menu permissions - defaults keep old behaviour, IT always sees everything, unknown keys ignored', () => {
  const d = perm.defaultPermissions()
  assert.equal(d.general.audit, true)
  assert.equal(d.thaimed.sql, false)
  assert.ok(perm.canAccessMenu(d, 'general', 'dashboard'))

  const saved = perm.normalizePermissions({ general: { healthmed: false, bogus: true }, hacker: { sql: true } })
  assert.equal(saved.general.healthmed, false)
  assert.equal('bogus' in saved.general, false)
  assert.equal('hacker' in saved, false)
  assert.equal(perm.canAccessMenu(saved, 'general', 'healthmed'), false)
  assert.equal(perm.canAccessMenu(saved, 'it', 'healthmed'), true)
  assert.equal(perm.canAccessMenu(saved, 'it', 'sql'), true)
})

test('Menu permissions - per-user role override from IT wins over automatic grouping', () => {
  // คนในกลุ่ม admin ของ HOSxP แต่ IT กำหนดเป็นผู้ใช้ทั่วไป
  assert.equal(perm.resolveRole({ groupname: 'admin', role_override: 'general' }, true), 'general')
  // พยาบาลที่ IT ยกให้เป็นแพทย์แผนไทย (รอง) / ผู้ดูแลสูงสุด
  assert.equal(perm.resolveRole({ position: 'พยาบาลวิชาชีพ', role_override: 'thaimed' }, false), 'thaimed')
  assert.equal(perm.resolveRole({ position: 'พยาบาลวิชาชีพ', role_override: 'it' }, false), 'it')
  // ค่าที่ไม่รู้จักถูกเพิกเฉย ใช้กฎอัตโนมัติ
  assert.equal(perm.resolveRole({ position: 'เภสัชกร', role_override: 'superuser' }, false), 'pharmacist')
  assert.equal(perm.validRoleOverride('auto'), null)
})

const claims = await import('./claims.mjs')
const claimRef = {
  eclaim: new Set(['M179', 'U5753', 'K640', 'S934', 'W010', 'N940', 'O800']),
  eclaimParents: new Set(['M17', 'K64', 'S93', 'N94']),
  icdSex: new Map([['N940', '2'], ['O800', '2']]),
  thaiMedU: new Set(['U5753']),
}

test('Claims - valid Thai-med visit has no ICD issues (K640 accepted via e-Claim table)', () => {
  assert.deepEqual(claims.checkVisitIcd({ pdx: 'M179', dx0: 'U5753', dx1: 'K640', sex: '2' }, claimRef), [])
})

test('Claims - detects NHSO-rejected patterns (201 no PDX, 232 injury without cause, unspecific, sex)', () => {
  const codes = (v) => claims.checkVisitIcd(v, claimRef).map((i) => i.code)
  assert.ok(codes({ dx0: 'U5753' }).includes('NO_PDX'))
  assert.ok(codes({ pdx: 'S934', sex: '1' }).includes('INJURY_NO_CAUSE'))
  assert.ok(!codes({ pdx: 'S934', dx0: 'W010', sex: '1' }).includes('INJURY_NO_CAUSE'))
  assert.ok(codes({ pdx: 'W010' }).includes('EXTERNAL_AS_PDX'))
  assert.ok(codes({ pdx: 'M17' }).includes('NOT_SPECIFIC'))
  assert.ok(codes({ pdx: 'M1799' }).includes('NOT_IN_ECLAIM'))
  assert.ok(codes({ pdx: 'N940', sex: '1' }).includes('SEX_MISMATCH'))
  assert.ok(codes({ pdx: 'M179', dx0: 'U9999' }).includes('U_NOT_THAIMED'))
})

test('Claims - claim state from FDH status', () => {
  assert.equal(claims.claimState({ hip: 'OFC' }), 'not_nhso')
  assert.equal(claims.claimState({ hip: 'UCS' }), 'no_result')
  assert.equal(claims.claimState({ hip: 'UCS', fdh_status: 'cut_off_batch' }), 'pending')
  assert.equal(claims.claimState({ hip: 'UCS', fdh_status: 'settled' }), 'settled')
  assert.equal(claims.claimState({ hip: 'UCS', fdh_status: 'rejected' }), 'rejected')
  assert.equal(claims.claimState({ hip: 'UCS', fdh_status: 'settled', fdh_errors: [{ code: '950' }] }), 'rejected')
})
