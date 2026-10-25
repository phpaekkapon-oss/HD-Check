// ความรู้ของ AI Copilot สร้างจากเกณฑ์จริงในระบบ (ไม่เข้าถึง DB เอง จึงทดสอบได้ด้วย node --test)
import { MIN_QTY_APPLY_PTTYPES, THAI_MED_DOCTORS_REQUIRE_U, normalizeIcdCode } from './config.mjs'
import { REQUIRED_KNEE_OPS, REQUIRED_POSTPARTUM_OPS, ALLOWED_MUSCLE_OPS } from './healthmed.mjs'

/** ชื่อหัตถการตาม health_med_operation_item ของ HOSxP ใช้เมื่อดึงจาก HOSxP ไม่ได้ */
export const FALLBACK_OP_NAMES = {
  '872-78-11': 'การนวดด้วยวิธีการแพทย์แผนไทยแบบราชสำนัก ที่ต้นขา (พอกเข่า)',
  '873-78-11': 'การนวดด้วยวิธีการแพทย์แผนไทยแบบราชสำนัก ที่หัวเข่า (พอกเข่า)',
  '874-78-11': 'การนวดด้วยวิธีการแพทย์แผนไทยแบบราชสำนัก ที่ขาท่อนล่าง (พอกเข่า)',
  '873-78-35': 'การพอกยาสมุนไพร แบบราชสำนัก ที่หัวเข่า (พอกเข่า)',
  '900-78-00': 'การอบไอน้ำสมุนไพร',
  '900-78-11': 'การนวดด้วยวิธีการแพทย์แผนไทยแบบราชสำนัก',
  '900-78-20': 'การประคบด้วยสมุนไพร',
  '900-77-12': 'การบริบาลหญิงหลังคลอดด้วยการทับหม้อเกลือ',
  '900-77-13': 'การบริบาลหญิงหลังคลอดด้วยการนวด',
  '900-77-14': 'การบริบาลหญิงหลังคลอดด้วยการประคบสมุนไพร',
  '900-77-16': 'การบริบาลหญิงหลังคลอดด้วยการอบไอน้ำสมุนไพร',
  '900-77-30': 'การบริบาลหญิงหลังคลอดด้วยการปฏิบัติตัวสำหรับหลังคลอด',
}
export const COPILOT_OP_CODES = [...new Set([...REQUIRED_KNEE_OPS, ...ALLOWED_MUSCLE_OPS, ...REQUIRED_POSTPARTUM_OPS])]

/**
 * รวมข้อมูลดิบเป็นฐานความรู้
 * dxMapRows: dw_hd_check_drug_dx_map, dispensingRules: getDispensingRules(activeOnly), opRows: [{ code, name }]
 */
export function buildCopilotKb({ dxMapRows = [], dispensingRules = [], duplicateRules = {}, opRows = [] }) {
  const intervalByIcode = new Map()
  for (const r of dispensingRules) {
    if (!intervalByIcode.has(String(r.drug_icode))) intervalByIcode.set(String(r.drug_icode), r)
  }
  const drugs = dxMapRows.map((r) => {
    const prefixes = String(r.dx_prefixes ?? '').split(',').map(normalizeIcdCode).filter(Boolean)
    const rule = intervalByIcode.get(String(r.icode))
    return {
      icode: String(r.icode),
      name: String(r.drug_name ?? '').replace(/\s+/g, ' ').trim(),
      modern: prefixes.filter((p) => !p.startsWith('U')),
      u: prefixes.filter((p) => p.startsWith('U')),
      minQty: Number(r.min_qty ?? 0),
      indication: String(r.indication ?? '').trim(),
      interval: rule ? { days: Number(rule.min_interval_days), label: rule.pttype_name_label || rule.pttype_filter } : null,
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'th'))
  const opNames = { ...FALLBACK_OP_NAMES }
  for (const o of opRows) if (o.code && o.name) opNames[o.code] = String(o.name).replace(/\s*-\s*\d+(?=\s*(\(|$))/, '').trim()
  return { drugs, opNames, duplicateRules }
}

const opList = (kb, codes) => codes.map((c) => `**${c}** ${kb.opNames[c] ?? ''}`.trim())
const bullets = (items) => items.map((s) => `- ${s}`).join('\n')

/* ---------------- คำตอบแต่ละหัวข้อ (ใช้ทั้งโหมด offline และเป็นบริบทให้ AI) ---------------- */

function drugAnswer(kb, d) {
  const lines = [`### 💊 ${d.name} (รหัสยา ${d.icode})`]
  if (d.indication) lines.push(`**ข้อบ่งใช้:** ${d.indication}`)
  if (d.modern.length || d.u.length) {
    lines.push(`**รหัส ICD-10 ที่ใช้คู่กับยานี้ (ขึ้นต้นด้วย):**`)
    lines.push(bullets([
      `แผนปัจจุบัน: ${d.modern.join(', ') || '— (ใช้รหัสในรายการแผนไทย)'}`,
      `แผนไทย (U) ที่เข้ากับข้อบ่งใช้: ${d.u.join(', ') || '—'} (แผนกแพทย์แผนไทยใช้รหัส U ตัวใดก็ได้)`,
    ]))
    lines.push(`**เกณฑ์ผ่าน:** แพทย์แผนปัจจุบันต้องมีรหัสแผนปัจจุบันตรงเกณฑ์ / แผนกแพทย์แผนไทยต้องมีรหัสแผนปัจจุบันตรงเกณฑ์ **ควบคู่กับรหัส U ตัวใดก็ได้**`)
  } else {
    lines.push('⚠️ ยาตัวนี้**ยังไม่ได้ตั้งเกณฑ์ ICD** ในระบบ — ตั้งได้ที่เมนู "ตั้งค่ายา ↔ ICD-10"')
  }
  lines.push(d.minQty > 0
    ? `**จ่ายขั้นต่ำ:** ${d.minQty} หน่วย/ครั้ง (ยกเว้นสิทธิข้าราชการ/ประกันสังคม/อปท./กทม./ชำระเงินเอง/ประกันภัย)`
    : '**จ่ายขั้นต่ำ:** ไม่ได้กำหนด')
  lines.push(d.interval
    ? `**รอบการจ่าย:** ${d.interval.label} จ่ายซ้ำได้เมื่อห่างจากครั้งก่อนอย่างน้อย ${d.interval.days} วัน`
    : '**รอบการจ่าย:** ไม่ได้กำหนด')
  return lines.join('\n')
}

function codeAnswer(kb, code) {
  const users = kb.drugs.filter((d) => [...d.modern, ...d.u].some((p) => code.startsWith(p)))
  if (users.length === 0) {
    return `### 🔎 รหัส ${code}\nยังไม่มียาสมุนไพรในระบบที่ตั้งเกณฑ์ให้ใช้คู่กับรหัส **${code}**\n\nถ้าจ่ายยาสมุนไพรกับรหัสนี้ ระบบจะขึ้น "DX ไม่ตรงข้อบ่งใช้"`
  }
  return `### 🔎 ยาสมุนไพรที่ใช้คู่กับรหัส ${code} ได้ (${users.length} รายการ)\n${bullets(users.map((d) => {
    const hit = [...d.modern, ...d.u].filter((p) => code.startsWith(p)).join(', ')
    return `**${d.name}** — ตรงเกณฑ์ ${hit}${d.indication ? ` (${d.indication})` : ''}`
  }))}`
}

function opAnswer(kb, code) {
  const roles = []
  if (REQUIRED_KNEE_OPS.includes(code)) roles.push('เป็น 1 ใน 4 รหัสพอกเข่า (ต้องลงครบทั้ง 4 รหัส)')
  if (REQUIRED_POSTPARTUM_OPS.includes(code)) roles.push('เป็น 1 ใน 5 รหัสบริบาลหญิงหลังคลอด (ต้องลงครบทั้ง 5 รหัส)')
  if (ALLOWED_MUSCLE_OPS.includes(code) && !REQUIRED_KNEE_OPS.includes(code)) roles.push('ใช้คู่กับรหัส M... + U... ในเกณฑ์โรคกล้ามเนื้อทั่วไป')
  return `### 🩺 หัตถการ ${code}\n**ชื่อใน HOSxP:** ${kb.opNames[code] ?? 'ไม่พบชื่อในระบบ'}\n${roles.length ? bullets(roles) : '- ไม่ได้ใช้ในเกณฑ์ตรวจของระบบนี้'}`
}

const TOPICS = {
  knee: (kb) => `### 🦵 เกณฑ์พอกเข่า (ตรวจหัตถการแผนไทย)
ใช้เกณฑ์นี้เมื่อ **สิทธิ UC** (ทุกประเภทย่อย เช่น ผู้สูงอายุ, อสม., ผู้พิการ — hipdata_code = UCS) **และ** ลงรหัสพอกเข่าอย่างน้อย 1 รหัส
1. ต้องมี **M179** คู่กับ **U5753**
2. อายุ **40 ปีขึ้นไป**
3. ต้องลงรหัสหัตถการ**ครบทั้ง 4 รหัส** ถ้าไม่ครบไม่ผ่าน:
${bullets(opList(kb, REQUIRED_KNEE_OPS))}

เคส M179+U5753 ที่**นวดอย่างเดียว** หรือ**สิทธิอื่น** (ข้าราชการ, ประกันสังคม ฯลฯ) ตรวจด้วยเกณฑ์โรคกล้ามเนื้อทั่วไป (M + U + หัตถการ)`,

  postpartum: (kb) => `### 🤱 เกณฑ์บริบาลหญิงหลังคลอด
1. ต้องมี **M6260** คู่กับ **U506**
2. ต้องลงรหัสหัตถการ**ครบทั้ง 5 รหัส**:
${bullets(opList(kb, REQUIRED_POSTPARTUM_OPS))}
3. ต้องมี**วันคลอด**ในระบบงานบัญชี 2 (ANC / ข้อมูลการคลอด) ถ้าไม่มีไม่ผ่าน

ถ้าเป็น **M6260 + รหัส U อื่น** (ไม่ใช่ U506) ถือเป็นโรคกล้ามเนื้ออื่นๆ ตรวจด้วยเกณฑ์ทั่วไป`,

  muscle: (kb) => `### 💆 เกณฑ์โรคกล้ามเนื้อทั่วไป (M + U + หัตถการ)
1. ต้องมีรหัสโรคกล้ามเนื้อ **M...**
2. ต้องมีรหัสแพทย์แผนไทย **U...** ร่วมด้วย
3. ต้องมีรหัสหัตถการอย่างน้อย 1 รหัส (หรือมีค่านวด/ประคบ/อบไอน้ำ):
${bullets(opList(kb, ALLOWED_MUSCLE_OPS))}`,

  duplicate: (kb) => {
    const r = kb.duplicateRules ?? {}
    const on = (v) => (v === false ? '(ปิดอยู่)' : '(เปิดอยู่)')
    return `### 🔁 เกณฑ์คิดค่าบริการซ้ำ
- ค่านวดและประคบ + ค่านวด + ค่าประคบ อยู่ใน visit เดียวกัน (ตั้งแต่ 2 อย่างขึ้นไป) ไม่ผ่าน ${on(r.block_coexist)}
- ค่านวดและประคบ (58130) 2 ครั้งใน visit เดียว ไม่ผ่าน ${on(r.block_both_multiple)}
- ค่านวดเดี่ยว หรือค่าประคบเดี่ยว 2 ครั้ง ไม่ผ่าน ${on(r.block_single_multiple)}

แก้ใน HOSxP: เปิดรายการค่าใช้จ่ายของ VN นั้น แล้วยกเลิกรายการที่ซ้ำ`
  },

  ep: () => `### ⚠️ รหัสปิดสิทธิ (EP...)
- ตรวจเฉพาะผู้ป่วย**สิทธิ UC** (ทุกประเภทย่อย) ถ้าพบรหัสที่ขึ้นต้นด้วย **EP** ในรหัสวินิจฉัยหรือรายการค่าบริการ จะไม่ผ่าน
- แก้ใน HOSxP: ตรวจสิทธิการรักษาของ visit และนำรหัส EP ที่ไม่ถูกต้องออก`,

  interval: (kb) => {
    const ruled = kb.drugs.filter((d) => d.interval)
    return `### 📅 เงื่อนไขรอบการจ่ายยา (ตัดการจ่าย)
${ruled.length ? bullets(ruled.map((d) => `**${d.name}** — ${d.interval.label} ต้องห่างจากครั้งก่อนอย่างน้อย **${d.interval.days} วัน**`)) : '- ยังไม่มีการตั้งเงื่อนไขรอบการจ่าย'}

ระบบดูประวัติการจ่ายยาตัวเดียวกันของ HN เดียวกัน ถ้าห่างไม่ครบจำนวนวันจะขึ้น "จ่ายซ้ำไม่ครบ X วัน"
ตั้งค่าได้ที่เมนู "ตั้งค่ายา ↔ ICD-10" → แท็บเงื่อนไขรอบการจ่าย`
  },

  minQty: (kb) => {
    const ruled = kb.drugs.filter((d) => d.minQty > 0)
    return `### 📦 เกณฑ์จ่ายขั้นต่ำ
${ruled.length ? bullets(ruled.map((d) => `**${d.name}** — อย่างน้อย **${d.minQty}** หน่วย/ครั้ง`)) : '- ยังไม่มีการตั้งจ่ายขั้นต่ำ'}

**ใช้เกณฑ์ขั้นต่ำเฉพาะสิทธิ UC** (สิทธิอื่นทั้งหมดไม่ตรวจ)`
  },

  herbRule: () => `### 🌿 เกณฑ์ตรวจการจ่ายยาสมุนไพร (DX ตรงข้อบ่งใช้)
ระบบเทียบรหัส PDX และ DX0–DX5 ของ visit กับเกณฑ์ ICD ที่ตั้งไว้ให้ยาแต่ละตัว (เทียบแบบขึ้นต้นด้วย เช่น M ครอบคลุม M00–M99)
- **แพทย์ พยาบาล และผู้สั่งอื่นๆ:** ผ่านเมื่อมีรหัสแผนปัจจุบัน (ICD10) ตรงเกณฑ์ของยา ไม่ต้องมีรหัส U
- **แพทย์แผนไทย 5 ท่านเท่านั้น** (${THAI_MED_DOCTORS_REQUIRE_U.join(', ')}): ต้องมีรหัสแผนปัจจุบันตรงเกณฑ์ **ควบคู่กับรหัส U ตัวใดก็ได้** (มีแต่รหัส U อย่างเดียวไม่ผ่าน)
- **ไม่มี DX:** visit ไม่มีรหัสวินิจฉัยเลย
- **รอตั้งค่า:** ยาตัวนั้นยังไม่ได้ตั้งเกณฑ์ ICD
- ไม่ผ่านได้อีก 2 กรณี: จ่ายต่ำกว่าขั้นต่ำ, จ่ายซ้ำไม่ครบรอบวัน

💡 คลิกที่แถวในตาราง (หรือรูปตา) เพื่อดูว่าขาดรหัสอะไร และต้องแก้ที่ไหนใน HOSxP`,

  drugList: (kb) => `### 💊 ยาสมุนไพรที่ตั้งเกณฑ์ในระบบ (${kb.drugs.length} รายการ)
${bullets(kb.drugs.map((d) => `**${d.name}** — ${[...d.modern, ...d.u].join(', ') || 'ยังไม่ตั้งเกณฑ์'}`))}`,

  contact: () => `### 📞 ติดต่อผู้พัฒนาระบบ SMART-HOSCHECK
- **ผู้พัฒนา:** นายเอกพล อันคำวงศ์ (นักวิชาการคอมพิวเตอร์ปฏิบัติการ)
- **กลุ่มงาน:** สุขภาพดิจิทัล โรงพยาบาลพังโคน
- **โทรภายใน:** ต่อ **257**`,
}

const TOPIC_PATTERNS = [
  ['knee', /พอกเข่า|ข้อเข่า|เข่าเสื่อม|เกณฑ์เข่า/],
  ['postpartum', /หลังคลอด|ทับหม้อเกลือ|วันคลอด|บัญชี\s*2/],
  ['duplicate', /ซ้ำซ้อน|คิด(ค่าบริการ)?ซ้ำ|ค่า(บริการ)?ซ้ำ|นวดและประคบ|58130|58101/],
  ['ep', /\bep|ปิดสิทธิ/i],
  ['interval', /รอบการจ่าย|ตัดการจ่าย|จ่ายซ้ำ|กี่วัน|ห่างกี่วัน|\d+\s*วัน/],
  ['minQty', /ขั้นต่ำ|min\s*qty|จ่ายน้อย/i],
  ['drugList', /รายการยา(ทั้งหมด)?|ยา(สมุนไพร)?\s*\d+\s*รายการ|มียาอะไรบ้าง/],
  ['muscle', /กล้ามเนื้อ|นวด|ประคบ|อบไอน้ำ|หัตถการ/],
  ['herbRule', /dx\s*ไม่ตรง|ข้อบ่งใช้|ไม่ผ่าน|เกณฑ์(การ)?จ่ายยา|ตรวจยา|ไม่มี\s*dx|รอตั้งค่า/i],
  ['contact', /ผู้พัฒนา|ติดต่อ|เบอร์|โทร|เอกพล/],
]

// ชื่อยาแบบสั้นสำหรับค้นในคำถาม เช่น "ไอมะขามป้อม  120  ml(X)" -> "ไอมะขามป้อม"
const baseName = (name) => name.replace(/\(.*?\)/g, ' ').replace(/\s+\d.*$/, '').replace(/^ยา/, '').replace(/\s+/g, '').trim()

export function findDrugs(kb, query) {
  const q = query.replace(/\s+/g, '')
  const hits = kb.drugs.filter((d) => {
    const b = baseName(d.name)
    return q.includes(d.icode) || (b.length >= 2 && q.includes(b))
  })
  // ถ้าชื่อหนึ่งอยู่ในอีกชื่อ (เช่น "รางจืด" กับ "ชาชงรางจืด") เก็บชื่อที่ยาวกว่าเมื่อคำถามระบุชัด
  return hits.filter((d) => !hits.some((o) => o !== d && baseName(o.name).includes(baseName(d.name)) && q.includes(baseName(o.name))))
}

/** ตอบจากฐานความรู้โดยไม่ใช้ AI (โหมด offline) */
export function offlineAnswer(kb, query) {
  const q = String(query ?? '').trim()
  const upper = q.toUpperCase()

  const opCodes = [...new Set(upper.match(/\d{3}-\d{2}-\d{2}/g) ?? [])]
  if (opCodes.length) return opCodes.map((c) => opAnswer(kb, c)).join('\n\n')

  // หัวข้อเฉพาะเจาะจงมาก่อนชื่อยา (เช่น "นวดและประคบ 2 ครั้ง" ไม่ใช่ยาประคบ)
  for (const [topic, re] of TOPIC_PATTERNS.slice(0, 3)) {
    if (re.test(q)) return TOPICS[topic](kb)
  }
  if (/\bM179\b|\bU5753\b/.test(upper)) return TOPICS.knee(kb)
  if (/\bU506\b/.test(upper)) return TOPICS.postpartum(kb)

  const drugs = findDrugs(kb, q)
  if (drugs.length) return drugs.slice(0, 3).map((d) => drugAnswer(kb, d)).join('\n\n---\n\n')

  const icd = [...new Set((upper.match(/\b[A-Z]\d{2,5}\b/g) ?? []).filter((c) => !c.startsWith('EP')))]
  if (icd.length) return icd.slice(0, 3).map((c) => codeAnswer(kb, c)).join('\n\n')

  for (const [topic, re] of TOPIC_PATTERNS.slice(3)) {
    if (re.test(q)) return TOPICS[topic](kb)
  }

  return `สวัสดีครับ ผมคือ **AI Smart Copilot** ของระบบ SMART-HOSCHECK ตอบจากเกณฑ์จริงที่ตั้งไว้ในระบบ ลองถามแบบนี้ได้เลยครับ
- "ขมิ้นชันใช้รหัสอะไร" — เกณฑ์ ICD, จ่ายขั้นต่ำ, รอบการจ่ายของยาแต่ละตัว (${kb.drugs.length} รายการ)
- "K30 ใช้ยาอะไรได้บ้าง" — ยาที่ใช้คู่กับรหัสโรคนั้น
- "873-78-35 คืออะไร" — ชื่อหัตถการและเกณฑ์ที่เกี่ยวข้อง
- "เกณฑ์พอกเข่า", "บริบาลหลังคลอด", "คิดค่าบริการซ้ำ", "รหัส EP"
- "ยาที่ตัดการจ่ายกี่วัน", "ยาที่มีจ่ายขั้นต่ำ", "DX ไม่ตรงแก้ยังไง"`
}

/** บริบทให้ AI (system instruction) */
export function buildCopilotContext(kb) {
  const drugLines = kb.drugs.map((d) =>
    `- ${d.name} [${d.icode}] | ICD แผนปัจจุบัน: ${d.modern.join(',') || '-'} | U แนะนำ (ไม่บังคับ): ${d.u.join(',') || '-'} | ขั้นต่ำ: ${d.minQty || '-'} | รอบจ่าย: ${d.interval ? `${d.interval.days} วัน (${d.interval.label})` : '-'} | ข้อบ่งใช้: ${d.indication || '-'}`
  )
  return [
    TOPICS.herbRule(kb),
    TOPICS.knee(kb),
    TOPICS.postpartum(kb),
    TOPICS.muscle(kb),
    TOPICS.duplicate(kb),
    TOPICS.ep(kb),
    `### สิทธิที่ใช้เกณฑ์จ่ายขั้นต่ำ (เฉพาะ UC; สิทธิอื่นไม่ตรวจ)\nชื่อสิทธิที่มีคำว่า: ${MIN_QTY_APPLY_PTTYPES.join(', ')}`,
    `### เกณฑ์ยาสมุนไพร ↔ ICD ที่ตั้งในระบบ (${kb.drugs.length} รายการ, รหัสเทียบแบบขึ้นต้นด้วย)
สำคัญ: แผนกแพทย์แผนไทยใช้รหัส U ตัวใดก็ได้ "U แนะนำ" เป็นเพียงรหัสที่เข้ากับข้อบ่งใช้ ไม่ใช่เงื่อนไขบังคับ
${drugLines.join('\n')}`,
  ].join('\n\n')
}
