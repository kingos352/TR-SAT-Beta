#Requires -Version 5.1
<#
.SYNOPSIS
    TR-SAT Mission Control V4 - Full installer build script.
    Output: installer\output\TR-SAT-Setup-v4.0.0.exe

.DESCRIPTION
    Steps:
      1. Prerequisites check  (Node, Python, Rust/Cargo, Inno Setup)
      2. Frontend build       (npm run build)
      3. Backend compile      (PyInstaller -> trsat-backend.exe)
      4. Tauri app build      (cargo tauri build -> .exe only)
      5. Installer assets     (Pillow BMP banner generation)
      6. WebView2 redist      (check / download instructions)
      7. Inno Setup           (ISCC setup.iss -> TR-SAT-Setup-v4.0.0.exe)

.NOTES
    Run from project root:
        cd C:\Users\yukse\Desktop\TR-SAT-Desktop
        .\scripts\build-full-installer.ps1

    Optional flags:
        -SkipFrontend  : skip npm build step
        -SkipBackend   : skip PyInstaller step
        -SkipTauri     : skip cargo tauri build step
        -SkipAssets    : skip BMP generation step
#>
[CmdletBinding()]
param(
    [switch]$SkipFrontend,
    [switch]$SkipBackend,
    [switch]$SkipTauri,
    [switch]$SkipAssets
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Output helpers ─────────────────────────────────────────────────────────────
function Write-Step  { param([string]$Msg) Write-Host "`n--  $Msg" -ForegroundColor Cyan }
function Write-OK    { param([string]$Msg) Write-Host "  OK  $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "  !!  $Msg" -ForegroundColor Yellow }
function Write-Fail  { param([string]$Msg) Write-Host "  XX  $Msg" -ForegroundColor Red; exit 1 }
function Write-Info  { param([string]$Msg) Write-Host "      $Msg" -ForegroundColor DarkGray }

# ── Path constants ─────────────────────────────────────────────────────────────
$Root         = $PSScriptRoot | Split-Path -Parent
$Frontend     = Join-Path $Root "frontend"
$Backend      = Join-Path $Root "backend"
$SrcTauri     = Join-Path $Root "src-tauri"
$InstallerDir = Join-Path $Root "installer"
$BackendDist  = Join-Path $Backend "dist"
$TauriRelease = Join-Path $SrcTauri "target\release"
$RedistDir    = Join-Path $InstallerDir "redist"
$AssetsDir    = Join-Path $InstallerDir "assets"
$OutputDir    = Join-Path $InstallerDir "output"
$IsccDefault  = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
$IsccAlt      = "C:\Program Files\Inno Setup 6\ISCC.exe"
# Tauri names the exe after the Cargo package name (lowercased, hyphens)
$AppExe       = Join-Path $TauriRelease "tr-sat-mission-control.exe"
# onedir layout: the executable is inside a trsat-backend/ subfolder
$BackendExeDir = Join-Path $BackendDist "trsat-backend"
$BackendExe    = Join-Path $BackendExeDir "trsat-backend.exe"
$IcoSrc       = Join-Path $SrcTauri "icons\icon.ico"
$IcoDst       = Join-Path $AssetsDir "icon.ico"

Write-Host ""
Write-Host "  +=============================================+" -ForegroundColor Blue
Write-Host "  |  TR-SAT Mission Control V4 - Installer     |" -ForegroundColor Blue
Write-Host "  |  Build Script v4.0.0                       |" -ForegroundColor Blue
Write-Host "  +=============================================+" -ForegroundColor Blue
Write-Host ""
Write-Info "Root : $Root"
Write-Info "Date : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# ═══════════════════════════════════════════════════════════════════════════════
# 0. Prerequisites
# ═══════════════════════════════════════════════════════════════════════════════
Write-Step "Checking prerequisites"

# Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js not found. Install from https://nodejs.org"
}
$nodeVer = node --version
Write-OK "Node.js $nodeVer"

# Python — prefer .venv-build (clean build env) over .venv (dev env)
$VenvBuildPy = Join-Path $Backend ".venv-build\Scripts\python.exe"
$VenvPy      = Join-Path $Backend ".venv\Scripts\python.exe"
if (Test-Path $VenvBuildPy) {
    $PythonExe = $VenvBuildPy
} elseif (Test-Path $VenvPy) {
    $PythonExe = $VenvPy
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $PythonExe = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $PythonExe = "python3"
} else {
    Write-Fail "Python not found. Create backend/.venv-build or install from https://python.org"
}
$pyVer = & $PythonExe --version 2>&1
Write-OK "Python: $pyVer ($PythonExe)"

# Guard: block Python 3.12.0 — known SciPy bytecode compiler bug
$pyVerStr = & $PythonExe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')" 2>&1
if ($pyVerStr -eq "3.12.0") {
    Write-Fail "Python 3.12.0 detected! This version has a known SciPy bytecode bug.`n  Use Python 3.12.1+ or 3.11.x for builds.`n  Current: $PythonExe"
}

# Log dependency versions for reproducibility
Write-Step "Dependency versions"
$prev0 = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$depVersions = & $PythonExe -c @"
import numpy, scipy, fastapi, uvicorn, skyfield, sgp4, jplephem, PyInstaller
try:
    import pyinstaller_hooks_contrib
    phc = pyinstaller_hooks_contrib.__version__
except Exception:
    phc = 'N/A'
print(f'  NumPy:      {numpy.__version__}')
print(f'  SciPy:      {scipy.__version__}')
print(f'  FastAPI:    {fastapi.__version__}')
print(f'  Uvicorn:    {uvicorn.__version__}')
print(f'  Skyfield:   {skyfield.__version__}')
print(f'  sgp4:       {sgp4.__version__}')
print(f'  jplephem:   {jplephem.__version__}')
print(f'  PyInstaller:{PyInstaller.__version__}')
print(f'  Hooks:      {phc}')
"@ 2>&1
$ErrorActionPreference = $prev0
$depVersions | ForEach-Object { Write-Info $_ }

# Import smoke test — verify scipy.stats.chi2 works BEFORE building
Write-Step "Import smoke test"
$smokeResult = & $PythonExe -c "from scipy.stats import chi2; print('chi2.cdf(1,df=2) =', chi2.cdf(1.0, df=2)); print('IMPORT SMOKE TEST OK')" 2>&1
if ($smokeResult -match "IMPORT SMOKE TEST OK") {
    Write-OK "scipy.stats.chi2 import OK"
} else {
    Write-Host $smokeResult -ForegroundColor Red
    Write-Fail "Import smoke test FAILED. Fix dependencies before building."
}

# Cargo / Rust
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Fail "Rust/Cargo not found. Install from https://rustup.rs"
}
$cargoVer = cargo --version
Write-OK "Cargo: $cargoVer"

# Inno Setup
if (Test-Path $IsccDefault) {
    $IsccExe = $IsccDefault
} elseif (Test-Path $IsccAlt) {
    $IsccExe = $IsccAlt
} else {
    $isccCmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($isccCmd) {
        $IsccExe = $isccCmd.Source
    } else {
        Write-Fail "Inno Setup 6 not found.`n  Download from https://jrsoftware.org/isdl.php then re-run."
    }
}
Write-OK "Inno Setup: $IsccExe"

# PyInstaller check + install — all pip calls run with Continue to ignore notices
$prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$piCheck = & $PythonExe -m pip show pyinstaller 2>&1
if ($piCheck -notmatch "Name: pyinstaller") {
    Write-Warn "PyInstaller not found. Installing..."
    & $PythonExe -m pip install pyinstaller 2>&1 | Out-Null
}
$ErrorActionPreference = $prev
Write-OK "PyInstaller available"

# Pillow check + install
$prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$pillowCheck = & $PythonExe -m pip show Pillow 2>&1
if ($pillowCheck -notmatch "Name: Pillow") {
    Write-Warn "Pillow not found. Installing..."
    & $PythonExe -m pip install Pillow 2>&1 | Out-Null
}
$ErrorActionPreference = $prev
Write-OK "Pillow available"

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Folder preparation
# ═══════════════════════════════════════════════════════════════════════════════
Write-Step "Preparing directories"

foreach ($d in @($AssetsDir, $RedistDir, $OutputDir)) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
        Write-OK "Created: $d"
    }
}

if (Test-Path $IcoSrc) {
    Copy-Item $IcoSrc $IcoDst -Force
    Write-OK "icon.ico copied"
} else {
    Write-Warn "src-tauri/icons/icon.ico not found - Inno Setup will use default icon"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Frontend build
# ═══════════════════════════════════════════════════════════════════════════════
if (-not $SkipFrontend) {
    Write-Step "Frontend build (npm run build)"
    Push-Location $Frontend
    try {
        npm install --prefer-offline
        if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed." }
        npm run build
        if ($LASTEXITCODE -ne 0) { Write-Fail "npm run build failed." }
    } finally { Pop-Location }
    Write-OK "Frontend built: frontend/dist/"
} else {
    Write-Warn "Frontend build skipped (-SkipFrontend)"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Backend compile (PyInstaller)
# ═══════════════════════════════════════════════════════════════════════════════
if (-not $SkipBackend) {
    Write-Step "Backend compile (PyInstaller onedir)"

    # Clean old build artifacts to prevent contamination
    Write-Info "Cleaning old backend build/dist..."
    Remove-Item -Recurse -Force (Join-Path $Backend "build") -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force (Join-Path $Backend "dist")  -ErrorAction SilentlyContinue

    Push-Location $Backend
    try {
        Write-Info "Installing backend requirements..."
        $prev2 = $ErrorActionPreference; $ErrorActionPreference = "Continue"
        & $PythonExe -m pip install -r requirements.txt --quiet 2>&1 | Out-Null
        $exitReq = $LASTEXITCODE
        $ErrorActionPreference = $prev2
        if ($exitReq -ne 0) { Write-Fail "pip install -r requirements.txt failed." }

        Write-Info "Running PyInstaller (onedir, this takes ~90 seconds)..."
        $prev3 = $ErrorActionPreference; $ErrorActionPreference = "Continue"
        & $PythonExe -m PyInstaller trsat_backend.spec `
            --distpath (Join-Path $Backend "dist") `
            --workpath (Join-Path $Backend "build") `
            --noconfirm 2>&1 | ForEach-Object {
                # Show only key milestones to keep output readable
                if ($_ -match "Building EXE|COLLECT|Build complete|ERROR|completed successfully") {
                    Write-Info "  $_"
                }
            }
        $exitPyi = $LASTEXITCODE
        $ErrorActionPreference = $prev3
        if ($exitPyi -ne 0) { Write-Fail "PyInstaller failed (exit $exitPyi)." }
    } finally { Pop-Location }

    if (-not (Test-Path $BackendExe)) {
        Write-Fail "Expected output not found: $BackendExe`n  (onedir layout: $BackendExeDir)"
    }
    $bSize = [math]::Round((Get-Item $BackendExe).Length / 1MB, 1)
    $folderSize = [math]::Round(((Get-ChildItem $BackendExeDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
    Write-OK "trsat-backend.exe compiled (exe: ${bSize} MB, folder: ${folderSize} MB)"

    # Quick backend health check: start, poll health, then kill
    Write-Step "Backend quick health check"
    $backendProc = $null
    try {
        $backendProc = Start-Process -FilePath $BackendExe -PassThru -WindowStyle Hidden
        $healthy = $false
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Milliseconds 1000
            try {
                $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/health" -TimeoutSec 2 -ErrorAction Stop
                if ($resp.status -eq "ok") {
                    $healthy = $true
                    break
                }
            } catch { }
        }
        if ($healthy) {
            Write-OK "Backend health check PASSED"
        } else {
            Write-Warn "Backend health check timed out (30s). Check backend log for errors."
        }
    } finally {
        if ($backendProc -and -not $backendProc.HasExited) {
            Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Warn "Backend compile skipped (-SkipBackend)"
    if (-not (Test-Path $BackendExe)) {
        Write-Fail "trsat-backend.exe missing. Cannot skip with -SkipBackend."
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Tauri app build
# ═══════════════════════════════════════════════════════════════════════════════
if (-not $SkipTauri) {
    Write-Step "Tauri app build (tauri build)"
    # Tauri CLI lives in frontend/node_modules/.bin — run from project root so it
    # can locate src-tauri/tauri.conf.json as a sub-directory.
    $TauriBin = Join-Path $Frontend "node_modules\.bin\tauri.cmd"
    if (-not (Test-Path $TauriBin)) {
        Write-Fail "Tauri CLI not found: $TauriBin  Run 'npm install' inside frontend/ first."
    }
    Push-Location $Root
    try {
        # Full build: produces target/release/TR-SAT Mission Control V4.exe
        # plus Tauri NSIS/MSI bundles (we only use the exe for our Inno Setup)
        Write-Info "Running: tauri build (full)"
        & $TauriBin build
        if ($LASTEXITCODE -ne 0) { Write-Fail "tauri build failed." }
    } finally { Pop-Location }

    if (-not (Test-Path $AppExe)) {
        Write-Fail "Expected output not found: $AppExe"
    }
    $aSize = [math]::Round((Get-Item $AppExe).Length / 1MB, 1)
    Write-OK "TR-SAT Mission Control V4.exe built (${aSize} MB)"
} else {
    Write-Warn "Tauri build skipped (-SkipTauri)"
    if (-not (Test-Path $AppExe)) {
        Write-Fail "TR-SAT Mission Control V4.exe missing."
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Installer asset generation (Pillow BMP)
# ═══════════════════════════════════════════════════════════════════════════════
if (-not $SkipAssets) {
    Write-Step "Generating installer banner BMPs"
    Push-Location $InstallerDir
    try {
        & $PythonExe generate_assets.py
        if ($LASTEXITCODE -ne 0) { Write-Fail "generate_assets.py failed." }
    } finally { Pop-Location }

    if (-not (Test-Path (Join-Path $AssetsDir "wizard_side.bmp"))) {
        Write-Fail "wizard_side.bmp was not created."
    }
    Write-OK "wizard_side.bmp + wizard_header.bmp generated"
} else {
    Write-Warn "Asset generation skipped (-SkipAssets)"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 6. WebView2 bootstrapper check
# ═══════════════════════════════════════════════════════════════════════════════
Write-Step "WebView2 bootstrapper check"

$Wv2Path = Join-Path $RedistDir "MicrosoftEdgeWebview2Setup.exe"
if (Test-Path $Wv2Path) {
    $wv2Size = (Get-Item $Wv2Path).Length
    if ($wv2Size -gt 100000) {
        Write-OK "WebView2 bootstrapper present ($(([math]::Round($wv2Size/1KB,0))) KB)"
    } else {
        Write-Warn "WebView2 bootstrapper looks like a placeholder (${wv2Size} bytes)"
        Write-Info "Download real bootstrapper: https://go.microsoft.com/fwlink/p/?LinkId=2124703"
        Write-Info "Save to: $Wv2Path"
        Write-Info "Continuing with placeholder (dev build only)..."
    }
} else {
    Write-Warn "WebView2 bootstrapper not found: $Wv2Path"
    Write-Info "Download: https://go.microsoft.com/fwlink/p/?LinkId=2124703"
    Write-Info "Creating placeholder for dev build..."
    [System.IO.File]::WriteAllText($Wv2Path, "PLACEHOLDER")
}

# ═══════════════════════════════════════════════════════════════════════════════
# 7. Inno Setup compile
# ═══════════════════════════════════════════════════════════════════════════════
Write-Step "Compiling installer with Inno Setup"

$IssFile = Join-Path $InstallerDir "setup.iss"
if (-not (Test-Path $IssFile)) {
    Write-Fail "setup.iss not found: $IssFile"
}

# Final file existence check
$missing = @()
if (-not (Test-Path $AppExe))     { $missing += "TR-SAT Mission Control V4.exe" }
if (-not (Test-Path $BackendExe)) { $missing += "trsat-backend.exe" }
if ($missing.Count -gt 0) {
    Write-Fail "Missing file(s):`n      $($missing -join "`n      ")"
}

Write-Info "Running ISCC..."
Push-Location $InstallerDir
try {
    & $IsccExe setup.iss
    if ($LASTEXITCODE -ne 0) { Write-Fail "ISCC compile failed." }
} finally { Pop-Location }

# ═══════════════════════════════════════════════════════════════════════════════
# 8. Summary
# ═══════════════════════════════════════════════════════════════════════════════
$FinalSetup = Join-Path $OutputDir "TR-SAT-Setup-v4.0.0.exe"
if (Test-Path $FinalSetup) {
    $setupSize = [math]::Round((Get-Item $FinalSetup).Length / 1MB, 1)
    Write-Host ""
    Write-Host "  +=============================================+" -ForegroundColor Green
    Write-Host "  |  BUILD SUCCESSFUL                           |" -ForegroundColor Green
    Write-Host "  +=============================================+" -ForegroundColor Green
    Write-Host ""
    Write-OK "Output : $FinalSetup"
    Write-OK "Size   : ${setupSize} MB"
    Write-Host ""
    Write-Info "Pre-distribution checklist:"
    Write-Info "  [ ] Real MicrosoftEdgeWebview2Setup.exe in installer/redist/"
    Write-Info "  [ ] Test install with valid Space-Track credentials"
    Write-Info "  [ ] Verify app launches and backend connects"
    Write-Info "  [ ] Test uninstall"
    Write-Host ""
} else {
    Write-Fail "Output file was not created: $FinalSetup"
}
