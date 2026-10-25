import { useEffect, useMemo, useState, type FC } from 'react'
import { AlertCircle, Check, Loader2, Lock, RotateCcw, ShieldCheck } from 'lucide-react'
import { useMenuPermissions, useSaveMenuPermissions } from '@/hooks/useHerbDx'
import type { MenuPermissionMatrix } from '@/types/herbdx.types'
import { cn } from '@/lib/utils'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

/** ตารางติ๊กสิทธิ์เมนูตามกลุ่มผู้ใช้ — เฉพาะ IT (ผู้ดูแลระบบสูงสุด) */
export const MenuPermissionsPanel: FC = () => {
  const { data, isLoading, error } = useMenuPermissions()
  const save = useSaveMenuPermissions()
  const [draft, setDraft] = useState<MenuPermissionMatrix | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    if (data?.permissions && !draft) setDraft(structuredClone(data.permissions))
  }, [data?.permissions, draft])

  const dirty = useMemo(
    () => Boolean(draft && data?.permissions && JSON.stringify(draft) !== JSON.stringify(data.permissions)),
    [draft, data?.permissions]
  )

  if (isLoading || (!draft && !error)) {
    return (
      <LoadingSkeleton rows={6} label="กำลังโหลดสิทธิ์เมนู" />
    )
  }
  if (error || !data?.roles || !data.menus || !draft) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3.5 text-sm text-rose-300">
        <AlertCircle className="size-4 shrink-0" />
        {error instanceof Error ? error.message : 'โหลดสิทธิ์เมนูไม่สำเร็จ (ต้องเป็นผู้ดูแลระบบ IT)'}
      </div>
    )
  }

  const roles = data.roles
  const menus = data.menus
  const toggle = (role: string, menu: string) =>
    setDraft((d) => (d ? { ...d, [role]: { ...d[role], [menu]: !d[role]?.[menu] } } : d))
  const setColumn = (role: string, value: boolean) =>
    setDraft((d) => (d ? { ...d, [role]: Object.fromEntries(menus.map((m) => [m.id, value])) } : d))

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-accent-soft p-5" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-hex) 14%, transparent) 0%, transparent 70%)' }}>
        <div className="flex items-start gap-3.5">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">สิทธิ์การเข้าถึงเมนู</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              ติ๊กเพื่อให้กลุ่มผู้ใช้เห็นเมนูนั้น เมนูที่ไม่ได้ติ๊กจะถูกซ่อน และเปิดผ่าน URL ไม่ได้
              ผู้ดูแลระบบ (IT) เห็นทุกเมนูเสมอ และเป็นกลุ่มเดียวที่แก้หน้านี้ได้ ส่วนเมนู "รายได้แผนไทย" เปิดให้เป็นรายคนเท่านั้น
            </p>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.03]">
              <th className="min-w-[220px] px-4 py-3 text-left font-semibold text-slate-200">เมนู</th>
              <th className="w-20 px-2 py-3 text-center font-semibold text-accent whitespace-nowrap">
                <div>IT</div>
                <div className="text-[11px] font-normal text-slate-400">สูงสุด</div>
              </th>
              {roles.map((r) => {
                const all = menus.every((m) => draft[r.id]?.[m.id])
                return (
                  <th key={r.id} className="w-24 px-2 py-3 text-center font-semibold text-slate-200 whitespace-nowrap" title={r.desc}>
                    <div>{r.label}</div>
                    <button
                      type="button"
                      onClick={() => setColumn(r.id, !all)}
                      className="mt-0.5 text-[11px] font-normal text-slate-400 underline-offset-2 hover:text-accent hover:underline cursor-pointer"
                    >
                      {all ? 'เอาออกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            <tr>
              <td className="px-4 py-3 text-slate-200">
                <div className="whitespace-nowrap">หน้าแรก / ภาพรวมระบบ</div>
                <div className="text-xs text-slate-500">ทุกคนเห็นเสมอ</div>
              </td>
              {[null, ...roles].map((r, i) => (
                <td key={r?.id ?? `it-${i}`} className="px-2 py-3 text-center">
                  <span className="inline-grid size-6 place-items-center rounded-md bg-white/[0.06] text-slate-400" title="เปิดเสมอ">
                    <Lock className="size-3.5" />
                  </span>
                </td>
              ))}
            </tr>
            {menus.map((m) => (
              <tr key={m.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-slate-200">
                  <div className="whitespace-nowrap">{m.label}</div>
                  {m.id === 'sql' && <div className="text-xs text-amber-300/80">แสดงชื่อตารางฐานข้อมูล HOSxP</div>}
                </td>
                <td className="px-2 py-3 text-center">
                  <span className="inline-grid size-6 place-items-center rounded-md bg-accent text-white" title="IT เห็นทุกเมนูเสมอ">
                    <Check className="size-4 stroke-[3]" />
                  </span>
                </td>
                {roles.map((r) => {
                  const on = Boolean(draft[r.id]?.[m.id])
                  return (
                    <td key={r.id} className="px-2 py-3 text-center">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`${r.label}: ${m.label}`}
                        onClick={() => toggle(r.id, m.id)}
                        className={cn(
                          'inline-grid size-6 place-items-center rounded-md border transition cursor-pointer',
                          on ? 'border-transparent bg-accent text-white' : 'border-white/25 hover:border-white/50'
                        )}
                      >
                        {on && <Check className="size-4 stroke-[3]" />}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 text-slate-200">
                <div className="whitespace-nowrap">รายได้แผนไทย</div>
                <div className="text-xs text-slate-500">เปิดรายคน ไม่ผูกกับกลุ่ม · ตั้งที่สวิตช์ "หน.แผนไทย" ในหน้า ผู้ใช้ &amp; นโยบาย</div>
              </td>
              <td className="px-2 py-3 text-center">
                <span className="inline-grid size-6 place-items-center rounded-md bg-accent text-white" title="IT เห็นเสมอ">
                  <Check className="size-4 stroke-[3]" />
                </span>
              </td>
              {roles.map((r) => (
                <td key={r.id} className="px-2 py-3 text-center">
                  <span className="inline-block rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-slate-400 whitespace-nowrap" title="เปิดให้เป็นรายคนเท่านั้น">
                    รายคน
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {save.isError && (
        <p role="alert" className="flex items-center gap-2 text-sm text-rose-300">
          <AlertCircle className="size-4" /> {(save.error as Error).message || 'บันทึกไม่สำเร็จ'}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-slate-400">
          {savedAt && !dirty ? 'บันทึกแล้ว · ผู้ใช้จะเห็นผลภายในไม่กี่วินาที' : dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'ชี้ที่ชื่อกลุ่มเพื่อดูว่าใครอยู่ในกลุ่มนั้น'}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => data.permissions && setDraft(structuredClone(data.permissions))}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="size-4" /> ยกเลิก
          </button>
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() =>
              save.mutate(draft, {
                onSuccess: (res) => {
                  setDraft(structuredClone(res.permissions))
                  setSavedAt(Date.now())
                },
              })
            }
            className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            style={{ background: 'linear-gradient(135deg, var(--accent-hex) 0%, color-mix(in srgb, var(--accent-hex) 70%, #000) 100%)' }}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            บันทึกสิทธิ์
          </button>
        </div>
      </div>
    </div>
  )
}
