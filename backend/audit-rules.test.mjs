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
