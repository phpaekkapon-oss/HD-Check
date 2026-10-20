import { useMemo, useState, type FC } from 'react'
import { AlertTriangle, Check, CheckCheck, ChevronDown, CircleHelp, ExternalLink, FileCheck2, LockKeyhole, ShieldCheck, Sparkles, X } from 'lucide-react'
import type { AuditRecord, DxMapRecord } from '@/types/herbdx.types'
import { useUpdateDxMap } from '@/hooks/useHerbDx'
import { fmtNum } from '@/lib/format'

interface DxMismatchReviewProps {
  readonly records: readonly AuditRecord[]
  readonly dxMap: readonly DxMapRecord[]
  readonly canEdit: boolean
}

interface MismatchGroup {
  readonly icode: string
  readonly drugName: string
  readonly visits: number
  readonly currentPrefixes: string
  readonly indication: string
  readonly diagnoses: readonly { code: string; count: number }[]
}

const DX_PREFIX_RE = /^[A-Z]\d{0,6}$/

export const DxMismatchReview: FC<DxMismatchReviewProps> = ({ records, dxMap, canEdit }) => {
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [openIcode, setOpenIcode] = useState<string | null>(null)
  const [showAiModal, setShowAiModal] = useState(false)

  const mutation = useUpdateDxMap()

  const groups = useMemo(() => {
    const map = new Map(dxMap.map((item) => [item.icode, item]))
    const byDrug = new Map<string, { name: string; visits: Set<string>; dxCount: Map<string, number> }>()
    for (const record of records) {
      const group = byDrug.get(record.drug_icode) ?? { name: record.drug_name, visits: new Set<string>(), dxCount: new Map<string, number>() }
      group.visits.add(record.vn || String(record.id))
      const diagnoses = new Set([record.pdx, record.dx0, record.dx1, record.dx2, record.dx3, record.dx4, record.dx5]
        .map((code) => code.trim().toUpperCase())
        .filter((code) => code && !record.matched_dx.some((matched) => matched.toUpperCase().replace(/\./g, '') === code.replace(/\./g, ''))))
      for (const code of diagnoses) group.dxCount.set(code, (group.dxCount.get(code) ?? 0) + 1)
      byDrug.set(record.drug_icode, group)
    }

    return [...byDrug.entries()].map(([icode, group]): MismatchGroup => ({
      icode,
      drugName: group.name,
      visits: group.visits.size,
      currentPrefixes: map.get(icode)?.dx_prefixes ?? '',
      indication: map.get(icode)?.indication ?? '',
      diagnoses: [...group.dxCount.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    })).sort((a, b) => b.visits - a.visits || a.drugName.localeCompare(b.drugName))
  }, [records, dxMap])

  // วิเคราะห์รหัสที่แพทย์สั่งใช้จริงในเวชระเบียน (สำหรับให้เจ้าหน้าที่ดูประกอบ)
  const aiRecommendations = useMemo(() => {
    const recs: { group: MismatchGroup; candidates: string[] }[] = []
    for (const g of groups) {
      const currentCodes = g.currentPrefixes.split(/[ ,\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean)
      const candidates = g.diagnoses
        .map((d) => d.code.replace(/\./g, ''))
        .filter((code) => DX_PREFIX_RE.test(code) && !currentCodes.some((prefix) => code.startsWith(prefix.replace(/\./g, ''))))
      if (candidates.length > 0) {
        // จำกัดรหัสพบบ่อยสูงสุด 25 รหัสแรกต่อตัวยา เพื่อความแม่นยำในการตรวจ
        const topCandidates = [...new Set(candidates)].slice(0, 25)
        recs.push({ group: g, candidates: topCandidates })
      }
    }
    return recs
  }, [groups])

  const handleSave = (group: MismatchGroup) => {
    const additions = selected[group.icode] ?? []
    if (!canEdit || additions.length === 0 || !confirmed[group.icode]) return
    const existing = group.currentPrefixes.split(/[ ,\s]+/).map((code) => code.trim().toUpperCase()).filter(Boolean)
    const prefixes = [...new Set([...existing, ...additions])].join(', ')
    mutation.mutate({ icode: group.icode, dx_prefixes: prefixes, indication: group.indication }, {
      onSuccess: () => {
        setSaved((value) => ({ ...value, [group.icode]: true }))
        setSelected((value) => ({ ...value, [group.icode]: [] }))
        setConfirmed((value) => ({ ...value, [group.icode]: false }))
      },
    })
  }

  return (
    <div className="space-y-3">
      {/* Clinical Guidance Banner according to NHSO standards */}
      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900/60 p-4 text-white shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-400 text-white shadow-md shadow-indigo-500/20">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-indigo-200">
              แนวทางจัดการตามมาตรฐาน สปสช. (แก้ไขใน HOSxP)
              <span className="rounded-full bg-indigo-400/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-300 border border-indigo-400/30">
                พบ {records.length} รายการที่ต้องทบทวน
              </span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-300 leading-relaxed">
              รายการด้านล่างเกิดจากแพทย์สั่งใช้ยาแต่ใน HOSxP ยังไม่ได้ระบุรหัสโรคตรงตามข้อบ่งใช้ สปสช. <strong className="text-white">เจ้าหน้าที่/แพทย์ต้องเปิด HOSxP เพื่อเพิ่มรหัสโรคร่วม (Secondary Dx)</strong> ตามอาการจริงของคนไข้ (ไม่ควรดึงรหัสโรคที่ไม่ตรงมาเป็นเกณฑ์ยา)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="#/dxwriteback"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            <ExternalLink className="size-3.5" />
            เปิดหน้าทบทวนและคัดลอกรหัส ICD-10
          </a>
          <a
            href="#/dxmap"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700/80 hover:text-white transition cursor-pointer"
          >
            ดูเกณฑ์ยามาตรฐาน
          </a>
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2.5 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20 transition cursor-pointer"
            title="ดูรายงานสรุปรหัสโรคที่แพทย์บันทึกจริงใน HOSxP"
          >
            <Sparkles className="size-3.5 text-indigo-300" />
            รายงานสถิติรหัสที่แพทย์สั่ง (ดูอ้างอิง)
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 p-8 text-center dark:bg-emerald-950/20">
          <FileCheck2 className="mx-auto size-9 text-emerald-600 dark:text-emerald-400" />
          <p className="mt-3 text-base font-bold text-slate-800 dark:text-slate-100">ไม่พบรายการ DX ไม่ตรงตามเกณฑ์ (ผ่านครบ 100%)</p>
          <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500 dark:text-slate-400">
            ยาสมุนไพรทุกรายการได้รับการจับคู่เกณฑ์รหัสวินิจฉัย (ICD-10) ครอบคลุมการสั่งใช้ของโรงพยาบาลแล้วอย่างสมบูรณ์ ไม่มีรหัสที่ต้องปรับปรุงเกณฑ์เพิ่มเติม
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200/80 bg-rose-50/70 px-3 py-2 dark:border-rose-900/60 dark:bg-rose-950/20">
            <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">{fmtNum(records.length)} รายการ DX ไม่ตรง · จัดกลุ่มตามยา ไม่แสดงชื่อหรือ HN</p>
            <span className="inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 text-xs font-semibold text-rose-800 dark:bg-black/20 dark:text-rose-200"><AlertTriangle className="size-3" /> ตรวจข้อบ่งใช้ก่อนเพิ่มเกณฑ์</span>
          </div>

          {!canEdit && <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"><LockKeyhole className="size-3.5 shrink-0" /> บัญชีนี้ดูผลได้ แต่ต้องใช้บัญชีผู้ดูแลระบบเพื่อบันทึกเกณฑ์</div>}

      {groups.map((group) => {
        const chosen = selected[group.icode] ?? []
        const currentCodes = group.currentPrefixes.split(/[ ,\s]+/).map((code) => code.trim().toUpperCase()).filter(Boolean)
        const isOpen = openIcode === group.icode
        return (
          <article key={group.icode} className="overflow-hidden rounded-xl border border-themed bg-themed-card shadow-xs">
            <button type="button" aria-expanded={isOpen} aria-controls={`dx-review-${group.icode}`} onClick={() => setOpenIcode((current) => current === group.icode ? null : group.icode)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-hex)] dark:hover:bg-white/[0.025] sm:px-4">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="break-words text-sm font-bold text-slate-900 dark:text-white">{group.drugName}</span><span className="font-mono text-xs text-slate-500 dark:text-slate-400">{group.icode}</span></span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">พบปัญหา {fmtNum(group.visits)} ครั้ง · {group.diagnoses.length} รหัส DX ให้ตรวจ</span>
              </span>
              <span className="hidden max-w-[40%] truncate rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 dark:bg-white/[0.05] dark:text-slate-300 sm:block">{group.currentPrefixes || 'ยังไม่ตั้งเกณฑ์'}</span>
              <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && <div id={`dx-review-${group.icode}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-themed px-3 py-2 text-xs sm:px-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-slate-500 dark:text-slate-400">เกณฑ์ปัจจุบัน</span><span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{group.currentPrefixes || 'ยังไม่ได้กำหนด'}</span>
                {group.indication && <span className="text-slate-500 dark:text-slate-400">ข้อบ่งใช้: {group.indication}</span>}
              </div>
              <span className="text-[11px] text-slate-400">
                เพิ่มรหัสโรคร่วมใน HOSxP ตามอาการจริง
              </span>
            </div>

            <div className="p-4 sm:px-5">
              <div className="flex items-start gap-2"><CircleHelp className="mt-0.5 size-4 shrink-0 text-teal-700 dark:text-teal-300" /><div><p className="text-xs font-semibold text-slate-800 dark:text-slate-100">DX ที่พบในรายการไม่ผ่าน</p><p className="mt-0.5 text-xs leading-4 text-slate-500 dark:text-slate-400">จำนวนครั้งเป็นข้อมูลช่วยตรวจ ไม่ใช่คำแนะนำให้เพิ่มรหัส เลือกเฉพาะที่ผู้รับผิดชอบยืนยันแล้ว</p></div></div>
              <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {group.diagnoses.map(({ code, count }) => {
                  const checked = chosen.includes(code)
                  const alreadyAllowed = currentCodes.some((prefix) => code.toUpperCase().replace(/\./g, '').startsWith(prefix.replace(/\./g, '')))
                  return <label key={code} className={`flex min-h-10 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${alreadyAllowed ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20' : checked ? 'border-teal-400 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/30' : 'border-themed bg-themed-app'} ${canEdit && !alreadyAllowed ? 'cursor-pointer' : ''}`}>
                    <input type="checkbox" checked={checked} disabled={!canEdit || alreadyAllowed || mutation.isPending} onChange={(event) => {
                      setSaved((value) => ({ ...value, [group.icode]: false }))
                      setSelected((value) => ({ ...value, [group.icode]: event.target.checked ? [...chosen, code] : chosen.filter((item) => item !== code) }))
                    }} className="size-4 shrink-0 accent-[var(--accent-hex)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)]" />
                    <span className="min-w-0 flex-1"><span className="font-mono font-bold text-slate-900 dark:text-white">{code}</span>{alreadyAllowed && <span className="ml-2 text-xs font-semibold text-amber-700 dark:text-amber-300">อยู่ในเกณฑ์แล้ว</span>}</span>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{fmtNum(count)} ครั้ง</span>
                  </label>
                })}
              </div>
            </div>

            <div className="border-t border-themed bg-slate-50/70 px-3 py-2.5 dark:bg-white/[0.02] sm:px-4">
              {canEdit && chosen.length > 0 && <label className="mb-2 flex items-start gap-2 text-xs leading-4 text-slate-700 dark:text-slate-300"><input type="checkbox" checked={Boolean(confirmed[group.icode])} onChange={(event) => setConfirmed((value) => ({ ...value, [group.icode]: event.target.checked }))} className="mt-0.5 size-4 shrink-0 accent-[var(--accent-hex)]" /><span>ยืนยันว่ารหัสที่เลือกตรงข้อบ่งใช้ตามแนวทางของหน่วยงาน</span></label>}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-4 text-slate-500 dark:text-slate-400">บันทึกเฉพาะเกณฑ์ในแอป ไม่แก้ DX ใน HOSxP</p>
                {canEdit && <button type="button" disabled={!chosen.length || !confirmed[group.icode] || mutation.isPending} onClick={() => handleSave(group)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-hex)] disabled:cursor-not-allowed disabled:opacity-45"><Check className="size-4" />{mutation.isPending ? 'กำลังบันทึก…' : 'บันทึกเกณฑ์ที่ยืนยันแล้ว'}</button>}
              </div>
              {saved[group.icode] && <p role="status" className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">บันทึกเกณฑ์แล้ว ระบบจะคำนวณผลตรวจใหม่</p>}
              {mutation.isError && <p role="alert" className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">บันทึกไม่สำเร็จ: {mutation.error instanceof Error ? mutation.error.message : 'กรุณาลองใหม่'}</p>}
            </div>
            </div>}
          </article>
        )
      })}
        </>
      )}

      {/* AI Statistical Review Modal (Read-Only Reference) */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-indigo-500/40 bg-slate-900 text-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-md">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">รายงานรหัสโรคที่แพทย์บันทึกใน HOSxP (ดูเพื่อการอ้างอิง)</h3>
                  <p className="text-xs text-slate-400">สำหรับเจ้าหน้าที่/แพทย์ใช้ดูประกอบ เพื่อนำไปเพิ่มรหัสโรคร่วม (Secondary Dx) ใน HOSxP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="size-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-amber-300 font-semibold">ข้อแนะนำตามหลักเกณฑ์ สปสช.:</strong> หน้านี้จัดทำขึ้นเพื่อให้<strong>ดูข้อมูลประกอบเท่านั้น (Read-Only)</strong> โดยไม่มีการแก้ไขเกณฑ์ยาในระบบ รหัสโรคบางส่วนเป็นโรคประจำตัวของผู้ป่วย (เช่น ความดัน, เบาหวาน) ซึ่งไม่ใช่ข้อบ่งใช้ของยาสมุนไพร หากเคสใดมีอาการตรงกับข้อบ่งใช้ยา ให้เปิดโปรแกรม HOSxP เพื่อบันทึกรหัสโรคร่วม (Secondary Diagnosis)
                </div>
              </div>

              {aiRecommendations.length === 0 ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
                  <div className="mx-auto size-12 rounded-full bg-emerald-500/20 text-emerald-400 grid place-items-center">
                    <CheckCheck className="size-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">ไม่พบรายการสั่งใช้ยาที่ไม่ตรงเกณฑ์</h4>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-lg mx-auto">
                      ในระบบตรวจขณะนี้ รายการสั่งใช้ยาสมุนไพรทั้งหมดมีรหัสโรคตรงตามข้อบ่งใช้ สปสช. เรียบร้อยแล้ว
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                      <p className="text-xs text-slate-400">ชนิดยาที่พบการสั่งใช้</p>
                      <p className="mt-1 text-xl font-extrabold text-indigo-300">{aiRecommendations.length} รายการ</p>
                    </div>
                    <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
                      <p className="text-xs text-slate-400">รหัสโรคที่แพทย์ลงประวัติ</p>
                      <p className="mt-1 text-xl font-extrabold text-purple-300">
                        {aiRecommendations.reduce((acc, r) => acc + r.candidates.length, 0)} รหัส
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="text-xs text-slate-400">สถานะความปลอดภัย</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-300">ดูข้อมูลเท่านั้น (ไม่มีการแก้ไขเกณฑ์)</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
                      <span>สรุปรายการยาและรหัสโรคที่แพทย์ระบุใน HOSxP ({aiRecommendations.length} รายการ)</span>
                      <span className="text-[11px] text-slate-500">สำหรับอ้างอิงเพื่อตรวจสอบใน HOSxP</span>
                    </div>

                    <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-2.5">
                      {aiRecommendations.map(({ group, candidates }) => (
                        <div
                          key={group.icode}
                          className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{group.drugName}</span>
                              <span className="font-mono text-[11px] text-slate-400">({group.icode})</span>
                            </div>
                            <span className="text-[11px] text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              พบไม่ตรงเกณฑ์ {fmtNum(group.visits)} ครั้ง
                            </span>
                          </div>

                          {group.indication && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              ข้อบ่งใช้ สปสช.: <span className="text-slate-300">{group.indication}</span>
                            </p>
                          )}

                          <div className="mt-2">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                              รหัสโรคที่แพทย์ระบุในใบสั่งยา (ตรวจสอบกับอาการจริง):
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {candidates.map((code) => (
                                <span
                                  key={code}
                                  className="rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-300 border border-indigo-500/30"
                                >
                                  {code}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 p-4 sm:px-6 bg-slate-900/90 rounded-b-2xl">
              <a
                href="#/dxwriteback"
                onClick={() => setShowAiModal(false)}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 hover:underline"
              >
                <ExternalLink className="size-3.5" />
                เปิดหน้าทบทวนเพื่อดูรายชื่อ HN และคัดลอกรหัส ICD-10
              </a>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-700 active:scale-95 transition"
              >
                ปิดหน้าต่าง (ดูเพื่อการอ้างอิงเท่านั้น)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

