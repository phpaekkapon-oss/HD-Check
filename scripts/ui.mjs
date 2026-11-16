// ตัวช่วยแสดงผลแบบมืออาชีพ: ใส่สีตามประเภทข้อความ (import แล้วทำงานทันที)
// [+] สำเร็จ=เขียว  [*] ขั้นตอน=ฟ้า  [!]/[WARN] เตือน=เหลือง  [ERROR]/[FAIL] ผิดพลาด=แดง  [n/N] หัวข้อขั้นตอน
const enabled = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR)
const wrap = (code) => (s) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : String(s))

export const c = {
  bold: wrap('1'), dim: wrap('2'),
  red: wrap('91'), green: wrap('92'), yellow: wrap('93'),
  blue: wrap('94'), magenta: wrap('95'), cyan: wrap('96'), white: wrap('97'),
  head: wrap('1;97;44'),
}

const WIDTH = 68
export const line = (ch = '━') => c.blue(ch.repeat(WIDTH))

export function banner(title, rows = [], color = c.cyan) {
  console.log('')
  console.log(line('━'))
  console.log(color(c.bold(`  ${title}`)))
  if (rows.length) console.log(line('─'))
  for (const [k, v] of rows) console.log(`  ${c.dim(k.padEnd(14))} ${c.white(v)}`)
  console.log(line('━'))
}

export function step(n, total, text) {
  console.log('')
  console.log(c.head(` ขั้นตอน ${n}/${total} `) + ' ' + c.bold(c.white(text)))
  console.log(c.dim('─'.repeat(WIDTH)))
}

function paint(s) {
  return s
    .split('\n')
    .map((ln) => {
      const t = ln.replace(/^\s+/, '')
      const pad = ln.slice(0, ln.length - t.length)
      if (/^={10,}$/.test(t)) return line('━')
      if (/^\[(\+|OK|SUCCESS)\]/.test(t)) return pad + c.green(t)
      if (/^\[(ERROR|CRITICAL|FAIL|X)\]/.test(t)) return pad + c.red(t)
      if (/^\[(!|WARN|WARNING|NOTICE|คำเตือน)\]/.test(t)) return pad + c.yellow(t)
      if (/^\[\*\]/.test(t)) return pad + c.cyan(t)
      if (/^>\s/.test(t)) return pad + c.dim(t)
      return ln
    })
    .join('\n')
}

if (enabled && !globalThis.__uiPatched) {
  globalThis.__uiPatched = true
  for (const m of ['log', 'warn', 'error']) {
    const orig = console[m].bind(console)
    console[m] = (...args) => orig(...args.map((a) => (typeof a === 'string' ? paint(a) : a)))
  }
}
