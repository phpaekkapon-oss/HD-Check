import { useState, useMemo, type FC } from 'react'
import { Copy, Check, Database, Code, Info, Terminal, Sparkles } from 'lucide-react'

const QUERY_1 = `SELECT 
    o.vstdate AS visit_date,
    o.vsttime AS visit_time,
    o.hn,
    CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS patient_name,
    ps.name AS pttype_name,
    d.name AS drug_name,
    op.qty AS drug_qty,
    sp.name AS department_name,
    ov.pdx AS main_pdx,
    ov.dx0, ov.dx1, ov.dx2, ov.dx3, ov.dx4, ov.dx5,
    doc.name AS doctor_name,
    CASE 
        WHEN ov.pdx IS NULL OR TRIM(ov.pdx) = '' THEN 'INCOMPLETE'
        WHEN (ov.pdx LIKE 'U%' OR ov.dx0 LIKE 'U%' OR ov.dx1 LIKE 'U%' OR ov.dx2 LIKE 'U%' OR ov.dx3 LIKE 'U%') THEN 'COMPLETE'
        ELSE 'INCOMPLETE'
    END AS audit_status
FROM opitemrece op
INNER JOIN ovst o ON op.vn = o.vn
INNER JOIN vn_stat ov ON o.vn = ov.vn
INNER JOIN patient pt ON o.hn = pt.hn
INNER JOIN drugitems d ON op.icode = d.icode
LEFT JOIN pttype ps ON o.pttype = ps.pttype
LEFT JOIN spclty sp ON o.spclty = sp.spclty
LEFT JOIN doctor doc ON o.doctor = doc.code
WHERE o.vstdate BETWEEN '2026-10-01' AND '2026-10-31'
  AND (d.name LIKE '%สมุนไพร%' OR d.drugcategory LIKE '%สมุนไพร%' OR sp.name LIKE '%แพทย์แผนไทย%')
ORDER BY o.vstdate DESC, o.vsttime DESC;`

const QUERY_2 = `SELECT 
    d.icode AS \`รหัสยา\`,
    d.name AS \`รายการยา\`,
    -- จ่ายผู้ป่วยนอก (OPD)
    SUM(CASE WHEN (op.an IS NULL OR op.an = '') AND op.vstdate BETWEEN '2026-10-01' AND '2026-10-31' THEN op.qty ELSE 0 END) AS \`จ่ายผู้ป่วยนอก\`,
    -- จ่ายผู้ป่วยใน (IPD)
    SUM(CASE WHEN (op.an IS NOT NULL AND op.an <> '') AND op.vstdate BETWEEN '2026-10-01' AND '2026-10-31' THEN op.qty ELSE 0 END) AS \`จ่ายผู้ป่วยใน\`,
    -- ราคาต้นทุน
    ROUND(IFNULL(d.unitcost, 0), 2) AS \`ราคาต้นทุน\`,
    -- รวมจำนวนที่จ่ายทั้งหมด
    SUM(CASE WHEN op.vstdate BETWEEN '2026-10-01' AND '2026-10-31' THEN op.qty ELSE 0 END) AS \`จำนวน\`,
    -- รวมต้นทุนยา
    ROUND(SUM(CASE WHEN op.vstdate BETWEEN '2026-10-01' AND '2026-10-31' THEN op.qty ELSE 0 END) * IFNULL(d.unitcost, 0), 2) AS \`รวมต้นทุนยา\`,
    -- รหัสมาตรฐาน 24 หลัก
    IFNULL(d.did, d.nhso_adp_code) AS \`รหัสยา 24 หลัก\`
FROM drugitems d
LEFT JOIN opitemrece op ON d.icode = op.icode
WHERE d.istatus = 'Y' -- กรองเฉพาะยาที่มีสถานะเปิดใช้งาน (Y)
  AND (
      d.drugcategory LIKE '%สมุนไพร%'
      OR d.name LIKE '%มะแว้ง%'
      OR d.name LIKE '%มะขามแขก%'
      OR d.name LIKE '%เถาวัลย์เปรียง%'
      OR d.name LIKE '%ทองพันชั่ง%'
      OR d.icode IN ('1550003', '1540013', '1560028', '1560031')
  )
  -- กรองทิ้งยาแผนปัจจุบันและยายืม
  AND d.name NOT LIKE '%(ยายืม)%'
  AND d.name NOT LIKE '%DICLOX%'
  AND d.name NOT LIKE '%imipenem%'
  AND d.name NOT LIKE '%inj%'
GROUP BY d.icode, d.name, d.unitcost, d.did, d.nhso_adp_code
ORDER BY \`จำนวน\` DESC, d.name ASC;`

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'INNER', 'LEFT', 'RIGHT', 'JOIN', 'ON', 'WHERE',
  'AND', 'OR', 'NOT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'ORDER', 'GROUP', 'BY', 'DESC', 'ASC', 'AS', 'IN', 'IS', 'NULL', 'LIKE',
  'BETWEEN'
])

const SQL_FUNCTIONS = new Set(['SUM', 'ROUND', 'IFNULL', 'CONCAT', 'TRIM'])

/**
 * Lightweight SQL Syntax Highlighter for crisp, high-contrast code visualization
 */
const SqlCodeBlock: FC<{ readonly code: string }> = ({ code }) => {
  const lines = useMemo(() => code.split('\n'), [code])

  const renderToken = (token: string, key: number) => {
    const trimmed = token.trim()
    const upper = trimmed.toUpperCase()

    // SQL Keywords
    if (SQL_KEYWORDS.has(upper)) {
      return (
        <span key={key} className="text-cyan-400 font-bold">
          {token}
        </span>
      )
    }

    // SQL Built-in Functions
    if (SQL_FUNCTIONS.has(upper)) {
      return (
        <span key={key} className="text-teal-300 font-semibold">
          {token}
        </span>
      )
    }

    // Numbers
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return (
        <span key={key} className="text-amber-400">
          {token}
        </span>
      )
    }

    // Strings with quotes
    if (
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('`') && trimmed.endsWith('`'))
    ) {
      return (
        <span key={key} className="text-emerald-300 font-medium">
          {token}
        </span>
      )
    }

    return <span key={key}>{token}</span>
  }

  const renderLine = (line: string, lineIndex: number) => {
    // Comment lines starting with --
    const commentIndex = line.indexOf('--')
    if (commentIndex !== -1) {
      const codePart = line.slice(0, commentIndex)
      const commentPart = line.slice(commentIndex)

      return (
        <div key={lineIndex} className="table-row hover:bg-white/5 transition-colors">
          <span className="table-cell select-none pr-4 text-right text-teal-500/40 font-mono text-[11px] w-8">
            {lineIndex + 1}
          </span>
          <span className="table-cell whitespace-pre font-mono">
            {codePart ? (
              codePart.split(/([A-Za-z0-9_`']+|\s+|[(),=<>!*+-])/).map((tok, i) => renderToken(tok, i))
            ) : null}
            <span className="text-slate-400/90 italic font-medium">{commentPart}</span>
          </span>
        </div>
      )
    }

    // Regular line tokenization
    const tokens = line.split(/([A-Za-z0-9_`']+|\s+|[(),=<>!*+-])/)
    return (
      <div key={lineIndex} className="table-row hover:bg-white/5 transition-colors">
        <span className="table-cell select-none pr-4 text-right text-teal-500/40 font-mono text-[11px] w-8">
          {lineIndex + 1}
        </span>
        <span className="table-cell whitespace-pre font-mono">
          {tokens.map((tok, i) => renderToken(tok, i))}
        </span>
      </div>
    )
  }

  return (
    <div className="table w-full text-[12px] leading-relaxed text-slate-100 font-mono select-text">
      {lines.map((line, i) => renderLine(line, i))}
    </div>
  )
}

export const SqlInspectorView: FC = () => {
  const [copied, setCopied] = useState<'q1' | 'q2' | null>(null)

  const copy = (text: string, id: 'q1' | 'q2') => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Informative Hospital Database Banner with Sleek Gradient */}
      <div className="rounded-2xl bg-themed-card text-slate-600 dark:text-slate-200 p-4 sm:p-5 shadow-sm border border-themed space-y-2">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <div className="grid place-items-center size-6 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300">
            <Info className="size-4" />
          </div>
          <span className="tracking-tight">การดึงและจัดเก็บข้อมูลเข้าตาราง dw_hd-check</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <Sparkles className="size-3" /> Auto ETL Sync
          </span>
        </div>
        <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
          ระบบเชื่อมต่อไปยัง <code className="text-teal-300 bg-teal-950/80 px-1.5 py-0.5 rounded font-mono font-semibold">HOSxP Database Server</code> เพื่อดึงข้อมูลประวัติการสั่งจ่ายยาสมุนไพรจากฐานข้อมูลหลัก <code className="text-teal-300 bg-teal-950/80 px-1.5 py-0.5 rounded font-mono font-semibold">hos</code> ด้วยคำสั่ง SQL ด้านล่างนี้ และทำการบันทึกข้อมูลเข้าสู่ตาราง <code className="text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded font-mono font-semibold">dw_hd-check.dw_hd_check_prescriptions</code> และ <code className="text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded font-mono font-semibold">dw_hd_check_drugs</code> โดยอัตโนมัติ
        </p>
      </div>

      {/* Query 1: ตรวจสอบเวชระเบียนยาสมุนไพรและรหัสวินิจฉัยโรค */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm overflow-hidden">
        <div className="p-3.5 bg-slate-50 dark:bg-[#1d2035] border-b border-slate-200 dark:border-[#292440] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center size-7 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <Database className="size-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white tracking-tight">
                QUERY 1 : ตรวจสอบเวชระเบียนยาสมุนไพรและรหัสวินิจฉัยโรค
              </h4>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                ดึงประวัติการสั่งจ่ายยาพร้อม PDX, DX0-DX5 เพื่อประเมินเกณฑ์
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copy(QUERY_1, 'q1')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#14172a] border border-slate-200 dark:border-[#292440] hover:border-violet-400 hover:text-accent text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs active:scale-95 transition"
            >
              {copied === 'q1' ? (
                <>
                  <Check className="size-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">คัดลอกสำเร็จ!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5 text-slate-400" />
                  <span>คัดลอก SQL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* IDE-Grade Code Editor Container */}
        <div className="bg-[#0b0d1b] p-3 sm:p-4 overflow-x-auto border-t border-[#292440]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[10px] font-mono text-teal-300/70">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500/80" />
              <span className="size-2 rounded-full bg-amber-500/80" />
              <span className="size-2 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-slate-300 font-bold flex items-center gap-1">
                <Terminal className="size-3 text-teal-400" /> query_audit_prescription.sql
              </span>
            </div>
            <span>MySQL 5.7+ / 8.0 Compatible</span>
          </div>
          <SqlCodeBlock code={QUERY_1} />
        </div>
      </div>

      {/* Query 2: สรุปยอดจ่ายยาสมุนไพร OPD / IPD */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card shadow-xs dark:shadow-sm overflow-hidden">
        <div className="p-3.5 bg-slate-50 dark:bg-[#1d2035] border-b border-slate-200 dark:border-[#292440] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center size-7 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <Code className="size-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white tracking-tight">
                QUERY 2 : สรุปยอดจ่ายยาสมุนไพร OPD / IPD และต้นทุนยา พร้อมรหัสมาตรฐาน 24 หลัก
              </h4>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                จัดกลุ่มยอดจ่ายตาม icode คำนวณยอดเงินรวมและจับคู่รหัส did
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copy(QUERY_2, 'q2')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#14172a] border border-slate-200 dark:border-[#292440] hover:border-violet-400 hover:text-accent text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs active:scale-95 transition"
            >
              {copied === 'q2' ? (
                <>
                  <Check className="size-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">คัดลอกสำเร็จ!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5 text-slate-400" />
                  <span>คัดลอก SQL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* IDE-Grade Code Editor Container */}
        <div className="bg-[#0b0d1b] p-3 sm:p-4 overflow-x-auto border-t border-[#292440]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[10px] font-mono text-cyan-300/70">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500/80" />
              <span className="size-2 rounded-full bg-amber-500/80" />
              <span className="size-2 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-slate-300 font-bold flex items-center gap-1">
                <Terminal className="size-3 text-cyan-400" /> query_drug_cost_summary.sql
              </span>
            </div>
            <span>Group By icode • Aggregation</span>
          </div>
          <SqlCodeBlock code={QUERY_2} />
        </div>
      </div>
    </div>
  )
}
