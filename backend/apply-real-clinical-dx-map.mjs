import mysql from 'mysql2/promise';
import { DB_BASE, DW_DB } from './config.mjs';

const dw = await mysql.createConnection({
  ...DB_BASE,
  database: DW_DB,
});

console.log('=== [START] Applying Authoritative Clinical & NHSO Standards for 34 Herbal Drugs ===');

// 1. Create a safe rollback backup
const backupTableName = `dw_hd_check_drug_dx_map_backup_pre_clean_${Date.now()}`;
await dw.query(`CREATE TABLE IF NOT EXISTS ${backupTableName} AS SELECT * FROM dw_hd_check_drug_dx_map`);
console.log(`[SAFE BACKUP] Created ${backupTableName}`);

// 2. Authoritative Clinical & NHSO ICD-10 dictionary
// Based on National List of Essential Medicines (Herbal) & NHSO Audit Guidelines
const REAL_CLINICAL_MAP = [
  {
    icode: '1470012',
    name: 'ฟ้าทะลายโจร',
    dx_prefixes: 'J00,J01,J02,J03,J06,J10,J11,J20,R05,R50,U5610,U5619,U5720,U643',
    indication: 'บรรเทาอาการหวัด เจ็บคอ ไข้หวัด คอหอยและทอนซิลอักเสบ'
  },
  {
    icode: '1490024',
    name: 'ยาธาตุอบเชย',
    dx_prefixes: 'K30,K29,K21,R14,R11,R10,K25,K26,U6680,U6670,U643',
    indication: 'บรรเทาอาการท้องอืด ท้องเฟ้อ จุกเสียด แน่นท้อง กรดไหลย้อน ขับลมในกระเพาะ'
  },
  {
    icode: '1490029',
    name: 'ยาผสมเพชรสังฆาต',
    dx_prefixes: 'I84,K64,K59,K590,U680,U6984,U6680,U643',
    indication: 'บรรเทาอาการริดสีดวงทวารหนัก และช่วยระบายอ่อนๆ'
  },
  {
    icode: '1500023',
    name: 'เสลดพังพอนทิงเจอร์(เริม งูสวัส)',
    dx_prefixes: 'B00,B009,B02,B029,L23,L28,L50,T63,R21,U707,U7079,U7081,U643',
    indication: 'บรรเทาอาการเริม งูสวัด ลมพิษ ผื่นคันจากแมลงสัตว์กัดต่อย'
  },
  {
    icode: '1540011',
    name: 'ยาประคบ (ลูกประคบ)',
    dx_prefixes: 'M791,M54,M255,M17,M626,S03,S13,S23,S33,S43,S53,S63,S73,S83,S93,T140,T143,U5733,U5753,U5720,U6680,U643',
    indication: 'ประคบบรรเทาอาการปวด บวม เคล็ดขัดยอก เส้นและกล้ามเนื้ออักเสบ'
  },
  {
    icode: '1540012',
    name: 'ขมิ้นชัน',
    dx_prefixes: 'K30,K29,K21,R10,R14,K25,K26,K27,K28,U6680,U6670,U643',
    indication: 'บรรเทาอาการท้องอืด ท้องเฟ้อ จุกเสียด แน่นท้อง อาหารไม่ย่อย แผลในกระเพาะอาหารและกรดไหลย้อน'
  },
  {
    icode: '1540013',
    name: 'มะขามแขก',
    dx_prefixes: 'K59,K590,K64,I84,K30,R14,U6984,U6680,U643',
    indication: 'บรรเทาอาการท้องผูก ยาระบาย ขับของเสีย'
  },
  {
    icode: '1550003',
    name: 'ยาอมมะแว้ง(X)',
    dx_prefixes: 'R05,J00,J02,J04,J06,J20,U5610,U5720,U643',
    indication: 'บรรเทาอาการไอ ขับเสมหะ บรรเทาอาการเจ็บคอ ระคายคอ'
  },
  {
    icode: '1550007',
    name: 'ยารางจืด(X)',
    dx_prefixes: 'T50,T56,T60,T63,T65,R21,L23,L27,L50,X49,U7081,U5720,U643',
    indication: 'ถอนพิษไข้ ถอนพิษเบื่อเมา บรรเทาอาการแพ้สารเคมีหรืออาหาร'
  },
  {
    icode: '1550008',
    name: 'ยาประสะไพล(X)(ปวดประจำเดือน)',
    dx_prefixes: 'N94,N944,N91,N92,O90,Z39,U5143,U521,U525,U506,U643',
    indication: 'บรรเทาอาการปวดประจำเดือน ประจำเดือนมาไม่สม่ำเสมอ ขับน้ำคาวปลาในสตรีหลังคลอด'
  },
  {
    icode: '1560005',
    name: 'ยาหอมนวโกฐ(X)(วิงเวียน)',
    dx_prefixes: 'R42,R11,H81,K30,R14,U6131,U6680,U643',
    indication: 'แก้ลมวิงเวียน หน้ามืด ตาลาย คลื่นไส้ อาเจียน แก้ลมจุกแน่นในอก'
  },
  {
    icode: '1560008',
    name: 'ยาธรณีสัณฑฆาต(X)(ท้องผูกเรื้อรัง)',
    dx_prefixes: 'K59,K590,K30,R14,U6984,U6680,U6670,U643',
    indication: 'บรรเทาอาการท้องผูกเรื้อรัง เถาดาน พรรดึก ขับเถาดานในลำไส้ ขับลม'
  },
  {
    icode: '1560011',
    name: 'ยาเหลืองปิดสมุทร(X)(ท้องเสีย)',
    dx_prefixes: 'A09,A099,K52,K58,U6980,U643,U6680',
    indication: 'บรรเทาอาการท้องเสียที่ไม่ได้เกิดจากการติดเชื้อ บิดมูกเลือด ท้องร่วง'
  },
  {
    icode: '1560012',
    name: 'ยาเลือดงาม',
    dx_prefixes: 'N94,N944,N91,N92,N95,O90,Z39,U5143,U521,U525,U506,U643',
    indication: 'บรรเทาอาการปวดประจำเดือน ช่วยให้ประจำเดือนมาเป็นปกติ บำรุงโลหิต ขับน้ำคาวปลา'
  },
  {
    icode: '1560013',
    name: 'ยาปลูกไฟธาตุ(กระตุ้นน้ำนม)',
    dx_prefixes: 'O92,O924,O91,O90,Z39,U504,U506,U643',
    indication: 'กระตุ้นน้ำนมสตรีหลังคลอด บำรุงธาตุไฟ ขับน้ำคาวปลา ฟื้นฟูมารดาหลังคลอด'
  },
  {
    icode: '1560016',
    name: 'ยาสตรีหลังคลอด(X)',
    dx_prefixes: 'O90,Z39,U506,U771,U643',
    indication: 'ขับน้ำคาวปลา มดลูกเข้าอู่ บรรเทาอาการปวดเมื่อยหลังคลอดบุตร'
  },
  {
    icode: '1560017',
    name: 'มะระขี้นก',
    dx_prefixes: 'E11,E10,E14,R630,K30,U6681,U643,U6680',
    indication: 'เจริญอาหาร ดับพิษร้อน บรรเทาอาการเบาหวาน'
  },
  {
    icode: '1560019',
    name: 'ห้าราก',
    dx_prefixes: 'R50,J00,J02,J06,J10,J11,J20,R05,U5610,U5619,U6131,U643',
    indication: 'บรรเทาอาการไข้ กระทุ้งพิษไข้ ดับพิษไข้ทั้งปวง'
  },
  {
    icode: '1560021',
    name: 'จันทร์ลีลา(X)',
    dx_prefixes: 'R50,J00,J02,J06,J10,J11,J20,R05,U5610,U561,U7502,U643',
    indication: 'บรรเทาอาการไข้ ตัวร้อน ไข้หวัด ไข้เปลี่ยนฤดู'
  },
  {
    icode: '1560022',
    name: 'ยาตรีผลา(X)(ไอเปลี่ยนฤดู ปรับธาตุ)',
    dx_prefixes: 'R05,J00,J02,J06,J20,K59,K590,U5610,U6984,U7502,U6680,U643',
    indication: 'บรรเทาอาการไอ ขับเสมหะ ปรับสมดุลธาตุในฤดูฝน/หนาว ยาระบายอ่อนๆ'
  },
  {
    icode: '1560023',
    name: 'ยาปราบชมพูทวีป',
    dx_prefixes: 'J30,J304,J31,J45,R05,R098,U5843,U743,U5831,U5610,U643',
    indication: 'บรรเทาอาการหวัดเรื้อรัง แพ้อากาศ คัดจมูก น้ำมูกไหล หอบหืด'
  },
  {
    icode: '1560025',
    name: 'บำรุงโลหิต (ผง)',
    dx_prefixes: 'D50,D53,D64,R42,R53,N91,N92,N94,U521,U525,U5143,U643',
    indication: 'บำรุงโลหิต บรรเทาอาการอ่อนเพลีย วิงเวียน และอาการประจำเดือนผิดปกติ'
  },
  {
    icode: '1560027',
    name: 'สหัสธารา(X)',
    dx_prefixes: 'M791,M54,M255,M626,G56,R20,U5733,U5753,U7502,U6680,U643',
    indication: 'บรรเทาอาการปวดกล้ามเนื้อ ปวดข้อ ชาตามปลายมือปลายเท้า'
  },
  {
    icode: '1560028',
    name: 'เถาวัลย์เปรียง(X)',
    dx_prefixes: 'M791,M54,M17,M255,M626,G56,R20,U5733,U5753,U7502,U6680,U643',
    indication: 'บรรเทาอาการปวดกล้ามเนื้อ ข้อเข่าเสื่อม ปวดข้อ ปวดหลัง เอ็นและเส้นตึง'
  },
  {
    icode: '1560031',
    name: 'ทิงเจอร์ทองพันชั่ง',
    dx_prefixes: 'B35,B36,L30,R21,U7081,U643',
    indication: 'รักษาโรคผิวหนังจากเชื้อรา กลาก เกลื้อน ผื่นคัน ผิวหนังอักเสบ'
  },
  {
    icode: '1600115',
    name: 'ยาเขียวหอม แคปซูล(X)',
    dx_prefixes: 'R50,K12,K120,B01,B05,J00,J02,J06,U6582,U5610,U643,U6680',
    indication: 'บรรเทาอาการไข้ ร้อนใน แผลในปาก ดับพิษไข้ ออกหัด อีสุกอีใส'
  },
  {
    icode: '1630003',
    name: 'ชาชงหญ้าดอกขาว(X)',
    dx_prefixes: 'F17,F172,Z716,Z720,U643',
    indication: 'ช่วยลดความอยากบุหรี่ ฟื้นฟูผู้ติดสารเสพติดและอดบุหรี่'
  },
  {
    icode: '1630009',
    name: 'ยาแก้ลมแก้เส้น แคปซูล',
    dx_prefixes: 'M791,M54,M255,M626,G56,R20,U5733,U5753,U5720,U6680,U643',
    indication: 'บรรเทาอาการปวดกล้ามเนื้อ ปวดตึงตามเส้น ชาตามปลายมือปลายเท้า'
  },
  {
    icode: '1640041',
    name: 'ยาศุขไสยาศน์(X) แคปซูล อาจาโร',
    dx_prefixes: 'G47,G470,F51,F510,R630,U7522,U643,U6680',
    indication: 'ช่วยให้นอนหลับ เจริญอาหาร บรรเทาอาการนอนไม่หลับเรื้อรัง'
  },
  {
    icode: '1650102',
    name: 'ไพลครีม   30  กรัม',
    dx_prefixes: 'M791,M54,M255,M17,M626,S03,S13,S23,S33,S43,S53,S63,S73,S83,S93,T140,T143,U5733,U5753,U7502,U6680,U643',
    indication: 'บรรเทาอาการปวด บวม เคล็ดขัดยอก ฟกช้ำ ข้อและกล้ามเนื้ออักเสบ'
  },
  {
    icode: '1660035',
    name: 'ไอมะขามป้อม  120  ml(X)',
    dx_prefixes: 'R05,J00,J02,J04,J06,J20,J40,U5610,U5720,U643',
    indication: 'บรรเทาอาการไอ ละลายเสมหะ ขับเสมหะ บรรเทาอาการเจ็บคอ หวัด หลอดลมอักเสบ'
  },
  {
    icode: '1670063',
    name: 'เบญจกูล แคปซูล',
    dx_prefixes: 'K30,K29,K21,R14,M791,U6670,U6680,U6984,U643',
    indication: 'ปรับสมดุลธาตุทั้งสี่ บรรเทาอาการท้องอืด ท้องเฟ้อ ปวดเมื่อย ขับลม'
  },
  {
    icode: '1680026',
    name: 'ขิง',
    dx_prefixes: 'R11,T753,K30,R14,K29,U6670,U6680,U643',
    indication: 'บรรเทาอาการคลื่นไส้ อาเจียน เมารถ เมาเรือ ท้องอืด ท้องเฟ้อ ขับลม'
  },
  {
    icode: '1690626',
    name: 'ชาชงรางจืด',
    dx_prefixes: 'T50,T56,T60,T63,T65,R21,L23,L27,L50,X49,U7081,U5720,U643',
    indication: 'ถอนพิษไข้ ถอนพิษเบื่อเมา บรรเทาผื่นแพ้ แมลงสัตว์กัดต่อย พิษสารเคมี'
  }
];

let updatedCount = 0;
for (const item of REAL_CLINICAL_MAP) {
  const [res] = await dw.query(
    `UPDATE dw_hd_check_drug_dx_map 
     SET dx_prefixes = ?, indication = ?
     WHERE icode = ?`,
    [item.dx_prefixes, item.indication, item.icode]
  );
  if (res.affectedRows > 0) {
    updatedCount++;
    console.log(`[UPDATED] [${item.icode}] ${item.name} -> ${item.dx_prefixes}`);
  } else {
    console.warn(`[NOT FOUND] icode: ${item.icode} (${item.name})`);
  }
}

console.log(`\n=== Successfully updated ${updatedCount} / ${REAL_CLINICAL_MAP.length} drugs to authentic clinical standards ===`);

await dw.end();
