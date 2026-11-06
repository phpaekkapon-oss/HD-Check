// สรุปผลการดำเนินงานกลุ่มงานแพทย์แผนไทย — ตรรกะล้วน (ไม่แตะฐานข้อมูล) เพื่อทดสอบได้

/** กลุ่มสิทธิที่แสดงในตาราง เรียงตามลำดับในแบบรายงาน (hipdata_code ของ HOSxP) */
export const RIGHT_GROUPS = [
  { id: 'ofc', label: 'สิทธิข้าราชการ', codes: ['OFC', 'BKK'] },
  { id: 'lgo', label: 'สิทธิ อปท.ท้องถิ่น', codes: ['LGO'] },
  { id: 'uc', label: 'บัตรทอง (UC)', codes: ['UCS'] },
  { id: 'pay', label: 'ชำระเงินเอง', codes: ['PAY', 'NRH'] },
  { id: 'sss', label: 'ประกันสังคม', codes: ['SSS'] },
  // จ่ายเองแล้วนำใบเสร็จไปเบิกคืน เช่น ประกันสังคมกรณีคลอดบุตร (ชำระเงิน)
  { id: 'reimb', label: 'เบิกได้ (ออกใบเสร็จ)', codes: ['CSH'] },
]
const OTHER_GROUP = { id: 'other', label: 'สิทธิอื่นๆ', codes: [] }

/** รหัสค่าบริการทั่วไปผู้ป่วยนอก 50 บาท (ในเวลา / นอกเวลาราชการ) */
export const OPD_FEE_ICODES = { inHours: '3000047', outHours: '3000048' }

export const rightGroupOf = (hipdataCode) => {
  const code = String(hipdataCode ?? '').trim().toUpperCase()
  return RIGHT_GROUPS.find((g) => g.codes.includes(code)) ?? OTHER_GROUP
}

const toSatang = (v) => Math.round(Number(v ?? 0) * 100)
const toBaht = (satang) => satang / 100
const flag = (v) => Number(v ?? 0) > 0

const emptyAcc = () => ({ persons: new Set(), servicePersons: new Set(), drugPersons: new Set(), visits: 0, visitsNoRecord: 0, service: 0, drug: 0, opdIn: 0, opdOut: 0 })

function addRow(acc, row) {
  acc.persons.add(row.hn)
  acc.visits += Number(row.visits ?? 0)
  acc.visitsNoRecord += Number(row.visits_no_record ?? 0)
  if (flag(row.has_service)) acc.servicePersons.add(row.hn)
  if (flag(row.has_drug)) acc.drugPersons.add(row.hn)
  acc.service += toSatang(row.service_value)
  acc.drug += toSatang(row.drug_value)
  acc.opdIn += toSatang(row.opd_in_value)
  acc.opdOut += toSatang(row.opd_out_value)
}

/**
 * @param opdRows แถวผู้ป่วยนอกแยกรายคน: { hipdata_code, hn, visits, visits_no_record, has_service, has_drug, service_value, drug_value, opd_in_value, opd_out_value }
 *   "ราย" (visits) = จำนวนครั้งที่รับบริการ ตรงกับจำนวนรายการในหน้าจอ HOSxP · "คน" (persons) = คนไม่ซ้ำ
 * @param ipdRows แถวผู้ป่วยใน (แม่หลังคลอด) แยกรายคน รูปแบบเดียวกัน
 * @param outreach { count, source }
 * @param records จำนวนบันทึกให้บริการใน HOSxP { opd, ipd, orphanOpd } ไว้กระทบยอดกับหน้าจอ HOSxP
 * เงินรวมเป็นสตางค์ (จำนวนเต็ม) ก่อนแปลงกลับ เพื่อไม่ให้ทศนิยมคลาดเคลื่อน
 */
export function buildDailySummary(opdRows, ipdRows, outreach, records = { opd: 0, ipd: 0, orphanOpd: 0 }) {
  const byId = new Map()
  for (const row of opdRows) {
    const g = rightGroupOf(row.hipdata_code)
    if (!byId.has(g.id)) byId.set(g.id, emptyAcc())
    addRow(byId.get(g.id), row)
  }
  const ipd = emptyAcc()
  for (const row of ipdRows) addRow(ipd, row)
  // ผู้ป่วยใน: นับครั้งจากบันทึกให้บริการที่มีเลข AN (1 AN มีได้หลายวัน)
  ipd.visits = Number(records.ipd ?? 0)

  const groups = [...RIGHT_GROUPS, OTHER_GROUP]
    .filter((g) => g.id !== 'other' || byId.has('other'))
    .map((g) => {
      const c = byId.get(g.id)
      return {
        id: g.id,
        label: g.label,
        visits: c?.visits ?? 0,
        persons: c?.persons.size ?? 0,
        servicePersons: c?.servicePersons.size ?? 0,
        drugPersons: c?.drugPersons.size ?? 0,
        serviceValue: toBaht(c?.service ?? 0),
        drugValue: toBaht(c?.drug ?? 0),
        total: toBaht((c?.service ?? 0) + (c?.drug ?? 0)),
      }
    })

  const accs = [...byId.values(), ipd]
  const union = (pick) => new Set(accs.flatMap((a) => [...pick(a)])).size
  const sum = (pick) => accs.reduce((s, a) => s + pick(a), 0)
  const serviceSatang = sum((a) => a.service)
  const drugSatang = sum((a) => a.drug)
  const opdInSatang = sum((a) => a.opdIn)
  const opdOutSatang = sum((a) => a.opdOut)

  const outreachCount = Math.max(0, Math.trunc(Number(outreach?.count ?? 0)))
  return {
    groups,
    ipd: {
      visits: ipd.visits,
      persons: ipd.persons.size,
      servicePersons: ipd.servicePersons.size,
      drugPersons: ipd.drugPersons.size,
      serviceValue: toBaht(ipd.service),
      drugValue: toBaht(ipd.drug),
      total: toBaht(ipd.service + ipd.drug),
    },
    totals: {
      visits: sum((a) => a.visits),
      /** visit แผนกแพทย์แผนไทยที่ยังไม่ลงบันทึกให้บริการใน HOSxP */
      visitsNoRecord: sum((a) => a.visitsNoRecord),
      persons: union((a) => a.persons),
      servicePersons: union((a) => a.servicePersons),
      drugPersons: union((a) => a.drugPersons),
      serviceValue: toBaht(serviceSatang),
      drugValue: toBaht(drugSatang),
      opdFeeInHours: toBaht(opdInSatang),
      opdFeeOutHours: toBaht(opdOutSatang),
      opdFee: toBaht(opdInSatang + opdOutSatang),
      grandTotal: toBaht(serviceSatang + drugSatang + opdInSatang + opdOutSatang),
    },
    outreach: { count: outreachCount, source: outreach?.source ?? 'none' },
    records: {
      opd: Number(records.opd ?? 0),
      ipd: Number(records.ipd ?? 0),
      total: Number(records.opd ?? 0) + Number(records.ipd ?? 0),
      orphanOpd: Number(records.orphanOpd ?? 0),
    },
  }
}

/** ตรวจจำนวนผู้ออกชุมชนที่กรอกเอง: จำนวนเต็ม 0–9999 */
export function parseOutreachCount(v) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 9999) return null
  return n
}

/**
 * รวมยอดออกชุมชนรายวันเป็นช่วง: วันที่มีค่าที่กรอกเองใช้ค่านั้น ไม่งั้นใช้ยอดจาก HOSxP
 * @param hosxp [{ date, count }]  @param manual [{ date, count }]
 */
export function mergeOutreach(hosxp, manual) {
  const manualByDate = new Map(manual.map((m) => [m.date, Number(m.count)]))
  const hosByDate = new Map(hosxp.map((h) => [h.date, Number(h.count)]))
  let count = 0
  let usedManual = false
  let usedHosxp = false
  for (const date of new Set([...manualByDate.keys(), ...hosByDate.keys()])) {
    if (manualByDate.has(date)) {
      count += manualByDate.get(date)
      usedManual = true
    } else if ((hosByDate.get(date) ?? 0) > 0) {
      count += hosByDate.get(date)
      usedHosxp = true
    }
  }
  const source = usedManual && usedHosxp ? 'mixed' : usedManual ? 'manual' : usedHosxp ? 'hosxp' : 'none'
  return {
    count,
    source,
    manualDays: manualByDate.size,
    hosxpCount: [...hosByDate.values()].reduce((s, n) => s + n, 0),
  }
}
