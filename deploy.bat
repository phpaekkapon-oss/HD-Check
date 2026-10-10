@echo off
title SMART-HOSCHECK Auto Deploy to 192.168.1.241
color 0B

echo ====================================================================
echo   SMART-HOSCHECK - Auto Build ^& Deploy to Server [192.168.1.241]
echo ====================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

:: 1. Build latest code
echo [*] Step 1: Building latest production bundle (HD-Check.zip)...
echo.
call build.bat --no-pause

if not exist "HD-Check.zip" (
    echo.
    echo [ERROR] HD-Check.zip not found. Please check build errors above.
    pause
    exit /b 1
)

:: 2. Upload and deploy to Server
echo.
echo [*] Step 2: Uploading and deploying to Server 192.168.1.241...
echo.
node backend\deploy.mjs

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Deployment failed. Please check errors above.
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo   Deployment finished! Press any key to close...
echo ====================================================================
pause >nul
