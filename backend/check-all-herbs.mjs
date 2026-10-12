import mysql from 'mysql2/promise'
import { HOS_DB_BASE, HOS_DB, HERB_DRUG_FILTER } from './config.mjs'

async function checkAllHerbs() {
  const conn = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const [rows] = await conn.query(`
    SELECT icode, name, units, default_qty, max_qty, minlevel, maxlevel, 
           show_notify, show_notify_text, empty_text, drugnote, hintcode
    FROM drugitems d
    WHERE ${HERB_DRUG_FILTER}
    ORDER BY name
  `)

  console.log(`Found ${rows.length} herbal drugs in HOSxP:`)
  for (const r of rows) {
    console.log(JSON.stringify(r))
  }

  await conn.end()
}

checkAllHerbs().catch(console.error)
