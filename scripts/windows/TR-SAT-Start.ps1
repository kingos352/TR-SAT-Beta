param (
    [switch]$AppMode
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..\..

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " TR-SAT Mission Control V3 - Launcher   " -ForegroundColor Cyan
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

# 3. Backend Setup
cd backend
if (-not (Test-Path ".venv")) {
    Write-Host "Backend virtual environment not found. Creating..." -ForegroundColor Yellow
    Invoke-Expression "$pyCmd -m venv .venv"
}
$pythonExe = "$PWD\.venv\Scripts\python.exe"
cd ..

# 4. Frontend Build Check
if (-not (Test-Path "frontend/dist/index.html")) {
    Write-Host "Frontend build not found! Starting automated build..." -ForegroundColor Yellow
    
    # We must call the powershell script using the ampersand
    try {
        & .\scripts\windows\TR-SAT-Build.ps1
    } catch {
        Write-Host "Build failed. Cannot start the application." -ForegroundColor Red
        exit 1
    }
}

# 5. Port Check
$port = 8000
$connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
$startBackend = $true

if ($connection) {
    Write-Host "Port $port is currently in use." -ForegroundColor Yellow
    $owningPids = $connection.OwningProcess | Select-Object -Unique
    
    foreach ($procId in $owningPids) {
        if ($procId -gt 0) {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "Automatically killing process $($proc.ProcessName) (PID: $procId) to free the port..." -ForegroundColor Cyan
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Start-Sleep -Seconds 2
}

# 6. Start Application
$url = "http://127.0.0.1:8000"
if ($AppMode) {
    Write-Host "Starting TR-SAT Mission Control V3 (App Window Mode) at $url" -ForegroundColor Green
    try {
        Start-Process msedge -ArgumentList "--app=$url", "--window-size=1600,950" -ErrorAction Stop
    } catch {
        try {
            Start-Process chrome -ArgumentList "--app=$url", "--window-size=1600,950" -ErrorAction Stop
        } catch {
            Write-Host "Edge/Chrome not found, falling back to default browser." -ForegroundColor Yellow
            Start-Process $url
        }
    }
} else {
    Write-Host "Starting TR-SAT Mission Control V3 at $url" -ForegroundColor Green
    Start-Process $url
}

cd backend
Write-Host "Starting FastAPI backend... Press Ctrl+C to stop." -ForegroundColor Cyan
& $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
