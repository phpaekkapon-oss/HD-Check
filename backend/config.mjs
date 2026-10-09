import 'dotenv/config'

const required = (key) => {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env variable: ${key} (see .env)`)
  return v
}

/** Base MySQL options. HOSxP uses tis620 (Thai) — must match or Thai LIKE filters return 0 rows. */
export const DB_BASE = {
  host: required('DB_HOST'),
  port: Number(process.env.DB_PORT ?? 3306),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
  charset: 'tis620',
  dateStrings: true, // keep DATE as 'YYYY-MM-DD' (avoid timezone shift)
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
}

export const HOS_DB = process.env.HOS_DB ?? 'hos'
export const DW_DB = process.env.DW_DB ?? 'dw_hd-check'
if (HOS_DB.toLowerCase() === DW_DB.toLowerCase()) {
  throw new Error('HOS_DB and DW_DB must be different databases')
}

// Use a dedicated SELECT-only account for HOSxP whenever one is configured.
export const HOS_DB_BASE = {
  ...DB_BASE,
  user: process.env.HOS_DB_USER ?? DB_BASE.user,
  password: process.env.HOS_DB_PASSWORD ?? DB_BASE.password,
}
if (process.env.NODE_ENV === 'production' && (!process.env.HOS_DB_USER || !process.env.HOS_DB_PASSWORD)) {
  console.warn('[SECURITY] HOSxP is using the shared DB_USER credentials. Configure a dedicated SELECT-only HOS_DB_USER/HOS_DB_PASSWORD for enhanced security.')
}
export const DW_DB_BASE = {
  ...DB_BASE,
  user: process.env.DW_DB_USER ?? DB_BASE.user,
  password: process.env.DW_DB_PASSWORD ?? DB_BASE.password,
}
export const API_PORT = Number(process.env.API_PORT ?? 3001)
export const AUTO_SYNC_MINUTES = Number(process.env.AUTO_SYNC_MINUTES ?? 1)

/** Herbal drug filter (same criteria as SQL Query 2) */
export const HERB_DRUG_FILTER = `
  d.istatus = 'Y'
  AND (
      d.drugcategory LIKE '%สมุนไพร%'
      OR d.name LIKE '%มะแว้ง%'
      OR d.name LIKE '%มะขามแขก%'
      OR d.name LIKE '%เถาวัลย์เปรียง%'
      OR d.name LIKE '%ทองพันชั่ง%'
      OR d.icode IN ('1550003', '1540013', '1560028', '1560031')
  )
  AND d.name NOT LIKE '%(ยายืม)%'
  AND d.name NOT LIKE '%DICLOX%'
  AND d.name NOT LIKE '%imipenem%'
  AND d.name NOT LIKE '%inj%'
`

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
