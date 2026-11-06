// ตรวจความสอดคล้องรายเดือน (HOSxP เทียบคลังข้อมูล) และซิงก์ย้อนหลังตอนกลางคืน
// - นับแถวยาสมุนไพรรายเดือนทั้งสองฝั่ง เดือนไหนไม่ตรงจะซิงก์เดือนนั้นใหม่ (ซ่อมตัวเอง)
// - ซิงก์ "เดือนนี้ + เดือนก่อน" ทุกคืนเสมอ เพื่อรับการแก้รหัสวินิจฉัยย้อนหลังที่จำนวนแถวไม่เปลี่ยน

const pad = (n) => String(n).padStart(2, '0')

export const ymOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number)
  return { startDate: `${ym}-01`, endDate: `${ym}-${pad(new Date(y, m, 0).getDate())}` }
}

/** รายชื่อเดือนตั้งแต่ fromYm ถึง toYm (รวมทั้งสองด้าน) */
export function monthsBetween(fromYm, toYm) {
  const out = []
  let [y, m] = fromYm.split('-').map(Number)
  const [ty, tm] = toYm.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${pad(m)}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/** เทียบจำนวนรายเดือน: Map ym → { opd, ipd } */
export function compareMonthly(months, hosCounts, dwCounts) {
  return months.map((month) => {
    const h = hosCounts.get(month) ?? { opd: 0, ipd: 0 }
    const d = dwCounts.get(month) ?? { opd: 0, ipd: 0 }
    return { month, hosOpd: h.opd, dwOpd: d.opd, hosIpd: h.ipd, dwIpd: d.ipd, ok: h.opd === d.opd && h.ipd === d.ipd }
  })
}

/**
 * @param o.countHos (startDate, endDate) => Promise<Map ym → {opd, ipd}>
 * @param o.countDw  (startDate, endDate) => Promise<Map ym → {opd, ipd}>
 * @param o.sync     (startDate, endDate) => Promise<{ skipped?, totalPrescriptions?, durationMs? }>
 * @param o.fromYm / o.toYm  ช่วงเดือนที่ตรวจ
 * @param o.recent   จำนวนเดือนล่าสุดที่ซิงก์ใหม่เสมอ (ค่าเริ่มต้น 2 = เดือนนี้ + เดือนก่อน)
 */
export async function runReconcile({ countHos, countDw, sync, fromYm, toYm, recent = 2, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), retries = 5 }) {
  const startedAt = new Date().toISOString()
  const months = monthsBetween(fromYm, toYm)
  const first = monthRange(months[0]).startDate
  const last = monthRange(months[months.length - 1]).endDate
  const before = compareMonthly(months, await countHos(first, last), await countDw(first, last))
  const recentMonths = months.slice(-recent)
  const toSync = [...new Set([...before.filter((r) => !r.ok).map((r) => r.month), ...recentMonths])]

  const resynced = []
  const errors = []
  for (const month of toSync) {
    const { startDate, endDate } = monthRange(month)
    let done = false
    for (let i = 0; i < retries && !done; i++) {
      try {
        const r = await sync(startDate, endDate)
        if (r?.skipped) {
          await sleep(30_000) // อีกเครื่องกำลังซิงก์อยู่ รอแล้วลองใหม่
          continue
        }
        resynced.push({ month, rows: r?.totalPrescriptions ?? 0, durationMs: r?.durationMs ?? 0, reason: before.find((b) => b.month === month)?.ok === false ? 'mismatch' : 'recent' })
        done = true
      } catch (err) {
        errors.push({ month, error: String(err?.message ?? err).slice(0, 200) })
        done = true
      }
    }
    if (!done) errors.push({ month, error: 'คลังข้อมูลถูกล็อกโดยการซิงก์อื่นนานเกินไป' })
  }

  // ตรวจซ้ำเฉพาะเดือนที่ไม่ตรงก่อนหน้า เพื่อยืนยันว่าซ่อมได้จริง
  const fixedMonths = before.filter((r) => !r.ok).map((r) => r.month)
  let after = before
  if (fixedMonths.length > 0) {
    const recheck = new Map(compareMonthly(months, await countHos(first, last), await countDw(first, last)).map((r) => [r.month, r]))
    after = before.map((r) => recheck.get(r.month) ?? r)
  }
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    monthsChecked: months.length,
    mismatchedBefore: fixedMonths,
    mismatchedAfter: after.filter((r) => !r.ok).map((r) => r.month),
    resynced,
    errors,
    months: after,
  }
}

/** ตัวนับจากฐานข้อมูลจริง (ใช้เงื่อนไขยาสมุนไพรชุดเดียวกับการซิงก์) */
export function makeCounters({ hosPool, dwPool, getFilter }) {
  const toMap = (rows, key) => {
    const m = new Map()
    for (const r of rows) {
      const cur = m.get(r.ym) ?? { opd: 0, ipd: 0 }
      cur[key] = Number(r.n)
      m.set(r.ym, cur)
    }
    return m
  }
  return {
    async countHos(startDate, endDate) {
      const filter = await getFilter()
      const [opd] = await hosPool.query(
        `SELECT DATE_FORMAT(o.vstdate, '%Y-%m') AS ym, COUNT(*) AS n
         FROM ovst o JOIN opitemrece op ON o.vn = op.vn JOIN drugitems d ON op.icode = d.icode
         WHERE o.vstdate BETWEEN ? AND ? AND (op.an IS NULL OR op.an = '') AND ${filter}
         GROUP BY ym`,
        [startDate, endDate]
      )
      const [ipd] = await hosPool.query(
        `SELECT DATE_FORMAT(op.vstdate, '%Y-%m') AS ym, COUNT(DISTINCT op.hos_guid) AS n
         FROM opitemrece op JOIN drugitems d ON op.icode = d.icode
         WHERE op.vstdate BETWEEN ? AND ? AND op.an IS NOT NULL AND op.an <> '' AND ${filter}
         GROUP BY ym`,
        [startDate, endDate]
      )
      const m = toMap(opd, 'opd')
      for (const [ym, v] of toMap(ipd, 'ipd')) m.set(ym, { opd: m.get(ym)?.opd ?? 0, ipd: v.ipd })
      return m
    },
    async countDw(startDate, endDate) {
      const [rows] = await dwPool.query(
        `SELECT DATE_FORMAT(visit_date, '%Y-%m') AS ym, SUM(vn NOT LIKE 'AN:%') AS opd, SUM(vn LIKE 'AN:%') AS ipd
         FROM dw_hd_check_prescriptions WHERE visit_date BETWEEN ? AND ? GROUP BY ym`,
        [startDate, endDate]
      )
      return new Map(rows.map((r) => [r.ym, { opd: Number(r.opd), ipd: Number(r.ipd) }]))
    },
  }
}
