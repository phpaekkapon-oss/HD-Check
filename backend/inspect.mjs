import mysql from 'mysql2/promise'
import { HOS_DB_BASE, HOS_DB, DW_DB_BASE, DW_DB } from './config.mjs'

async function inspect() {
  const conn = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const [cols] = await conn.query('SHOW COLUMNS FROM drugitems')
  const matched = cols.filter(c => /min|max|limit|lock|qty|claim|pay/i.test(c.Field)).map(c => c.Field)
  console.log('Matched columns in drugitems:', matched)

  const selectCols = matched.filter(c => !['qty', 'total_qty'].includes(c)).slice(0, 20)
  const [items] = await conn.query(`
    SELECT icode, name, units, ${selectCols.join(', ')}
    FROM drugitems
    WHERE name LIKE '%ประคบ%' OR name LIKE '%ไพล%' OR name LIKE '%ขมิ้น%'
    LIMIT 5
  `)
  console.log('Sample data:', JSON.stringify(items, null, 2))

  // Check tables related to item locking, drug limits, or nhso claim limits in HOSxP
  const [limitTables] = await conn.query(`
    SHOW TABLES WHERE Tables_in_${HOS_DB} LIKE '%limit%' 
      OR Tables_in_${HOS_DB} LIKE '%lock%' 
      OR Tables_in_${HOS_DB} LIKE '%drug_item%'
      OR Tables_in_${HOS_DB} LIKE '%nhso%'
  `)
  console.log('Limit/Lock tables:', limitTables)

  // Check prescriptions in DW where qty < 3
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })
  const [lowQty] = await dw.query(`
    SELECT vn, drug_icode, drug_name, drug_qty, drug_units, audit_status, pdx
    FROM dw_hd_check_prescriptions
    WHERE drug_qty < 3
    LIMIT 10
  `)
  console.log('DW low qty (< 3) prescriptions:', lowQty)

  await conn.end()
  await dw.end()
}

inspect().catch(console.error)
