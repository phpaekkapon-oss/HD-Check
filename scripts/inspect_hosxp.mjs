import mysql from 'mysql2/promise'
import { HOS_DB_BASE, HOS_DB, DW_DB_BASE, DW_DB } from './backend/config.mjs'

async function inspect() {
  const conn = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const [cols] = await conn.query("SHOW COLUMNS FROM drugitems")
  const matchedCols = cols.filter(c => /min|max|limit|lock|qty|claim|pay/i.test(c.Field))
  console.log('Matched columns in drugitems:', matchedCols.map(c => c.Field))

  const [herbs] = await conn.query(`
    SELECT icode, name, units, drugcategory
    FROM drugitems
    WHERE name LIKE '%ประคบ%' OR name LIKE '%ไพล%' OR name LIKE '%ขมิ้น%'
    LIMIT 10
  `)
  console.log('Herbs in drugitems:', herbs)

  // Check columns that might have values
  const interestingCols = matchedCols.map(c => c.Field).filter(f => !['qty', 'total_qty'].includes(f))
  if (interestingCols.length) {
    const [herbDetails] = await conn.query(`
      SELECT icode, name, ${interestingCols.slice(0, 15).join(', ')}
      FROM drugitems
      WHERE name LIKE '%ประคบ%' OR name LIKE '%ไพล%'
      LIMIT 5
    `)
    console.log('Herb details:', herbDetails)
  }

  // Check opitemrece
  const [opCols] = await conn.query("SHOW COLUMNS FROM opitemrece")
  console.log('opitemrece columns with qty:', opCols.filter(c => /qty|lock|claim/i.test(c.Field)).map(c => c.Field))

  // Also check DW table
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })
  const [dwCols] = await dw.query("SHOW COLUMNS FROM dw_hd_check_prescriptions")
  console.log('DW prescriptions columns:', dwCols.map(c => c.Field))

  const [dwMapCols] = await dw.query("SHOW COLUMNS FROM dw_hd_check_drug_dx_map")
  console.log('DW dx map columns:', dwMapCols.map(c => c.Field))

  await conn.end()
  await dw.end()
}

inspect().catch(console.error)
