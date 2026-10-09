import mysql from 'mysql2/promise'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DW_DB_BASE, DW_DB } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const backupDir = path.join(rootDir, 'backups_sql')

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true })
}

const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
const backupFilename = `backup_${DW_DB}_${timestamp}.sql`
const backupFilePath = path.join(backupDir, backupFilename)

function escapeSqlValue(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (Buffer.isBuffer(v)) return `X'${v.toString('hex')}'`
  if (v instanceof Date) {
    return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`
  }
  const s = String(v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\0/g, '\\0')
  return `'${s}'`
}

async function runBackup() {
  console.log('====================================================================')
  console.log('  SMART-HOSCHECK Database Backup Utility')
  console.log('====================================================================')
  console.log(`[*] Connecting to database server: ${DW_DB_BASE.host}:${DW_DB_BASE.port}`)
  console.log(`[*] Target database: [${DW_DB}]`)
  console.log(`[*] Output file: backups/${backupFilename}`)
  console.log('')

  let connection = null
  const startTime = Date.now()

  try {
    connection = await mysql.createConnection({
      ...DW_DB_BASE,
      database: DW_DB,
      connectTimeout: 10000,
    })
    await connection.query('SET NAMES tis620')

    const [tablesRows] = await connection.query(`SHOW TABLES`)
    if (tablesRows.length === 0) {
      console.log('[WARN] No tables found in database.')
      return
    }

    const tableNames = tablesRows.map((r) => Object.values(r)[0])
    console.log(`[*] Found ${tableNames.length} tables to backup:`)

    const stream = fs.createWriteStream(backupFilePath, { encoding: 'utf8' })

    const write = (text) => {
      return new Promise((resolve, reject) => {
        if (!stream.write(text)) {
          stream.once('drain', resolve)
        } else {
          process.nextTick(resolve)
        }
      })
    }

    // Header
    await write(`-- ====================================================================\n`)
    await write(`-- SMART-HOSCHECK Database Backup\n`)
    await write(`-- Database : ${DW_DB}\n`)
    await write(`-- Host     : ${DW_DB_BASE.host}:${DW_DB_BASE.port}\n`)
    await write(`-- Date     : ${now.toLocaleString('th-TH')}\n`)
    await write(`-- ====================================================================\n\n`)
    await write(`/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n`)
    await write(`/*!40101 SET NAMES utf8mb4 */;\n`)
    await write(`/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n`)
    await write(`/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n\n`)

    let totalRowsExported = 0

    for (const table of tableNames) {
      console.log(`  -> Backing up table: ${table}...`)

      await write(`-- -----------------------------------------------------\n`)
      await write(`-- Table structure for \`${table}\`\n`)
      await write(`-- -----------------------------------------------------\n`)
      await write(`DROP TABLE IF EXISTS \`${table}\`;\n`)

      const [[createRow]] = await connection.query(`SHOW CREATE TABLE \`${table}\``)
      const createSql = createRow['Create Table'] || Object.values(createRow)[1]
      await write(`${createSql};\n\n`)

      // Table data
      const [[countRow]] = await connection.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``)
      const count = Number(countRow.cnt || 0)

      if (count > 0) {
        await write(`-- Dumping data for table \`${table}\` (${count} rows)\n`)
        await write(`LOCK TABLES \`${table}\` WRITE;\n`)
        await write(`/*!40000 ALTER TABLE \`${table}\` DISABLE KEYS */;\n`)

        const BATCH_SIZE = 500
        let offset = 0

        while (offset < count) {
          const [rows] = await connection.query(
            `SELECT * FROM \`${table}\` LIMIT ? OFFSET ?`,
            [BATCH_SIZE, offset]
          )

          if (rows.length === 0) break

          const colNames = Object.keys(rows[0]).map((c) => `\`${c}\``).join(', ')
          const valuesList = rows
            .map((r) => `(${Object.values(r).map(escapeSqlValue).join(', ')})`)
            .join(',\n')

          await write(`INSERT INTO \`${table}\` (${colNames}) VALUES\n${valuesList};\n`)

          offset += rows.length
          totalRowsExported += rows.length
        }

        await write(`/*!40000 ALTER TABLE \`${table}\` ENABLE KEYS */;\n`)
        await write(`UNLOCK TABLES;\n\n`)
      }

      console.log(`     Done: ${count} rows backed up.`)
    }

    // Footer
    await write(`/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n`)
    await write(`/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n`)
    await write(`/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n`)
    await write(`-- Backup completed at ${new Date().toISOString()}\n`)

    stream.end()

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    const stats = fs.statSync(backupFilePath)
    const fileSizeKb = (stats.size / 1024).toFixed(1)
    const fileSizeMb = (stats.size / (1024 * 1024)).toFixed(2)
    const sizeDisplay = stats.size > 1024 * 1024 ? `${fileSizeMb} MB` : `${fileSizeKb} KB`

    console.log('')
    console.log('====================================================================')
    console.log('  [SUCCESS] Backup Completed Successfully!')
    console.log(`  * File: ${backupFilePath}`)
    console.log(`  * Total Tables: ${tableNames.length}`)
    console.log(`  * Total Rows: ${totalRowsExported.toLocaleString()}`)
    console.log(`  * File Size: ${sizeDisplay}`)
    console.log(`  * Time Taken: ${duration} seconds`)
    console.log('====================================================================')
  } catch (err) {
    console.error('')
    console.error('[ERROR] Backup failed:', err.message)
    if (fs.existsSync(backupFilePath)) {
      try { fs.unlinkSync(backupFilePath) } catch (_) {}
    }
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

runBackup()
