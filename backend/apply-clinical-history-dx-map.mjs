import mysql from 'mysql2/promise';
import fs from 'fs';
import { DW_DB_BASE, DW_DB } from './config.mjs';

const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB });

console.log('=== [START] Applying Clinically Relevant & Diagnosed ICD-10 to DW ===\n');

// 1. Create safety backup
const backupTable = `dw_hd_check_drug_dx_map_backup_${Date.now()}`;
await dw.query(`CREATE TABLE IF NOT EXISTS ${backupTable} AS SELECT * FROM dw_hd_check_drug_dx_map`);
console.log(`[BACKUP CREATED] Table: ${backupTable}`);

// 2. Read proposed map
const proposed = JSON.parse(fs.readFileSync('proposed-dx-map.json', 'utf8'));

let updatedCount = 0;
for (const item of proposed) {
  await dw.query(`
    UPDATE dw_hd_check_drug_dx_map
    SET dx_prefixes = ?
    WHERE icode = ?
  `, [item.new_dx, item.icode]);
  updatedCount++;
}

console.log(`\n[SUCCESS] Updated ${updatedCount} herbal drugs with verified clinical diagnosis history.`);

// Verify by reading back
const [verifyRows] = await dw.query(`
  SELECT icode, drug_name, dx_prefixes, min_qty, indication 
  FROM dw_hd_check_drug_dx_map 
  ORDER BY icode
`);

console.log(`\n=== Verification sample: ===`);
for (const r of verifyRows.slice(0, 10)) {
  console.log(`[${r.icode}] ${r.drug_name.padEnd(25)} -> ${r.dx_prefixes}`);
}

await dw.end();
