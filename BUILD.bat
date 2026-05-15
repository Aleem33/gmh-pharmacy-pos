@echo off
title GMH Pharmacy POS - Build EXE
color 0A
echo ============================================
echo   GMH Pharmacy POS - Windows EXE Builder
echo ============================================
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed!
    echo Please download from: https://nodejs.org  (choose LTS)
    pause
    exit /b 1
)
echo [OK] Node.js found: && node --version
echo.

echo [1/3] Installing all dependencies (first time takes a few minutes)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Check your internet connection.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.
echo.

echo [2/3] Building React app...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Vite build failed.
    pause
    exit /b 1
)
echo [OK] React app built.
echo.

echo [3/3] Packaging as Windows EXE...
echo.
echo NOTE: To publish a release with auto-update support, set your GitHub token:
echo   set GH_TOKEN=your_github_personal_access_token
echo   then run: npm run dist:win -- --publish always
echo.
echo Building local installer (no publish)...
call npm run electron:build
if %errorlevel% neq 0 (
    echo [ERROR] Electron packaging failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   BUILD COMPLETE!
echo ============================================
echo.
echo Your EXE files are in the "release" folder:
echo   GMH Pharmacy POS Setup.exe   (installer with auto-update)
echo   GMH Pharmacy POS.exe         (portable)
echo.
echo To publish an update to GitHub Releases:
echo   1. Bump version in package.json
echo   2. set GH_TOKEN=ghp_yourtoken
echo   3. npm run dist:win -- --publish always
echo.
explorer release
pause
