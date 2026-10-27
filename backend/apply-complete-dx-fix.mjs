import mysql from 'mysql2/promise';
import { DW_DB_BASE, DW_DB } from './config.mjs';

const dw = await mysql.createConnection({ ...DW_DB_BASE, database: DW_DB });

console.log('=== [START] Applying Complete Real-World Clinical Diagnoses Map ===\n');

// Backup first
const backupName = `dw_hd_check_drug_dx_map_backup_${Date.now()}`;
await dw.query(`CREATE TABLE IF NOT EXISTS ${backupName} AS SELECT * FROM dw_hd_check_drug_dx_map`);
console.log(`[BACKUP] Created table ${backupName}`);

const UPDATES = [
  {
    icode: '1660035',
    name: 'ไอมะขามป้อม  120  ml(X)',
    dx_prefixes: 'R05,J00,J02,J04,J06,J069,J20,J209,J40,J44,J449,J45,J18,U643,U5610,J10,J100,J101,J108,J11,J118,J03,J038,J039,J15,J159,J180,J189,J21,J219,J301,J304,J310,J42,J46,U071,R50,R500,R508,R509,R51,R510,A15,A150,R074,R042'
  },
  {
    icode: '1650102',
    name: 'ไพลครีม   30  กรัม',
    dx_prefixes: 'M791,M7910,M7911,M7912,M7916,M626,M6260,M6261,M6265,M6266,M608,M54,M17,M179,M47,M75,S00,S01,S03,S33,S43,S53,S63,S83,S93,T14,U7501,U7502,U7506,U5720,U5733,U5753,U57,M72,M722,M7228,M726,M7266,R252,M51,M510,M511,M512,M519,M43,M430,M4306,M4309,M4316,M48,M480,M4800,M4806,M4807,M70,M71,M76,M77,M7713,M7792,M10,M100,M109,M05,M06,S80,S800,S809,S82,S820,S90,S909,S60,S609,S70,S700,S20,S208,S39,S390,W00,W01,W11,W14,W17,W20,W21,Z501,R53'
  },
  {
    icode: '1490024',
    name: 'ยาธาตุอบเชย',
    dx_prefixes: 'K30,K259,K590,K279,K29,K290,K297,K21,K210,K219,R10,R101,R104,R11,R14,U6680,U6670,U6984,U643,K56,K566,K57,K571,K26,K260,O82,O820,O821,O33,O339,Z37,Z370,O244,A09,A090,A099'
  },
  {
    icode: '1540013',
    name: 'มะขามแขก',
    dx_prefixes: 'K59,K590,K64,I84,K30,R14,U6984,U6680,Z515,Z09,Z099,K56,K566,K26,K269'
  },
  {
    icode: '1560013',
    name: 'ยาปลูกไฟธาตุ(กระตุ้นน้ำนม)',
    dx_prefixes: 'O92,O924,Z39,Z392,U504,U506,U771,Z37,Z370,O80,O800,O82,O820,O821,O84,O842,O72,O721,O73,O730,O33,O339,O34,O342,O32,O321,O30,O300,O68,Z30,Z302,O244,O99,O998,O98,O981'
  },
  {
    icode: '1550008',
    name: 'ยาประสะไพล(X)(ปวดประจำเดือน)',
    dx_prefixes: 'N94,N940,N944,N92,N95,Z39,Z392,U506,U503,U5143,U516,U771,Z37,Z370,O80,O800,O82,O820,O821,O84,O842,O72,O721,O73,O730,O33,O339,O34,O342,O32,O321,O30,O300,O68,Z30,Z302,O244,O99,O998,O98,O981'
  },
  {
    icode: '1550003',
    name: 'ยาอมมะแว้ง(X)',
    dx_prefixes: 'R05,J00,J02,J04,J06,J069,J20,J209,J304,J40,U643,U5610,J10,J100,J101,J108,J11,J118,J03,J038,J039,J15,J159,J18,J189,J21,J219,J45,J459,R50'
  },
  {
    icode: '1540011',
    name: 'ยาประคบ (ลูกประคบ)',
    dx_prefixes: 'M791,M7910,M7911,M7912,M7913,M7915,M7916,M626,M6260,M6261,M6265,M6266,M608,M6081,M6088,M54,M17,M179,M77,M7709,U7501,U7502,U7503,U7506,U5731,U5732,U5733,U5734,U5720,U5753,U57,Z501,M47,M479,M4792,M48,M480,M4805,M72,M722,M7228,M76,M760,M7604'
  },
  {
    icode: '1630003',
    name: 'ชาชงหญ้าดอกขาว(X)',
    dx_prefixes: 'F17,F172,F1723,F1725,Z716,Z720,Z503,Z508,T652,F10,F102,F105,F1056,F20,F29,Z719'
  },
  {
    icode: '1490029',
    name: 'ยาผสมเพชรสังฆาต',
    dx_prefixes: 'I84,I840,I841,I842,I844,I849,K64,K640,K59,K590,U680,U6984,S39,S390,S399,V18,V184,V1841,M48,M480,M4806'
  },
  {
    icode: '1550007',
    name: 'ยารางจืด(X)',
    dx_prefixes: 'X49,X490,X4904,R21,U7081,F15,F155,Z714,Z716,T63,T65'
  },
  {
    icode: '1540012',
    name: 'ขมิ้นชัน',
    dx_prefixes: 'K30,K259,K279,K29,K21,R10,R101,R14,K590,U6680,U6670,U6002,U6984,A09,A090,A099'
  },
  {
    icode: '1470012',
    name: 'ฟ้าทะลายโจร',
    dx_prefixes: 'U071,J00,J02,J028,J029,J03,J039,J06,J068,J069,J11,J20,J208,J209,J40,R05,R50,R509,U5610,U5619,U643,Z11,Z115'
  }
];

for (const u of UPDATES) {
  // deduplicate prefixes cleanly
  const uniquePrefixes = [...new Set(u.dx_prefixes.split(',').map(s => s.trim()).filter(Boolean))].join(',');
  await dw.query('UPDATE dw_hd_check_drug_dx_map SET dx_prefixes = ? WHERE icode = ?', [uniquePrefixes, u.icode]);
  console.log(`Updated [${u.icode}] ${u.name}`);
}

console.log('\n[SUCCESS] Applied updates to dw_hd_check_drug_dx_map.');
await dw.end();
