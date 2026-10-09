# 🌿 SMART-HOSCHECK (HerbDx Audit System)

ระบบตรวจสอบการสั่งใช้ยาสมุนไพรตามเงื่อนไขข้อบ่งใช้ ICD-10 / ICD-10-TM สำหรับโรงพยาบาลที่ใช้ระบบ HOSxP

---

## 📁 โครงสร้างโปรเจกต์ (แยกหน้าบ้าน - หลังบ้านชัดเจน)

```text
HD-Check/
├── 📂 backend/               # [หลังบ้าน] Node.js Express API & MySQL Data Sync
│   ├── .env                  # การตั้งค่าเชื่อมต่อ HOSxP MySQL (192.168.1.253)
│   ├── package.json          # Dependency เฉพาะฝั่งหลังบ้าน (Express, mysql2, cors, dotenv)
│   ├── index.mjs             # Express REST API Server (Port 3002) & Auto-Sync Cron
│   ├── config.mjs            # การตั้งค่า DB / Indication Criteria
│   ├── init-db.mjs           # Migration ตาราง dw_hd-check บน MySQL
│   └── sync.mjs              # สคริปต์ Sync ข้อมูลจาก HOSxP เข้า dw_hd-check
│
├── 📂 frontend/              # [หน้าบ้าน] React 19 + TypeScript + Tailwind CSS v4 + Vite
│   ├── package.json          # Dependency เฉพาะฝั่งหน้าบ้าน (React 19, Shadcn Table, Lucide, Tailwind 4)
│   ├── vite.config.ts        # Vite config พร้อม Reverse Proxy ไปยัง Backend :3002
│   ├── src/
│   │   ├── api/              # API Client (herbdx.api.ts)
│   │   ├── components/       # UI Components & Shadcn Data Table
│   │   ├── hooks/            # TanStack Query Custom Hooks
│   │   ├── types/            # Strict Type Interfaces & Enums
│   │   ├── App.tsx           # หน้าจอหลัก SMART-HOSCHECK
│   │   └── main.tsx          # Entrypoint
│   └── index.html
│
└── package.json              # Root orchestration สั่งรันพร้อมกันได้ด้วยคำสั่งเดียว
```

---

## 🚀 วิธีการใช้งาน

### วิธีที่ 1: รันพร้อมกันทั้งระบบจากโฟลเดอร์หลัก
```bash
npm run dev           # รันทั้ง Backend (:3002) และ Frontend (:5174) พร้อมกันอัตโนมัติ
```

### วิธีที่ 2: รันแยกอิสระทีละฝั่ง

#### 🌐 ฝั่งหลังบ้าน (Backend API)
```bash
cd backend
npm install           # ติดตั้ง dependencies ฝั่งหลังบ้าน
npm run dev           # รันเซิร์ฟเวอร์แบบ watch mode (Port 3002)
# หรือ
npm start             # รันแบบ production
npm run sync          # สั่ง Sync ข้อมูลจาก HOSxP ทันที
```

#### 💻 ฝั่งหน้าบ้าน (Frontend UI)
```bash
cd frontend
npm install           # ติดตั้ง dependencies ฝั่งหน้าบ้าน
npm run dev           # รัน Vite dev server (Port 5174)
npm run build         # Build production bundle สำหรับนำไป deploy
```

---

## ⚙️ การตั้งค่าฐานข้อมูล HOSxP (`backend/.env`)
```ini
DB_HOST=192.168.1.253
DB_PORT=3306
DB_USER=dw_service_user
DB_PASSWORD=<เก็บรหัสผ่านไว้ใน backend/.env เท่านั้น>
HOS_DB_USER=hos_readonly_user
HOS_DB_PASSWORD=<บัญชีนี้ควรมีสิทธิ์ SELECT เท่านั้น>
HOS_DB=hos
DW_DB=dw_hd-check
API_PORT=3002
AUTO_SYNC_MINUTES=10
```
