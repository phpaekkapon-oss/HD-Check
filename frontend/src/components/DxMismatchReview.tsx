import { useMemo, useState, type FC } from 'react'
import { AlertTriangle, Check, ChevronDown, CircleHelp, FileCheck2, LockKeyhole } from 'lucide-react'
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

export const DxMismatchReview: FC<DxMismatchReviewProps> = ({ records, dxMap, canEdit }) => {
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [openIcode, setOpenIcode] = useState<string | null>(null)
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

  if (records.length === 0) {
    return <div className="rounded-xl border border-themed bg-themed-card px-4 py-8 text-center"><FileCheck2 className="mx-auto size-7 text-emerald-600 dark:text-emerald-400" /><p className="mt-2 font-semibold text-slate-800 dark:text-slate-100">ไม่พบรายการ DX ไม่ตรงในช่วงวันที่เลือก</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ลองเปลี่ยนช่วงวันที่จากหน้าตรวจสอบ</p></div>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200/80 bg-rose-50/70 px-3 py-2 dark:border-rose-900/60 dark:bg-rose-950/20">
        <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">{fmtNum(records.length)} รายการ DX ไม่ตรง · จัดกลุ่มตามยา ไม่แสดงชื่อหรือ HN</p>
        <span className="inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 text-[10px] font-semibold text-rose-800 dark:bg-black/20 dark:text-rose-200"><AlertTriangle className="size-3" /> ตรวจข้อบ่งใช้ก่อนเพิ่มเกณฑ์</span>
      </div>

      {!canEdit && <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"><LockKeyhole className="size-3.5 shrink-0" /> บัญชีนี้ดูผลได้ แต่ต้องใช้บัญชีผู้ดูแลระบบเพื่อบันทึกเกณฑ์</div>}

      {groups.map((group) => {
        const chosen = selected[group.icode] ?? []
        const currentCodes = group.currentPrefixes.split(/[ ,\s]+/).map((code) => code.trim().toUpperCase()).filter(Boolean)
        const isOpen = openIcode === group.icode
        return (
          <article key={group.icode} className="overflow-hidden rounded-xl border border-themed bg-themed-card shadow-xs">
            <button type="button" aria-expanded={isOpen} aria-controls={`dx-review-${group.icode}`} onClick={() => setOpenIcode((current) => current === group.icode ? null : group.icode)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 dark:hover:bg-white/[0.025] sm:px-4">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="break-words text-sm font-bold text-slate-900 dark:text-white">{group.drugName}</span><span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{group.icode}</span></span>
                <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">พบปัญหา {fmtNum(group.visits)} ครั้ง · {group.diagnoses.length} รหัส DX ให้ตรวจ</span>
              </span>
              <span className="hidden max-w-[40%] truncate rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600 dark:bg-white/[0.05] dark:text-slate-300 sm:block">{group.currentPrefixes || 'ยังไม่ตั้งเกณฑ์'}</span>
              <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && <div id={`dx-review-${group.icode}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-themed px-3 py-2 text-[11px] sm:px-4">
              <span className="text-slate-500 dark:text-slate-400">เกณฑ์ปัจจุบัน</span><span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{group.currentPrefixes || 'ยังไม่ได้กำหนด'}</span>
              {group.indication && <span className="text-slate-500 dark:text-slate-400">ข้อบ่งใช้: {group.indication}</span>}
            </div>

            <div className="p-4 sm:px-5">
              <div className="flex items-start gap-2"><CircleHelp className="mt-0.5 size-4 shrink-0 text-teal-700 dark:text-teal-300" /><div><p className="text-xs font-semibold text-slate-800 dark:text-slate-100">DX ที่พบในรายการไม่ผ่าน</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">จำนวนครั้งเป็นข้อมูลช่วยตรวจ ไม่ใช่คำแนะนำให้เพิ่มรหัส เลือกเฉพาะที่ผู้รับผิดชอบยืนยันแล้ว</p></div></div>
              <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {group.diagnoses.map(({ code, count }) => {
                  const checked = chosen.includes(code)
                  const alreadyAllowed = currentCodes.some((prefix) => code.toUpperCase().replace(/\./g, '').startsWith(prefix.replace(/\./g, '')))
                  return <label key={code} className={`flex min-h-10 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${alreadyAllowed ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20' : checked ? 'border-teal-400 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/30' : 'border-themed bg-themed-app'} ${canEdit && !alreadyAllowed ? 'cursor-pointer' : ''}`}>
                    <input type="checkbox" checked={checked} disabled={!canEdit || alreadyAllowed || mutation.isPending} onChange={(event) => {
                      setSaved((value) => ({ ...value, [group.icode]: false }))
                      setSelected((value) => ({ ...value, [group.icode]: event.target.checked ? [...chosen, code] : chosen.filter((item) => item !== code) }))
                    }} className="size-4 shrink-0 accent-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" />
                    <span className="min-w-0 flex-1"><span className="font-mono font-bold text-slate-900 dark:text-white">{code}</span>{alreadyAllowed && <span className="ml-2 text-[10px] font-semibold text-amber-700 dark:text-amber-300">อยู่ในเกณฑ์แล้ว</span>}</span>
                    <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{fmtNum(count)} ครั้ง</span>
                  </label>
                })}
              </div>
            </div>

            <div className="border-t border-themed bg-slate-50/70 px-3 py-2.5 dark:bg-white/[0.02] sm:px-4">
              {canEdit && chosen.length > 0 && <label className="mb-2 flex items-start gap-2 text-[11px] leading-4 text-slate-700 dark:text-slate-300"><input type="checkbox" checked={Boolean(confirmed[group.icode])} onChange={(event) => setConfirmed((value) => ({ ...value, [group.icode]: event.target.checked }))} className="mt-0.5 size-4 shrink-0 accent-teal-700" /><span>ยืนยันว่ารหัสที่เลือกตรงข้อบ่งใช้ตามแนวทางของหน่วยงาน</span></label>}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">บันทึกเฉพาะเกณฑ์ในแอป ไม่แก้ DX ใน HOSxP</p>
                {canEdit && <button type="button" disabled={!chosen.length || !confirmed[group.icode] || mutation.isPending} onClick={() => handleSave(group)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-xs font-bold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/25 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"><Check className="size-4" />{mutation.isPending ? 'กำลังบันทึก…' : 'บันทึกเกณฑ์ที่ยืนยันแล้ว'}</button>}
              </div>
              {saved[group.icode] && <p role="status" className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">บันทึกเกณฑ์แล้ว ระบบจะคำนวณผลตรวจใหม่</p>}
              {mutation.isError && <p role="alert" className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">บันทึกไม่สำเร็จ: {mutation.error instanceof Error ? mutation.error.message : 'กรุณาลองใหม่'}</p>}
            </div>
            </div>}
          </article>
        )
      })}
    </div>
  )
}
