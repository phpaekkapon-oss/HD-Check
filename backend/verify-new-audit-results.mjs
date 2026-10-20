import mysql from 'mysql2/promise';
import { DB_BASE, DW_DB } from './config.mjs';
import { evaluate } from './audit-rules.mjs';

const dw = await mysql.createConnection({
  ...DB_BASE,
  database: DW_DB,
});

// Load dxMap
const [mapRows] = await dw.query('SELECT icode, dx_prefixes, min_qty FROM dw_hd_check_drug_dx_map');
const dxMap = new Map();
const minQtyMap = new Map();
for (const r of mapRows) {
  dxMap.set(r.icode, (r.dx_prefixes || '').split(/[,\s]+/).filter(Boolean));
  minQtyMap.set(r.icode, Number(r.min_qty || 0));
}

async function testRange(name, startDate, endDate) {
  const [rows] = await dw.query(`
    SELECT id, vn, hn, patient_name, pttype_name, drug_icode, drug_name, drug_qty, drug_units, department_name, doctor_name,
           pdx, dx0, dx1, dx2, dx3, dx4, dx5
    FROM dw_hd_check_prescriptions
    WHERE visit_date BETWEEN ? AND ? AND drug_qty > 0
  `, [startDate, endDate]);

  let pass = 0, fail = 0, noDx = 0, noMap = 0;
  for (const row of rows) {
    const res = evaluate(row, dxMap, minQtyMap);
    if (res.audit_result === 'PASS') pass++;
    else if (res.audit_result === 'FAIL') fail++;
    else if (res.audit_result === 'NO_DX') noDx++;
    else noMap++;
  }

  const total = rows.length;
  const passRate = total ? ((pass / total) * 100).toFixed(1) : '0';
  console.log(`\n=== [${name}] (${startDate} to ${endDate}) ===`);
  console.log(`Total Prescriptions: ${total}`);
  console.log(`PASS: ${pass} (${passRate}%)`);
  console.log(`FAIL (DX ไม่ตรง): ${fail}`);
  console.log(`NO_DX: ${noDx}`);
  console.log(`NO_MAP: ${noMap}`);

  const reasons = new Map();
  for (const row of rows) {
    const res = evaluate(row, dxMap, minQtyMap);
    if (res.audit_result === 'FAIL') {
      const simplified = res.audit_reason.split(';')[0] || res.audit_reason;
      reasons.set(simplified, (reasons.get(simplified) || 0) + 1);
    }
  }
  const topReasons = [...reasons.entries()].sort((a,b) => b[1] - a[1]).slice(0, 5);
  for (const [r, c] of topReasons) {
    console.log(`  - ${c} ครั้ง: ${r}`);
  }
}

await testRange('ปีงบประมาณ 2568 (FY 68)', '2024-10-01', '2025-09-30');
await testRange('เดือนปัจจุบัน ต.ค. 2569 (Current Month)', '2026-10-01', '2026-10-31');

await dw.end();
