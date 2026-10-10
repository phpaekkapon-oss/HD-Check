import mysql from 'mysql2/promise'
import { HOS_DB_BASE, DW_DB_BASE, HOS_DB, DW_DB, HERB_DRUG_FILTER, THAI_MED_FILTER, SYNC_ENABLED } from './config.mjs'

/** SQL Query 2 — captures both OPD (Thai Med) and IPD herbal drug dispensing accurately */
const DRUG_SUMMARY_SQL = `
  SELECT
      d.icode,
      d.name,
      d.units,
      SUM(CASE WHEN (op.an IS NULL OR op.an = '') THEN IFNULL(op.qty, 0) ELSE 0 END) AS opd_qty,
      SUM(CASE WHEN (op.an IS NOT NULL AND op.an <> '') THEN IFNULL(op.qty, 0) ELSE 0 END) AS ipd_qty,
      ROUND(IFNULL(d.unitcost, 0), 2) AS unitcost,
      SUM(IFNULL(op.qty, 0)) AS total_qty,
      ROUND(SUM(IFNULL(op.qty, 0)) * IFNULL(d.unitcost, 0), 2) AS total_cost,
      IFNULL(d.did, d.nhso_adp_code) AS nhso_adp_code
  FROM drugitems d
  LEFT JOIN (
    SELECT op.icode, op.qty, op.an
    FROM opitemrece op
    LEFT JOIN ovst o ON op.vn = o.vn
    LEFT JOIN spclty sp ON o.spclty = sp.spclty
    WHERE op.vstdate BETWEEN ? AND ?
      AND (
        ((op.an IS NULL OR op.an = '') AND ${THAI_MED_FILTER})
        OR
        (op.an IS NOT NULL AND op.an <> '')
      )
  ) op ON d.icode = op.icode
  WHERE ${HERB_DRUG_FILTER}
  GROUP BY d.icode, d.name, d.units, d.unitcost, d.did, d.nhso_adp_code
  ORDER BY total_qty DESC, d.name ASC
`

/** SQL Query 1 — combines OPD (Thai Med) and IPD herbal prescriptions */
const PRESCRIPTION_SQL = `
  (
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
        IFNULL(d.units, '') AS drug_units,
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
    INNER JOIN spclty sp ON o.spclty = sp.spclty AND ${THAI_MED_FILTER}
    LEFT JOIN doctor doc ON o.doctor = doc.code
    WHERE o.vstdate BETWEEN ? AND ?
      AND ${HERB_DRUG_FILTER}
  )
  UNION ALL
  (
    SELECT
        CONCAT('AN:', op.an) AS vn,
        op.vstdate AS visit_date,
        IFNULL(op.vsttime, '08:00:00') AS visit_time,
        op.hn,
        CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS patient_name,
        ps.name AS pttype_name,
        d.icode AS drug_icode,
        d.name AS drug_name,
        op.qty AS drug_qty,
        IFNULL(d.units, '') AS drug_units,
        CONCAT('IPD: ', IFNULL(w.name, 'หอผู้ป่วยใน')) AS department_name,
        IFNULL(id1.icd10, '') AS main_pdx,
        IFNULL(id1.icd10, '') AS pdx,
        IFNULL(id2.icd10, '') AS dx0,
        IFNULL(id3.icd10, '') AS dx1,
        IFNULL(id4.icd10, '') AS dx2,
        IFNULL(id5.icd10, '') AS dx3,
        IFNULL(id6.icd10, '') AS dx4,
        '' AS dx5,
        IFNULL(op.doctor, IFNULL(i.admdoctor, '')) AS doctor_code,
        IFNULL(doc.name, 'แพทย์ประจำหอผู้ป่วย') AS doctor_name,
        CASE
            WHEN id1.icd10 IS NULL OR TRIM(id1.icd10) = '' THEN 'INCOMPLETE'
            WHEN (id1.icd10 LIKE 'U%' OR id2.icd10 LIKE 'U%' OR id3.icd10 LIKE 'U%') THEN 'COMPLETE'
            ELSE 'INCOMPLETE'
        END AS audit_status
    FROM opitemrece op
    INNER JOIN drugitems d ON op.icode = d.icode
    INNER JOIN patient pt ON op.hn = pt.hn
    LEFT JOIN ipt i ON op.an = i.an
    LEFT JOIN ward w ON i.ward = w.ward
    LEFT JOIN pttype ps ON i.pttype = ps.pttype
    LEFT JOIN doctor doc ON IFNULL(op.doctor, i.admdoctor) = doc.code
    LEFT JOIN iptdiag id1 ON op.an = id1.an AND id1.diagtype = '1'
    LEFT JOIN iptdiag id2 ON op.an = id2.an AND id2.diagtype = '2'
    LEFT JOIN iptdiag id3 ON op.an = id3.an AND id3.diagtype = '3'
    LEFT JOIN iptdiag id4 ON op.an = id4.an AND id4.diagtype = '4'
    LEFT JOIN iptdiag id5 ON op.an = id5.an AND id5.diagtype = '5'
    LEFT JOIN iptdiag id6 ON op.an = id6.an AND id6.diagtype = '6'
    WHERE op.vstdate BETWEEN ? AND ?
      AND (op.an IS NOT NULL AND op.an <> '')
      AND ${HERB_DRUG_FILTER}
    GROUP BY op.hos_guid
  )
  ORDER BY visit_date DESC, visit_time DESC
`

const toNum = (v) => Number(v ?? 0)

export function normalizeDrugRow(r) {
  return {
    icode: r.icode,
    name: r.name,
    units: r.units ?? '',
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
  if (!SYNC_ENABLED) {
    const err = new Error('ปิดการซิงก์ไว้ในสภาพแวดล้อมนี้ เพื่อป้องกันการเขียนทับคลังข้อมูล')
    err.status = 403
    err.code = 'SYNC_DISABLED'
    throw err
  }

  const t0 = Date.now()
  const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })
  let syncLockAcquired = false

  try {
    // Multiple app instances may point at the same warehouse. Serialize refreshes
    // across processes, not just within a single Node process.
    const [[lock]] = await dw.query("SELECT GET_LOCK('hd-check-herbal-sync', 0) AS acquired")
    syncLockAcquired = Number(lock.acquired) === 1
    if (!syncLockAcquired) {
      return {
        success: true,
        skipped: true,
        reason: 'another_sync_is_running',
        startDate,
        endDate,
        trigger,
        durationMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      }
    }

    const drugs = await fetchDrugSummary(hos, startDate, endDate)
    const [presc] = await hos.query(PRESCRIPTION_SQL, [startDate, endDate, startDate, endDate])

    // A stale/limited HOSxP source can return no rows for a period that already
    // has data in the warehouse. Never interpret that as an instruction to erase
    // the existing snapshot; keep it and make the skipped replacement visible.
    if (presc.length === 0) {
      const [[existing]] = await dw.query(
        'SELECT COUNT(*) AS total FROM dw_hd_check_prescriptions WHERE visit_date BETWEEN ? AND ?',
        [startDate, endDate]
      )
      if (Number(existing.total) > 0) {
        const durationMs = Date.now() - t0
        const message = `Preserved ${existing.total} existing rows because source returned 0 rows for ${startDate}..${endDate}`
        await dw.query(
          `INSERT INTO dw_hd_check_sync_log (start_date, end_date, trigger_type, total_prescriptions, total_drugs, duration_ms, status, message)
           VALUES (?, ?, ?, 0, ?, ?, 'SUCCESS', ?)`,
          [startDate, endDate, trigger, drugs.length, durationMs, message]
        )
        return {
          success: true,
          preservedExisting: true,
          warning: 'source_returned_zero_rows_existing_data_preserved',
          startDate,
          endDate,
          trigger,
          totalPrescriptions: Number(existing.total),
          totalDrugs: drugs.length,
          durationMs,
          timestamp: new Date().toISOString(),
        }
      }
    }

    await dw.beginTransaction()

    if (drugs.length) {
      await dw.query(
        `INSERT INTO dw_hd_check_drugs (icode, name, units, opd_qty, ipd_qty, unitcost, total_qty, total_cost, nhso_adp_code)
         VALUES ?
         ON DUPLICATE KEY UPDATE name=VALUES(name), units=VALUES(units), opd_qty=VALUES(opd_qty), ipd_qty=VALUES(ipd_qty),
           unitcost=VALUES(unitcost), total_qty=VALUES(total_qty), total_cost=VALUES(total_cost),
           nhso_adp_code=VALUES(nhso_adp_code), last_sync=NOW()`,
        [drugs.map((d) => [d.icode, d.name, d.units, d.opd_qty, d.ipd_qty, d.unitcost, d.total_qty, d.total_cost, d.nhso_adp_code])]
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
      p.drug_icode ?? '', p.drug_name ?? '', toNum(p.drug_qty) || 1, p.drug_units ?? '', p.department_name ?? '',
      p.main_pdx ?? '', p.pdx ?? '', p.dx0 ?? '', p.dx1 ?? '', p.dx2 ?? '', p.dx3 ?? '', p.dx4 ?? '', p.dx5 ?? '',
      p.doctor_code ?? '', p.doctor_name ?? '', p.audit_status,
    ])
    for (let i = 0; i < values.length; i += 500) {
      await dw.query(
        `INSERT INTO dw_hd_check_prescriptions
         (vn, visit_date, visit_time, hn, patient_name, pttype_name, drug_icode, drug_name, drug_qty, drug_units, department_name,
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
    if (syncLockAcquired) {
      await dw.query("SELECT RELEASE_LOCK('hd-check-herbal-sync')").catch(() => {})
    }
    await hos.end().catch(() => {})
    await dw.end().catch(() => {})
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('sync.mjs')) {
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
