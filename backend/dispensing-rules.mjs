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
    return name.includes(k) || code === k
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
    selected_drugs,
    pttype_filter = 'UC',
    pttype_name_label = 'สิทธิ UC / บัตรทอง',
    min_interval_days = 7,
    rule_description = '',
    is_active = 1,
  } = rule

  const days = Math.max(1, parseInt(min_interval_days, 10) || 7)

  // Multiple drugs batch mode
  const drugsToSave = Array.isArray(selected_drugs) && selected_drugs.length > 0
    ? selected_drugs.map((d) => ({ icode: String(d.icode || d), drug_name: String(d.drug_name || d.name || '') }))
    : (drug_icode && drug_name ? [{ icode: String(drug_icode), drug_name: String(drug_name) }] : [])

  if (drugsToSave.length === 0) {
    throw new Error('กรุณาเลือกรายการยาสมุนไพรอย่างน้อย 1 รายการ')
  }

  // If single rule with id being edited
  if (id && drugsToSave.length === 1) {
    await dwPool.query(
      `UPDATE dw_hd_check_dispensing_rules
       SET drug_icode = ?, drug_name = ?, pttype_filter = ?, pttype_name_label = ?,
           min_interval_days = ?, rule_description = ?, is_active = ?
       WHERE id = ?`,
      [
        drugsToSave[0].icode,
        drugsToSave[0].drug_name,
        pttype_filter,
        pttype_name_label,
        days,
        rule_description,
        is_active ? 1 : 0,
        id,
      ]
    )
    return { id, success: true, count: 1 }
  }

  // If multiple drugs selected
  const savedIds = []
  for (let i = 0; i < drugsToSave.length; i++) {
    const d = drugsToSave[i]
    if (id && i === 0) {
      await dwPool.query(
        `UPDATE dw_hd_check_dispensing_rules
         SET drug_icode = ?, drug_name = ?, pttype_filter = ?, pttype_name_label = ?,
             min_interval_days = ?, rule_description = ?, is_active = ?
         WHERE id = ?`,
        [
          d.icode,
          d.drug_name,
          pttype_filter,
          pttype_name_label,
          days,
          rule_description,
          is_active ? 1 : 0,
          id,
        ]
      )
      savedIds.push(id)
    } else {
      const [existing] = await dwPool.query(
        'SELECT id FROM dw_hd_check_dispensing_rules WHERE drug_icode = ? AND pttype_filter = ? LIMIT 1',
        [d.icode, pttype_filter]
      )
      if (existing.length > 0) {
        await dwPool.query(
          `UPDATE dw_hd_check_dispensing_rules
           SET drug_name = ?, pttype_name_label = ?, min_interval_days = ?, rule_description = ?, is_active = ?
           WHERE id = ?`,
          [
            d.drug_name,
            pttype_name_label,
            days,
            rule_description,
            is_active ? 1 : 0,
            existing[0].id,
          ]
        )
        savedIds.push(existing[0].id)
      } else {
        const [result] = await dwPool.query(
          `INSERT INTO dw_hd_check_dispensing_rules
           (drug_icode, drug_name, pttype_filter, pttype_name_label, min_interval_days, rule_description, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            d.icode,
            d.drug_name,
            pttype_filter,
            pttype_name_label,
            days,
            rule_description,
            is_active ? 1 : 0,
          ]
        )
        savedIds.push(result.insertId)
      }
    }

    // Ensure drug is also registered in dw_hd_check_drug_dx_map so both tabs stay perfectly synced
    try {
      const [exMap] = await dwPool.query('SELECT icode FROM dw_hd_check_drug_dx_map WHERE icode = ? LIMIT 1', [d.icode])
      if (exMap.length === 0) {
        await dwPool.query(
          'INSERT INTO dw_hd_check_drug_dx_map (icode, drug_name, dx_prefixes, min_qty, indication) VALUES (?, ?, ?, ?, ?)',
          [d.icode, d.drug_name, '', 0, '']
        )
      }
    } catch (err) {
      console.warn('[SYNC HERB DX MAP] could not sync drug:', d.icode, err?.message)
    }
  }

  return { success: true, count: savedIds.length, ids: savedIds }
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
