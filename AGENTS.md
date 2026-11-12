# AGENTS.md — กฎกลางสำหรับ AI ทุกตัว (HD-Check)

> ไฟล์นี้คือแหล่งกฎเดียวของโปรเจกต์ Claude Code (`CLAUDE.md`), Gemini (`GEMINI.md`), Copilot, Windsurf, Cursor, Codex อ่านจากที่นี่ — แก้ที่นี่ที่เดียว

## 1. หลักการทำงาน
- **คิดก่อนเขียน**: ระบุสมมติฐาน ถ้ามีหลายความหมายให้เสนอทางเลือก ถ้าไม่ชัดให้ถามก่อนลงมือ
- **เรียบง่ายที่สุด**: เขียนเท่าที่โจทย์ต้องการ ไม่เพิ่มฟีเจอร์/abstraction/config ที่ไม่มีใครขอ
- **แก้เฉพาะจุด**: ทุกบรรทัดที่แก้ต้องโยงกลับไปที่คำขอได้ · เลียนแบบสไตล์โค้ดรอบข้าง · ไม่ refactor/จัดรูปโค้ดที่ไม่เกี่ยว · เห็นโค้ดตายที่ไม่เกี่ยวให้แจ้ง ไม่ลบเอง
- **กำหนดเกณฑ์สำเร็จแล้วตรวจจริง**: แปลงงานเป็นเป้าที่ตรวจได้ (เช่น เขียนเทสต์ที่พังก่อน แล้วแก้ให้ผ่าน) ห้ามรายงานว่าเสร็จโดยไม่มีผลรันจริง

## 2. มาตรฐานโค้ด
- ห้ามโค้ดตัดทอน / placeholder / `// TODO` / "เหมือนเดิม" — เขียนให้ใช้งานได้จริง
- ไม่ใช้ชนิดหลวม (`any` ใน TypeScript ฯลฯ) ถ้าไม่จำเป็น · จัดการ error ที่เกิดได้จริง ไม่ใส่ try/catch กับสิ่งที่เป็นไปไม่ได้
- ตั้งชื่อตามที่โปรเจกต์ใช้อยู่แล้ว · ไม่ใส่ comment อธิบายสิ่งที่โค้ดบอกอยู่แล้ว (comment ไว้อธิบาย "ทำไม")
- เงิน/จำนวนที่ต้องแม่นยำ ใช้ชนิด decimal ห้าม float

## 3. ความปลอดภัยและข้อมูล
- ห้ามใส่ secret/รหัสผ่าน/token ในโค้ด, commit, log หรือไฟล์ตัวอย่าง (ใช้ `.env` ที่ไม่ commit)
- SQL ต้อง parameterized เสมอ · ตรวจ input ที่ขอบระบบ (request, ไฟล์อัปโหลด)
- ข้อมูลส่วนบุคคล (เลขบัตร, เบอร์, สุขภาพ) ต้อง mask ตามสิทธิ์ ไม่ใส่ข้อมูลจริงในโค้ด/เทสต์/commit
- การแก้ไข/ลบข้อมูลสำคัญต้องเก็บ audit (ใคร/เมื่อไร/เหตุผล) · ทำลายข้อมูลแบบกู้ไม่ได้ต้องถามก่อน

## 4. Git และการส่งงาน
- Conventional Commits (`feat:` `fix:` `chore:` `docs:` …) · commit เล็ก ทำสิ่งเดียว
- ห้ามแก้/ลบ tag หรือ history ที่ push แล้ว (ไม่ force push เว้นแต่ผู้ใช้สั่ง)
- commit/push เมื่อผู้ใช้สั่งหรือตกลงไว้ล่วงหน้าเท่านั้น

## 5. การตรวจก่อนบอกว่าเสร็จ
- คำสั่งตรวจ: `npm run build`
- ต้องมีผลรันล่าสุดจริง (exit code 0) ก่อนรายงานว่าเสร็จ · ถ้าเทสต์ล้ม รายงานตามจริงพร้อมผลลัพธ์ · ถ้าข้ามขั้นตอนใด บอกว่าข้าม

## 6. Project Context
- **Stack**: Node.js
- **Stack จริง**: Monorepo — `backend/` (Node.js ESM + Express 5 + mysql2, เทสต์ `npm test --prefix backend`) · `frontend/` (React 19 + TypeScript + Tailwind v4 + Vite + TanStack Query/Table, ตรวจด้วย `npm run build` ที่ root)
- **โครงสร้างโฟลเดอร์สำคัญ**: `backend/index.mjs` (API + cron sync) · `backend/config.mjs` · `backend/sync.mjs` / `init-db.mjs` · `frontend/src/{api,components,hooks,types,layouts,lib}`
- **ฐานข้อมูล/ระบบภายนอกที่ห้ามเขียน**: HOSxP (`HOS_DB`) = อ่านอย่างเดียว · เขียนได้เฉพาะ `DW_DB` (dw_hd-check) และต้องเป็นคนละฐานกัน (`config.mjs` บังคับ)
- **กฎธุรกิจที่เดาเองไม่ได้**: เกณฑ์ข้อบ่งใช้ยาสมุนไพรตาม ICD-10/ICD-10-TM และกฎการสั่งจ่าย (`backend/dispensing-rules.mjs`, `audit-rules.mjs`) — ห้ามเดาเกณฑ์ ให้ถามผู้ใช้
- **UI/ภาษา/ธีม**: UI ภาษาไทย · วันที่เป็น พ.ศ. · ใช้ Tailwind v4 token ของโปรเจกต์
- **Skill/Agent (Nexus AIO)**: ติดตั้งที่ `.claude/skills` (68 skill) และ `.claude/agents` (21 ผู้ช่วยอ่านอย่างเดียว) — โฟลเดอร์ `.claude/` ถูก gitignore จึงไม่เข้า commit · งานของโปรเจกต์นี้เริ่มที่ `hrms-dev-pro`/`core-dev-pro` → เลือก skill ตามสารบัญ `.claude/skills/INDEX.md`
  - ใช้บ่อย: `hrms-mysql-testing` (SQL/migration) · `hrms-healthcare-data` + `pdpa-healthcare-security` (HN/ข้อมูลผู้ป่วย) · `hrms-frontend-ui` + `tailwind-design-system` (หน้าจอ) · `hrms-git-release` (commit/release) · `verification-before-completion` (ก่อนบอกว่าเสร็จ)
  - skill ชื่อ `hrms-*` เขียนไว้สำหรับระบบ HRMS รพ.พังโคน: ใช้เฉพาะส่วนที่เป็นหลักการทั่วไป (DB read-only, PDPA, UI) · ส่วนที่เป็นเส้นทาง/ตาราง/เวิร์กโฟลว์ของ HRMS ไม่ใช้กับโปรเจกต์นี้ และกฎใน AGENTS.md นี้ชนะเสมอถ้าขัดกัน
