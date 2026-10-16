import { useState, useEffect, type FC } from 'react'
import {
  Layers,
  ShieldAlert,
  Check,
  Save,
  Loader2,
  Zap,
} from 'lucide-react'
import { useHealthMedSettings, useSaveHealthMedSettings } from '@/hooks/useHerbDx'
import type { ThaiMedDuplicateRules } from '@/types/herbdx.types'

interface ThaiMedRulesTabProps {
  readonly canEdit: boolean
}

export const ThaiMedRulesTab: FC<ThaiMedRulesTabProps> = ({ canEdit }) => {
  const { data: remoteSettings, isLoading } = useHealthMedSettings()
  const { mutate: saveSettings, isPending: isSaving } = useSaveHealthMedSettings()

  const [formState, setFormState] = useState<ThaiMedDuplicateRules>({
    block_coexist: true,
    block_both_multiple: true,
    block_single_multiple: true,
    massage_and_compress_codes: ['58130', '58131'],
    massage_only_codes: ['58101', '58102'],
    compress_only_codes: ['58201', '56001'],
  })

  const [savedSuccess, setSavedSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (remoteSettings) {
      setFormState({
        block_coexist: remoteSettings.block_coexist ?? true,
        block_both_multiple: remoteSettings.block_both_multiple ?? true,
        block_single_multiple: remoteSettings.block_single_multiple ?? true,
        massage_and_compress_codes: remoteSettings.massage_and_compress_codes?.length
          ? remoteSettings.massage_and_compress_codes
          : ['58130', '58131'],
        massage_only_codes: remoteSettings.massage_only_codes?.length
          ? remoteSettings.massage_only_codes
          : ['58101', '58102'],
        compress_only_codes: remoteSettings.compress_only_codes?.length
          ? remoteSettings.compress_only_codes
          : ['58201', '56001'],
      })
    }
  }, [remoteSettings])

  const handleSave = () => {
    setErrorMessage(null)
    saveSettings(formState, {
      onSuccess: () => {
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      },
      onError: (err) => {
        setErrorMessage(err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <Loader2 className="size-8 animate-spin text-amber-500" />
        <span className="text-sm">กำลังโหลดการตั้งค่าเกณฑ์แพทย์แผนไทย…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 p-4.5 text-xs text-slate-600 dark:text-slate-200 flex items-start gap-3.5 shadow-xs">
        <div className="grid place-items-center size-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
          <Layers className="size-5" />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <strong className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              เกณฑ์ตรวจสอบการคิดค่าบริการซ้ำซ้อน (แพทย์แผนไทย)
            </strong>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-500/30">
              <Zap className="size-3.5" /> ตรวจสอบอัตโนมัติในครั้งบริการเดียวกัน
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs sm:text-[13px]">
            กำหนดเงื่อนไขการเบิกจ่ายค่าบริการและหัตถการตามประกาศ สปสช. เพื่อป้องกันการคิดค่าบริการซ้ำซ้อน
            ระบบจะนำเกณฑ์นี้ไปตรวจสอบข้อมูลในหน้า <strong className="text-amber-600 dark:text-amber-400 font-bold">ตรวจหัตถการแพทย์แผนไทย</strong> แบบเรียลไทม์
          </p>
        </div>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-3 text-xs text-amber-900 dark:border-amber-500/25 dark:bg-amber-950/20 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 size-4.5 shrink-0" />
          <p>บัญชีนี้ดูเงื่อนไขเกณฑ์ได้เท่านั้น (การปรับแต่งและบันทึกเกณฑ์เปิดให้เฉพาะผู้ดูแลระบบและแพทย์แผนไทย)</p>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-rose-300/60 bg-rose-50 px-3.5 py-3 text-xs text-rose-800 dark:border-rose-500/25 dark:bg-rose-950/20 dark:text-rose-200">
          {errorMessage}
        </div>
      )}

      {/* Rules Config List */}
      <div className="grid grid-cols-1 gap-4">
        {/* Rule 1: Coexistence of 3 categories */}
        <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                  เงื่อนไขที่ 1, 2, 3
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  ห้ามคิดค่าบริการร่วมกันระหว่าง 3 หมวด (ค่านวดและประคบ + ค่านวด + ค่าประคบ)
                </h3>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                ในครั้งบริการเดียวกัน (vn เดียวกัน) หากพบค่าบริการ 2 ใน 3 หมวดหมู่นี้ หรือครบทั้ง 3 หมวดหมู่
                เช่น <strong>พบค่านวดและประคบ คู่กับ ค่านวด</strong>, <strong>ค่านวดและประคบ คู่กับ ค่าประคบ</strong> หรือ <strong>ค่านวด คู่กับ ค่าประคบ</strong> จะถูกประเมินเป็น <span className="text-rose-600 dark:text-rose-400 font-bold">ไม่ผ่าน (คิดค่าบริการซ้ำซ้อน)</span>
              </p>
            </div>

            {/* Toggle switch */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={formState.block_coexist}
                onChange={(e) => setFormState({ ...formState, block_coexist: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Reference Items Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-3 border border-slate-200/80 dark:border-white/10 space-y-1.5">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500"></span>
                <span>1. ค่านวดและประคบ</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                <div>• รหัส ADP: <code className="font-mono font-bold text-amber-600 dark:text-amber-400">58130</code> (บำบัดโรค 250.-)</div>
                <div>• รหัส ADP: <code className="font-mono font-bold text-amber-600 dark:text-amber-400">58131</code> (ฟื้นฟู 250.-)</div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-3 border border-slate-200/80 dark:border-white/10 space-y-1.5">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500"></span>
                <span>2. ค่านวด (อย่างเดียว)</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                <div>• รหัส ADP: <code className="font-mono font-bold text-blue-600 dark:text-blue-400">58101</code> (บำบัดโรค 200.-)</div>
                <div>• รหัส ADP: <code className="font-mono font-bold text-blue-600 dark:text-blue-400">58102</code> (ฟื้นฟู 200.-)</div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-3 border border-slate-200/80 dark:border-white/10 space-y-1.5">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500"></span>
                <span>3. ค่าประคบ (อย่างเดียว)</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                <div>• รหัส ADP: <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">58201</code> (ประคบสมุนไพร 150.-)</div>
                <div>• รหัส ADP: <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">56001</code> (ประคบความร้อน 60.-)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Rule 2: Massage and Compress >= 2 times */}
        <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card p-5 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  เงื่อนไขที่ 4
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  ห้ามคิดค่านวดและประคบ 2 ครั้งขึ้นไป (จำนวน ≥ 2 ครั้ง / วัน)
                </h3>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                ไม่อนุญาตให้คิดค่านวดและประคบสมุนไพร (<code className="font-mono font-bold text-amber-600 dark:text-amber-400">58130 / 58131</code>)
                ซ้ำกัน 2 ครั้งในการรับบริการครั้งเดียวกัน หากพบจำนวนครั้ง ≥ 2 ครั้ง จะถูกประเมินเป็น <span className="text-rose-600 dark:text-rose-400 font-bold">ไม่ผ่าน</span> ทันที
              </p>
            </div>

            {/* Toggle switch */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={formState.block_both_multiple}
                onChange={(e) => setFormState({ ...formState, block_both_multiple: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>

        {/* Rule 3: Single massage or compress >= 2 times */}
        <div className="rounded-2xl border border-slate-200 dark:border-[#292440] bg-themed-card p-5 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  เงื่อนไขเสริม
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  ห้ามคิดค่านวดเดี่ยวๆ หรือ ค่าประคบเดี่ยวๆ 2 ครั้งขึ้นไป (จำนวน ≥ 2 ครั้ง / วัน)
                </h3>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                ป้องกันการคิดค่านวดเพื่อการบำบัดโรค (<code className="font-mono font-bold text-blue-600 dark:text-blue-400">58101</code>) ≥ 2 ครั้ง
                หรือค่าประคบสมุนไพร (<code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">58201 / 56001</code>) ≥ 2 ครั้งในวันเดียวกัน
              </p>
            </div>

            {/* Toggle switch */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={formState.block_single_multiple}
                onChange={(e) => setFormState({ ...formState, block_single_multiple: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      {canEdit && (
        <div className="flex items-center justify-between pt-2">
          <div>
            {savedSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="size-4" /> บันทึกการตั้งค่าเกณฑ์สำเร็จเรียบร้อยแล้ว
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="btn-pill-action inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-md cursor-pointer hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>บันทึกเกณฑ์แพทย์แผนไทย</span>
          </button>
        </div>
      )}
    </div>
  )
}
