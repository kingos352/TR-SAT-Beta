@echo off
REM ---------------------------------------------------------------
REM  TR-SAT — Rust Toolchain Kurulumu
REM  Tauri desktop build icin gerekli tek on kosul budur.
REM  Bu scripti bir kez calistirin, sonra TR-SAT-Desktop.bat calismaya hazir.
REM ---------------------------------------------------------------
echo.
echo ============================================================
echo   TR-SAT Desktop - Rust Kurulum Yardimcisi
echo ============================================================
echo.

REM Rust zaten kurulu mu kontrol et
where rustc >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Rust zaten kurulu:
    rustc --version
    cargo --version
    echo.
    echo Tauri build icin hazirsiniz. TR-SAT-Desktop.bat'i calistirabilirsiniz.
    pause
    exit /b 0
)

echo Rust bulunamadi. Kurulum baslatiliyor...
echo.

REM winget ile kurulum dene
where winget >nul 2>&1
if %errorlevel% == 0 (
    echo [winget] Rust kuruluyor...
    winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements
    if %errorlevel% == 0 (
        echo.
        echo [OK] Rust basariyla kuruldu!
        echo.
        echo ONEMLI: Degisikliklerin gecerli olabilmesi icin bu pencereyi kapatin
        echo         ve YENI bir komut istemi acin, sonra TR-SAT-Desktop.bat calistirin.
        pause
        exit /b 0
    )
)

REM winget basarisiz veya yoksa manuel indirme
echo winget ile kurulamadi. Manuel kurulum gerekiyor.
echo.
echo Asagidaki adresi tarayicinizda acin ve rustup-init.exe indirip calistirin:
echo.
echo   https://win.rustup.rs/x86_64
echo.
echo Kurulum tamamlaninca bu pencereyi kapatin, yeni bir terminal acin ve
echo TR-SAT-Desktop.bat'i calistirin.
echo.
start https://win.rustup.rs/x86_64
pause
