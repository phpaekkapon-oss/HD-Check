@echo off
title SMART-HOSCHECK Automated Release ^& Deploy
color 0B

echo ====================================================================
echo   SMART-HOSCHECK Automated Release, Git Push ^& Deploy
echo ====================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

node scripts\release.mjs %*

echo.
echo Press any key to close...
pause >nul
