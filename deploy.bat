@echo off
chcp 65001 >nul
title SMART-HOSCHECK Automated Release, Git Push ^& Deploy
color 0B

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

:: Run Node.js release engine (Node handles full UTF-8 Thai interface and confirmation prompt)
node scripts\release.mjs --auto %*

if %errorlevel% neq 0 (
    echo.
    echo [!] Process exited with code %errorlevel%.
    pause
    exit /b %errorlevel%
)

pause
