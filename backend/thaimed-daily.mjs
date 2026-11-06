// สรุปผลการดำเนินงานรายวัน กลุ่มงานแพทย์แผนไทย — ตรรกะล้วน (ไม่แตะฐานข้อมูล) เพื่อทดสอบได้

/** กลุ่มสิทธิที่แสดงในตาราง เรียงตามลำดับในแบบรายงาน (hipdata_code ของ HOSxP) */
export const RIGHT_GROUPS = [
  { id: 'ofc', label: 'สิทธิข้าราชการ', codes: ['OFC'] },
  { id: 'lgo', label: 'สิทธิ อปท.ท้องถิ่น', codes: ['LGO'] },
  { id: 'uc', label: 'บัตรทอง (UC)', codes: ['UCS'] },
  { id: 'pay', label: 'ชำระเงินเอง', codes: ['PAY'] },
  { id: 'sss', label: 'ประกันสังคม', codes: ['SSS'] },
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

/**
 * @param rows แถวจาก SQL แยกตาม hipdata_code:
 *   { hipdata_code, persons, service_persons, drug_persons, service_value, drug_value, opd_in_value, opd_out_value }
 * @param outreach { count: number, source: 'hosxp' | 'manual' | 'none' }
 * เงินรวมเป็นสตางค์ (จำนวนเต็ม) ก่อนแปลงกลับ เพื่อไม่ให้ทศนิยมคลาดเคลื่อน
 */
export function buildDailySummary(rows, outreach) {
  const byId = new Map()
  for (const row of rows) {
    const g = rightGroupOf(row.hipdata_code)
    const cur = byId.get(g.id) ?? { g, persons: 0, servicePersons: 0, drugPersons: 0, service: 0, drug: 0, opdIn: 0, opdOut: 0 }
    cur.persons += Number(row.persons ?? 0)
    cur.servicePersons += Number(row.service_persons ?? 0)
    cur.drugPersons += Number(row.drug_persons ?? 0)
    cur.service += toSatang(row.service_value)
    cur.drug += toSatang(row.drug_value)
    cur.opdIn += toSatang(row.opd_in_value)
    cur.opdOut += toSatang(row.opd_out_value)
    byId.set(g.id, cur)
  }

  const order = [...RIGHT_GROUPS, OTHER_GROUP]
  const groups = order
    .filter((g) => g.id !== 'other' || byId.has('other'))
    .map((g) => {
      const c = byId.get(g.id)
      const service = c?.service ?? 0
      const drug = c?.drug ?? 0
      return {
        id: g.id,
        label: g.label,
        persons: c?.persons ?? 0,
        servicePersons: c?.servicePersons ?? 0,
        drugPersons: c?.drugPersons ?? 0,
        serviceValue: toBaht(service),
        drugValue: toBaht(drug),
        total: toBaht(service + drug),
      }
    })

  const all = [...byId.values()]
  const sum = (pick) => all.reduce((s, c) => s + pick(c), 0)
  const serviceSatang = sum((c) => c.service)
  const drugSatang = sum((c) => c.drug)
  const opdInSatang = sum((c) => c.opdIn)
  const opdOutSatang = sum((c) => c.opdOut)

  const outreachCount = Math.max(0, Math.trunc(Number(outreach?.count ?? 0)))
  return {
    groups,
    totals: {
      persons: sum((c) => c.persons),
      servicePersons: sum((c) => c.servicePersons),
      drugPersons: sum((c) => c.drugPersons),
      serviceValue: toBaht(serviceSatang),
      drugValue: toBaht(drugSatang),
      opdFeeInHours: toBaht(opdInSatang),
      opdFeeOutHours: toBaht(opdOutSatang),
      opdFee: toBaht(opdInSatang + opdOutSatang),
      grandTotal: toBaht(serviceSatang + drugSatang + opdInSatang + opdOutSatang),
    },
    outreach: { count: outreachCount, source: outreach?.source ?? 'none' },
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
