import { Client } from 'ssh2'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const zipPath = path.join(rootDir, 'HD-Check.zip')

// Server connection settings
const CONFIG = {
  host: process.env.DEPLOY_HOST || '192.168.1.241',
  port: Number(process.env.DEPLOY_PORT || 22),
  username: process.env.DEPLOY_USER || 'srimuang',
  password: process.env.DEPLOY_PASSWORD || "Fi'rpk[k]ry'F8o",
  remoteDir: process.env.DEPLOY_REMOTE_DIR || '/var/www/html/hd-check',
  appName: 'hd-check',
}

if (!fs.existsSync(zipPath)) {
  console.error('[ERROR] File not found: HD-Check.zip')
  console.error('Please run build.bat first to produce HD-Check.zip.')
  process.exit(1)
}

const zipStats = fs.statSync(zipPath)
const zipSizeMb = (zipStats.size / (1024 * 1024)).toFixed(2)

console.log('====================================================================')
console.log('  SMART-HOSCHECK Automated Deployment to Linux Server')
console.log('====================================================================')
console.log(`[*] Target Server : ${CONFIG.username}@${CONFIG.host}:${CONFIG.port}`)
console.log(`[*] Remote Folder : ${CONFIG.remoteDir}`)
console.log(`[*] Package File  : HD-Check.zip (${zipSizeMb} MB)`)
console.log('')

const conn = new Client()

function runRemoteCommand(command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err)
      let output = ''
      stream
        .on('close', (code) => {
          if (code === 0) resolve(output)
          else reject(new Error(`Command exited with code ${code}: ${output}`))
        })
        .on('data', (data) => {
          const str = data.toString()
          output += str
          process.stdout.write(str)
        })
        .stderr.on('data', (data) => {
          const str = data.toString()
          output += str
          process.stderr.write(str)
        })
    })
  })
}

conn.on('ready', () => {
  console.log('[+] SSH connection established successfully!')
  console.log(`[*] Ensuring remote directory exists: ${CONFIG.remoteDir}...`)

  runRemoteCommand(`mkdir -p "${CONFIG.remoteDir}"`)
    .then(() => {
      console.log(`[*] Uploading HD-Check.zip via SFTP...`)
      return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
          if (err) return reject(err)
          const remoteZip = `${CONFIG.remoteDir}/HD-Check.zip`
          const readStream = fs.createReadStream(zipPath)
          const writeStream = sftp.createWriteStream(remoteZip)

          let uploaded = 0
          readStream.on('data', (chunk) => {
            uploaded += chunk.length
            const percent = Math.round((uploaded / zipStats.size) * 100)
            process.stdout.write(`\r[*] Uploading: ${percent}% (${(uploaded / (1024 * 1024)).toFixed(2)} / ${zipSizeMb} MB)`)
          })

          writeStream.on('close', () => {
            console.log('\n[+] File upload completed successfully!')
            resolve()
          })

          writeStream.on('error', reject)
          readStream.pipe(writeStream)
        })
      })
    })
    .then(() => {
      console.log(`[*] Extracting files and restarting application on remote server...`)
      const remoteScript = `
        set -e
        cd "${CONFIG.remoteDir}"
        echo "[1/4] Extracting HD-Check.zip..."
        python3 -c "
import zipfile, os
with zipfile.ZipFile('HD-Check.zip', 'r') as z:
    for f in z.infolist():
        target = f.filename.replace('\\\\', '/')
        if target.endswith('/'):
            os.makedirs(target, exist_ok=True)
        else:
            p = os.path.dirname(target)
            if p: os.makedirs(p, exist_ok=True)
            with open(target, 'wb') as out:
                out.write(z.read(f))
" 2>/dev/null || (unzip -o -q HD-Check.zip || true)

        echo "[2/4] Installing backend production dependencies..."
        cd backend
        npm install --omit=dev

        echo "[3/4] Checking and restarting with PM2..."
        cd "${CONFIG.remoteDir}"
        if command -v pm2 >/dev/null 2>&1; then
          pm2 delete ${CONFIG.appName} 2>/dev/null || true
          pm2 start backend/index.mjs --name ${CONFIG.appName}
          pm2 save || true
        else
          echo "[NOTICE] PM2 not installed. Starting with Node.js in background..."
          pkill -f "node backend/index.mjs" || true
          nohup node backend/index.mjs > server.log 2>&1 &
        fi

        echo "[4/4] Server is up and running!"
      `
      return runRemoteCommand(remoteScript)
    })
    .then(() => {
      console.log('')
      console.log('====================================================================')
      console.log('  [SUCCESS] Deployment Completed Successfully!')
      console.log(`  * Server URL : http://${CONFIG.host}:3002`)
      console.log(`  * Remote Path: ${CONFIG.remoteDir}`)
      console.log('====================================================================')
      conn.end()
    })
    .catch((err) => {
      console.error('')
      console.error('[ERROR] Deployment failed:', err.message)
      conn.end()
      process.exit(1)
    })
})

conn.on('error', (err) => {
  console.error('[ERROR] SSH connection error:', err.message)
  process.exit(1)
})

conn.connect({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.username,
  password: CONFIG.password,
  readyTimeout: 20000,
})
