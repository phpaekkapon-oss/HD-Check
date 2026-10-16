import { useEffect, useState, type FC, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  Keyboard,
  Loader2,
  Pill,
  Settings2,
  Sparkles,
  User,
  Wrench,
  X,
} from 'lucide-react'
import { herbDxApi } from '@/api/herbdx.api'
import type { AuditRecord, HerbAuditAiAdvice } from '@/types/herbdx.types'
import { cleanDrugUnit } from '@/types/herbdx.types'
import { CopyButton } from '@/components/CopyButton'
import { toThaiDate } from '@/lib/format'
import { cn } from '@/lib/utils'

interface HerbAuditDetailModalProps {
  readonly record: AuditRecord
  readonly onClose: () => void
  readonly onConfigureDrug?: (record: AuditRecord) => void
}

const RESULT_LABEL: Record<AuditRecord['audit_result'], string> = {
  PASS: 'ผ่านเกณฑ์',
  FAIL: 'ไม่ผ่านเกณฑ์',
  NO_DX: 'ไม่มีรหัสวินิจฉัย',
  NO_MAP: 'ยังไม่ตั้งเกณฑ์ ICD',
}

const norm = (c: string) => c.trim().toUpperCase().replace(/\./g, '')

function Section({ icon, title, tone = 'slate', children }: {
  readonly icon: ReactNode
  readonly title: string
  readonly tone?: 'slate' | 'rose' | 'amber' | 'teal'
  readonly children: ReactNode
}) {
  const toneClass = {
    slate: 'bg-slate-50 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/5',
    rose: 'bg-rose-50 dark:bg-rose-950/20 border-rose-300/70 dark:border-rose-500/30',
    amber: 'bg-amber-50 dark:bg-amber-950/20 border-amber-300/70 dark:border-amber-500/30',
    teal: 'bg-teal-50/70 dark:bg-teal-950/20 border-teal-300/70 dark:border-teal-500/30',
  }[tone]
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
        {icon} {title}
      </h4>
      <div className={cn('p-3 rounded-xl border text-xs', toneClass)}>{children}</div>
    </div>
  )
}

function BulletList({ items, ordered = false }: { readonly items: readonly string[]; readonly ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={cn('space-y-1 pl-4 leading-relaxed text-slate-800 dark:text-slate-200', ordered ? 'list-decimal' : 'list-disc')}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  )
}

export const HerbAuditDetailModal: FC<HerbAuditDetailModalProps> = ({ record, onClose, onConfigureDrug }) => {
  const [copied, setCopied] = useState(false)
  const isPass = record.audit_result === 'PASS'

  const { data, isLoading, error } = useQuery({
    queryKey: ['herb-audit-advice', record.id, record.audit_result],
    queryFn: () => herbDxApi.herbAuditAdvice(record, 'rule'),
    staleTime: 60_000,
  })
  const analysis = data?.analysis

  const ai = useMutation({ mutationFn: () => herbDxApi.herbAuditAdvice(record, 'ai') })
  const aiAdvice: HerbAuditAiAdvice | null = ai.data?.advice ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const matched = new Set(record.matched_dx.map(norm))
  const dxSlots: ReadonlyArray<readonly [string, string]> = [
    ['PDX', record.pdx],
    ['DX0', record.dx0],
    ['DX1', record.dx1],
    ['DX2', record.dx2],
    ['DX3', record.dx3],
    ['DX4', record.dx4],
    ['DX5', record.dx5],
  ]
  const isIpd = record.vn.startsWith('AN:')
  const units = cleanDrugUnit(record.drug_units ?? '')

  const handleCopy = async () => {
    if (!aiAdvice) return
    const text = [
      `[วิเคราะห์รายการจ่ายยา: ${record.drug_name} — ${record.patient_name} HN ${record.hn} ${isIpd ? record.vn : `VN ${record.vn}`}]`,
      `สรุป: ${aiAdvice.summary}`,
      aiAdvice.keyingError ? `จุดที่คีย์ผิด: ${aiAdvice.keyingError}` : '',
      `แก้ไขใน HOSxP:\n${aiAdvice.hosxpAction}`,
      aiAdvice.caution ? `ข้อควรระวัง: ${aiAdvice.caution}` : '',
    ].filter(Boolean).join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard blocked: ignore
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`รายละเอียดการจ่าย ${record.drug_name}`}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 shrink-0 rounded-xl bg-teal-500/15 text-teal-500 grid place-items-center">
              <User className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{record.patient_name}</h3>
                <CopyButton text={record.patient_name} title="คัดลอกชื่อผู้รับบริการ" iconSize="size-3.5" />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                <span className="text-teal-600 dark:text-teal-400 font-bold inline-flex items-center gap-1">
                  HN: {record.hn}
                  <CopyButton text={record.hn} title="คัดลอก HN" iconSize="size-3" />
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  {isIpd ? record.vn : `VN: ${record.vn}`}
                  <CopyButton text={isIpd ? record.vn.slice(3) : record.vn} title={isIpd ? 'คัดลอก AN' : 'คัดลอก VN'} iconSize="size-3" />
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Status */}
        <div
          className={cn(
            'p-3 rounded-xl border flex items-start gap-2.5 text-xs',
            isPass
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
              : record.audit_result === 'NO_MAP'
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-200'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-200'
          )}
        >
          {isPass ? <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" /> : <AlertTriangle className="size-4 shrink-0 mt-0.5" />}
          <div className="space-y-0.5">
            <p className="font-bold text-sm">{RESULT_LABEL[record.audit_result]}{analysis ? ` — ${analysis.summary}` : ''}</p>
            <p className="text-[11.5px] leading-relaxed opacity-90">{record.audit_reason}</p>
          </div>
        </div>

        {/* Visit + drug */}
        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold">วันที่ / เวลา</span>
            <span className="font-medium text-slate-800 dark:text-slate-200 font-mono">{toThaiDate(record.visit_date)} {record.visit_time}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold">สิทธิการรักษา</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{record.pttype_name || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold">แพทย์ผู้สั่ง</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{record.doctor_name || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold">แผนก</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{record.department_name || '—'}</span>
          </div>
          <div className="col-span-2 flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-white/5">
            <Pill className="size-4 text-teal-500 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-white">{record.drug_name}</span>
            <span className="font-mono text-slate-400">({record.drug_icode})</span>
            <span className="ml-auto font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
              {record.drug_qty.toLocaleString('th-TH')} {units}
              {record.min_qty ? <span className="ml-1 font-normal text-slate-400">(ขั้นต่ำ {record.min_qty})</span> : null}
            </span>
          </div>
        </div>

        {/* DX vs criteria */}
        <Section icon={<FileText className="size-3.5 text-teal-500" />} title="รหัสวินิจฉัยใน HOSxP เทียบกับเกณฑ์ของยา">
          <div className="flex flex-wrap gap-1.5">
            {dxSlots.map(([slot, code]) => {
              const c = norm(code ?? '')
              const ok = c && matched.has(c)
              return (
                <span
                  key={slot}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px]',
                    !c
                      ? 'border-dashed border-slate-300 text-slate-400 dark:border-white/10'
                      : ok
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-800 font-bold dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'border-slate-300 bg-white text-slate-700 font-bold dark:border-white/15 dark:bg-white/5 dark:text-slate-200'
                  )}
                  title={ok ? 'ตรงเกณฑ์ของยา' : c ? 'ไม่อยู่ในเกณฑ์ของยานี้' : 'ช่องว่าง'}
                >
                  <span className="text-[9px] font-semibold opacity-60">{slot}</span>
                  {c || '—'}
                  {ok && <Check className="size-3" />}
                </span>
              )
            })}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/5 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
            <div>
              <span className="font-semibold">เกณฑ์แผนปัจจุบัน:</span>{' '}
              <span className="font-mono">{analysis?.criteria.modern.join(', ') || record.allowed_dx.filter((p) => !p.startsWith('U')).join(', ') || '—'}</span>
            </div>
            <div>
              <span className="font-semibold">รหัสแผนไทยของยา:</span>{' '}
              <span className="font-mono">{analysis?.criteria.u.join(', ') || '—'}</span>
              {analysis?.isThaiMed && <span className="text-slate-400"> (แผนกแพทย์แผนไทยใช้รหัส U ตัวใดก็ได้)</span>}
            </div>
            {analysis?.indication && (
              <div>
                <span className="font-semibold">ข้อบ่งใช้:</span> {analysis.indication}
              </div>
            )}
          </div>
        </Section>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500">
            <Loader2 className="size-4 animate-spin" /> กำลังวิเคราะห์รายการ…
          </div>
        )}
        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400">วิเคราะห์ไม่สำเร็จ: {(error as Error).message}</p>
        )}

        {analysis && analysis.missing.length > 0 && (
          <Section icon={<ClipboardList className="size-3.5 text-rose-500" />} title="สิ่งที่ขาด" tone="rose">
            <BulletList items={analysis.missing} />
          </Section>
        )}

        {analysis && analysis.keyErrors.length > 0 && (
          <Section icon={<Keyboard className="size-3.5 text-amber-500" />} title="จุดที่อาจคีย์ผิดใน HOSxP" tone="amber">
            <BulletList items={analysis.keyErrors} />
          </Section>
        )}

        {analysis && analysis.hosxpSteps.length > 0 && (
          <Section icon={<Wrench className="size-3.5 text-teal-500" />} title="แก้ไขที่ไหนใน HOSxP" tone="teal">
            <BulletList items={analysis.hosxpSteps} ordered />
            {analysis.cautions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-teal-300/40 dark:border-teal-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                <strong>⚠️ ข้อควรระวัง:</strong> {analysis.cautions.join(' • ')}
              </div>
            )}
          </Section>
        )}

        {/* AI */}
        {!isPass && (
          <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-lg bg-gradient-to-tr from-violet-600 via-teal-500 to-cyan-400 text-white grid place-items-center">
                  <Bot className="size-3.5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">AI ช่วยวิเคราะห์</h4>
              </div>
              {!aiAdvice && (
                <button
                  type="button"
                  disabled={ai.isPending}
                  onClick={() => ai.mutate()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-violet-500 hover:from-teal-600 hover:to-violet-600 text-white font-bold text-xs shadow-md shadow-teal-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                >
                  {ai.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {ai.isPending ? 'กำลังวิเคราะห์…' : 'ให้ AI วิเคราะห์ & แนะนำการแก้ไข'}
                </button>
              )}
            </div>

            {ai.isError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2">
                <span>{(ai.error as Error).message || 'เชื่อมต่อ AI ไม่สำเร็จ'}</span>
                <button type="button" onClick={() => ai.mutate()} className="underline font-bold cursor-pointer">
                  ลองใหม่
                </button>
              </div>
            )}

            {aiAdvice && (
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-teal-50/90 via-slate-50/90 to-violet-50/80 dark:from-[#0d1627] dark:via-[#0c1424] dark:to-[#141226] border border-teal-500/30 space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1">
                      <Sparkles className="size-3" /> {aiAdvice.aiModel || 'AI'}
                    </span>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1 leading-snug">{aiAdvice.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 px-2 py-1 rounded-lg bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition cursor-pointer flex items-center gap-1 text-[10.5px] font-medium"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                  </button>
                </div>
                {aiAdvice.keyingError && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200">
                    <strong className="block text-[11px] mb-0.5">⌨️ คีย์ผิดใน HOSxP:</strong>
                    <div className="whitespace-pre-line leading-relaxed">{aiAdvice.keyingError}</div>
                  </div>
                )}
                <div className="p-2.5 rounded-lg bg-white/90 dark:bg-black/30 border border-teal-500/20 text-xs text-slate-800 dark:text-slate-200">
                  <strong className="block font-bold text-teal-700 dark:text-teal-300 text-[11px] mb-0.5">🛠️ สิ่งที่ต้องแก้ไขใน HOSxP:</strong>
                  <div className="whitespace-pre-line leading-relaxed">{aiAdvice.hosxpAction}</div>
                </div>
                {aiAdvice.caution && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                    <strong>⚠️ ข้อควรระวัง:</strong> {aiAdvice.caution}
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => ai.mutate()}
                    className="text-[10px] text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="size-2.5" /> วิเคราะห์ใหม่อีกครั้ง
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 flex flex-wrap justify-end gap-2 border-t border-slate-200 dark:border-white/10">
          {onConfigureDrug && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onConfigureDrug(record)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 transition cursor-pointer"
            >
              <Settings2 className="size-3.5" /> ตั้งค่าเกณฑ์ยานี้
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
