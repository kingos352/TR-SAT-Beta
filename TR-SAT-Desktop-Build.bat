@echo off
REM ---------------------------------------------------------------
REM  TR-SAT Mission Control V3 — Production desktop build
REM  Compiles backend to .exe (PyInstaller) and bundles everything
REM  into a Windows installer via Tauri (NSIS + MSI).
REM ---------------------------------------------------------------
setlocal

cd /d "%~dp0"

echo.
echo [1/2] Building backend sidecar (PyInstaller)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\build-backend-sidecar.ps1"
if errorlevel 1 goto :error

echo.
echo [2/2] Building Tauri desktop bundle (Rust + WebView2)...
echo.
cd frontend
call npm run tauri:build
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  Build complete.
echo  Installer:  src-tauri\target\release\bundle\nsis\*.exe
echo  MSI:        src-tauri\target\release\bundle\msi\*.msi
echo ============================================================
goto :eof

:error
echo.
echo Build FAILED. See messages above.
exit /b 1
