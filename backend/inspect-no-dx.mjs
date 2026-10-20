import mysql from 'mysql2/promise';
import { DB_BASE, DW_DB } from './config.mjs';

const dw = await mysql.createConnection({ ...DB_BASE, database: DW_DB });
const [rows] = await dw.query(`
  SELECT vn, hn, patient_name, drug_name, department_name, pdx, dx0, dx1
  FROM dw_hd_check_prescriptions
  WHERE visit_date BETWEEN '2026-10-01' AND '2026-10-31'
    AND (pdx IS NULL OR pdx = '')
    AND (dx0 IS NULL OR dx0 = '')
    AND (dx1 IS NULL OR dx1 = '')
  LIMIT 10
`);

console.log('Sample NO_DX records in Oct 2026:');
for (const r of rows) {
  console.log(`[${r.vn}] HN:${r.hn} ${r.patient_name} - ${r.drug_name} (${r.department_name})`);
}

const [[cnt]] = await dw.query(`
  SELECT COUNT(*) as total,
         SUM(IF(vn LIKE 'AN:%', 1, 0)) as ipd_count,
         SUM(IF(vn NOT LIKE 'AN:%', 1, 0)) as opd_count
  FROM dw_hd_check_prescriptions
  WHERE visit_date BETWEEN '2026-10-01' AND '2026-10-31'
    AND (pdx IS NULL OR pdx = '')
    AND (dx0 IS NULL OR dx0 = '')
`);
console.log('Breakdown:', cnt);

await dw.end();
