import mysql from 'mysql2/promise'
import { HOS_DB_BASE, HOS_DB, DW_DB_BASE, DW_DB } from './config.mjs'

async function syncMinQtyFromHosxp() {
  const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })

  try {
    // 1. Get default_qty from HOSxP drugitems for all drugs
    const [hosDrugs] = await hos.query(`
      SELECT icode, name, units, default_qty 
      FROM drugitems 
      WHERE default_qty IS NOT NULL AND default_qty > 0
    `)
    const hosQtyMap = new Map(hosDrugs.map(d => [String(d.icode), { name: d.name, units: d.units, default_qty: Number(d.default_qty) }]))
    console.log(`Found ${hosDrugs.length} drugs with default_qty > 0 in HOSxP`)

    // 2. Fetch current herbal drugs from DW
    const [dwDrugs] = await dw.query(`
      SELECT icode, drug_name, min_qty 
      FROM dw_hd_check_drug_dx_map 
      ORDER BY drug_name
    `)
    console.log(`Current drugs in DW dw_hd_check_drug_dx_map: ${dwDrugs.length}`)

    let updatedCount = 0
    for (const d of dwDrugs) {
      const hosInfo = hosQtyMap.get(String(d.icode))
      if (hosInfo && hosInfo.default_qty > 0) {
        await dw.query(
          'UPDATE dw_hd_check_drug_dx_map SET min_qty = ? WHERE icode = ?',
          [hosInfo.default_qty, d.icode]
        )
        console.log(`[UPDATED] ${d.drug_name} (${d.icode}): min_qty ${d.min_qty} -> ${hosInfo.default_qty} (HOSxP default_qty)`)
        updatedCount++
      } else {
        console.log(`[NO DEFAULT_QTY] ${d.drug_name} (${d.icode}): kept ${d.min_qty}`)
      }
    }

    console.log(`\nSuccessfully updated ${updatedCount}/${dwDrugs.length} herbal drugs with HOSxP default_qty!`)

    // Verify
    const [verified] = await dw.query(`
      SELECT icode, drug_name, min_qty 
      FROM dw_hd_check_drug_dx_map 
      WHERE min_qty > 0 
      ORDER BY drug_name
    `)
    console.log(`Total herbs with min_qty > 0 in DW: ${verified.length}`)
  } finally {
    await hos.end()
    await dw.end()
  }
}

syncMinQtyFromHosxp().catch(console.error)
