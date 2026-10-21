import mysql from 'mysql2/promise';
import { HOS_DB_BASE, HOS_DB, DW_DB_BASE, DW_DB } from '../backend/config.mjs';

async function main() {
  const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB });
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB });

  const hns = ['000097348', '000028642', '000102301', '000084976', '000109839'];

  console.log('=== 1. CHECK DW DRUG DX MAP ===');
  const [dxMaps] = await dw.query(`SELECT drug_icode, drug_name, dx_prefixes, description FROM dw_hd_check_drug_dx_map WHERE drug_icode IN ('1680026', '1540012', '1550008')`);
  console.log(JSON.stringify(dxMaps, null, 2));

  console.log('\n=== 2. CHECK DW PRESCRIPTIONS ===');
  const [dwPrescs] = await dw.query(`SELECT id, visit_date, visit_time, hn, patient_name, drug_name, drug_icode, pdx, dx0, dx1, dx2, main_pdx, audit_status, audit_reason FROM dw_hd_check_prescriptions WHERE hn IN (?)`, [hns]);
  console.log(JSON.stringify(dwPrescs, null, 2));

  console.log('\n=== 3. CHECK HOSXP DATA ===');
  for (const hn of hns) {
    const [ov] = await hos.query(`SELECT vn, hn, vstdate, vsttime, cur_dep, doctor FROM ovst WHERE hn = ? AND vstdate >= '2026-10-18'`, [hn]);
    const vns = ov.map(r => r.vn);
    const [diag] = vns.length > 0 ? await hos.query(`SELECT vn, icd10, diagtype, doctor FROM ovstdiag WHERE vn IN (?)`, [vns]) : [[]];
    const [hm] = vns.length > 0 ? await hos.query(`SELECT health_med_service_id, vn, hn, service_date, service_time FROM health_med_service WHERE vn IN (?)`, [vns]) : [[]];
    const hmsIds = hm.map(r => r.health_med_service_id);
    const [hmdx] = hmsIds.length > 0 ? await hos.query(`SELECT health_med_service_id, icd10, diagnosis_type_id FROM health_med_service_diagnosis WHERE health_med_service_id IN (?)`, [hmsIds]) : [[]];
    const [drugs] = vns.length > 0 ? await hos.query(`SELECT vn, icode, qty, doctor FROM opitemrece WHERE vn IN (?) AND (icode LIKE '168%' OR icode LIKE '154%' OR icode LIKE '155%')`, [vns]) : [[]];
    console.log(`\n--- HN ${hn} ---`);
    console.log('OVST:', ov);
    console.log('OVSTDIAG:', diag);
    console.log('HEALTH_MED_SERVICE:', hm);
    console.log('HEALTH_MED_SERVICE_DIAGNOSIS:', hmdx);
    console.log('DRUGS:', drugs);
  }
  await hos.end();
  await dw.end();
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
