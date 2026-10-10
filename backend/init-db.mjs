import mysql from 'mysql2/promise'
import { DB_BASE, DW_DB_BASE, DW_DB } from './config.mjs'

/**
 * Default herbal drug -> allowed ICD-10 prefix mapping (Thai National List of Essential Herbal Medicines).
 * ICD codes in HOSxP are stored without dots (e.g. M7911). A prefix "M" matches every M-code.
 * U-codes (Thai traditional medicine) always pass regardless of mapping.
 * Editable later from the UI ("ตั้งค่ายา ↔ ICD"). INSERT IGNORE keeps user edits.
 */
const DEFAULT_DX_MAP = [
  ['1540012', 'K30,K29,K21,R10,R14', 'ท้องอืด ท้องเฟ้อ อาหารไม่ย่อย'],
  ['1680026', 'K30,R11,R14,T753', 'คลื่นไส้ อาเจียน ท้องอืด เมารถ'],
  ['1560021', 'R50,J00,J06', 'ลดไข้'],
  ['1630003', 'F17,Z716,Z720', 'ช่วยลดการสูบบุหรี่'],
  ['1560028', 'M', 'ปวดกล้ามเนื้อ ปวดเมื่อย'],
  ['1560031', 'B35,B36,L30', 'กลาก เกลื้อน น้ำกัดเท้า'],
  ['1560025', 'D50,D53,D64,N92,N94', 'บำรุงโลหิต ประจำเดือนผิดปกติ'],
  ['1670063', 'K30,R14,M,N94', 'บำรุงธาตุ ปวดเมื่อย'],
  ['1650102', 'M,S', 'ฟกช้ำ เคล็ดขัดยอก ปวดกล้ามเนื้อ'],
  ['1540013', 'K59', 'ท้องผูก'],
  ['1560017', 'E11,E14,K30', 'เบาหวาน (เสริม) ขับลม'],
  ['1630009', 'M', 'ปวดเมื่อยตามร่างกาย'],
  ['1600115', 'B01,B05,R50', 'ไข้ ไข้ออกผื่น (อีสุกอีใส หัด)'],
  ['1560022', 'R05,J00,J02,J06,K59', 'ไอ เจ็บคอ ปรับธาตุ ท้องผูก'],
  ['1560008', 'K59', 'ท้องผูกเรื้อรัง'],
  ['1490024', 'K30,R14,R11', 'ท้องอืด ท้องเฟ้อ'],
  ['1540011', 'M,S', 'ปวดเมื่อย เคล็ดขัดยอก'],
  ['1550008', 'N94,N92', 'ปวดประจำเดือน'],
  ['1560023', 'J30,J31,J45,R05', 'ภูมิแพ้ แพ้อากาศ หวัดเรื้อรัง'],
  ['1560013', 'O92,R14,K30', 'กระตุ้นน้ำนม'],
  ['1490029', 'I84,K64', 'ริดสีดวงทวาร'],
  ['1550007', 'T,R21,L23,L27,L50', 'ถอนพิษ ผื่นคัน แพ้'],
  ['1560012', 'N94,N92,N95', 'ประจำเดือนผิดปกติ'],
  ['1640041', 'G47,F51', 'นอนไม่หลับ'],
  ['1560016', 'O90,Z39', 'บำรุงหลังคลอด'],
  ['1560005', 'R42,R11,H81', 'วิงเวียน คลื่นไส้'],
  ['1560011', 'A09,K52,K58', 'ท้องเสีย'],
  ['1550003', 'R05,J00,J02,J03,J06,J20', 'ไอ ขับเสมหะ เจ็บคอ'],
  ['1560027', 'M', 'ปวดเมื่อยกล้ามเนื้อ'],
  ['1500023', 'B00,B02,L23,T63', 'เริม งูสวัด แมลงกัดต่อย'],
  ['1560019', 'R50,J00,J06', 'ลดไข้'],
  ['1660035', 'R05,J00,J02,J06,J20', 'ไอ ขับเสมหะ'],
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
      indication VARCHAR(255) NOT NULL DEFAULT '',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=tis620
  `)

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

  await conn.end()
  console.log(`Database \`${DW_DB}\` ready (6 tables, 2FA enabled, ${DEFAULT_DX_MAP.length} default drug-ICD rules).`)
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('server/init-db.mjs')) {
  initDatabaseAndTables()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
