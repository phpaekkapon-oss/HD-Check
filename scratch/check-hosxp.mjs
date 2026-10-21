import mysql from 'mysql2/promise'
import { HOS_DB_BASE, HOS_DB, DW_DB_BASE, DW_DB } from '../backend/config.mjs'

async function main() {
  const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })

  console.log('====================================================')
  console.log('1. HOSxP: OVST (Visits of 000099690 on 2026-10-20)')
  console.log('====================================================')
  const [visits] = await hos.query(`
    SELECT o.vn, o.hn, o.vstdate, o.vsttime, o.spclty, sp.name as spclty_name, o.doctor, d.name as doctor_name, ov.pdx, ov.dx0, ov.dx1, ov.dx2
    FROM ovst o
    LEFT JOIN spclty sp ON o.spclty = sp.spclty
    LEFT JOIN doctor d ON o.doctor = d.code
    LEFT JOIN vn_stat ov ON o.vn = ov.vn
    WHERE o.hn = '000099690' AND o.vstdate = '2026-10-20'
  `)
  console.table(visits)

  console.log('====================================================')
  console.log('2. HOSxP: OVSTDIAG (Diagnoses of 000099690 on 2026-10-20)')
  console.log('====================================================')
  const [diags] = await hos.query(`
    SELECT od.vn, od.icd10, od.diagtype, od.doctor, d.name as doc_name, ic.name as icd_name
    FROM ovstdiag od
    JOIN ovst o ON od.vn = o.vn
    LEFT JOIN doctor d ON od.doctor = d.code
    LEFT JOIN icd101 ic ON od.icd10 = ic.code
    WHERE o.hn = '000099690' AND o.vstdate = '2026-10-20'
  `)
  console.table(diags)

  console.log('====================================================')
  console.log('3. HOSxP: HEALTH_MED_SERVICE (F7 Diagnoses of 000099690 on 2026-10-20)')
  console.log('====================================================')
  const [hms] = await hos.query(`
    SELECT hms.health_med_service_id, hms.vn, hms.hn, hms.service_date, hms.service_time, hmd.icd10, hmd.ovst_diag_id
    FROM health_med_service hms
    LEFT JOIN health_med_service_diagnosis hmd ON hms.health_med_service_id = hmd.health_med_service_id
    WHERE hms.hn = '000099690' AND hms.service_date = '2026-10-20'
  `)
  console.table(hms)

  console.log('====================================================')
  console.log('4. HOSxP: OPITEMRECE (Herbal Drugs prescribed for 000099690 on 2026-10-20)')
  console.log('====================================================')
  const [drugs] = await hos.query(`
    SELECT op.vn, op.hn, op.vstdate, op.icode, d.name as drug_name, op.qty, op.doctor, doc.name as doc_name
    FROM opitemrece op
    JOIN drugitems d ON op.icode = d.icode
    LEFT JOIN doctor doc ON op.doctor = doc.code
    WHERE op.hn = '000099690' AND op.vstdate = '2026-10-20'
  `)
  console.table(drugs)

  console.log('====================================================')
  console.log('5. DW: Current row in dw_hd_check_prescriptions for 000099690')
  console.log('====================================================')
  const [dwRows] = await dw.query(`
    SELECT id, vn, visit_date, visit_time, hn, patient_name, drug_name, drug_qty, department_name, main_pdx, pdx, dx0, dx1, doctor_name, audit_status
    FROM dw_hd_check_prescriptions
    WHERE hn = '000099690' AND visit_date = '2026-10-20'
  `)
  console.table(dwRows)

  await hos.end()
  await dw.end()
}

main().catch(console.error)
