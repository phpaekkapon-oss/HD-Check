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

:: Run fully automated release (Zero manual input: Auto Changelog + Bump + Git Push + Deploy)
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
