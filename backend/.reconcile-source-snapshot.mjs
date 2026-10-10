import mysql from 'mysql2/promise'
import { HOS_DB_BASE, DW_DB_BASE, HOS_DB, DW_DB, HERB_DRUG_FILTER } from './config.mjs'

const startDate = '2026-10-01'
const endDate = '2026-10-31'
const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })

const normalize = (value) => value == null ? '' : String(value).trim()
const keyOf = (row) => JSON.stringify([
  normalize(row.vn), normalize(row.visit_date), normalize(row.visit_time), normalize(row.drug_icode),
  normalize(row.drug_qty), normalize(row.main_pdx), normalize(row.pdx), normalize(row.dx0),
  normalize(row.dx1), normalize(row.dx2), normalize(row.dx3), normalize(row.dx4), normalize(row.dx5),
])

try {
  const [source] = await hos.query(
    `SELECT o.vn, o.vstdate AS visit_date, o.vsttime AS visit_time, op.icode AS drug_icode,
            op.qty AS drug_qty, ov.pdx AS main_pdx, ov.pdx, ov.dx0, ov.dx1, ov.dx2, ov.dx3, ov.dx4, ov.dx5
       FROM ovst o
       INNER JOIN opitemrece op ON o.vn = op.vn
       INNER JOIN vn_stat ov ON o.vn = ov.vn
       INNER JOIN patient pt ON o.hn = pt.hn
       INNER JOIN drugitems d ON op.icode = d.icode
       LEFT JOIN pttype ps ON o.pttype = ps.pttype
       LEFT JOIN spclty sp ON o.spclty = sp.spclty
       LEFT JOIN doctor doc ON o.doctor = doc.code
      WHERE o.vstdate BETWEEN ? AND ? AND ${HERB_DRUG_FILTER}`,
    [startDate, endDate],
  )
  const [warehouse] = await dw.query(
    `SELECT vn, visit_date, visit_time, drug_icode, drug_qty, main_pdx, pdx, dx0, dx1, dx2, dx3, dx4, dx5
       FROM dw_hd_check_prescriptions WHERE visit_date BETWEEN ? AND ?`,
    [startDate, endDate],
  )

  const sourceCounts = new Map()
  const warehouseCounts = new Map()
  for (const row of source) sourceCounts.set(keyOf(row), (sourceCounts.get(keyOf(row)) ?? 0) + 1)
  for (const row of warehouse) warehouseCounts.set(keyOf(row), (warehouseCounts.get(keyOf(row)) ?? 0) + 1)

  let sourceOnlyRows = 0
  let warehouseOnlyRows = 0
  for (const [key, count] of sourceCounts) sourceOnlyRows += Math.max(0, count - (warehouseCounts.get(key) ?? 0))
  for (const [key, count] of warehouseCounts) warehouseOnlyRows += Math.max(0, count - (sourceCounts.get(key) ?? 0))

  console.log(JSON.stringify({
    range: [startDate, endDate],
    sourceRows: source.length,
    warehouseRows: warehouse.length,
    exactRowsOnlyInSource: sourceOnlyRows,
    exactRowsOnlyInWarehouse: warehouseOnlyRows,
  }))
} finally {
  await Promise.all([hos.end(), dw.end()])
}
