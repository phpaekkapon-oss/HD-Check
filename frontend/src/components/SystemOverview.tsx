import { type FC, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Bot,
  Database,
  DownloadCloud,
  KeyRound,
  ListChecks,
  Server,
  ShieldCheck,
} from 'lucide-react'
import type { DbStatus } from '@/types/herbdx.types'
import { toThaiDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

interface SystemOverviewProps {
  readonly status: DbStatus | undefined
  readonly statusError: boolean
  readonly isAdmin: boolean
}

function Step({ icon, title, desc, tone }: { readonly icon: ReactNode; readonly title: string; readonly desc: string; readonly tone: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03] sm:flex-col sm:items-center sm:text-center">
      <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl', tone)}>{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
        <div className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{desc}</div>
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <div aria-hidden className="flex shrink-0 items-center justify-center text-slate-300 dark:text-white/25">
      <ArrowDown className="size-4 sm:hidden" />
      <ArrowRight className="hidden size-4 sm:block" />
    </div>
  )
}

/** ตารางในคลังข้อมูล dw_hd-check ที่ระบบใช้ (ชื่อตารางไม่ใช่ความลับ แต่แสดงเฉพาะผู้ดูแลระบบ) */
const DW_TABLES: readonly (readonly [string, string])[] = [
  ['dw_hd_check_prescriptions', 'สำเนารายการจ่ายยาสมุนไพร OPD/IPD + รหัสวินิจฉัย'],
  ['dw_hd_check_drugs', 'สรุปยอดจ่ายและต้นทุนรายยา'],
  ['dw_hd_check_drug_dx_map', 'เกณฑ์ยา ↔ ICD-10, จ่ายขั้นต่ำ, ข้อบ่งใช้'],
  ['dw_hd_check_dispensing_rules', 'เงื่อนไขรอบการจ่ายตามสิทธิ'],
  ['dw_hd_check_sync_log', 'ประวัติการดึงข้อมูลจาก HOSxP'],
  ['dw_hd_check_system_settings', 'ค่าตั้งระบบ (นโยบาย 2FA/PIN, เกณฑ์ค่าบริการซ้ำ)'],
  ['dw_hd_check_user_2fa / _sessions', 'บัญชี 2FA, PIN และ session ผู้ใช้'],
  ['dw_hd_check_user_avatar / _sso_identities', 'รูปโปรไฟล์ และการผูก ThaiD / Provider ID'],
]

export const SystemOverview: FC<SystemOverviewProps> = ({ status, statusError, isAdmin }) => {
  const syncLabel = !status
    ? 'กำลังตรวจสอบ…'
    : !status.syncEnabled
      ? 'ปิดการดึงข้อมูล'
      : status.autoSyncMinutes > 0
        ? `อัตโนมัติทุก ${status.autoSyncMinutes} นาที`
        : 'กดดึงด้วยตนเอง'
  const lastSyncAt = status?.lastSync?.at ? toThaiDateTime(status.lastSync.at) : '—'

  return (
    <div className="space-y-4">
      {/* ระดับ 1: ทุกคน — ข้อมูลมาจากไหน ไปไหน */}
      <section>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">ระบบทำงานอย่างไร</h4>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">ข้อมูลไหลจาก HOSxP มาตรวจตามเกณฑ์ แล้วแสดงผลในหน้าจอนี้</p>

        <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-stretch">
          <Step icon={<Database className="size-4.5" />} tone="bg-sky-500/15 text-sky-500" title="HOSxP" desc="เวชระเบียน รหัสโรค และรายการยาของโรงพยาบาล" />
          <Arrow />
          <Step icon={<DownloadCloud className="size-4.5" />} tone="bg-violet-500/15 text-violet-500" title="ดึงข้อมูล" desc={`เฉพาะยาสมุนไพร/หัตถการแผนไทย · ${syncLabel}`} />
          <Arrow />
          <Step icon={<ListChecks className="size-4.5" />} tone="bg-amber-500/15 text-amber-500" title="ตรวจตามเกณฑ์" desc="ICD-10 ตรงข้อบ่งใช้ · จ่ายขั้นต่ำ · รอบการจ่าย · หัตถการ" />
          <Arrow />
          <Step icon={<BarChart3 className="size-4.5" />} tone="bg-emerald-500/15 text-emerald-500" title="แสดงผล" desc="หน้าจอ, คำแนะนำการแก้ไข และส่งออก Excel" />
        </div>

        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/[0.03]">
            <dt className="text-slate-500 dark:text-slate-400">ดึงข้อมูลล่าสุด</dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">{lastSyncAt}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/[0.03]">
            <dt className="text-slate-500 dark:text-slate-400">ข้อมูลในระบบ</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-slate-900 dark:text-white">
              {status ? `${status.totalPrescriptions.toLocaleString('th-TH')} รายการ · ยา ${status.totalDrugs} ชนิด` : '—'}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/[0.03]">
            <dt className="text-slate-500 dark:text-slate-400">การเชื่อมต่อ HOSxP</dt>
            <dd className={cn('mt-0.5 inline-flex items-center gap-1.5 font-medium', statusError ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400')}>
              <span className={cn('size-1.5 rounded-full', statusError ? 'bg-rose-500' : status ? 'bg-emerald-500' : 'bg-slate-400')} />
              {statusError ? 'ขาดการเชื่อมต่อ' : status ? 'พร้อมใช้งาน' : 'กำลังตรวจสอบ…'}
            </dd>
          </div>
        </dl>

        <p className="mt-2.5 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-emerald-500" />
          ระบบตรวจจากสำเนาข้อมูล ไม่แก้ไขเวชระเบียนใน HOSxP — การแก้รหัสโรคทำใน HOSxP แล้วดึงข้อมูลใหม่
        </p>
      </section>

      {/* ระดับ 2: ผู้ดูแลระบบ — ส่วนประกอบและตารางข้อมูล (ไม่แสดง IP / รหัสผ่าน / คีย์) */}
      {isAdmin && (
        <details className="group rounded-xl border border-slate-200/80 dark:border-white/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="flex items-center gap-2">
              <Server className="size-4 text-accent" />
              รายละเอียดเทคนิค
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">ผู้ดูแลระบบ</span>
            </span>
            <ArrowDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>

          <div className="space-y-3 border-t border-slate-200/80 px-3.5 py-3 text-xs dark:border-white/10">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                ['หน้าเว็บ', 'React + Vite (ไฟล์ static ในโฟลเดอร์ HD-Check)'],
                ['API', 'Node.js + Express · รันด้วย PM2 บนเซิร์ฟเวอร์โรงพยาบาล'],
                ['HOSxP', 'อ่านอย่างเดียว ยกเว้นเปิด/ปิดบัญชีผู้ใช้ (opduser) โดยผู้ดูแลระบบ'],
                ['คลังข้อมูล', `ฐาน ${status?.database ?? 'dw_hd-check'} (MySQL) เก็บสำเนาและค่าตั้ง`],
                ['การยืนยันตัวตน', 'บัญชี HOSxP + 2FA (TOTP) + PIN ล็อกหน้าจอ · ThaiD / Provider ID (ถ้าเปิด)'],
                ['AI', 'Google Gemini (ถ้าตั้งค่าไว้) ส่งเฉพาะเกณฑ์และรหัส ไม่ส่งชื่อผู้ป่วยใน Copilot'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
                  <div className="font-medium text-slate-900 dark:text-white">{k}</div>
                  <div className="mt-0.5 text-slate-500 dark:text-slate-400">{v}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-1.5 font-medium text-slate-900 dark:text-white">ตารางในคลังข้อมูล</div>
              <ul className="divide-y divide-slate-200/70 rounded-lg border border-slate-200/70 dark:divide-white/5 dark:border-white/10">
                {DW_TABLES.map(([t, d]) => (
                  <li key={t} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <code className="font-mono text-[11px] text-accent">{t}</code>
                    <span className="text-slate-500 dark:text-slate-400 sm:text-right">{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
              <KeyRound className="mt-px size-3.5 shrink-0" />
              รหัสผ่านฐานข้อมูล, API key และที่อยู่เซิร์ฟเวอร์อยู่ในไฟล์ .env บนเซิร์ฟเวอร์เท่านั้น ไม่แสดงในโปรแกรมและไม่ขึ้น GitHub
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Bot className="size-3.5" />
              เอกสารนักพัฒนาและซอร์สโค้ด: README.md ใน GitHub (phpaekkapon-oss/HD-Check)
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
