/**
 * Dispensing Interval Rules & Benefit Entitlement Management
 * ระบบจัดการเงื่อนไขรอบการจ่ายยาสมุนไพรและสิทธิการรักษา
 */

export function matchesPttype(patientPttypeName, pttypeCode, filter) {
  if (!filter || filter.trim() === '' || filter.trim().toUpperCase() === 'ALL') {
    return true
  }
  const name = String(patientPttypeName || '').toLowerCase()
  const code = String(pttypeCode || '').toLowerCase()
  const keywords = filter
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)

  return keywords.some((k) => {
    if (k === 'uc' || k === 'ucs') {
      return (
        name.includes('ประกันสุขภาพ') ||
        name.includes('บัตรทอง') ||
        name.includes('uc') ||
        code.startsWith('u')
      )
    }
    if (k === 'sss') {
      return name.includes('ประกันสังคม') || code.startsWith('s')
    }
    if (k === 'ofc') {
      return (
        name.includes('ข้าราชการ') ||
        name.includes('เบิกตรง') ||
        name.includes('กรมบัญชีกลาง') ||
        code.startsWith('o')
      )
    }
    return name.includes(k) || code.includes(k)
  })
}

export async function initDispensingRulesTable(dwPool) {
  await dwPool.query(`
    CREATE TABLE IF NOT EXISTS dw_hd_check_dispensing_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      drug_icode VARCHAR(20) NOT NULL,
      drug_name VARCHAR(255) NOT NULL,
      pttype_filter VARCHAR(255) NOT NULL DEFAULT 'UC',
      pttype_name_label VARCHAR(255) NOT NULL DEFAULT 'สิทธิ UC / บัตรทอง',
      min_interval_days INT NOT NULL DEFAULT 7,
      rule_description VARCHAR(255) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_drug_icode (drug_icode)
    ) ENGINE=InnoDB DEFAULT CHARSET=tis620
  `)

  // ตรวจสอบและเพิ่มเงื่อนไขเริ่มต้น (ยาธาตุอบเชย สิทธิ UC 7 วัน) หากยังไม่มีข้อมูล
  const [existingRules] = await dwPool.query('SELECT COUNT(*) as cnt FROM dw_hd_check_dispensing_rules')
  if (existingRules[0].cnt === 0) {
    await dwPool.query(
      `INSERT INTO dw_hd_check_dispensing_rules 
       (drug_icode, drug_name, pttype_filter, pttype_name_label, min_interval_days, rule_description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        '1490024',
        'ยาธาตุอบเชย',
        'UC,บัตรทอง,ประกันสุขภาพ,UCS',
        'สิทธิ UC / บัตรทอง',
        7,
        'เงื่อนไขสิทธิ UC ตัดการจ่าย 7 วัน ถ้าไม่ครบ 7 วันไม่ผ่าน',
      ]
    )
  }
}

export async function getDispensingRules(dwPool, activeOnly = false) {
  const sql = activeOnly
    ? 'SELECT * FROM dw_hd_check_dispensing_rules WHERE is_active = 1 ORDER BY id ASC'
    : 'SELECT * FROM dw_hd_check_dispensing_rules ORDER BY is_active DESC, id ASC'
  const [rows] = await dwPool.query(sql)
  return rows.map((r) => ({
    id: r.id,
    drug_icode: String(r.drug_icode),
    drug_name: r.drug_name,
    pttype_filter: r.pttype_filter,
    pttype_name_label: r.pttype_name_label,
    min_interval_days: Number(r.min_interval_days),
    rule_description: r.rule_description || '',
    is_active: Boolean(r.is_active),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))
}

export async function saveDispensingRule(dwPool, rule) {
  const {
    id,
    drug_icode,
    drug_name,
    pttype_filter = 'UC',
    pttype_name_label = 'สิทธิ UC / บัตรทอง',
    min_interval_days = 7,
    rule_description = '',
    is_active = 1,
  } = rule

  if (!drug_icode || !drug_name) {
    throw new Error('กรุณาระบุรหัสยาและชื่อยาให้ครบถ้วน')
  }

  const days = Math.max(1, parseInt(min_interval_days, 10) || 7)

  if (id) {
    await dwPool.query(
      `UPDATE dw_hd_check_dispensing_rules
       SET drug_icode = ?, drug_name = ?, pttype_filter = ?, pttype_name_label = ?,
           min_interval_days = ?, rule_description = ?, is_active = ?
       WHERE id = ?`,
      [
        drug_icode,
        drug_name,
        pttype_filter,
        pttype_name_label,
        days,
        rule_description,
        is_active ? 1 : 0,
        id,
      ]
    )
    return { id, success: true }
  } else {
    const [result] = await dwPool.query(
      `INSERT INTO dw_hd_check_dispensing_rules
       (drug_icode, drug_name, pttype_filter, pttype_name_label, min_interval_days, rule_description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        drug_icode,
        drug_name,
        pttype_filter,
        pttype_name_label,
        days,
        rule_description,
        is_active ? 1 : 0,
      ]
    )
    return { id: result.insertId, success: true }
  }
}

export async function toggleDispensingRule(dwPool, id, isActive) {
  await dwPool.query(
    'UPDATE dw_hd_check_dispensing_rules SET is_active = ? WHERE id = ?',
    [isActive ? 1 : 0, id]
  )
  return { success: true }
}

export async function deleteDispensingRule(dwPool, id) {
  await dwPool.query('DELETE FROM dw_hd_check_dispensing_rules WHERE id = ?', [id])
  return { success: true }
}
