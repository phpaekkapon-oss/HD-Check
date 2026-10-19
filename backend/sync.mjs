import mysql from 'mysql2/promise'
import { HOS_DB_BASE, DW_DB_BASE, HOS_DB, DW_DB, HERB_DRUG_FILTER, THAI_MED_FILTER, SYNC_ENABLED } from './config.mjs'

export function buildHerbFilter(customIcodes = []) {
  const cleanIcodes = (customIcodes || [])
    .map((c) => String(c).trim().replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)

  if (cleanIcodes.length === 0) {
    return HERB_DRUG_FILTER
  }
  const inList = cleanIcodes.map((c) => `'${c}'`).join(',')
  return `((${HERB_DRUG_FILTER}) OR (d.istatus = 'Y' AND d.icode IN (${inList})))`
}

export function buildDrugSummarySql(customIcodes = []) {
  const filter = buildHerbFilter(customIcodes)
  return `
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
  WHERE ${filter}
  GROUP BY d.icode, d.name, d.units, d.unitcost, d.did, d.nhso_adp_code
  ORDER BY total_qty DESC, d.name ASC
`
}

/** รหัสวินิจฉัยรองลำดับที่ n (1-based) จาก codes string, ว่างถ้ามีไม่ถึง n รหัส */
const getCodeAt = (field, n) =>
  `IF(IFNULL(${field}, '') <> '' AND LENGTH(${field}) - LENGTH(REPLACE(${field}, ',', '')) >= ${n - 1},
     SUBSTRING_INDEX(SUBSTRING_INDEX(${field}, ',', ${n}), ',', -1), '')`

const ipdDx = (n) => getCodeAt('dgx.codes', n)
const opdDx = (n) => getCodeAt('odx.codes', n)

/** Placeholders: OPD lv (start, end), OPD odx (start, end), OPD plv (start, end), OPD (start, end), IPD dgx (start, end), IPD (start, end) */
export function buildPrescriptionSql(customIcodes = []) {
  const filter = buildHerbFilter(customIcodes)
  return `
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
        COALESCE(NULLIF(TRIM(ov_latest.pdx), ''), NULLIF(TRIM(od1.icd10), ''), NULLIF(TRIM(ov.pdx), ''), NULLIF(TRIM(ov_period.pdx), ''), '') AS main_pdx,
        COALESCE(NULLIF(TRIM(ov_latest.pdx), ''), NULLIF(TRIM(od1.icd10), ''), NULLIF(TRIM(ov.pdx), ''), NULLIF(TRIM(ov_period.pdx), ''), '') AS pdx,
        COALESCE(NULLIF(${opdDx(1)}, ''), NULLIF(TRIM(ov_latest.dx0), ''), NULLIF(TRIM(ov.dx0), ''), NULLIF(TRIM(ov_period.dx0), ''), '') AS dx0,
        COALESCE(NULLIF(${opdDx(2)}, ''), NULLIF(TRIM(ov_latest.dx1), ''), NULLIF(TRIM(ov.dx1), ''), NULLIF(TRIM(ov_period.dx1), ''), '') AS dx1,
        COALESCE(NULLIF(${opdDx(3)}, ''), NULLIF(TRIM(ov_latest.dx2), ''), NULLIF(TRIM(ov.dx2), ''), NULLIF(TRIM(ov_period.dx2), ''), '') AS dx2,
        COALESCE(NULLIF(${opdDx(4)}, ''), NULLIF(TRIM(ov_latest.dx3), ''), NULLIF(TRIM(ov.dx3), ''), NULLIF(TRIM(ov_period.dx3), ''), '') AS dx3,
        COALESCE(NULLIF(${opdDx(5)}, ''), NULLIF(TRIM(ov_latest.dx4), ''), NULLIF(TRIM(ov.dx4), ''), NULLIF(TRIM(ov_period.dx4), ''), '') AS dx4,
        COALESCE(NULLIF(${opdDx(6)}, ''), NULLIF(TRIM(ov_latest.dx5), ''), NULLIF(TRIM(ov.dx5), ''), NULLIF(TRIM(ov_period.dx5), ''), '') AS dx5,
        o.doctor AS doctor_code,
        doc.name AS doctor_name,
        CASE
            WHEN COALESCE(NULLIF(TRIM(ov_latest.pdx), ''), NULLIF(TRIM(od1.icd10), ''), NULLIF(TRIM(ov.pdx), ''), NULLIF(TRIM(ov_period.pdx), '')) IS NULL THEN 'INCOMPLETE'
            WHEN (
              COALESCE(ov_latest.pdx, od1.icd10, ov.pdx, ov_period.pdx, '') LIKE 'U%'
              OR COALESCE(ov_latest.dx0, ov.dx0, ov_period.dx0, '') LIKE 'U%'
              OR COALESCE(ov_latest.dx1, ov.dx1, ov_period.dx1, '') LIKE 'U%'
              OR CONCAT(',', IFNULL(odx.codes, '')) LIKE '%,U%'
            ) THEN 'COMPLETE'
            ELSE 'INCOMPLETE'
        END AS audit_status
    FROM ovst o
    INNER JOIN opitemrece op ON o.vn = op.vn
    LEFT JOIN vn_stat ov ON o.vn = ov.vn
    INNER JOIN patient pt ON o.hn = pt.hn
    INNER JOIN drugitems d ON op.icode = d.icode
    LEFT JOIN pttype ps ON o.pttype = ps.pttype
    INNER JOIN spclty sp ON o.spclty = sp.spclty AND ${THAI_MED_FILTER}
    LEFT JOIN doctor doc ON o.doctor = doc.code
    -- 1) Visit ล่าสุดของผู้ป่วยในวันเดียวกัน (Latest Visit of the day for this HN)
    LEFT JOIN (
      SELECT o_max.hn, o_max.vstdate, MAX(o_max.vn) AS latest_vn
      FROM ovst o_max
      WHERE o_max.vstdate BETWEEN ? AND ?
      GROUP BY o_max.hn, o_max.vstdate
    ) lv ON o.hn = lv.hn AND o.vstdate = lv.vstdate
    LEFT JOIN vn_stat ov_latest ON ov_latest.vn = lv.latest_vn
    -- 2) รหัสวินิจฉัยหลัก (PDX) จาก ovstdiag เผื่อ vn_stat ของ visit ล่าสุดยังไม่อัปเดต
    LEFT JOIN ovstdiag od1 ON od1.vn = COALESCE(lv.latest_vn, o.vn) AND od1.diagtype = '1'
    -- 3) รหัสวินิจฉัยรอง/อื่นๆ ทั้งหมดของผู้ป่วยในวันนั้นจาก ovstdiag (เรียง non-U ขึ้นก่อน เพื่อไม่ให้ U-codes เบียดรหัสโรคแผนปัจจุบันหลุดจาก 6 ช่อง)
    LEFT JOIN (
      SELECT o2.hn, o2.vstdate, 
             GROUP_CONCAT(DISTINCT od.icd10 ORDER BY (od.icd10 LIKE 'U%') ASC, od.diagtype, od.icd10 SEPARATOR ',') AS codes
      FROM ovstdiag od
      INNER JOIN ovst o2 ON od.vn = o2.vn
      WHERE od.diagtype <> '1' AND od.icd10 IS NOT NULL AND od.icd10 <> ''
        AND o2.vstdate BETWEEN ? AND ?
      GROUP BY o2.hn, o2.vstdate
    ) odx ON o.hn = odx.hn AND o.vstdate = odx.vstdate
    -- 4) Visit ล่าสุดของผู้ป่วยในช่วงเวลา (เผื่อกรณีมารับยาต่อเนื่องแต่รหัสวินิจฉัยอยู่ที่ visit ล่าสุดในรอบเดือน)
    LEFT JOIN (
      SELECT o_m.hn, MAX(o_m.vn) AS period_latest_vn
      FROM ovst o_m
      WHERE o_m.vstdate BETWEEN ? AND ?
      GROUP BY o_m.hn
    ) plv ON o.hn = plv.hn
    LEFT JOIN vn_stat ov_period ON ov_period.vn = plv.period_latest_vn
    WHERE o.vstdate BETWEEN ? AND ?
      AND (op.an IS NULL OR op.an = '')
      AND ${filter}
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
        ${ipdDx(1)} AS dx0,
        ${ipdDx(2)} AS dx1,
        ${ipdDx(3)} AS dx2,
        ${ipdDx(4)} AS dx3,
        ${ipdDx(5)} AS dx4,
        ${ipdDx(6)} AS dx5,
        IFNULL(op.doctor, IFNULL(i.admdoctor, '')) AS doctor_code,
        IFNULL(doc.name, 'แพทย์ประจำหอผู้ป่วย') AS doctor_name,
        CASE
            WHEN id1.icd10 IS NULL OR TRIM(id1.icd10) = '' THEN 'INCOMPLETE'
            WHEN (id1.icd10 LIKE 'U%' OR CONCAT(',', IFNULL(dgx.codes, '')) LIKE '%,U%') THEN 'COMPLETE'
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
    -- รหัสวินิจฉัยรองทั้งหมดของ AN: diagtype 2 มีได้หลายแถว ต้องรวมทุกแถว (JOIN ทีละ diagtype เก็บได้แค่แถวเดียว)
    LEFT JOIN (
      SELECT dg.an, GROUP_CONCAT(DISTINCT dg.icd10 ORDER BY dg.diagtype, dg.icd10 SEPARATOR ',') AS codes
      FROM iptdiag dg
      WHERE dg.diagtype <> '1' AND dg.icd10 IS NOT NULL AND dg.icd10 <> ''
        AND dg.an IN (SELECT o2.an FROM opitemrece o2 WHERE o2.vstdate BETWEEN ? AND ? AND o2.an IS NOT NULL AND o2.an <> '')
      GROUP BY dg.an
    ) dgx ON op.an = dgx.an
    WHERE op.vstdate BETWEEN ? AND ?
      AND (op.an IS NOT NULL AND op.an <> '')
      AND ${filter}
    GROUP BY op.hos_guid
  )
  ORDER BY visit_date DESC, visit_time DESC
`
}

/** SQL Query 2 — captures both OPD (Thai Med) and IPD herbal drug dispensing accurately */
const DRUG_SUMMARY_SQL = buildDrugSummarySql()

/** SQL Query 1 — combines OPD (Thai Med) and IPD herbal prescriptions */
const PRESCRIPTION_SQL = buildPrescriptionSql()

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
export async function fetchDrugSummary(hosPoolOrConn, startDate, endDate, customIcodes = []) {
  const sql = customIcodes && customIcodes.length > 0 ? buildDrugSummarySql(customIcodes) : DRUG_SUMMARY_SQL
  const [rows] = await hosPoolOrConn.query(sql, [startDate, endDate])
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

    // Automatically incorporate custom icodes from the dx map settings
    const [mappedHerbs] = await dw.query('SELECT icode FROM dw_hd_check_drug_dx_map').catch(() => [[]])
    const customIcodes = mappedHerbs.map((r) => String(r.icode)).filter(Boolean)

    const drugs = await fetchDrugSummary(hos, startDate, endDate, customIcodes)
    const prescSql = customIcodes.length > 0 ? buildPrescriptionSql(customIcodes) : PRESCRIPTION_SQL
    const prescParams = [
      startDate, endDate, // OPD lv: latest visit of the day
      startDate, endDate, // OPD odx: ovstdiag secondary codes of the day
      startDate, endDate, // OPD plv: latest visit in period
      startDate, endDate, // OPD main: vstdate
      startDate, endDate, // IPD dgx: iptdiag secondary codes
      startDate, endDate, // IPD main: vstdate
    ]
    const [presc] = await hos.query(prescSql, prescParams)

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
      p.drug_icode ?? '', p.drug_name ?? '', toNum(p.drug_qty), p.drug_units ?? '', p.department_name ?? '',
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
