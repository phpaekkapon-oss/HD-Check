import mysql from 'mysql2/promise'
import { DW_DB_BASE, DW_DB } from './config.mjs'

async function migrate() {
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })
  
  try {
    await dw.query("ALTER TABLE dw_hd_check_drug_dx_map ADD COLUMN min_qty INT NOT NULL DEFAULT 0 AFTER dx_prefixes")
    console.log('Added min_qty column to dw_hd_check_drug_dx_map')
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('min_qty column already exists')
    } else {
      console.error(err)
    }
  }

  // Set min_qty based on HOSxP drugitems lock criteria
  const minQtyPresets = [
    { icode: '1490024', qty: 3, name: 'ยาธาตุอบเชย' },
    { icode: '1540012', qty: 56, name: 'ขมิ้นชัน' },
    { icode: '1630003', qty: 45, name: 'ชาชงหญ้าดอกขาว(X)' },
    { icode: '1560028', qty: 42, name: 'เถาวัลย์เปรียง(X)' },
    { icode: '1560023', qty: 42, name: 'ยาปราบชมพูทวีป' },
    { icode: '1490029', qty: 42, name: 'ยาผสมเพชรสังฆาต' },
    { icode: '1550003', qty: 60, name: 'ยาอมมะแว้ง(X)' },
    { icode: '1560027', qty: 42, name: 'สหัสธารา(X)' },
  ]

  for (const preset of minQtyPresets) {
    await dw.query("UPDATE dw_hd_check_drug_dx_map SET min_qty = ? WHERE icode = ?", [preset.qty, preset.icode])
  }
  console.log('Updated min_qty presets for herbs:', minQtyPresets)

  // Verify
  const [rows] = await dw.query("SELECT icode, drug_name, dx_prefixes, min_qty FROM dw_hd_check_drug_dx_map WHERE min_qty > 0 ORDER BY drug_name")
  console.log('Herbs with min_qty in DW:', rows)

  await dw.end()
}

migrate().catch(console.error)
