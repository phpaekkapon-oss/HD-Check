@echo off
title SMART-HOSCHECK Automated Release, Git Push ^& Deploy to Server
color 0B

echo ====================================================================
echo   SMART-HOSCHECK - Automated Release, Git Push ^& Deploy
echo ====================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

echo [คำเตือน] คุณกำลังจะทำการสร้างเวอร์ชันใหม่และ Deploy ขึ้นสู่ระบบ
set /p CONFIRM="ยืนยันการเริ่ม Release ^& Deploy หรือไม่? พิมพ์ Y เพื่อยืนยัน (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo ====================================================================
    echo   [*] ยกเลิกเรียบร้อย - ระบบจะไม่เปลี่ยนเวอร์ชันและไม่มีการแก้ไขใดๆ
    echo ====================================================================
    pause
    exit /b 0
)

echo.
:: Run automated release (with AI Changelog + Code Diff Guard)
node scripts\release.mjs --auto

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Automated release or deploy failed. Please check errors above.
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo   Deployment and Release finished! Press any key to close...
echo ====================================================================
pause >nul
