import mysql from 'mysql2/promise'
import { HOS_DB_BASE, HOS_DB, HERB_DRUG_FILTER } from './config.mjs'

async function checkNotifyTexts() {
  const conn = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const [rows] = await conn.query(`
    SELECT d.icode, d.name, d.units, d.default_qty, d.max_qty, d.show_notify_text, d.empty_text
    FROM drugitems d
    WHERE ${HERB_DRUG_FILTER}
      AND (show_notify_text IS NOT NULL OR empty_text IS NOT NULL OR default_qty > 0)
    ORDER BY name
  `)

  for (const r of rows) {
    if (r.show_notify_text || r.empty_text) {
      console.log(`[${r.icode}] ${r.name} (${r.units}): default=${r.default_qty}, max=${r.max_qty}`)
      console.log(`  notify: ${r.show_notify_text}`)
      console.log(`  empty:  ${r.empty_text}`)
    }
  }

  await conn.end()
}

checkNotifyTexts().catch(console.error)
