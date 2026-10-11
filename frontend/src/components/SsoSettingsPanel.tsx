import { useCallback, useEffect, useState, type FC } from 'react'
import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  Info,
  Loader2,
  PlugZap,
  Save,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type P = 'thaid' | 'providerid'
type Mode = 'off' | 'demo' | 'live'
interface Cfg {
  readonly mode: Mode
  readonly client_id: string
  readonly authorize_url: string
  readonly token_url: string
  readonly userinfo_url: string
  readonly scope: string
  readonly cid_claim: string
  readonly use_pkce: boolean
  readonly public_base: string
  readonly has_secret: boolean
  readonly missing: readonly string[]
  readonly callback_url: string
}
interface Identity {
  readonly id: number
  readonly loginname: string
  readonly name: string | null
  readonly status: 'active' | 'disabled'
  readonly link_method: 'auto' | 'manual'
  readonly linked_by: string | null
  readonly note: string | null
  readonly login_count: number
  readonly linked_at: string | null
  readonly last_login_at: string | null
}
type Msg = { readonly text: string; readonly tone: 'success' | 'error' | 'warning' } | null

const META: Record<P, { label: string; org: string; icon: typeof Fingerprint; tone: string; doc: string }> = {
  thaid: {
    label: 'ThaiD',
    org: 'กรมการปกครอง (DOPA) — แอป ThaiD บนมือถือ',
    icon: Fingerprint,
    tone: 'from-indigo-700 to-slate-900',
    doc: 'ลงทะเบียนระบบกับ DOPA (ThaiD Partner) เพื่อขอ Client ID / Secret และแจ้ง Callback URL ด้านล่าง',
  },
  providerid: {
    label: 'Provider ID',
    org: 'กระทรวงสาธารณสุข (MOPH) — บุคลากรสาธารณสุข',
    icon: BadgeCheck,
    tone: 'from-emerald-600 to-teal-800',
    doc: 'ลงทะเบียนกับ MOPH Provider ID เพื่อขอ Client ID / Secret และ URL ของบริการ (ใส่ตามเอกสารที่ได้รับ)',
  },
}

const card = 'rounded-2xl border border-slate-800 bg-slate-950/60'
const input =
  'w-full mt-1 h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs font-mono focus:outline-hidden focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20'
const btn = 'inline-flex items-center justify-center gap-1.5 min-h-10 px-3.5 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-60'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...init })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) throw new Error(body?.error || `HTTP ${res.status}`)
  return body as T
}

const MsgBar: FC<{ msg: Msg }> = ({ msg }) =>
  msg ? (
    <p
      className={cn(
        'px-3 py-2 rounded-lg text-xs font-medium border',
        msg.tone === 'success' && 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
        msg.tone === 'warning' && 'bg-amber-500/10 border-amber-500/25 text-amber-300',
        msg.tone === 'error' && 'bg-rose-500/10 border-rose-500/25 text-rose-300'
      )}
    >
      {msg.text}
    </p>
  ) : null

/** ตั้งค่าเข้าสู่ระบบด้วย ThaiD / Provider ID (เฉพาะผู้ดูแล) */
export const SsoSettingsPanel: FC = () => {
  const [data, setData] = useState<Record<P, Cfg> | null>(null)
  const [linked, setLinked] = useState(0)
  const [suggested, setSuggested] = useState('')
  const [tab, setTab] = useState<P>('thaid')
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api<{ data: Record<P, Cfg>; linked_users: number; suggested_base: string }>('/api/admin/sso')
      setData(r.data)
      setLinked(r.linked_users)
      setSuggested(r.suggested_base)
      setLoadError(null)
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">เข้าสู่ระบบด้วย ThaiD / Provider ID</p>
          <p className="text-[11px] text-white/80">OAuth 2.0 · จับคู่บัญชี HOSxP ด้วยเลขบัตรประชาชน (เก็บแบบ hash) · เปิด/ปิดได้ทีละผู้ให้บริการ</p>
        </div>
        <span className="rounded-full bg-white/15 ring-1 ring-white/25 px-2.5 py-1 text-[11px] font-semibold">
          ผูกบัญชีแล้ว {linked.toLocaleString()} คน
        </span>
      </div>

      {loadError && <MsgBar msg={{ text: `โหลดค่าไม่สำเร็จ: ${loadError}`, tone: 'error' }} />}

      <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {(Object.keys(META) as P[]).map((p) => {
          const c = data?.[p]
          const active = c?.mode === 'live' && c.missing.length === 0
          return (
            <button
              key={p}
              type="button"
              onClick={() => setTab(p)}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 min-h-11 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap cursor-pointer',
                tab === p ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              {META[p].label}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-bold',
                  active
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : c?.mode === 'demo'
                      ? 'bg-violet-500/20 text-violet-300'
                      : c?.mode === 'live'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-slate-800 text-slate-400'
                )}
              >
                {active ? 'ใช้งานจริง' : c?.mode === 'demo' ? 'สาธิต (Demo)' : c?.mode === 'live' ? 'ค่ายังไม่ครบ' : 'ปิด'}
              </span>
            </button>
          )
        })}
      </div>

      {data && <ProviderForm key={tab} p={tab} cfg={data[tab]} suggested={suggested} onSaved={load} />}
      {data && <IdentitiesPanel key={`id-${tab}`} p={tab} />}
    </div>
  )
}

const ProviderForm: FC<{ p: P; cfg: Cfg; suggested: string; onSaved: () => void }> = ({ p, cfg, suggested, onSaved }) => {
  const m = META[p]
  const [f, setF] = useState({ ...cfg, client_secret: '' })
  const [showSecret, setShowSecret] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [check, setCheck] = useState<{ results: ReadonlyArray<{ name: string; ok: boolean; detail: string }> } | null>(null)
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }))
  const callback = f.public_base ? `${f.public_base.replace(/\/+$/, '')}/api/auth/sso/${p}/callback` : ''

  const save = async (patch: Partial<{ mode: Mode }> = {}) => {
    setBusy(true)
    setMsg(null)
    try {
      const { has_secret: _h, missing: _m, callback_url: _c, ...fields } = f
      const r = await api<{ mode: Mode; active: boolean; missing: string[] }>(`/api/admin/sso/${p}`, {
        method: 'PUT',
        body: JSON.stringify({ ...fields, ...patch, client_secret: f.client_secret || undefined }),
      })
      setMsg(
        r.mode === 'demo'
          ? { text: `บันทึกแล้ว — ปุ่ม ${m.label} (DEMO) แสดงบนหน้าเข้าสู่ระบบแล้ว`, tone: 'success' }
          : r.active
            ? { text: `บันทึกแล้ว — ปุ่ม ${m.label} ใช้งานจริงบนหน้าเข้าสู่ระบบแล้ว`, tone: 'success' }
            : r.mode === 'live'
              ? { text: `บันทึกแล้ว แต่ยังไม่แสดงปุ่ม: ขาด ${r.missing.join(', ')}`, tone: 'warning' }
              : { text: 'บันทึกแล้ว (ปิด — ไม่แสดงปุ่มบนหน้าเข้าสู่ระบบ)', tone: 'success' }
      )
      setF((x) => ({ ...x, ...patch, client_secret: '' }))
      onSaved()
    } catch (e) {
      setMsg({ text: `บันทึกไม่สำเร็จ: ${(e as Error).message}`, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const runCheck = async () => {
    setBusy(true)
    try {
      setCheck(await api(`/api/admin/sso/${p}/check`, { method: 'POST' }))
    } catch (e) {
      setMsg({ text: `ตรวจไม่สำเร็จ: ${(e as Error).message}`, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const field = (label: string, k: keyof typeof f, hint = '') => (
    <label className="block">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <input value={String(f[k] ?? '')} onChange={(e) => set(k, e.target.value)} placeholder={hint} spellCheck={false} className={input} />
    </label>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] items-start">
      <section className={card}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-800">
          <span className={`size-10 rounded-xl bg-gradient-to-br ${m.tone} grid place-items-center shrink-0`}>
            <m.icon className="size-5 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-100 text-sm">การเข้าสู่ระบบด้วย {m.label}</p>
            <p className="text-[11px] text-slate-400">{m.org}</p>
          </div>
          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 ring-1 ring-slate-700" role="radiogroup" aria-label="โหมด">
            {(
              [
                ['off', 'ปิด', 'bg-slate-600 text-white'],
                ['demo', 'สาธิต (Demo)', 'bg-violet-600 text-white'],
                ['live', 'ใช้งานจริง', 'bg-emerald-600 text-white'],
              ] as const
            ).map(([k, label, on]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={f.mode === k}
                disabled={busy}
                onClick={() => void save({ mode: k })}
                className={cn(
                  'min-h-9 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer',
                  f.mode === k ? `${on} shadow-sm` : 'text-slate-400 hover:text-slate-100'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p
          className={cn(
            'px-4 py-2 text-xs border-b border-slate-800',
            f.mode === 'demo' ? 'bg-violet-500/10 text-violet-300' : f.mode === 'live' ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400'
          )}
        >
          {f.mode === 'demo'
            ? `โหมดสาธิต: ปุ่ม ${m.label} แสดงบนหน้าเข้าสู่ระบบพร้อมป้าย DEMO — กดแล้วขึ้นคำอธิบาย ยังไม่ได้เชื่อมกับหน่วยงานจริง`
            : f.mode === 'live'
              ? cfg.missing.length
                ? `โหมดใช้งานจริง แต่ยังไม่แสดงปุ่ม — ขาด ${cfg.missing.join(', ')}`
                : `โหมดใช้งานจริง: ปุ่ม ${m.label} พาไปยืนยันตัวตนกับหน่วยงานจริง`
              : 'ปิด: ไม่แสดงปุ่มบนหน้าเข้าสู่ระบบ'}
        </p>

        <div className="p-4 space-y-3">
          <MsgBar msg={msg} />
          <div className="grid gap-3 md:grid-cols-2">
            {field('Client ID', 'client_id', 'ได้จากหน่วยงานตอนลงทะเบียน')}
            <label className="block">
              <span className="text-xs font-semibold text-slate-300">
                Client Secret {cfg.has_secret && <span className="text-emerald-400">· บันทึกแล้ว (ซ่อน)</span>}
              </span>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={f.client_secret}
                  onChange={(e) => set('client_secret', e.target.value)}
                  placeholder={cfg.has_secret ? 'เว้นว่าง = ใช้ค่าเดิม' : 'ได้จากหน่วยงาน'}
                  autoComplete="new-password"
                  className={cn(input, 'pr-10')}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 mt-0.5 size-9 grid place-items-center text-slate-400 cursor-pointer"
                  aria-label={showSecret ? 'ซ่อน' : 'แสดง'}
                >
                  {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
          </div>
          {field('URL หน้าเว็บของระบบ SMART-HOSCHECK (ใช้สร้าง Callback URL)', 'public_base', suggested || 'https://hd-check.โรงพยาบาล.go.th')}
          <div className="rounded-lg bg-slate-900 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-400">Callback / Redirect URL — แจ้งหน่วยงานตอนลงทะเบียน</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs text-slate-100">{callback || '— กรอก URL หน้าเว็บก่อน —'}</code>
              {callback && (
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(callback).then(() => setMsg({ text: 'คัดลอก Callback URL แล้ว', tone: 'success' }))}
                  className={cn(btn, 'bg-slate-800 text-slate-200 hover:bg-slate-700')}
                  aria-label="คัดลอก"
                >
                  <Copy className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          <details className="rounded-lg border border-slate-800 px-3 py-2" open={!cfg.authorize_url}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-200 min-h-8 flex items-center">ค่าขั้นสูง (URL ของผู้ให้บริการ)</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {field('Authorization URL', 'authorize_url', 'https://…')}
              {field('Token URL', 'token_url', 'https://…')}
              {field('UserInfo URL (ถ้ามี)', 'userinfo_url', 'เว้นว่างได้')}
              {field('Scope', 'scope', 'เช่น pid name')}
              {field('ชื่อฟิลด์เลขบัตรประชาชน', 'cid_claim', 'เช่น pid หรือ data.cid')}
              <label className="flex items-center gap-2 text-sm text-slate-200 self-end pb-2 cursor-pointer">
                <input type="checkbox" checked={f.use_pkce} onChange={(e) => set('use_pkce', e.target.checked)} className="size-4 accent-emerald-500" />
                ใช้ PKCE (ถ้าผู้ให้บริการรองรับ)
              </label>
            </div>
            <p className="mt-2 text-[11px] text-amber-300">⚠ ค่าเริ่มต้นเป็นค่าที่เปิดเผยทั่วไป — ตรวจให้ตรงกับเอกสารที่หน่วยงานส่งให้ตอนลงทะเบียน</p>
          </details>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-800">
          <button type="button" onClick={() => void runCheck()} disabled={busy} className={cn(btn, 'bg-slate-800 text-slate-200 hover:bg-slate-700')}>
            <PlugZap className="size-4" />
            ทดสอบการติดต่อ
          </button>
          <button type="button" onClick={() => void save()} disabled={busy} className={cn(btn, 'bg-emerald-600 text-white hover:bg-emerald-500')}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            บันทึกการตั้งค่า
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <section className={card}>
          <div className="px-4 py-2.5 border-b border-slate-800 text-sm font-bold text-slate-100">สถานะ</div>
          <div className="p-4 space-y-2 text-sm">
            {cfg.missing.length === 0 ? (
              <p className="flex items-start gap-2 text-emerald-300 text-xs">
                <CheckCircle2 className="size-4 shrink-0" />
                ค่าครบ{cfg.mode === 'live' ? ' — ปุ่มใช้งานจริงแสดงบนหน้าเข้าสู่ระบบ' : ' — เลือก "ใช้งานจริง" เพื่อเปิดใช้'}
              </p>
            ) : (
              <>
                <p className="text-amber-300 font-semibold text-xs">ยังขาด:</p>
                <ul className="list-disc pl-5 text-xs text-slate-300">
                  {cfg.missing.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </>
            )}
            {check && (
              <div className="pt-2 border-t border-slate-800 space-y-1">
                {check.results.map((r) => (
                  <p key={r.name} className={cn('flex items-start gap-1.5 text-xs', r.ok ? 'text-emerald-300' : 'text-rose-300')}>
                    {r.ok ? <CheckCircle2 className="size-3.5 mt-px shrink-0" /> : <XCircle className="size-3.5 mt-px shrink-0" />}
                    <span>
                      <b>{r.name}</b>: {r.detail}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className={card}>
          <div className="px-4 py-2.5 border-b border-slate-800 text-sm font-bold text-slate-100">ขั้นตอนเปิดใช้</div>
          <ol className="p-4 space-y-2 text-xs text-slate-300 list-decimal pl-8">
            <li>{m.doc}</li>
            <li>กรอก URL หน้าเว็บของระบบ แล้วคัดลอก Callback URL ไปแจ้งหน่วยงาน (ต้องเป็น https เมื่อเปิดใช้จริง)</li>
            <li>ได้ Client ID / Secret มาแล้ว กรอก → บันทึก → ทดสอบการติดต่อ</li>
            <li>ตรวจว่าเลขบัตรประชาชนใน HOSxP (opduser) ของผู้ใช้ถูกต้อง — ระบบใช้จับคู่บัญชี</li>
            <li>เลือก "ใช้งานจริง" (ระหว่างรอรหัส ใช้ "สาธิต" ให้ผู้ใช้เห็นหน้าตาก่อนได้)</li>
          </ol>
          <p className="flex items-start gap-1.5 px-4 pb-4 text-[11px] text-slate-400">
            <Info className="size-3.5 shrink-0 mt-px" />
            ใช้สิทธิ์เดียวกับบัญชี HOSxP ที่จับคู่ได้ · ไม่ถาม 2FA ซ้ำเพราะ {m.label} ยืนยันตัวตนระดับสูงแล้ว · บัญชีที่ถูกระงับใน HOSxP เข้าไม่ได้
          </p>
        </section>
      </aside>
    </div>
  )
}

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-')

/** บัญชีที่ผูกกับผู้ให้บริการนี้ */
const IdentitiesPanel: FC<{ p: P }> = ({ p }) => {
  const m = META[p]
  const [rows, setRows] = useState<readonly Identity[]>([])
  const [f, setF] = useState({ loginname: '', cid: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const load = useCallback(async () => {
    try {
      setRows((await api<{ data: Identity[] }>(`/api/admin/sso/${p}/identities`)).data)
    } catch {
      setRows([])
    }
  }, [p])
  useEffect(() => {
    void load()
  }, [load])

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg({ text: ok, tone: 'success' })
      await load()
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const link = () =>
    run(async () => {
      await api(`/api/admin/sso/${p}/identities`, { method: 'POST', body: JSON.stringify(f) })
      setF({ loginname: '', cid: '', note: '' })
    }, `ผูก ${f.loginname} กับ ${m.label} แล้ว`)

  return (
    <section className={cn(card, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-slate-800">
        <m.icon className="size-4 text-emerald-400" />
        <span className="text-sm font-bold text-slate-100">
          บัญชีที่ผูกกับ {m.label} ({rows.length})
        </span>
        <span className="text-[11px] text-slate-400">— ผูกอัตโนมัติเมื่อเข้าระบบครั้งแรก หรือผูกด้วยมือด้านล่าง (เช่น เลขบัตรใน HOSxP ว่าง/มีหลายบัญชี)</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[10rem_13rem_1fr_auto] items-end px-4 py-3 border-b border-slate-800">
        <label className="block">
          <span className="text-[11px] text-slate-400">ชื่อผู้ใช้ HOSxP</span>
          <input value={f.loginname} onChange={(e) => setF((x) => ({ ...x, loginname: e.target.value }))} className={input} />
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-400">เลขบัตรประชาชน 13 หลัก (เก็บแบบ hash)</span>
          <input
            value={f.cid}
            onChange={(e) => setF((x) => ({ ...x, cid: e.target.value.replace(/[^0-9-]/g, '').slice(0, 17) }))}
            inputMode="numeric"
            autoComplete="off"
            className={input}
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-400">หมายเหตุ</span>
          <input value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} placeholder="เช่น เลขบัตรใน HOSxP ว่าง" className={cn(input, 'font-sans')} />
        </label>
        <button
          type="button"
          onClick={() => void link()}
          disabled={busy || !f.loginname.trim() || f.cid.replace(/\D/g, '').length !== 13}
          className={cn(btn, 'bg-emerald-600 text-white hover:bg-emerald-500')}
        >
          ผูกบัญชีด้วยมือ
        </button>
      </div>
      {msg && (
        <div className="px-4 pt-3">
          <MsgBar msg={msg} />
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-slate-800 max-h-80 overflow-y-auto">
        {!rows.length && <p className="text-center py-8 text-xs text-slate-400">ยังไม่มีบัญชีที่ผูก</p>}
        {rows.map((r) => (
          <div key={r.id} className="px-4 py-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{r.name || r.loginname}</p>
                <p className="text-[11px] text-slate-400 font-mono">{r.loginname}</p>
              </div>
              <StatusBadge status={r.status} label={m.label} />
            </div>
            <p className="text-[11px] text-slate-400">
              {r.link_method === 'manual' ? `ผูกด้วยมือ · ${r.linked_by ?? ''}` : 'อัตโนมัติ'} · เข้าล่าสุด {fmt(r.last_login_at)} · {r.login_count} ครั้ง
            </p>
            <RowActions r={r} label={m.label} busy={busy} run={run} />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-auto max-h-80">
        <table className="w-full text-xs text-left">
          <thead className="sticky top-0 bg-slate-900 text-slate-400 [&_th]:px-4 [&_th]:py-2">
            <tr>
              <th>ผู้ใช้</th>
              <th>วิธีผูก</th>
              <th>ผูกเมื่อ</th>
              <th>เข้าระบบล่าสุด</th>
              <th className="text-right">ครั้ง</th>
              <th>สถานะ</th>
              <th className="text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 [&_td]:px-4 [&_td]:py-2 text-slate-200">
            {!rows.length && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  ยังไม่มีบัญชีที่ผูก — จะเริ่มมีเมื่อเปิดใช้งานจริงและผู้ใช้เข้าระบบด้วย {m.label}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <p className="font-medium">{r.name || r.loginname}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{r.loginname}</p>
                </td>
                <td title={r.note ?? ''}>{r.link_method === 'manual' ? `ผูกด้วยมือ · ${r.linked_by ?? ''}` : 'อัตโนมัติ'}</td>
                <td className="text-slate-400">{fmt(r.linked_at)}</td>
                <td className="text-slate-400">{fmt(r.last_login_at)}</td>
                <td className="text-right tabular-nums">{r.login_count}</td>
                <td>
                  <StatusBadge status={r.status} label={m.label} />
                </td>
                <td className="text-right whitespace-nowrap">
                  <RowActions r={r} label={m.label} busy={busy} run={run} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const StatusBadge: FC<{ status: Identity['status']; label: string }> = ({ status, label }) =>
  status === 'active' ? (
    <span className="text-[11px] font-semibold text-emerald-300 whitespace-nowrap">ใช้ได้</span>
  ) : (
    <span className="text-[11px] font-semibold text-rose-300 whitespace-nowrap">ปิดการเข้าด้วย {label}</span>
  )

const RowActions: FC<{
  r: Identity
  label: string
  busy: boolean
  run: (fn: () => Promise<unknown>, ok: string) => Promise<void>
}> = ({ r, label, busy, run }) => (
  <div className="inline-flex gap-1.5">
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        void run(
          () => api(`/api/admin/sso/identities/${r.id}`, { method: 'PUT', body: JSON.stringify({ status: r.status === 'active' ? 'disabled' : 'active' }) }),
          `${r.status === 'active' ? 'ปิด' : 'เปิด'}การเข้าด้วย ${label} ของ ${r.loginname} แล้ว`
        )
      }
      className={cn(btn, 'min-h-9 bg-slate-800 text-slate-200 hover:bg-slate-700')}
    >
      {r.status === 'active' ? 'ปิด' : 'เปิด'}
    </button>
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (!window.confirm(`ยกเลิกการผูก ${r.loginname} กับ ${label}?\n(เข้าครั้งหน้าระบบจะจับคู่จากเลขบัตรใน HOSxP อีกครั้ง)`)) return
        void run(() => api(`/api/admin/sso/identities/${r.id}`, { method: 'DELETE' }), `ยกเลิกการผูก ${r.loginname} แล้ว`)
      }}
      className={cn(btn, 'min-h-9 bg-rose-500/10 text-rose-300 border border-rose-500/25 hover:bg-rose-500/20')}
    >
      ยกเลิกผูก
    </button>
  </div>
)
