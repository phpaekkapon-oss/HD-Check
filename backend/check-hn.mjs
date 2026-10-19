import mysql from 'mysql2/promise'
import { HOS_DB_BASE, HOS_DB, DW_DB_BASE, DW_DB } from './config.mjs'

async function check() {
  console.log('Connecting to HOSxP...')
  const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })

  const hns = ['000060788', '000106939']
  console.log('\n--- 1. Check ovst visits for HNs ---')
  const [visits] = await hos.query(`
    SELECT o.vn, o.hn, o.vstdate, o.vsttime, o.spclty, sp.name AS spclty_name, o.cur_dep, o.doctor, doc.name AS doctor_name
    FROM ovst o
    LEFT JOIN spclty sp ON o.spclty = sp.spclty
    LEFT JOIN doctor doc ON o.doctor = doc.code
    WHERE o.hn IN (?) AND o.vstdate BETWEEN '2026-10-01' AND '2026-10-31'
    ORDER BY o.hn, o.vstdate DESC, o.vsttime DESC
  `, [hns])
  console.log('Visits in HOSxP:', JSON.stringify(visits, null, 2))

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
