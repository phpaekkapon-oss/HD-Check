import mysql from 'mysql2/promise'
import { HOS_DB_BASE, DW_DB_BASE, HOS_DB, DW_DB, HERB_DRUG_FILTER, THAI_MED_FILTER } from './config.mjs'

async function check() {
  console.log('กำลังเชื่อมต่อฐานข้อมูล HOSxP และ Data Warehouse...')
  const hos = await mysql.createConnection({ ...HOS_DB_BASE, database: HOS_DB })
  const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })

  const startDate = '2026-10-01'
  const endDate = '2026-10-31'

  console.log(`\n====================================================================`)
  console.log(`  ตรวจสอบเปรียบเทียบข้อมูล HOSxP (${HOS_DB}) กับ DW (${DW_DB}) [เฉพาะแผนกแพทย์แผนไทย]`)
  console.log(`  ช่วงวันที่: ${startDate} ถึง ${endDate}`)
  console.log(`====================================================================`)

  // 1. ตรวจสอบยอดรวม HOSxP vs DW
  const [[hosTotal]] = await hos.query(`
    SELECT COUNT(*) AS total
    FROM ovst o
    INNER JOIN opitemrece op ON o.vn = op.vn
    INNER JOIN vn_stat ov ON o.vn = ov.vn
    INNER JOIN patient pt ON o.hn = pt.hn
    INNER JOIN drugitems d ON op.icode = d.icode
    INNER JOIN spclty sp ON o.spclty = sp.spclty AND ${THAI_MED_FILTER}
    WHERE o.vstdate BETWEEN ? AND ?
      AND ${HERB_DRUG_FILTER}
  `, [startDate, endDate])

  const [[dwTotal]] = await dw.query(`
    SELECT COUNT(*) AS total
    FROM dw_hd_check_prescriptions
    WHERE visit_date BETWEEN ? AND ?
  `, [startDate, endDate])

  console.log(`[*] ยอดใบสั่งยาสมุนไพรใน HOSxP : ${hosTotal.total} รายการ`)
  console.log(`[*] ยอดใบสั่งยาสมุนไพรใน DW    : ${dwTotal.total} รายการ`)
  console.log(`[*] ผลการเปรียบเทียบ          : ${hosTotal.total === dwTotal.total ? 'ตรงกัน 100% [PASS]' : 'ไม่ตรงกัน [MISMATCH]'}`)

  // 2. ตรวจสอบแยกรายวัน
  console.log(`\n[*] ตรวจสอบแยกรายวัน (Daily Breakdown):`)
  const [hosByDate] = await hos.query(`
    SELECT o.vstdate as visit_date, COUNT(*) as count
    FROM ovst o
    INNER JOIN opitemrece op ON o.vn = op.vn
    INNER JOIN vn_stat ov ON o.vn = ov.vn
    INNER JOIN drugitems d ON op.icode = d.icode
    INNER JOIN spclty sp ON o.spclty = sp.spclty AND ${THAI_MED_FILTER}
    WHERE o.vstdate BETWEEN ? AND ?
      AND ${HERB_DRUG_FILTER}
    GROUP BY o.vstdate
    ORDER BY o.vstdate DESC
  `, [startDate, endDate])

  const [dwByDate] = await dw.query(`
    SELECT visit_date, COUNT(*) as count
    FROM dw_hd_check_prescriptions
    WHERE visit_date BETWEEN ? AND ?
    GROUP BY visit_date
    ORDER BY visit_date DESC
  `, [startDate, endDate])

  const dateMap = new Map()
  for (const r of hosByDate) {
    const d = typeof r.visit_date === 'string' ? r.visit_date : r.visit_date.toISOString().slice(0, 10)
    dateMap.set(d, { hos: r.count, dw: 0 })
  }
  for (const r of dwByDate) {
    const d = typeof r.visit_date === 'string' ? r.visit_date : r.visit_date.toISOString().slice(0, 10)
    if (!dateMap.has(d)) dateMap.set(d, { hos: 0, dw: r.count })
    else dateMap.get(d).dw = r.count
  }

  const tableData = []
  for (const [date, counts] of dateMap.entries()) {
    tableData.push({
      'วันที่': date,
      'HOSxP': counts.hos,
      'DW': counts.dw,
      'สถานะ': counts.hos === counts.dw ? ' ตรงกัน' : ' ไม่ตรงกัน'
    })
  }
  console.table(tableData)

  // 3. ตรวจสอบการตั้งค่าเกณฑ์ ICD-10 (Drug DX Map)
  console.log(`\n[*] รายการยาสมุนไพรและการตั้งค่าเกณฑ์ ICD-10 (dw_hd_check_drug_dx_map):`)
  const [mapRules] = await dw.query(`
    SELECT m.icode, m.drug_name, m.dx_prefixes, m.indication, COUNT(p.id) as total_prescriptions
    FROM dw_hd_check_drug_dx_map m
    LEFT JOIN dw_hd_check_prescriptions p ON m.icode = p.drug_icode AND p.visit_date BETWEEN ? AND ?
    GROUP BY m.icode, m.drug_name, m.dx_prefixes, m.indication
    HAVING total_prescriptions > 0
    ORDER BY total_prescriptions DESC
  `, [startDate, endDate])
  console.table(mapRules)

  await hos.end()
  await dw.end()
  console.log('\n[+] การตรวจสอบเสร็จสมบูรณ์เรียบร้อยแล้ว!')
}

check().catch((err) => {
  console.error('[ERROR]', err.message)
  process.exit(1)
})
