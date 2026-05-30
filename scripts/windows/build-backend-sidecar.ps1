# Builds the FastAPI backend into a single .exe and copies it into the
# Tauri binaries/ folder under the platform-specific name Tauri expects.
#
# Tauri's externalBin resolver looks for "<name>-<target-triple>.exe" alongside
# the bundle so the binary is unambiguous across cross-builds.

$ErrorActionPreference = "Stop"

$repoRoot   = Resolve-Path "$PSScriptRoot\..\.."
$backendDir = Join-Path $repoRoot "backend"
$venvDir    = Join-Path $backendDir ".venv"
$binariesDir = Join-Path $repoRoot "src-tauri\binaries"

Write-Host "[1/4] Ensuring Python virtualenv exists..." -ForegroundColor Cyan
# Use 'py' launcher (Windows) if available, fall back to 'python'
$pyExe = if (Get-Command py -ErrorAction SilentlyContinue) { "py" } else { "python" }
if (-not (Test-Path $venvDir)) {
    & $pyExe -m venv $venvDir
}

$pip    = Join-Path $venvDir "Scripts\pip.exe"
$pyinst = Join-Path $venvDir "Scripts\pyinstaller.exe"

Write-Host "[2/4] Installing backend + pyinstaller into venv..." -ForegroundColor Cyan
& $pip install --upgrade pip wheel | Out-Null
& $pip install -r (Join-Path $backendDir "requirements.txt")
& $pip install pyinstaller

Write-Host "[3/4] Compiling trsat-backend.exe via PyInstaller..." -ForegroundColor Cyan
Push-Location $backendDir
try {
    & $pyinst --clean --noconfirm "trsat-backend.spec"
} finally {
    Pop-Location
}

Write-Host "[4/4] Staging sidecar binary for Tauri..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $binariesDir | Out-Null

# Discover the host triple Tauri/rustc would use so the sidecar name matches.
$target = (& rustc -vV | Select-String "host:" | ForEach-Object {
    ($_ -split ":")[1].Trim()
})
if (-not $target) {
    throw "rustc not found — install Rust toolchain (https://rustup.rs/) before running this script."
}

$src = Join-Path $backendDir "dist\trsat-backend.exe"
$dst = Join-Path $binariesDir "trsat-backend-$target.exe"
Copy-Item -Force $src $dst

Write-Host ""
Write-Host "Done. Sidecar staged at:" -ForegroundColor Green
Write-Host "  $dst"
Write-Host ""
Write-Host "Next: from frontend/ run 'npm run tauri:dev' or 'npm run tauri:build'." -ForegroundColor Yellow
