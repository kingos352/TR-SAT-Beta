@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║    TR-SAT Mission Control V4-Beta - Launcher     ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: ── 1. .env check ────────────────────────────────────────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo  [WARN] .env bulunamadi, .env.example kopyalandi.
        echo         CESIUM_ION_TOKEN ve Space-Track bilgilerini ekleyin.
        echo.
    ) else (
        echo  [WARN] .env dosyasi eksik. Uygulama kisitli modda calisabilir.
        echo.
    )
)

:: ── 2. Python check ───────────────────────────────────────────────────────────
set "PYTHON_EXE="

py -3.12 --version >nul 2>&1
if %errorlevel% == 0 (
    set "PYTHON_EXE=py -3.12"
    echo  [OK] Python 3.12 bulundu.
) else (
    python --version >nul 2>&1
    if %errorlevel% == 0 (
        set "PYTHON_EXE=python"
        echo  [WARN] Python 3.12 bulunamadi, varsayilan Python kullaniliyor.
    ) else (
        echo  [HATA] Python bulunamadi!
        echo         https://www.python.org/downloads/ adresinden yukleyin.
        pause
        exit /b 1
    )
)

:: ── 3. Venv check ─────────────────────────────────────────────────────────────
if not exist "backend\.venv\Scripts\python.exe" (
    echo  [INFO] Virtual environment olusturuluyor...
    %PYTHON_EXE% -m venv backend\.venv
    if %errorlevel% neq 0 (
        echo  [HATA] Venv olusturulamadi!
        pause
        exit /b 1
    )
    echo  [INFO] Bagimliliklar yukleniyor...
    backend\.venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt
    if %errorlevel% neq 0 (
        echo  [HATA] Pip install basarisiz!
        pause
        exit /b 1
    )
)
set "PYTHON_EXE=backend\.venv\Scripts\python.exe"

:: ── 4. Frontend build check ───────────────────────────────────────────────────
if not exist "frontend\dist\index.html" (
    echo  [INFO] Frontend build bulunamadi, derleniyor...
    echo.
    where npm >nul 2>&1
    if %errorlevel% neq 0 (
        echo  [HATA] Node.js/npm bulunamadi!
        echo         https://nodejs.org/ adresinden LTS surumunu yukleyin.
        pause
        exit /b 1
    )
    cd frontend
    call npm install
    call npm run build
    if %errorlevel% neq 0 (
        echo  [HATA] Frontend build basarisiz!
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo  [OK] Frontend build tamamlandi.
)

:: ── 5. Port 8000 temizle ──────────────────────────────────────────────────────
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    echo  [INFO] Port 8000 mesgul ^(PID %%p^), kapatiliyor...
    taskkill /PID %%p /F >nul 2>&1
    timeout /t 1 >nul
)

:: ── 6. Tarayici ac ───────────────────────────────────────────────────────────
set "URL=http://127.0.0.1:8000"
echo  [INFO] Tarayici aciliyor: %URL%

where msedge >nul 2>&1
if %errorlevel% == 0 (
    start "" msedge --app="%URL%" --window-size=1600,950
    goto :browser_done
)
where chrome >nul 2>&1
if %errorlevel% == 0 (
    start "" chrome --app="%URL%" --window-size=1600,950
    goto :browser_done
)
start "" "%URL%"
:browser_done

:: ── 7. Backend baslat ────────────────────────────────────────────────────────
echo.
echo  ════════════════════════════════════════════════════
echo   TR-SAT backend calisıyor → %URL%
echo   Durdurmak icin bu pencereyi kapatin veya Ctrl+C
echo  ════════════════════════════════════════════════════
echo.

cd backend
"%~dp0backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

cd ..
endlocal
