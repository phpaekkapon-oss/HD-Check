import mysql from 'mysql2/promise'
import { HOS_DB_BASE, HOS_DB, DW_DB_BASE, DW_DB } from './config.mjs'

async function check() {
  console.log('Connecting to HOSxP...')
  const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })

  const targetHns = ['000131626', '000079394', '000026779', '000128186', '000126108', '000101496', '000035119', '000207651']
  console.log('\n--- Checking visits & diags for all target HNs ---')
  console.log('\n--- Check nondrugitem 58001 ---')
  const [nd58001] = await hos.query(`
    SELECT icode, name, nhso_adp_code, price
    FROM nondrugitems
    WHERE icode = '58001' OR nhso_adp_code = '58001'
  `)
  console.log('58001 info:', nd58001)

  import('./healthmed.mjs').then(({ evaluateHealthMedAudit }) => {
    const naowaratRow = {
      hn: '000035119',
      vn: '691006144457',
      visit_date: '2026-10-06',
      age_y: 66,
      pttype_name: 'ผู้สูงอายุ',
      pttype_hipdata: 'UCS',
      service_items_raw: '58130:ค่านวดและประคบสมุนไพรเพื่อการบำบัดรักษาโรค:1:250',
      count_58130: 1,
      pdx: 'M7911',
      dx0: 'U5720',
      all_dx: ['M7911', 'U5720', 'M4782'],
      operations: [
        { code: '900-78-11', name: 'การนวดราชสำนัก' },
        { code: '900-78-20', name: 'การประคบสมุนไพร' },
      ],
      operation_codes: ['900-78-11', '900-78-20'],
    }
    const evalResult = evaluateHealthMedAudit(naowaratRow)
    console.log('\n--- Naowarat Visit 2 Audit Result ---')
    console.log('Status:', evalResult.status)
    console.log('Pass reasons:', evalResult.passes)
    console.log('Fail reasons:', evalResult.failures)
  })

  const [nHmsServices] = await hos.query(`
    SELECT hms.health_med_service_id, hms.vn, hms.service_date, hms.service_time, hms.health_med_treatment_type_id
    FROM health_med_service hms
    WHERE hms.hn = '000035119' AND hms.service_date = '2026-10-06'
  `)
  console.log('Naowarat HMS services:', nHmsServices)

  const [nHmsOpsByVn] = await hos.query(`
    SELECT hms.vn, hms.health_med_service_id, hmoi.icd10tm, hmoi.health_med_operation_item_name
    FROM health_med_service_operation hso
    JOIN health_med_service hms ON hso.health_med_service_id = hms.health_med_service_id
    JOIN health_med_operation_item hmoi ON hmoi.health_med_operation_item_id = hso.health_med_operation_item_id
    WHERE hms.hn = '000035119' AND hms.service_date = '2026-10-06'
  `)
  console.log('Naowarat HMS ops by VN:', nHmsOpsByVn)

  console.log('\n--- 2. Check Palliative Care & ยานวดชนิดหลอด (ไพล/พริก) & พ.ร.บ. in HOSxP ---')
  const [tubeDrugs] = await hos.query(`
    SELECT icode, name, drugcategory, units, unitprice, nhso_adp_code
    FROM drugitems
    WHERE (name LIKE '%เจล%' OR name LIKE '%ไพล%' OR name LIKE '%พริก%' OR name LIKE '%บาล์ม%' OR name LIKE '%ครีม%' OR name LIKE '%หลอด%' OR name LIKE '%ศุขไสยาศน์%' OR name LIKE '%กัญชา%')
      AND (drugcategory LIKE '%สมุนไพร%' OR name LIKE '%สมุนไพร%' OR icode LIKE '15%')
    LIMIT 20
  `)
  console.log('Herbal topical/tube & palliative drugs in hospital:', tubeDrugs)

  const [pttypesAct] = await hos.query(`
    SELECT pttype, name, hipdata_code, nhso_code
    FROM pttype
    WHERE name LIKE '%พรบ%' OR name LIKE '%พ.ร.บ%' OR name LIKE '%รถ%' OR hipdata_code LIKE '%ACT%'
  `)
  console.log('ACT / พรบ pttypes:', pttypesAct)

  const [dispensedDrugs] = await hos.query(`
    SELECT op.icode, d.name, op.pttype, pt.name as pttype_name, COUNT(*) as cnt
    FROM opitemrece op
    JOIN drugitems d ON op.icode = d.icode
    LEFT JOIN pttype pt ON op.pttype = pt.pttype
    WHERE op.vstdate BETWEEN '2026-10-01' AND '2026-10-31'
      AND op.icode IN ('1550011', '1550012', '1560035', '1650102', '1660043', '1630035', '1640016', '1640041')
    GROUP BY op.icode, d.name, op.pttype, pt.name
  `)
  console.log('Dispensed herbal tube/palliative drugs in Oct 2026:', dispensedDrugs)

  const [palliativeClinics] = await hos.query(`
    SELECT clinic, name FROM clinic WHERE name LIKE '%ประคับประคอง%' OR name LIKE '%palliative%' OR name LIKE '%มะเร็ง%'
  `)
  console.log('Palliative clinics:', palliativeClinics)

  await hos.end()
  await dw.end()
  process.exit(0)

  console.log('\n--- Check opitemrece for Naowarat 000035119 on 2026-10-06 ---')
  const [nOpitem] = await hos.query(`
    SELECT op.vn, op.hn, op.vstdate, op.icode, nd.nhso_adp_code, nd.name, op.qty, op.unitprice, op.sum_price
    FROM opitemrece op
    JOIN nondrugitems nd ON op.icode = nd.icode
    WHERE op.hn = '000035119' AND op.vstdate = '2026-10-06'
  `)
  console.log('Naowarat opitemrece:', nOpitem)

  const [hmsDetails] = await hos.query(`
    SELECT *
    FROM health_med_service
    WHERE hn = '000035119' AND service_date = '2026-10-06'
  `)
  console.log('Naowarat health_med_service full:', hmsDetails)

  console.log('\n--- Check 000131626 on 2026-10-15 (Screenshot 2) ---')
  const [s2Hms] = await hos.query(`
    SELECT hms.health_med_service_id, hms.vn, hms.hn, hms.service_date, hmd.icd10 as hmd_icd10, hmd.ovst_diag_id
    FROM health_med_service hms
    LEFT JOIN health_med_service_diagnosis hmd ON hmd.health_med_service_id = hms.health_med_service_id
    WHERE hms.hn = '000131626' AND hms.service_date = '2026-10-15'
  `)
  console.log('s2Hms:', s2Hms)

  const [s2Ovst] = await hos.query(`
    SELECT o.vn, o.hn, o.vstdate, o.vsttime, o.spclty, o.cur_dep, od.icd10, od.diagtype, od.doctor
    FROM ovst o
    LEFT JOIN ovstdiag od ON od.vn = o.vn
    WHERE o.hn = '000131626' AND o.vstdate = '2026-10-15'
  `)
  console.log('s2Ovst diags:', s2Ovst)

  console.log('\n--- Check Naowarat 000035119 on 2026-10-06 ---')
  const [nOvst] = await hos.query(`
    SELECT o.vn, o.hn, o.vstdate, o.vsttime, o.spclty, o.cur_dep, od.icd10, od.diagtype, od.doctor
    FROM ovst o
    LEFT JOIN ovstdiag od ON od.vn = o.vn
    WHERE o.hn = '000035119' AND o.vstdate = '2026-10-06'
  `)
  console.log('Naowarat ovst diags:', nOvst)

  const [nHmsAll] = await hos.query(`
    SELECT hms.health_med_service_id, hms.vn, hms.hn, hms.service_date, hmd.icd10 as hmd_icd10
    FROM health_med_service hms
    LEFT JOIN health_med_service_diagnosis hmd ON hmd.health_med_service_id = hms.health_med_service_id
    WHERE hms.hn = '000035119' AND hms.service_date = '2026-10-06'
  `)
  console.log('Naowarat all HMS diags:', nHmsAll)

  await hos.end()
  await dw.end()
  process.exit(0)

  console.log('\n--- 2. Check vn_stat for these visits ---')
  const vns = visits.map(v => v.vn)
  if (vns.length > 0) {
    const [stats] = await hos.query(`
      SELECT vn, hn, vstdate, pdx, dx0, dx1, dx2, dx3, dx4, dx5
      FROM vn_stat
      WHERE vn IN (?)
    `, [vns])
    console.log('vn_stat rows:', JSON.stringify(stats, null, 2))

    console.log('\n--- 3. Check ovstdiag for these visits ---')
    const [diags] = await hos.query(`
      SELECT od.vn, od.icd10, od.diagtype, od.doctor, ic.name AS icd_name
      FROM ovstdiag od
      LEFT JOIN icd101 ic ON od.icd10 = ic.code
      WHERE od.vn IN (?)
      ORDER BY od.vn, od.diagtype
    `, [vns])
    console.log('ovstdiag rows for visits:', JSON.stringify(diags, null, 2))

    console.log('\n--- 4. Check opitemrece (herbal drugs) for these visits ---')
    const [drugs] = await hos.query(`
      SELECT op.vn, op.hn, op.vstdate, op.icode, d.name AS drug_name, op.qty, op.unitprice
      FROM opitemrece op
      INNER JOIN drugitems d ON op.icode = d.icode
      WHERE op.vn IN (?) AND (d.drugcategory LIKE '%สมุนไพร%' OR d.name LIKE '%ทองพันชั่ง%' OR d.name LIKE '%ปราบชมพู%' OR d.name LIKE '%ศุขไสยาศน์%' OR d.name LIKE '%ชาสตรี%')
    `, [vns])
    console.log('opitemrece herbal drugs:', JSON.stringify(drugs, null, 2))
  }

  console.log('\n--- 5. Check dx map in DW for these drugs ---')
  const [dxMap] = await dw.query(`
    SELECT icode, drug_name, dx_prefixes, indication
    FROM dw_hd_check_drug_dx_map
    WHERE drug_name LIKE '%ทองพันชั่ง%' OR drug_name LIKE '%ปราบชมพู%' OR drug_name LIKE '%ศุขไสยาศน์%' OR drug_name LIKE '%ชาสตรี%'
  `)
  console.log('DW drug dx map:', JSON.stringify(dxMap, null, 2))

  await hos.end()
  await dw.end()
}

check().catch(console.error)
