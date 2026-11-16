@echo off
chcp 65001 >nul
title SMART-HOSCHECK Release and Deploy
color 0B
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

node scripts\deploy-all.mjs %*
set RC=%errorlevel%

echo.
pause
exit /b %RC%
