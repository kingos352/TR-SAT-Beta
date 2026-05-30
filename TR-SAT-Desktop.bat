@echo off
REM ---------------------------------------------------------------
REM  TR-SAT Mission Control V3 — Tauri Native Desktop
REM ---------------------------------------------------------------
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   TR-SAT Mission Control V3 - Desktop Modu
echo ============================================================
echo.

where rustc >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Rust bulunamadi! RUST-KUR.bat dosyasini calistirin.
    pause & exit /b 1
)
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Node.js bulunamadi! nodejs.org adresinden indirin.
    pause & exit /b 1
)

if not exist "frontend\node_modules\@tauri-apps\cli" (
    echo npm bagimliliklari yukleniyor...
    cd frontend & call npm install & cd ..
)

REM --- Backend'i bagimsiz process olarak baslat ---
echo Backend baslatiliyor...
set UVICORN="%~dp0backend\.venv\Scripts\uvicorn.exe"
set BACKEND_DIR=%~dp0backend

REM Port 8000 dolu ise eski sureci oldur
netstat -ano | findstr "127.0.0.1:8000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo Eski backend sureci kapatiliyor...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr "127.0.0.1:8000" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
    timeout /t 1 /nobreak >nul
)
echo Backend baslatiliyor (--reload aktif)...
set PYTHON="%~dp0backend\.venv\Scripts\python.exe"
start /B "" %PYTHON% -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --app-dir "%~dp0backend"
timeout /t 3 /nobreak >nul

echo Tauri native penceresi aciliyor...
echo.
"frontend\node_modules\.bin\tauri.cmd" dev

echo.
echo Uygulama kapandi.
pause
