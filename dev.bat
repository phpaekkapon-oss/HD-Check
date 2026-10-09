@echo off
title SMART-HOSCHECK (Backend + Frontend)
color 0A

echo ====================================================================
echo   SMART-HOSCHECK - Herbal Medicine Audit System [HOSxP Audit]
echo   Starting both Backend and Frontend in a single window...
echo ====================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

:: 1. Check and install dependencies if missing
if not exist "backend\node_modules" (
    echo [*] Installing Backend Dependencies...
    cd backend
    call npm install
    cd ..
)

if not exist "frontend\node_modules" (
    echo [*] Installing Frontend Dependencies...
    cd frontend
    call npm install
    cd ..
)

:: 2. Auto-detect LAN IP Address
for /f "tokens=*" %%a in ('node -e "const os=require('os'); const nets=os.networkInterfaces(); for(const n of Object.keys(nets)){ for(const net of nets[n]){ if(net.family==='IPv4' && !net.internal && !net.address.startsWith('169.254') && !net.address.startsWith('172.22') && !net.address.startsWith('192.168.56')) { console.log(net.address); process.exit(0); } } } console.log('127.0.0.1');"') do set LAN_IP=%%a

:: 3. This app uses alternate ports so it can run beside the HRMS app
netstat -ano | findstr /R /C:":3002 .*LISTENING" >nul
if %errorlevel% equ 0 (
    echo [ERROR] Port 3002 is already in use. This app's backend cannot start.
    pause
    exit /b 1
)
netstat -ano | findstr /R /C:":5174 .*LISTENING" >nul
if %errorlevel% equ 0 (
    echo [ERROR] Port 5174 is already in use. This app's frontend cannot start.
    pause
    exit /b 1
)

:: Override backend/.env for this launcher, keeping this app separate from HRMS
set API_PORT=3002

echo.
echo ====================================================================
echo   Starting SMART-HOSCHECK System...
echo   * Local URL    : http://localhost:5174
echo   * Network IP   : http://%LAN_IP%:5174
echo   * Backend API  : http://%LAN_IP%:3002
echo   * HOSxP MySQL  : 192.168.1.253 [dw_hd-check]
echo ====================================================================
echo.

:: 4. Start Backend API in background
start /B "" node backend\index.mjs

:: Wait 2 seconds for backend initialization
timeout /t 2 /nobreak >nul

:: 5. Start Frontend Dev Server (Vite will automatically open browser when ready)
cd frontend
call npm run dev

pause
