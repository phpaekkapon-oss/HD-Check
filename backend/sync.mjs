import mysql from 'mysql2/promise'
import { HOS_DB_BASE, DW_DB_BASE, HOS_DB, DW_DB, HERB_DRUG_FILTER } from './config.mjs'

/** SQL Query 2 — date filter moved into the JOIN so it only scans the requested period */
const DRUG_SUMMARY_SQL = `
  SELECT
      d.icode,
      d.name,
      SUM(CASE WHEN (op.an IS NULL OR op.an = '') THEN IFNULL(op.qty, 0) ELSE 0 END) AS opd_qty,
      SUM(CASE WHEN (op.an IS NOT NULL AND op.an <> '') THEN IFNULL(op.qty, 0) ELSE 0 END) AS ipd_qty,
      ROUND(IFNULL(d.unitcost, 0), 2) AS unitcost,
      SUM(IFNULL(op.qty, 0)) AS total_qty,
      ROUND(SUM(IFNULL(op.qty, 0)) * IFNULL(d.unitcost, 0), 2) AS total_cost,
      IFNULL(d.did, d.nhso_adp_code) AS nhso_adp_code
  FROM drugitems d
  LEFT JOIN opitemrece op ON d.icode = op.icode AND op.vstdate BETWEEN ? AND ?
  WHERE ${HERB_DRUG_FILTER}
  GROUP BY d.icode, d.name, d.unitcost, d.did, d.nhso_adp_code
  ORDER BY total_qty DESC, d.name ASC
`

/** SQL Query 1 — starts from ovst (indexed by vstdate) */
const PRESCRIPTION_SQL = `
  SELECT
      o.vn,
      o.vstdate AS visit_date,
      o.vsttime AS visit_time,
      o.hn,
      CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS patient_name,
      ps.name AS pttype_name,
      d.icode AS drug_icode,
      d.name AS drug_name,
      op.qty AS drug_qty,
      sp.name AS department_name,
      ov.pdx AS main_pdx,
      ov.pdx AS pdx,
      ov.dx0, ov.dx1, ov.dx2, ov.dx3, ov.dx4, ov.dx5,
      o.doctor AS doctor_code,
      doc.name AS doctor_name,
      CASE
          WHEN ov.pdx IS NULL OR TRIM(ov.pdx) = '' THEN 'INCOMPLETE'
          WHEN (ov.pdx LIKE 'U%' OR ov.dx0 LIKE 'U%' OR ov.dx1 LIKE 'U%' OR ov.dx2 LIKE 'U%' OR ov.dx3 LIKE 'U%') THEN 'COMPLETE'
          ELSE 'INCOMPLETE'
      END AS audit_status
  FROM ovst o
  INNER JOIN opitemrece op ON o.vn = op.vn
  INNER JOIN vn_stat ov ON o.vn = ov.vn
  INNER JOIN patient pt ON o.hn = pt.hn
  INNER JOIN drugitems d ON op.icode = d.icode
  LEFT JOIN pttype ps ON o.pttype = ps.pttype
  LEFT JOIN spclty sp ON o.spclty = sp.spclty
  LEFT JOIN doctor doc ON o.doctor = doc.code
  WHERE o.vstdate BETWEEN ? AND ?
    AND (d.name LIKE '%สมุนไพร%' OR d.drugcategory LIKE '%สมุนไพร%' OR sp.name LIKE '%แพทย์แผนไทย%')
  ORDER BY o.vstdate DESC, o.vsttime DESC
`

const toNum = (v) => Number(v ?? 0)

export function normalizeDrugRow(r) {
  return {
    icode: r.icode,
    name: r.name,
    opd_qty: toNum(r.opd_qty),
    ipd_qty: toNum(r.ipd_qty),
    unitcost: toNum(r.unitcost),
    total_qty: toNum(r.total_qty),
    total_cost: toNum(r.total_cost),
    nhso_adp_code: r.nhso_adp_code ?? '',
  }
}

/** Live drug summary straight from HOSxP for any period */
export async function fetchDrugSummary(hosPoolOrConn, startDate, endDate) {
  const [rows] = await hosPoolOrConn.query(DRUG_SUMMARY_SQL, [startDate, endDate])
  return rows.map(normalizeDrugRow)
}

/**
 * Pull HOSxP data for a period and store it into dw_hd-check.
 * Prescriptions of the period are replaced atomically (transaction).
 */
export async function syncHerbalData(startDate, endDate, trigger = 'MANUAL') {
  const t0 = Date.now()
  const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })

  try {
    const drugs = await fetchDrugSummary(hos, startDate, endDate)
    const [presc] = await hos.query(PRESCRIPTION_SQL, [startDate, endDate])

    await dw.beginTransaction()

    if (drugs.length) {
      await dw.query(
        `INSERT INTO dw_hd_check_drugs (icode, name, opd_qty, ipd_qty, unitcost, total_qty, total_cost, nhso_adp_code)
         VALUES ?
         ON DUPLICATE KEY UPDATE name=VALUES(name), opd_qty=VALUES(opd_qty), ipd_qty=VALUES(ipd_qty),
           unitcost=VALUES(unitcost), total_qty=VALUES(total_qty), total_cost=VALUES(total_cost),
           nhso_adp_code=VALUES(nhso_adp_code), last_sync=NOW()`,
        [drugs.map((d) => [d.icode, d.name, d.opd_qty, d.ipd_qty, d.unitcost, d.total_qty, d.total_cost, d.nhso_adp_code])]
      )
      // Register any new herbal drug in the ICD map (empty rule) + refresh names
      await dw.query(
        `INSERT INTO dw_hd_check_drug_dx_map (icode, drug_name) VALUES ?
         ON DUPLICATE KEY UPDATE drug_name = VALUES(drug_name)`,
        [drugs.map((d) => [d.icode, d.name])]
      )
    }

    await dw.query('DELETE FROM dw_hd_check_prescriptions WHERE visit_date BETWEEN ? AND ?', [startDate, endDate])

    const values = presc.map((p) => [
      p.vn ?? '', p.visit_date, p.visit_time, p.hn, p.patient_name ?? '', p.pttype_name ?? '',
      p.drug_icode ?? '', p.drug_name ?? '', toNum(p.drug_qty) || 1, p.department_name ?? '',
      p.main_pdx ?? '', p.pdx ?? '', p.dx0 ?? '', p.dx1 ?? '', p.dx2 ?? '', p.dx3 ?? '', p.dx4 ?? '', p.dx5 ?? '',
      p.doctor_code ?? '', p.doctor_name ?? '', p.audit_status,
    ])
    for (let i = 0; i < values.length; i += 500) {
      await dw.query(
        `INSERT INTO dw_hd_check_prescriptions
         (vn, visit_date, visit_time, hn, patient_name, pttype_name, drug_icode, drug_name, drug_qty, department_name,
          main_pdx, pdx, dx0, dx1, dx2, dx3, dx4, dx5, doctor_code, doctor_name, audit_status)
         VALUES ?`,
        [values.slice(i, i + 500)]
      )
    }

    await dw.commit()

    const result = {
      success: true,
      startDate,
      endDate,
      trigger,
      totalPrescriptions: presc.length,
      totalDrugs: drugs.length,
      durationMs: Date.now() - t0,
      timestamp: new Date().toISOString(),
    }
    await dw.query(
      `INSERT INTO dw_hd_check_sync_log (start_date, end_date, trigger_type, total_prescriptions, total_drugs, duration_ms, status)
       VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS')`,
      [startDate, endDate, trigger, presc.length, drugs.length, result.durationMs]
    )
    return result
  } catch (err) {
    await dw.rollback().catch(() => {})
    await dw
      .query(
        `INSERT INTO dw_hd_check_sync_log (start_date, end_date, trigger_type, duration_ms, status, message)
         VALUES (?, ?, ?, ?, 'ERROR', ?)`,
        [startDate, endDate, trigger, Date.now() - t0, String(err.message).slice(0, 500)]
      )
      .catch(() => {})
    throw err
  } finally {
    await hos.end().catch(() => {})
    await dw.end().catch(() => {})
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('server/sync.mjs')) {
  const [, , start = '2026-10-01', end = '2026-10-31'] = process.argv
  syncHerbalData(start, end)
    .then((r) => {
      console.log(r)
      process.exit(0)
    })
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
