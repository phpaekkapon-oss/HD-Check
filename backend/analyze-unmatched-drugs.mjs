import mysql from 'mysql2/promise';
import { DB_BASE, DW_DB } from './config.mjs';

const dw = await mysql.createConnection({
  ...DB_BASE,
  database: DW_DB,
});

const [drugs] = await dw.query('SELECT icode, drug_name, dx_prefixes, min_qty, indication FROM dw_hd_check_drug_dx_map ORDER BY drug_name');
console.log('Total drugs in dw_hd_check_drug_dx_map:', drugs.length);

for (const d of drugs) {
  const [topDx] = await dw.query(`
    SELECT dx, COUNT(*) as cnt FROM (
      SELECT pdx as dx FROM dw_hd_check_prescriptions WHERE drug_icode = ? AND pdx IS NOT NULL AND pdx != ''
      UNION ALL
      SELECT dx0 as dx FROM dw_hd_check_prescriptions WHERE drug_icode = ? AND dx0 IS NOT NULL AND dx0 != ''
      UNION ALL
      SELECT dx1 as dx FROM dw_hd_check_prescriptions WHERE drug_icode = ? AND dx1 IS NOT NULL AND dx1 != ''
      UNION ALL
      SELECT dx2 as dx FROM dw_hd_check_prescriptions WHERE drug_icode = ? AND dx2 IS NOT NULL AND dx2 != ''
      UNION ALL
      SELECT dx3 as dx FROM dw_hd_check_prescriptions WHERE drug_icode = ? AND dx3 IS NOT NULL AND dx3 != ''
      UNION ALL
      SELECT dx4 as dx FROM dw_hd_check_prescriptions WHERE drug_icode = ? AND dx4 IS NOT NULL AND dx4 != ''
      UNION ALL
      SELECT dx5 as dx FROM dw_hd_check_prescriptions WHERE drug_icode = ? AND dx5 IS NOT NULL AND dx5 != ''
    ) t
    GROUP BY dx
    ORDER BY cnt DESC
    LIMIT 12
  `, [d.icode, d.icode, d.icode, d.icode, d.icode, d.icode, d.icode]);

  console.log(`\n--- [${d.icode}] ${d.drug_name} ---`);
  console.log(`Current: ${d.dx_prefixes || '(none)'}`);
  console.log(`Top Dx: ${topDx.map(r => `${r.dx}(${r.cnt})`).join(', ')}`);
}

await dw.end();
