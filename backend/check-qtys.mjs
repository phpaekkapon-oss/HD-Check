import mysql from 'mysql2/promise'
import { HOS_DB_BASE, HOS_DB, DW_DB_BASE, DW_DB, HERB_DRUG_FILTER } from './config.mjs'

async function checkPrescriptionQtys() {
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })
  const [dwRows] = await dw.query(`
    SELECT drug_icode, drug_name, drug_qty, drug_units, COUNT(*) as cnt
    FROM dw_hd_check_prescriptions
    GROUP BY drug_icode, drug_name, drug_qty, drug_units
    ORDER BY drug_name, drug_qty
  `)
  console.log('Prescriptions by drug & qty in DW:')
  for (const r of dwRows) {
    console.log(`${r.drug_name} (${r.drug_icode}): qty = ${r.drug_qty} ${r.drug_units} (count = ${r.cnt})`)
  }

  // Also check HOSxP to see if there is any other table or setting for min qty
  const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const [sysSettings] = await hos.query(`
    SELECT * FROM opdconfig WHERE hospitalcode IS NOT NULL LIMIT 1
  `).catch(() => [[]])
  
  // Check drugitems for anything with 3
  const [herbsWith3] = await hos.query(`
    SELECT icode, name, units, default_qty, max_qty, show_notify_text
    FROM drugitems d
    WHERE ${HERB_DRUG_FILTER}
      AND (default_qty = 3 OR max_qty = 3 OR show_notify_text LIKE '%3%')
  `)
  console.log('Herbs with 3 in HOSxP drugitems:', herbsWith3)

  await dw.end()
  await hos.end()
}

checkPrescriptionQtys().catch(console.error)
