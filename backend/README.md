# SMART-HOSCHECK Backend API

ระบบหลังบ้าน Node.js + Express สำหรับเชื่อมต่อฐานข้อมูล HOSxP (`192.168.1.253`) และระบบ Data Warehouse `dw_hd-check`

## ข้อกำหนด
- Node.js v18+
- เครือข่ายเชื่อมต่อ HOSxP MySQL Server (192.168.1.253:3306)

## การติดตั้งและรัน
```bash
cd backend
npm install
npm start          # รัน Production Server (Port 3002)
npm run dev        # รัน Development พร้อม Auto-reload
npm run sync       # สั่งดึงข้อมูลจาก HOSxP ทันทีแบบ Manual
npm run init-db    # ตรวจสอบและสร้างโครงสร้างตาราง dw_hd-check
```

## การตั้งค่า (.env)
- `DB_HOST`: IP ของเครื่องแม่ข่าย HOSxP (เช่น `192.168.1.253`)
- `DB_PORT`: `3306`
- `DB_USER` / `DB_PASSWORD`: บัญชีสำหรับฐาน DW เก็บค่าไว้ใน `backend/.env` และห้ามใส่รหัสจริงในเอกสาร
- `HOS_DB_USER` / `HOS_DB_PASSWORD`: แนะนำให้ใช้บัญชี HOSxP แยกที่มีสิทธิ์อ่านอย่างเดียว (`SELECT`)
- `HOS_DB`: `hos`
- `DW_DB`: `dw_hd-check`
- `API_PORT`: `3002`
- `AUTO_SYNC_MINUTES`: `10` (ตั้งรอบดึงข้อมูลอัตโนมัติเป็นนาที)
