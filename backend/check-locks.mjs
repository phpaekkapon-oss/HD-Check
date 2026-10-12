import mysql from 'mysql2/promise'
import { HOS_DB_BASE, HOS_DB } from './config.mjs'

async function checkDrugLocks() {
  const conn = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  
  // Check opitemrece_lock schema and data
  const [opLockCols] = await conn.query("SHOW COLUMNS FROM opitemrece_lock").catch(() => [[]])
  console.log('opitemrece_lock cols:', opLockCols.map(c => c.Field))
  const [opLockData] = await conn.query("SELECT * FROM opitemrece_lock LIMIT 20").catch(() => [[]])
  console.log('opitemrece_lock data:', opLockData)

  // Check drugitems_patient_limit
  const [dplCols] = await conn.query("SHOW COLUMNS FROM drugitems_patient_limit").catch(() => [[]])
  console.log('drugitems_patient_limit cols:', dplCols.map(c => c.Field))
  const [dplData] = await conn.query("SELECT * FROM drugitems_patient_limit LIMIT 20").catch(() => [[]])
  console.log('drugitems_patient_limit data:', dplData)

  // Check all columns in drugitems for icode in ('1540011', '1650102', '1490024')
  const [drugs] = await conn.query(`
    SELECT * FROM drugitems WHERE icode IN ('1540011', '1650102', '1490024')
  `)
  for (const d of drugs) {
    const nonNull = Object.fromEntries(Object.entries(d).filter(([_, v]) => v !== null && v !== '' && v !== 0 && v !== '0'))
    console.log(`Drug ${d.icode} (${d.name}):`, nonNull)
  }

  // Search across HOSxP for any tables with 'min_qty' or 'min_order' or 'min_pay' or 'claim'
  const [tablesWithMin] = await conn.query(`
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = '${HOS_DB}' 
      AND (COLUMN_NAME LIKE '%min%qty%' OR COLUMN_NAME LIKE '%min%pay%' OR COLUMN_NAME LIKE '%min%order%' OR COLUMN_NAME LIKE '%min%unit%')
  `)
  console.log('Columns matching min qty in HOSxP:', tablesWithMin)

  await conn.end()
}

checkDrugLocks().catch(console.error)
