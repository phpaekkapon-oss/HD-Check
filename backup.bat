@echo off
chcp 65001 >nul
title SMART-HOSCHECK Database Backup
color 0B

echo ====================================================================
echo   SMART-HOSCHECK - Database Backup Utility [HOSxP Data Warehouse]
echo ====================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

if not exist "backend\node_modules" (
    echo [*] Installing Backend Dependencies...
    cd backend
    call npm install
    cd ..
)

echo [*] Starting database backup...
echo.
node backend\backup.mjs

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Backup failed. Please check error logs above.
    pause
    exit /b 1
)

echo.
echo [*] Opening backups_sql folder...
if exist "backups_sql" (
    start "" "%~dp0backups_sql"
)

echo.
echo ====================================================================
echo   Backup finished! Press any key to close this window.
echo ====================================================================
pause >nul
