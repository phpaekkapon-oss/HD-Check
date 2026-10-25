/** ชื่อ: เหลือตัวอักษรแรก ที่เหลือเป็น * (คงช่องว่างระหว่างชื่อกับนามสกุล) */
export const maskName = (name: string | null | undefined): string =>
  String(name ?? '')
    .split(/(\s+)/)
    .map((part, i) => (i % 2 === 1 || part.length === 0 ? part : `${part[0]}${'*'.repeat(Math.min(part.length - 1, 6))}`))
    .join('')

/** HN: เหลือ 2 ตัวท้ายไว้ช่วยแยกเคส */
export const maskHn = (hn: string | null | undefined): string => {
  const s = String(hn ?? '')
  return s.length <= 2 ? '*'.repeat(s.length) : `${'*'.repeat(s.length - 2)}${s.slice(-2)}`
}
