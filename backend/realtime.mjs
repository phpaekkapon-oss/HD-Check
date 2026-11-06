// ข้อมูลแบบเกือบเรียลไทม์โดยไม่เพิ่มภาระเครื่อง HOSxP หลักตามจำนวนผู้ใช้
// - ตัวเฝ้าดู 1 ตัวต่อเซิร์ฟเวอร์ ถาม HOSxP ด้วยคำสั่งเบา (นับ/รวม เฉพาะ "วันนี้") เป็นรอบ
// - หน้าจอทุกเครื่องถามเลขเวอร์ชันจากหน่วยความจำของเซิร์ฟเวอร์เรา (ไม่แตะ HOSxP)
// - ผลลัพธ์ของหน้าที่อ่านสดถูกแคชตามเลขเวอร์ชัน: เปิดกี่เครื่องก็ถาม HOSxP 1 ครั้งต่อการเปลี่ยนแปลง

import { THAI_MED_FILTER } from './config.mjs'

/** ลายนิ้วมือของข้อมูลแผนไทยวันนี้: บันทึกให้บริการ รหัสหัตถการ/วินิจฉัย และรายการค่าใช้จ่ายของ visit ที่เกี่ยวข้อง */
export const THAI_MED_FINGERPRINT_SQL = `
  SELECT
    (SELECT CONCAT(COUNT(*), ':', IFNULL(MAX(health_med_service_id), 0))
       FROM health_med_service WHERE service_date = CURDATE()) AS hms,
    -- ตารางรหัสหัตถการ/วินิจฉัยไม่มีดัชนีตามบันทึก: ใช้เลขคีย์หลักล่าสุด (อ่านจากดัชนีทันที) แทนการนับ
    (SELECT IFNULL(MAX(health_med_service_operation_id), 0) FROM health_med_service_operation) AS ops,
    (SELECT IFNULL(MAX(health_med_service_diagnosis_id), 0) FROM health_med_service_diagnosis) AS hdx,
    (SELECT CONCAT(COUNT(*), ':', IFNULL(ROUND(SUM(op.sum_price), 2), 0))
       FROM opitemrece op
       JOIN ovst o ON o.vn = op.vn
       JOIN spclty sp ON sp.spclty = o.spclty
      WHERE o.vstdate = CURDATE()
        AND (${THAI_MED_FILTER}
             OR o.vn IN (SELECT h.vn FROM health_med_service h WHERE h.service_date = CURDATE()))) AS opd_items,
    (SELECT CONCAT(COUNT(*), ':', IFNULL(ROUND(SUM(op.sum_price), 2), 0))
       FROM opitemrece op
      WHERE op.rxdate = CURDATE()
        AND op.an IN (SELECT an FROM health_med_service WHERE service_date = CURDATE() AND an IS NOT NULL AND an <> '')) AS ipd_items,
    DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today
`

/** ลายนิ้วมือของการจ่ายยาสมุนไพรวันนี้ (ทุกแผนก) ใช้กับหน้าที่อ่านจากคลังข้อมูล */
export const HERB_FINGERPRINT_SQL = `
  SELECT CONCAT(COUNT(*), ':', IFNULL(SUM(qty), 0), ':', IFNULL(ROUND(SUM(sum_price), 2), 0)) AS herb
  FROM opitemrece WHERE vstdate = CURDATE() AND icode IN (?)
`

const SLOW_MS = 1500
const MAX_INTERVAL_MS = 60_000

/**
 * ตัวเฝ้าดูการเปลี่ยนแปลงใน HOSxP
 * @param {object} o
 * @param {{ query: Function }} o.pool  pool อ่านอย่างเดียวของ HOSxP
 * @param {() => Promise<string[]>} o.getHerbCodes  รหัสยาสมุนไพรที่ใช้งาน
 * @param {number} o.intervalMs  รอบการตรวจปกติ
 * @param {number} o.idleStopMs  หยุดตรวจเมื่อไม่มีหน้าจอถามนานเท่านี้ (ยกเว้น keepAlive)
 * @param {() => boolean} o.keepAlive  ให้ตรวจต่อแม้ไม่มีหน้าจอเปิด (เช่น เครื่องที่ทำหน้าที่ซิงก์)
 * @param {(signal: 'thaimed' | 'herb') => void} [o.onChange]
 */
export function createChangeWatcher({ pool, getHerbCodes, intervalMs = 10_000, idleStopMs = 90_000, keepAlive = () => false, onChange }) {
  const state = {
    versions: { thaimed: 1, herb: 1 },
    fingerprints: { thaimed: null, herb: null },
    checkedAt: null,
    changedAt: { thaimed: null, herb: null },
    durationMs: null,
    error: null,
    intervalMs,
  }
  let timer = null
  let lastClientAt = 0
  let checking = false

  const bump = (signal, fp) => {
    if (state.fingerprints[signal] !== null && state.fingerprints[signal] !== fp) {
      state.versions[signal] += 1
      state.changedAt[signal] = new Date().toISOString()
      onChange?.(signal)
    }
    state.fingerprints[signal] = fp
  }

  const check = async () => {
    if (checking) return
    checking = true
    const t0 = Date.now()
    try {
      const [[tm]] = await pool.query(THAI_MED_FINGERPRINT_SQL)
      bump('thaimed', `${tm.today}|${tm.hms}|${tm.ops}|${tm.hdx}|${tm.opd_items}|${tm.ipd_items}`)
      const codes = await getHerbCodes()
      if (codes.length > 0) {
        const [[hb]] = await pool.query(HERB_FINGERPRINT_SQL, [codes])
        bump('herb', `${tm.today}|${hb.herb}`)
      }
      state.error = null
      state.durationMs = Date.now() - t0
      // เครื่องหลักช้า: ถอยรอบการตรวจออกไปเอง (สูงสุด 60 วินาที) เพื่อไม่ซ้ำเติม
      state.intervalMs = state.durationMs > SLOW_MS ? Math.min(state.intervalMs * 2, MAX_INTERVAL_MS) : intervalMs
    } catch (err) {
      state.error = String(err?.message ?? err).slice(0, 200)
      state.intervalMs = Math.min(state.intervalMs * 2, MAX_INTERVAL_MS)
    } finally {
      state.checkedAt = new Date().toISOString()
      checking = false
    }
  }

  const loop = async () => {
    timer = null
    if (!keepAlive() && Date.now() - lastClientAt > idleStopMs) return // ไม่มีใครดู: หยุดถาม HOSxP
    await check()
    timer = setTimeout(loop, state.intervalMs)
  }

  return {
    /** หน้าจอถามเวอร์ชัน: เริ่มเฝ้าดูถ้ายังไม่ทำงาน */
    touch() {
      lastClientAt = Date.now()
      if (!timer && !checking) timer = setTimeout(loop, 0)
    },
    start() {
      if (!timer && !checking) timer = setTimeout(loop, 0)
    },
    get running() {
      return Boolean(timer) || checking
    },
    snapshot() {
      return {
        versions: { ...state.versions },
        checkedAt: state.checkedAt,
        changedAt: { ...state.changedAt },
        durationMs: state.durationMs,
        intervalSeconds: Math.round(state.intervalMs / 1000),
        healthy: !state.error,
        error: state.error,
      }
    },
    version(signal) {
      return state.versions[signal]
    },
    /** ข้อมูลเปลี่ยนจากในโปรแกรมเอง (เช่น กรอกยอดออกชุมชน/แก้เกณฑ์) — เลื่อนเวอร์ชันให้หน้าจอโหลดใหม่ */
    invalidate(signal) {
      state.versions[signal] += 1
      state.changedAt[signal] = new Date().toISOString()
    },
    /** สำหรับทดสอบ */
    _check: check,
  }
}

/**
 * แคชผลลัพธ์ JSON ตาม URL + เวอร์ชันข้อมูล (อายุสูงสุด maxAgeMs เพื่อรับการแก้ไขข้อมูลย้อนหลังที่ลายนิ้วมือ "วันนี้" ไม่เห็น)
 * ใช้หลังตรวจสิทธิ์เสมอ — ผลลัพธ์ของเส้นทางเหล่านี้ไม่ขึ้นกับผู้ใช้
 */
export function createLiveCache({ maxEntries = 300, maxAgeMs = 60_000 } = {}) {
  const store = new Map()
  return function liveCache(getVersion) {
    return (req, res, next) => {
      const key = `${req.originalUrl}|${getVersion()}`
      const hit = store.get(key)
      if (hit && Date.now() - hit.at < maxAgeMs) {
        res.setHeader('X-Live-Cache', 'HIT')
        return res.json(hit.body)
      }
      const json = res.json.bind(res)
      res.json = (body) => {
        if (res.statusCode === 200 && body && body.success !== false) {
          if (store.size >= maxEntries) store.delete(store.keys().next().value)
          store.set(key, { at: Date.now(), body })
        }
        res.setHeader('X-Live-Cache', 'MISS')
        return json(body)
      }
      next()
    }
  }
}
