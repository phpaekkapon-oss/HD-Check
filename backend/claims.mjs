// ตรวจการเบิก สปสช. (เฟส 1): ตรวจรหัสวินิจฉัยก่อนส่งเบิก + ติดตามผลเบิกจาก FDH ที่ HOSxP เก็บไว้
// ฟังก์ชัน checkVisitIcd / claimState เป็น pure function (ทดสอบได้ไม่ต้องต่อ DB)
import { THAI_MED_FILTER } from './config.mjs'

const norm = (c) => String(c ?? '').trim().toUpperCase().replace(/\./g, '')

/**
 * ตรวจรหัสวินิจฉัยของ visit ตามหลักการเบิก (สอดคล้องกับ error ที่ สปสช. ตีกลับ เช่น 201, 232)
 * ref: { eclaim:Set(รหัสที่ e-Claim/สปสช./แผนไทย รับ), eclaimParents:Set(รหัสที่มีรหัสย่อยใน e-Claim), icdSex:Map(code→'1'|'2'), thaiMedU:Set }
 */
export function checkVisitIcd(visit, ref) {
  const issues = []
  const slots = ['pdx', 'dx0', 'dx1', 'dx2', 'dx3', 'dx4', 'dx5']
  const codes = slots.map((s) => [s, norm(visit[s])]).filter(([, c]) => c)
  const pdx = norm(visit.pdx)

  if (!pdx) issues.push({ code: 'NO_PDX', level: 'error', text: 'ไม่มีรหัสโรคหลัก (PDX)', hint: 'ลงรหัสโรคหลักในหน้าวินิจฉัยของ HOSxP (สปสช. error 201)' })

  for (const [slot, c] of codes) {
    const label = slot === 'pdx' ? 'โรคหลัก' : `โรคร่วม ${slot.toUpperCase()}`
    if (!ref.eclaim.has(c)) {
      if (ref.eclaimParents.has(c)) {
        issues.push({ code: 'NOT_SPECIFIC', level: 'error', dx: c, text: `${label} ${c} ไม่ละเอียดพอ`, hint: `เลือกรหัสย่อยที่ขึ้นต้นด้วย ${c} ให้ตรงกับอาการ` })
      } else {
        issues.push({ code: 'NOT_IN_ECLAIM', level: 'error', dx: c, text: `${label} ${c} ไม่อยู่ในรายการรหัสที่ สปสช./e-Claim รับ`, hint: 'ตรวจการพิมพ์รหัส หรือเลือกรหัสที่ใช้ได้' })
      }
    }
    const sex = ref.icdSex.get(c)
    if ((sex === '1' || sex === '2') && visit.sex && String(visit.sex) !== sex) {
      issues.push({ code: 'SEX_MISMATCH', level: 'error', dx: c, text: `${c} ใช้ได้เฉพาะเพศ${sex === '1' ? 'ชาย' : 'หญิง'}`, hint: 'ตรวจรหัสหรือเพศของผู้ป่วย' })
    }
    if (c.startsWith('U') && ref.thaiMedU.size > 0 && !ref.thaiMedU.has(c)) {
      issues.push({ code: 'U_NOT_THAIMED', level: 'warn', dx: c, text: `${c} ไม่อยู่ในรายการรหัสแพทย์แผนไทยของ HOSxP`, hint: 'ตรวจรหัส U กับรายการ icd10_health_med' })
    }
  }

  if (/^[V-Y]/.test(pdx)) {
    issues.push({ code: 'EXTERNAL_AS_PDX', level: 'error', dx: pdx, text: `รหัสสาเหตุภายนอก ${pdx} ใช้เป็นโรคหลักไม่ได้`, hint: 'ใช้รหัสการบาดเจ็บ (S/T) เป็นโรคหลัก แล้วใส่ V–Y เป็นโรคร่วม' })
  }
  if (/^[ST]/.test(pdx) && !codes.some(([, c]) => /^[V-Y]/.test(c))) {
    issues.push({ code: 'INJURY_NO_CAUSE', level: 'error', dx: pdx, text: `โรคหลักเป็นการบาดเจ็บ ${pdx} แต่ไม่มีรหัสสาเหตุ (V–Y)`, hint: 'เพิ่มรหัสสาเหตุภายนอกเป็นโรคร่วม (สปสช. error 232)' })
  }
  return issues
}

/**
 * สถานะการเบิกของ visit: not_nhso | no_result | pending | settled | rejected
 * no_result = HOSxP ยังไม่มีผลจาก FDH (อาจยังไม่ส่ง หรือยังไม่ได้ดึงสถานะ) จึงไม่ฟันธงว่า "ยังไม่ส่ง"
 */
export function claimState(visit) {
  if (visit.hip !== 'UCS') return 'not_nhso'
  if (!visit.fdh_status) return 'no_result'
  if (visit.fdh_status === 'rejected' || (visit.fdh_errors?.length ?? 0) > 0) return 'rejected'
  if (visit.fdh_status === 'settled') return 'settled'
  if (visit.fdh_status === 'unclaimed') return 'not_nhso'
  // received / waited / cut_off_batch / reclaimed / nhso_appealed ฯลฯ = ส่งแล้ว รอผล
  return 'pending'
}

/* ---------------- อ่านข้อมูลจาก HOSxP (อ่านอย่างเดียว) ---------------- */
let refCache = { at: 0, ref: null }
export async function loadIcdReference(hosPool) {
  if (refCache.ref && Date.now() - refCache.at < 30 * 60_000) return refCache.ref
  // ไม่มีตารางใดครบตารางเดียว: icd10_eclaim ไม่มี U506 (แต่ สปสช. จ่ายเงินจริง), icd10_nhso ไม่มี K64x
  // จึงถือว่าใช้ได้ถ้าอยู่ในตารางใดตารางหนึ่ง (e-Claim / สปสช. / รหัสแพทย์แผนไทย)
  const [ec] = await hosPool.query("SELECT code FROM icd10_eclaim WHERE IFNULL(active_status, 'Y') = 'Y'")
  const [nh] = await hosPool.query('SELECT code FROM icd10_nhso').catch(() => [[]])
  const [hmAll] = await hosPool.query('SELECT icd10 AS code FROM icd10_health_med').catch(() => [[]])
  const eclaim = new Set([...ec, ...nh, ...hmAll].map((r) => norm(r.code)).filter(Boolean))
  const eclaimParents = new Set()
  for (const c of eclaim) for (let n = 3; n < c.length; n++) eclaimParents.add(c.slice(0, n))
  const [ic] = await hosPool.query("SELECT code, sex FROM icd101 WHERE sex IN ('1','2')")
  const icdSex = new Map(ic.map((r) => [norm(r.code), String(r.sex)]))
  const [hm] = await hosPool.query('SELECT icd10 FROM icd10_health_med').catch(() => [[]])
  const thaiMedU = new Set(hm.map((r) => norm(r.icd10)).filter((c) => c.startsWith('U')))
  refCache = { at: Date.now(), ref: { eclaim, eclaimParents, icdSex, thaiMedU } }
  return refCache.ref
}

export async function fetchClaimVisits(hosPool, startDate, endDate) {
  const [visits] = await hosPool.query(
    `SELECT o.vn, o.hn, DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS visit_date, TIME_FORMAT(o.vsttime, '%H:%i') AS visit_time,
            CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS patient_name, pt.sex,
            ps.name AS pttype_name, ps.hipdata_code AS hip, doc.name AS doctor_name,
            ov.pdx, ov.dx0, ov.dx1, ov.dx2, ov.dx3, ov.dx4, ov.dx5
     FROM ovst o
     JOIN vn_stat ov ON ov.vn = o.vn
     JOIN patient pt ON pt.hn = o.hn
     JOIN spclty sp ON sp.spclty = o.spclty AND ${THAI_MED_FILTER}
     LEFT JOIN pttype ps ON ps.pttype = o.pttype
     LEFT JOIN doctor doc ON doc.code = o.doctor
     WHERE o.vstdate BETWEEN ? AND ?
     ORDER BY o.vstdate DESC, o.vsttime DESC`,
    [startDate, endDate]
  )
  if (visits.length === 0) return []
  const vns = visits.map((v) => v.vn)
  // ผลล่าสุดจาก FDH ต่อ visit
  const [fdh] = await hosPool.query(
    `SELECT f.fdh_claim_status_id AS id, f.vn,
            JSON_UNQUOTE(JSON_EXTRACT(f.fdh_claim_status_response, '$.data[0].status')) AS status,
            JSON_UNQUOTE(JSON_EXTRACT(f.fdh_claim_status_response, '$.data[0].status_message_th')) AS status_th,
            f.fdh_act_amt AS amount, f.fdh_stm_period AS stm_period,
            DATE_FORMAT(f.fdh_claim_status_datetime, '%Y-%m-%d %H:%i') AS checked_at
     FROM fdh_claim_status f
     JOIN (SELECT vn, MAX(fdh_claim_status_id) AS id FROM fdh_claim_status WHERE vn IN (?) GROUP BY vn) last ON last.id = f.fdh_claim_status_id`,
    [vns]
  )
  const fdhByVn = new Map(fdh.map((r) => [r.vn, r]))
  const ids = fdh.map((r) => r.id)
  const errById = new Map()
  if (ids.length) {
    const [errs] = await hosPool.query(
      "SELECT fdh_claim_status_id AS id, fdh_error_code AS code, fdh_error_desc AS descr FROM fdh_claim_status_detail WHERE fdh_claim_status_id IN (?)",
      [ids]
    )
    for (const e of errs) {
      if (!errById.has(e.id)) errById.set(e.id, [])
      errById.get(e.id).push({ code: String(e.code), text: e.descr })
    }
  }
  return visits.map((v) => {
    const f = fdhByVn.get(v.vn)
    return {
      ...v,
      fdh_status: f?.status && f.status !== 'null' ? f.status : null,
      fdh_status_th: f?.status_th && f.status_th !== 'null' ? f.status_th : null,
      fdh_amount: f?.amount != null ? Number(f.amount) : null,
      fdh_stm_period: f?.stm_period ?? null,
      fdh_checked_at: f?.checked_at ?? null,
      fdh_errors: f ? errById.get(f.id) ?? [] : [],
    }
  })
}

/** วันที่ล่าสุดที่ HOSxP ดึงสถานะจาก FDH (ใช้บอกผู้ใช้ว่าผลเบิกอัปเดตถึงเมื่อไร) */
export async function fdhLastChecked(hosPool) {
  const [[r]] = await hosPool.query("SELECT DATE_FORMAT(MAX(fdh_claim_status_datetime), '%Y-%m-%d %H:%i') AS last FROM fdh_claim_status")
  return r?.last ?? null
}
