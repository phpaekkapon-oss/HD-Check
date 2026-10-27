import mysql from 'mysql2/promise'
import { DB_BASE, DW_DB_BASE, DW_DB } from './config.mjs'

/**
 * Default herbal drug -> allowed ICD-10 prefix mapping (Thai National List of Essential Herbal Medicines).
 * ICD codes in HOSxP are stored without dots (e.g. M7911). A prefix "M" matches every M-code.
 * U-codes (Thai traditional medicine) always pass regardless of mapping.
 * Editable later from the UI ("ตั้งค่ายา ↔ ICD"). INSERT IGNORE keeps user edits.
 */
const DEFAULT_DX_MAP = [
  ['1470012', 'U071,J00,J02,J028,J029,J03,J039,J06,J068,J069,J11,J20,J208,J209,J40,R05,R50,R509,U5610,U5619,U643,Z11,Z115', 'บรรเทาอาการหวัด เจ็บคอ ไข้หวัด คอหอยและทอนซิลอักเสบ'],
  ['1490024', 'K30,K259,K590,K279,K29,K290,K297,K21,K210,K219,R10,R101,R104,R11,R14,U6680,U6670,U6984,U643,K56,K566,K57,K571,K26,K260,O82,O820,O821,O33,O339,Z37,Z370,O244,A09,A090,A099', 'บรรเทาอาการท้องอืด ท้องเฟ้อ จุกเสียด แน่นท้อง กรดไหลย้อน ขับลมในกระเพาะ'],
  ['1490029', 'I84,I840,I841,I842,I844,I849,K64,K640,K59,K590,U680,U6984,S39,S390,S399,V18,V184,V1841,M48,M480,M4806', 'บรรเทาอาการริดสีดวงทวารหนัก และช่วยระบายอ่อนๆ'],
  ['1500023', 'B00,B009,B02,B029,L50,L500,L30,L309,R21,T63,U707,U7079,U7081', 'บรรเทาอาการเริม งูสวัด ลมพิษ ผื่นคันจากแมลงสัตว์กัดต่อย'],
  ['1540011', 'M791,M7910,M7911,M7912,M7913,M7915,M7916,M626,M6260,M6261,M6265,M6266,M608,M6081,M6088,M54,M17,M179,M77,M7709,U7501,U7502,U7503,U7506,U5731,U5732,U5733,U5734,U5720,U5753,U57,Z501,M47,M479,M4792,M48,M480,M4805,M72,M722,M7228,M76,M760,M7604', 'ประคบบรรเทาอาการปวด บวม เคล็ดขัดยอก เส้นและกล้ามเนื้ออักเสบ'],
  ['1540012', 'K30,K259,K279,K29,K21,R10,R101,R14,K590,U6680,U6670,U6002,U6984,A09,A090,A099', 'บรรเทาอาการท้องอืด ท้องเฟ้อ จุกเสียด แน่นท้อง อาหารไม่ย่อย แผลในกระเพาะอาหารและกรดไหลย้อน'],
  ['1540013', 'K59,K590,K64,I84,K30,R14,U6984,U6680,Z515,Z09,Z099,K56,K566,K26,K269', 'บรรเทาอาการท้องผูก ยาระบาย ขับของเสีย'],
  ['1550003', 'R05,J00,J02,J04,J06,J069,J20,J209,J304,J40,U643,U5610,J10,J100,J101,J108,J11,J118,J03,J038,J039,J15,J159,J18,J189,J21,J219,J45,J459,R50', 'บรรเทาอาการไอ ขับเสมหะ บรรเทาอาการเจ็บคอ ระคายคอ'],
  ['1550007', 'X49,X490,X4904,R21,U7081,F15,F155,Z714,Z716,T63,T65', 'ถอนพิษไข้ ถอนพิษเบื่อเมา บรรเทาอาการแพ้สารเคมีหรืออาหาร'],
  ['1550008', 'N94,N940,N944,N92,N95,Z39,Z392,U506,U503,U5143,U516,U771,Z37,Z370,O80,O800,O82,O820,O821,O84,O842,O72,O721,O73,O730,O33,O339,O34,O342,O32,O321,O30,O300,O68,Z30,Z302,O244,O99,O998,O98,O981', 'บรรเทาอาการปวดประจำเดือน ประจำเดือนมาไม่สม่ำเสมอ ขับน้ำคาวปลาในสตรีหลังคลอด'],
  ['1560005', 'R42,R11,H81,K30,R14,U6131,U6132,U6680,U6670', 'แก้ลมวิงเวียน หน้ามืด ตาลาย คลื่นไส้ อาเจียน แก้ลมจุกแน่นในอก'],
  ['1560008', 'K59,K590,K30,R14,U6984,U6680,U6670', 'บรรเทาอาการท้องผูกเรื้อรัง เถาดาน พรรดึก ขับเถาดานในลำไส้ ขับลม'],
  ['1560011', 'A09,A099,K58,U6980', 'บรรเทาอาการท้องเสียที่ไม่ได้เกิดจากการติดเชื้อ บิดมูกเลือด ท้องร่วง'],
  ['1560012', 'N94,N940,N944,N95,Z39,U5143,U516,U521,U506,U771', 'บรรเทาอาการปวดประจำเดือน ช่วยให้ประจำเดือนมาเป็นปกติ บำรุงโลหิต ขับน้ำคาวปลา'],
  ['1560013', 'O92,O924,Z39,Z392,U504,U506,U771,Z37,Z370,O80,O800,O82,O820,O821,O84,O842,O72,O721,O73,O730,O33,O339,O34,O342,O32,O321,O30,O300,O68,Z30,Z302,O244,O99,O998,O98,O981', 'กระตุ้นน้ำนมสตรีหลังคลอด บำรุงธาตุไฟ ขับน้ำคาวปลา ฟื้นฟูมารดาหลังคลอด'],
  ['1560016', 'Z39,Z390,Z392,U506,U505,U771,M62,M6260', 'ขับน้ำคาวปลา มดลูกเข้าอู่ บรรเทาอาการปวดเมื่อยหลังคลอดบุตร'],
  ['1560017', 'R630,E11,E119,E10,U6681,U6680,K30,K259', 'เจริญอาหาร ดับพิษร้อน บรรเทาอาการเบาหวาน'],
  ['1560019', 'R50,R509,J00,J02,J06,J069,J20,R05,U56,U5610,U5619,U643', 'บรรเทาอาการไข้ กระทุ้งพิษไข้ ดับพิษไข้ทั้งปวง'],
  ['1560021', 'R50,R509,J00,J06,J069,R05,U561,U5610,U5619,U643,U7502', 'บรรเทาอาการไข้ ตัวร้อน ไข้หวัด ไข้เปลี่ยนฤดู'],
  ['1560022', 'R05,J00,J06,J20,J209,K59,K590,U643,U5610,U6984,U6680', 'บรรเทาอาการไอ ขับเสมหะ ปรับสมดุลธาตุในฤดูฝน/หนาว ยาระบายอ่อนๆ'],
  ['1560023', 'J30,J304,R098,J00,J20,J209,R05,U5831,U5843,U5942,U5610,U643,U743', 'บรรเทาอาการหวัดเรื้อรัง แพ้อากาศ คัดจมูก น้ำมูกไหล หอบหืด'],
  ['1560025', 'D50,D509,R42,R630,R53,N94,U6681,U506,U503,U521,U771', 'บำรุงโลหิต บรรเทาอาการอ่อนเพลีย วิงเวียน และอาการประจำเดือนผิดปกติ'],
  ['1560027', 'M791,M7910,M7911,M7916,M626,M608,M54,M17,M179,M75,U7141,U7501,U7502,U5732,U5733,U5753', 'บรรเทาอาการปวดกล้ามเนื้อ ปวดข้อ ชาตามปลายมือปลายเท้า'],
  ['1560028', 'M791,M7910,M7911,M7912,M7916,M626,M6260,M6261,M608,M6081,M6086,M6088,M54,M17,M179,M75,U7501,U7502,U5720,U5732,U5733,U5753,U57', 'บรรเทาอาการปวดกล้ามเนื้อ ข้อเข่าเสื่อม ปวดข้อ ปวดหลัง เอ็นและเส้นตึง'],
  ['1560031', 'B35,B36,B360,L30,L309,R21,U7020,U7081', 'รักษาโรคผิวหนังจากเชื้อรา กลาก เกลื้อน ผื่นคัน ผิวหนังอักเสบ'],
  ['1600115', 'R50,R509,K12,K120,J00,J02,R05,U6582,U5610,U643', 'บรรเทาอาการไข้ ร้อนใน แผลในปาก ดับพิษไข้ ออกหัด อีสุกอีใส'],
  ['1630003', 'F17,F172,F1723,F1725,Z716,Z720,Z503,Z508,T652,F10,F102,F105,F1056,F20,F29,Z719', 'ช่วยลดความอยากบุหรี่ ฟื้นฟูผู้ติดสารเสพติดและอดบุหรี่'],
  ['1630009', 'M791,M7910,M7911,M626,M6265,M6266,M608,M6081,M6086,M17,M179,M54,U5720,U5726,U5732,U5733,U5753,U57', 'บรรเทาอาการปวดกล้ามเนื้อ ปวดตึงตามเส้น ชาตามปลายมือปลายเท้า'],
  ['1640041', 'F51,F510,G47,G470,R630,U7522', 'ช่วยให้นอนหลับ เจริญอาหาร บรรเทาอาการนอนไม่หลับเรื้อรัง'],
  ['1650102', 'M791,M7910,M7911,M7912,M7916,M626,M6260,M6261,M6265,M6266,M608,M54,M17,M179,M47,M75,S00,S01,S03,S33,S43,S53,S63,S83,S93,T14,U7501,U7502,U7506,U5720,U5733,U5753,U57,M72,M722,M7228,M726,M7266,R252,M51,M510,M511,M512,M519,M43,M430,M4306,M4309,M4316,M48,M480,M4800,M4806,M4807,M70,M71,M76,M77,M7713,M7792,M10,M100,M109,M05,M06,S80,S800,S809,S82,S820,S90,S909,S60,S609,S70,S700,S20,S208,S39,S390,W00,W01,W11,W14,W17,W20,W21,Z501,R53', 'บรรเทาอาการปวด บวม เคล็ดขัดยอก ฟกช้ำ ข้อและกล้ามเนื้ออักเสบ'],
  ['1660035', 'R05,J00,J02,J04,J06,J069,J20,J209,J40,J44,J449,J45,J18,U643,U5610,J10,J100,J101,J108,J11,J118,J03,J038,J039,J15,J159,J180,J189,J21,J219,J301,J304,J310,J42,J46,U071,R50,R500,R508,R509,R51,R510,A15,A150,R074,R042', 'บรรเทาอาการไอ ละลายเสมหะ ขับเสมหะ บรรเทาอาการเจ็บคอ หวัด หลอดลมอักเสบ'],
  ['1670063', 'K30,K259,K590,R101,R14,U6680,U6670,U6984,U6681,U5831', 'ปรับสมดุลธาตุทั้งสี่ บรรเทาอาการท้องอืด ท้องเฟ้อ ปวดเมื่อย ขับลม'],
  ['1680026', 'K259,K30,K590,R101,R14,R098,U6680,U6670,U6984,U643,U5831', 'บรรเทาอาการคลื่นไส้ อาเจียน เมารถ เมาเรือ ท้องอืด ท้องเฟ้อ ขับลม'],
  ['1690626', 'X49,X490,X4904,R21,U7081,F15,F155,Z714,Z716,T63,T65', 'ถอนพิษไข้ ถอนพิษเบื่อเมา บรรเทาผื่นแพ้ แมลงสัตว์กัดต่อย พิษสารเคมี'],
]

export async function initDatabaseAndTables() {
  const root = await mysql.createConnection(DW_DB_BASE)
  await root.query(`CREATE DATABASE IF NOT EXISTS \`${DW_DB}\` CHARACTER SET tis620 COLLATE tis620_thai_ci`)
  await root.end()

  const conn = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB })

  // 1) Prescription audit rows (SQL Query 1)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS dw_hd_check_prescriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vn VARCHAR(20) NULL,
      visit_date DATE NOT NULL,
      visit_time TIME NOT NULL,
      hn VARCHAR(15) NOT NULL,
      patient_name VARCHAR(200) NOT NULL,
      pttype_name VARCHAR(200) NULL,
      drug_icode VARCHAR(20) NULL,
      drug_name VARCHAR(255) NOT NULL,
      drug_qty INT NOT NULL DEFAULT 1,
      drug_units VARCHAR(50) NULL DEFAULT '',
      department_name VARCHAR(150) NULL,
      main_pdx VARCHAR(20) NULL,
      pdx VARCHAR(20) NULL,
      dx0 VARCHAR(20) NULL, dx1 VARCHAR(20) NULL, dx2 VARCHAR(20) NULL,
      dx3 VARCHAR(20) NULL, dx4 VARCHAR(20) NULL, dx5 VARCHAR(20) NULL,
      doctor_code VARCHAR(50) NULL,
      doctor_name VARCHAR(200) NULL,
      audit_status ENUM('COMPLETE','INCOMPLETE') NOT NULL DEFAULT 'INCOMPLETE',
      sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_visit_date (visit_date),
      INDEX idx_hn (hn),
      INDEX idx_drug_icode (drug_icode)
    ) ENGINE=InnoDB DEFAULT CHARSET=tis620
  `)

  // Migration for existing tables
  await conn.query("ALTER TABLE dw_hd_check_prescriptions ADD COLUMN IF NOT EXISTS drug_units VARCHAR(50) NULL DEFAULT '' AFTER drug_qty").catch(() => {})

  // 2) Drug dispensing summary snapshot (SQL Query 2)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS dw_hd_check_drugs (
      icode VARCHAR(20) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      units VARCHAR(50) NULL DEFAULT '',
      opd_qty DECIMAL(12,2) DEFAULT 0,
      ipd_qty DECIMAL(12,2) DEFAULT 0,
      unitcost DECIMAL(10,2) DEFAULT 0,
      total_qty DECIMAL(12,2) DEFAULT 0,
      total_cost DECIMAL(12,2) DEFAULT 0,
      nhso_adp_code VARCHAR(50) NULL,
      last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=tis620
  `)

  await conn.query("ALTER TABLE dw_hd_check_drugs ADD COLUMN IF NOT EXISTS units VARCHAR(50) NULL DEFAULT '' AFTER name").catch(() => {})

  // 3) Drug <-> allowed ICD prefixes (audit rule)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS dw_hd_check_drug_dx_map (
      icode VARCHAR(20) PRIMARY KEY,
      drug_name VARCHAR(255) NULL,
      dx_prefixes VARCHAR(500) NOT NULL DEFAULT '',
      min_qty INT NOT NULL DEFAULT 0,
      indication VARCHAR(255) NOT NULL DEFAULT '',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=tis620
  `)

  await conn.query("ALTER TABLE dw_hd_check_drug_dx_map ADD COLUMN IF NOT EXISTS min_qty INT NOT NULL DEFAULT 0 AFTER dx_prefixes").catch(() => {})

  // 4) Sync history
  await conn.query(`
    CREATE TABLE IF NOT EXISTS dw_hd_check_sync_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      trigger_type ENUM('MANUAL','AUTO') NOT NULL DEFAULT 'MANUAL',
      total_prescriptions INT DEFAULT 0,
      total_drugs INT DEFAULT 0,
      duration_ms INT DEFAULT 0,
      status ENUM('SUCCESS','ERROR') NOT NULL,
      message VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=tis620
  `)

  // 5) System settings (including 2FA Enforcement Policy)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS dw_hd_check_system_settings (
      setting_key VARCHAR(50) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=tis620
  `)

  // 6) User 2FA Secrets & Status
  await conn.query(`
    CREATE TABLE IF NOT EXISTS dw_hd_check_user_2fa (
      loginname VARCHAR(50) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      user_type VARCHAR(20) NOT NULL DEFAULT 'opduser',
      groupname VARCHAR(100) NULL,
      two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0,
      totp_secret VARCHAR(64) NULL,
      backup_codes TEXT NULL,
      pin_hash VARCHAR(64) NULL,
      pin_enabled TINYINT(1) NOT NULL DEFAULT 0,
      auto_lock_minutes INT NOT NULL DEFAULT 5,
      last_login_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=tis620
  `)

  await conn.query(`
    INSERT IGNORE INTO dw_hd_check_system_settings (setting_key, setting_value)
    VALUES 
      ('enforce_2fa', 'N'),
      ('enforce_pin_lock', 'N'),
      ('default_auto_lock_minutes', '5')
  `)

  await conn.query(
    'INSERT IGNORE INTO dw_hd_check_drug_dx_map (icode, dx_prefixes, indication) VALUES ?',
    [DEFAULT_DX_MAP]
  )

  // 7) Dispensing interval & benefit rules
  await conn.query(`
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

  const [existingRules] = await conn.query('SELECT COUNT(*) as cnt FROM dw_hd_check_dispensing_rules')
  if (existingRules[0].cnt === 0) {
    await conn.query(
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

  await conn.end()
  console.log(`Database \`${DW_DB}\` ready (7 tables, 2FA enabled, ${DEFAULT_DX_MAP.length} default drug-ICD rules).`)
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('server/init-db.mjs')) {
  initDatabaseAndTables()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
