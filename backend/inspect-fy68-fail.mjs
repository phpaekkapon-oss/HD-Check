import mysql from 'mysql2/promise';
import { DB_BASE, DW_DB } from './config.mjs';

const dw = await mysql.createConnection({ ...DB_BASE, database: DW_DB });
const [rows] = await dw.query(`
  SELECT audit_result, audit_reason, COUNT(*) as cnt 
  FROM dw_hd_check_prescriptions 
  WHERE visit_date BETWEEN '2024-10-01' AND '2025-09-30'
  GROUP BY audit_result, audit_reason 
  ORDER BY cnt DESC LIMIT 10
`);
console.table(rows);
await dw.end();
