import mysql from 'mysql2/promise';
import { HOS_DB_BASE, HOS_DB } from './config.mjs';

const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB });

// 1. Search for tables in HOSxP related to drug ICD-10 mapping
const [tables] = await hos.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = ? 
    AND (
      table_name LIKE '%drug%icd%' 
      OR table_name LIKE '%drug%dx%'
      OR table_name LIKE '%herb%icd%'
      OR table_name LIKE '%herb%dx%'
      OR table_name LIKE '%drug%diag%'
      OR table_name LIKE '%drugitems%'
    )
`, [HOS_DB]);

console.log('Matching tables in HOSxP:');
console.table(tables);

// 2. Check columns in drugitems table
const [cols] = await hos.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema = ? AND table_name = 'drugitems'
    AND (column_name LIKE '%icd%' OR column_name LIKE '%dx%' OR column_name LIKE '%diag%')
`, [HOS_DB]);

console.log('\nDrugitems columns with icd/dx:');
console.table(cols);

await hos.end();
