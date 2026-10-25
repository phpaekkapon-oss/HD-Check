import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))
const { version: appVersion } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      // __APP_VERSION__ ถูกอ่านจาก package.json ครั้งเดียวตอนเปิด dev server: ถ้า release ขยับเลขเวอร์ชัน
      // หน้าเว็บจะยังเป็นเลขเก่า แล้วป้าย "มีเวอร์ชันใหม่" เด้งซ้ำหลังกดยืนยัน จึงให้ dev server รีสตาร์ทเองเมื่อ package.json เปลี่ยน
      name: 'restart-on-version-bump',
      configureServer(server) {
        server.watcher.add(packageJsonPath)
        server.watcher.on('change', (file) => {
          if (resolve(file) !== resolve(packageJsonPath)) return
          try {
            const next = (JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string }).version
            if (next && next !== appVersion) void server.restart()
          } catch {
            // package.json กำลังถูกเขียน ไฟล์ยังไม่สมบูรณ์ รอรอบถัดไป
          }
        })
      },
    },
    {
      // Publish release notes next to index.html so an already-open (older) page can
      // read what the newly deployed version contains before reloading.
      name: 'emit-changelog',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'changelog.json',
          source: readFileSync(new URL('./src/data/changelog.json', import.meta.url), 'utf8'),
        })
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5174,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../HD-Check',
    emptyOutDir: true,
  },
})
