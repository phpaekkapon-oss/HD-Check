@echo off
title SMART-HOSCHECK Auto Deploy to 192.168.1.241
color 0B

echo ====================================================================
echo   SMART-HOSCHECK - Auto Build & Deploy to Server [192.168.1.241]
echo ====================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

:: 1. สั่ง Build โค้ดล่าสุดเป็น Production Bundle
echo [*] ขั้นตอนที่ 1: กำลังสร้างไฟล์บิลด์ล่าสุด (HD-Check.zip)...
echo.
call build.bat --no-pause

if not exist "HD-Check.zip" (
    echo.
    echo [ERROR] ไม่พบไฟล์ HD-Check.zip กรุณาตรวจสอบข้อผิดพลาดในการ build ด้านบน
    pause
    exit /b 1
)

:: 2. อัปโหลดขึ้น Server และสั่งเปิดใช้งาน
echo.
echo [*] ขั้นตอนที่ 2: กำลังส่งไฟล์และสั่งเปิดใช้งานบน Server 192.168.1.241...
echo.
node backend\deploy.mjs

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] การ Deploy ขัดข้อง กรุณาตรวจสอบ Error ด้านบน
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo   กดปุ่มใดก็ได้เพื่อปิดหน้าต่างนี้...
echo ====================================================================
pause >nul
