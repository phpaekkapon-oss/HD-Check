@echo off
title SMART-HOSCHECK Build ^& Package (HD-Check)
color 0B

echo ====================================================================
echo   SMART-HOSCHECK - Build ^& Package Production [HD-Check]
echo ====================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    if not "%1"=="--no-pause" pause
    exit /b 1
)

:: 1. Check frontend dependencies
if not exist "frontend\node_modules" (
    echo [*] Installing Frontend Dependencies...
    cd frontend
    call npm install
    cd ..
)

:: Clean up legacy dist folder if present
if exist "dist" (
    rmdir /s /q "dist"
)

:: 2. Compile and build frontend into HD-Check folder (instead of dist)
echo [*] Compiling TypeScript and Building Frontend into folder: HD-Check...
cd frontend
call npm run build
set BUILD_STATUS=%errorlevel%
cd ..

if %BUILD_STATUS% neq 0 (
    echo.
    echo [ERROR] Build failed. Please check the logs above.
    if not "%1"=="--no-pause" pause
    exit /b %BUILD_STATUS%
)

:: 3. Bundle Backend, Configs, and Quick Starter into HD-Check
echo.
echo [*] Bundling Backend and configuration into HD-Check...
if not exist "HD-Check\backend" mkdir "HD-Check\backend"

:: Copy backend files (excluding node_modules to keep size light)
robocopy "backend" "HD-Check\backend" /E /XD "node_modules" >nul
:: Copy config & package files
copy /y "package.json" "HD-Check\package.json" >nul
if exist ".env" (
    copy /y ".env" "HD-Check\.env" >nul
)
if exist "ecosystem.config.cjs" (
    copy /y "ecosystem.config.cjs" "HD-Check\ecosystem.config.cjs" >nul
)
if exist "README.md" (
    copy /y "README.md" "HD-Check\README.md" >nul
)

:: Create quick start launcher inside HD-Check
set "TARGET_START=HD-Check\start.bat"
echo @echo off > "%TARGET_START%"
echo title SMART-HOSCHECK Production Server >> "%TARGET_START%"
echo color 0A >> "%TARGET_START%"
echo echo ==================================================================== >> "%TARGET_START%"
echo echo   SMART-HOSCHECK Production Server [HD-Check] >> "%TARGET_START%"
echo echo ==================================================================== >> "%TARGET_START%"
echo echo. >> "%TARGET_START%"
echo if not exist "backend\node_modules" ( >> "%TARGET_START%"
echo     echo [*] Installing backend dependencies... >> "%TARGET_START%"
echo     cd backend >> "%TARGET_START%"
echo     call npm install --omit=dev >> "%TARGET_START%"
echo     cd .. >> "%TARGET_START%"
echo ) >> "%TARGET_START%"
echo echo. >> "%TARGET_START%"
echo echo [*] Starting Production Server on port 3001... >> "%TARGET_START%"
echo start "" http://localhost:3001 >> "%TARGET_START%"
echo node backend\index.mjs >> "%TARGET_START%"
echo pause >> "%TARGET_START%"

:: 4. Compress into HD-Check.zip for fast upload
echo.
echo [*] Creating archive HD-Check.zip for easy upload...
if exist "HD-Check.zip" del /f /q "HD-Check.zip"
powershell -NoProfile -Command "Compress-Archive -Path 'HD-Check\*' -DestinationPath 'HD-Check.zip' -Force"

echo.
echo ====================================================================
echo   [SUCCESS] Build ^& Package Completed Successfully!
echo.
echo   * Production Folder : %~dp0HD-Check
echo   * Ready-to-Upload   : %~dp0HD-Check.zip
echo ====================================================================
echo.
if not "%1"=="--no-pause" (
    echo [*] Opening folder location for upload...
    if exist "HD-Check.zip" (
        explorer /select,"%~dp0HD-Check.zip"
    )
    pause
)
