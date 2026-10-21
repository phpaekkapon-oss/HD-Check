import mysql from 'mysql2/promise'
import { HOS_DB_BASE, DW_DB_BASE, HOS_DB, DW_DB, HERB_DRUG_FILTER, THAI_MED_FILTER, SYNC_ENABLED, buildThaiMedDoctorSql } from './config.mjs'

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
  const docFilter = buildThaiMedDoctorSql('doc')
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
    LEFT JOIN doctor doc ON o.doctor = doc.code
    WHERE op.vstdate BETWEEN ? AND ?
      AND (
        ((op.an IS NULL OR op.an = '') AND ${docFilter})
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

const ipdDx = (n) => getCodeAt("COALESCE(NULLIF(dgx.codes, ''), adx.codes, '')", n)
const opdSecDx = (n) => getCodeAt('sec.all_sec_codes', n)

/** Placeholders: OPD lv (start, end), OPD sec o2 (start, end), OPD sec hms (start, end), OPD sec o3 (start, end), OPD plv (start, end), OPD (start, end), IPD dgx (start, end), IPD adx (start, end), IPD (start, end) */
export function buildPrescriptionSql(customIcodes = []) {
  const filter = buildHerbFilter(customIcodes)
  const docFilter = buildThaiMedDoctorSql('doc')
  const dMaxFilter = buildThaiMedDoctorSql('d_max')
  const d2Filter = buildThaiMedDoctorSql('d2')
  const d3Filter = buildThaiMedDoctorSql('d3')
  const dMFilter = buildThaiMedDoctorSql('d_m')
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
        COALESCE(NULLIF(TRIM(od_pdx.icd10), ''), NULLIF(TRIM(ov.pdx), ''), NULLIF(TRIM(od1.icd10), ''), NULLIF(TRIM(ov_latest.pdx), ''), NULLIF(TRIM(ov_period.pdx), ''), '') AS main_pdx,
        COALESCE(NULLIF(TRIM(od_pdx.icd10), ''), NULLIF(TRIM(ov.pdx), ''), NULLIF(TRIM(od1.icd10), ''), NULLIF(TRIM(ov_latest.pdx), ''), NULLIF(TRIM(ov_period.pdx), ''), '') AS pdx,
        ${opdSecDx(1)} AS dx0,
        ${opdSecDx(2)} AS dx1,
        ${opdSecDx(3)} AS dx2,
        ${opdSecDx(4)} AS dx3,
        ${opdSecDx(5)} AS dx4,
        ${opdSecDx(6)} AS dx5,
        o.doctor AS doctor_code,
        doc.name AS doctor_name,
        CASE
            WHEN COALESCE(NULLIF(TRIM(od_pdx.icd10), ''), NULLIF(TRIM(ov.pdx), ''), NULLIF(TRIM(od1.icd10), ''), NULLIF(TRIM(ov_latest.pdx), ''), NULLIF(TRIM(ov_period.pdx), '')) IS NULL THEN 'INCOMPLETE'
            WHEN (
              COALESCE(od_pdx.icd10, ov.pdx, od1.icd10, ov_latest.pdx, ov_period.pdx, '') LIKE 'U%'
              OR CONCAT(',', IFNULL(sec.all_sec_codes, '')) LIKE '%,U%'
            ) THEN 'COMPLETE'
            ELSE 'INCOMPLETE'
        END AS audit_status
    FROM ovst o
    INNER JOIN opitemrece op ON o.vn = op.vn
    LEFT JOIN vn_stat ov ON o.vn = ov.vn
    INNER JOIN patient pt ON o.hn = pt.hn
    INNER JOIN drugitems d ON op.icode = d.icode
    LEFT JOIN pttype ps ON o.pttype = ps.pttype
    LEFT JOIN spclty sp ON o.spclty = sp.spclty
    INNER JOIN doctor doc ON o.doctor = doc.code AND ${docFilter}
    -- 1) Visit ล่าสุดของผู้ป่วยในวันเดียวกัน (เฉพาะแพทย์แผนไทย 5 ท่าน)
    LEFT JOIN (
      SELECT o_max.hn, o_max.vstdate, MAX(o_max.vn) AS latest_vn
      FROM ovst o_max
      INNER JOIN doctor d_max ON o_max.doctor = d_max.code AND ${dMaxFilter}
      WHERE o_max.vstdate BETWEEN ? AND ?
      GROUP BY o_max.hn, o_max.vstdate
    ) lv ON o.hn = lv.hn AND o.vstdate = lv.vstdate
    LEFT JOIN vn_stat ov_latest ON ov_latest.vn = lv.latest_vn
    -- 2) รหัสวินิจฉัยหลัก (PDX) จาก ovstdiag ของ visit นี้ หรือ visit ล่าสุดของแพทย์แผนไทย
    LEFT JOIN ovstdiag od_pdx ON od_pdx.vn = o.vn AND od_pdx.diagtype = '1'
    LEFT JOIN ovstdiag od1 ON od1.vn = lv.latest_vn AND od1.diagtype = '1'
    -- 3) รหัสวินิจฉัยรองทั้งหมด: รวมรหัสแผนปัจจุบันจาก ovstdiag (priority 1) + รหัส U จาก F7 health_med_service_diagnosis (priority 2) + รหัส U จาก ovstdiag (priority 3)
    LEFT JOIN (
      SELECT t.hn, t.vstdate, GROUP_CONCAT(DISTINCT t.icd10 ORDER BY t.priority, t.icd10 SEPARATOR ',') AS all_sec_codes
      FROM (
        SELECT o2.hn, o2.vstdate, od.icd10, 1 AS priority
        FROM ovstdiag od
        INNER JOIN ovst o2 ON od.vn = o2.vn
        INNER JOIN doctor d2 ON o2.doctor = d2.code AND ${d2Filter}
        WHERE od.diagtype <> '1' AND od.icd10 IS NOT NULL AND od.icd10 <> '' AND od.icd10 NOT LIKE 'U%'
          AND o2.vstdate BETWEEN ? AND ?

        UNION

        SELECT hms.hn, hms.service_date AS vstdate, hmd.icd10, 2 AS priority
        FROM health_med_service_diagnosis hmd
        JOIN health_med_service hms ON hms.health_med_service_id = hmd.health_med_service_id
        WHERE hms.service_date BETWEEN ? AND ?
          AND hmd.icd10 IS NOT NULL AND hmd.icd10 <> '' AND hmd.icd10 LIKE 'U%'

        UNION

        SELECT o3.hn, o3.vstdate, od3.icd10, 3 AS priority
        FROM ovstdiag od3
        INNER JOIN ovst o3 ON od3.vn = o3.vn
        INNER JOIN doctor d3 ON o3.doctor = d3.code AND ${d3Filter}
        WHERE od3.icd10 IS NOT NULL AND od3.icd10 <> '' AND od3.icd10 LIKE 'U%'
          AND o3.vstdate BETWEEN ? AND ?
      ) t
      GROUP BY t.hn, t.vstdate
    ) sec ON o.hn = sec.hn AND o.vstdate = sec.vstdate
    -- 4) Visit ล่าสุดของผู้ป่วยในช่วงเวลา (เฉพาะแพทย์แผนไทย 5 ท่าน)
    LEFT JOIN (
      SELECT o_m.hn, MAX(o_m.vn) AS period_latest_vn
      FROM ovst o_m
      INNER JOIN doctor d_m ON o_m.doctor = d_m.code AND ${dMFilter}
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
        IFNULL(NULLIF(TRIM(id1.icd10), ''), IFNULL(ad1.icd10, '')) AS main_pdx,
        IFNULL(NULLIF(TRIM(id1.icd10), ''), IFNULL(ad1.icd10, '')) AS pdx,
        ${ipdDx(1)} AS dx0,
        ${ipdDx(2)} AS dx1,
        ${ipdDx(3)} AS dx2,
        ${ipdDx(4)} AS dx3,
        ${ipdDx(5)} AS dx4,
        ${ipdDx(6)} AS dx5,
        IFNULL(op.doctor, IFNULL(i.admdoctor, '')) AS doctor_code,
        IFNULL(doc.name, 'แพทย์ประจำหอผู้ป่วย') AS doctor_name,
        CASE
            WHEN COALESCE(NULLIF(TRIM(id1.icd10), ''), ad1.icd10) IS NULL OR TRIM(COALESCE(NULLIF(TRIM(id1.icd10), ''), ad1.icd10)) = '' THEN 'INCOMPLETE'
            WHEN (COALESCE(NULLIF(TRIM(id1.icd10), ''), ad1.icd10) LIKE 'U%' OR CONCAT(',', IFNULL(COALESCE(NULLIF(dgx.codes, ''), adx.codes), '')) LIKE '%,U%') THEN 'COMPLETE'
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
    -- รหัสแรกรับตอนรับตัวเข้านอน รพ. จาก OPD/ER (เผื่อเคสที่ยังนอนรักษาตัวอยู่ หรือชาร์ตยังไม่สรุป)
    LEFT JOIN ovstdiag ad1 ON ad1.vn = i.vn AND ad1.diagtype = '1'
    -- รหัสวินิจฉัยรองทั้งหมดของ AN: diagtype 2 มีได้หลายแถว ต้องรวมทุกแถว (JOIN ทีละ diagtype เก็บได้แค่แถวเดียว)
    LEFT JOIN (
      SELECT dg.an, GROUP_CONCAT(DISTINCT dg.icd10 ORDER BY dg.diagtype, dg.icd10 SEPARATOR ',') AS codes
      FROM iptdiag dg
      WHERE dg.diagtype <> '1' AND dg.icd10 IS NOT NULL AND dg.icd10 <> ''
        AND dg.an IN (SELECT o2.an FROM opitemrece o2 WHERE o2.vstdate BETWEEN ? AND ? AND o2.an IS NOT NULL AND o2.an <> '')
      GROUP BY dg.an
    ) dgx ON op.an = dgx.an
    -- รหัสวินิจฉัยรองแรกรับจาก OPD/ER
    LEFT JOIN (
      SELECT od2.vn, GROUP_CONCAT(DISTINCT od2.icd10 ORDER BY (od2.icd10 LIKE 'U%') ASC, od2.diagtype, od2.icd10 SEPARATOR ',') AS codes
      FROM ovstdiag od2
      WHERE od2.diagtype <> '1' AND od2.icd10 IS NOT NULL AND od2.icd10 <> ''
        AND od2.vn IN (SELECT i2.vn FROM ipt i2 WHERE i2.an IN (SELECT o2.an FROM opitemrece o2 WHERE o2.vstdate BETWEEN ? AND ? AND o2.an IS NOT NULL AND o2.an <> ''))
      GROUP BY od2.vn
    ) adx ON adx.vn = i.vn
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
      startDate, endDate, // OPD lv: latest visit of the day (เฉพาะแพทย์แผนไทย 5 ท่าน)
      startDate, endDate, // OPD sec: o2 non-U secondary from ovstdiag
      startDate, endDate, // OPD sec: hms U-codes from F7
      startDate, endDate, // OPD sec: o3 U-codes from ovstdiag
      startDate, endDate, // OPD plv: latest visit in period (เฉพาะแพทย์แผนไทย 5 ท่าน)
      startDate, endDate, // OPD main: vstdate
      startDate, endDate, // IPD dgx: iptdiag secondary codes
      startDate, endDate, // IPD adx: ovstdiag secondary admitting codes
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
