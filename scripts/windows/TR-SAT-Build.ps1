$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..\..

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " TR-SAT Mission Control V3 - Build Tool " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Environment Check
if (-not (Test-Path ".env")) {
    Write-Host "Created local .env from .env.example. Add CESIUM_ION_TOKEN or Space-Track credentials if needed." -ForegroundColor Yellow
    Copy-Item ".env.example" -Destination ".env"
}

# 2. Python Check
$pyCmd = "py"
try {
    $pyVersion = & py -3.12 --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $pyCmd = "py -3.12"
    } else {
        Write-Host "Python 3.12 not explicitly found, falling back to default Python." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Python 3.12 not explicitly found, falling back to default Python." -ForegroundColor Yellow
}

Write-Host "Using Python launcher: $pyCmd" -ForegroundColor Green

# 3. Backend Setup
Write-Host "`n[1/4] Setting up Backend Virtual Environment..." -ForegroundColor Yellow
cd backend
if (-not (Test-Path ".venv")) {
    Invoke-Expression "$pyCmd -m venv .venv"
}
$pythonExe = "$PWD\.venv\Scripts\python.exe"

Write-Host "Installing backend dependencies..."
& $pythonExe -m pip install -q -r requirements.txt

# 4. Backend Tests
Write-Host "`n[2/4] Running Backend Tests..." -ForegroundColor Yellow
try {
    & $pythonExe -m pytest -q
} catch {
    Write-Host "Backend tests failed!" -ForegroundColor Red
    exit 1
}
cd ..

# 5. Node.js Check
Write-Host "`n[3/4] Checking Node.js..." -ForegroundColor Yellow
try {
    $npmVersion = & npm --version
    Write-Host "npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js/npm is required to build the frontend. Install Node.js LTS." -ForegroundColor Red
    exit 1
}

# 6. Frontend Build
Write-Host "`n[4/4] Building Frontend..." -ForegroundColor Yellow
cd frontend
Write-Host "Installing frontend dependencies..."
& npm install

Write-Host "Building frontend for production..."
try {
    & npm run build
} catch {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}
cd ..

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Build Successful! You can now run TR-SAT-Start.bat" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
