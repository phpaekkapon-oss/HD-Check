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
  const doctor = 'นภัสกร มวลชัยภูมิ'
  assert.equal(run({ pdx: 'K30', doctor_name: doctor }).audit_result, 'FAIL')
  assert.equal(run({ pdx: 'K30', dx0: 'U57.1', doctor_name: doctor }).audit_result, 'PASS')
  // other doctors are unaffected
  assert.equal(run({ pdx: 'K30', doctor_name: 'แพทย์ทั่วไป' }).audit_result, 'PASS')
})

const { evaluateHealthMedAudit } = await import('./healthmed.mjs')

test('HealthMed - M179 + U5753 age >= 40 with all 4 knee operations passes', () => {
  const r = evaluateHealthMedAudit({
    pdx: 'M179',
    dx0: 'U5753',
    age_y: 45,
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
    operation_codes: ['872-78-11', '873-78-11', '874-78-11', '873-78-35'],
    count_58130: 1,
  })
  assert.equal(r.audit_result, 'FAIL')
  assert.match(r.audit_reason, /40 ปีขึ้นไป/)
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

test('Cinnamon drug (1490024) passes when interval >= 7 days or first visit', () => {
  const r = evaluate(
    {
      drug_icode: '1490024',
      drug_name: 'ยาธาตุอบเชย',
      drug_qty: 3,
      pttype_name: 'UC30บาท(UCS) 12-59 ปีในเขต',
      pdx: 'K30',
      cinnamon_interval_fail: false,
    },
    new Map([['1490024', ['K30']]]),
    new Map()
  )
  assert.equal(r.audit_result, 'PASS')
})


