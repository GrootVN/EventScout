[CmdletBinding()]
param(
  [switch]$InstallNode,
  [switch]$InstallDocker,
  [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Test-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "docker")) {
  if ($InstallDocker) {
    if (-not (Test-Command "winget")) {
      throw "winget was not found. Install Docker Desktop manually from https://www.docker.com/products/docker-desktop/"
    }
    Write-Step "Installing Docker Desktop via winget"
    winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  } elseif (-not $SkipDocker) {
    throw "Docker is not installed or not on PATH. Re-run with -InstallDocker, or use -SkipDocker for web-only mode."
  }
}

if (-not (Test-Command "node") -or -not (Test-Command "npm")) {
  if ($InstallNode) {
    if (-not (Test-Command "winget")) {
      throw "winget was not found. Install Node.js LTS manually from https://nodejs.org/"
    }
    Write-Step "Installing Node.js LTS via winget"
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  } else {
    throw "Node.js/npm not found. Re-run with -InstallNode or install Node.js LTS manually."
  }
}

Write-Step "Checking versions"
node -v
npm -v
if (-not $SkipDocker -and (Test-Command "docker")) {
  docker --version
}

Write-Step "Ensuring local env file"
if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
  Write-Host "Created .env.local from .env.example"
} else {
  Write-Host ".env.local already exists"
}

Write-Step "Installing npm dependencies"
npm install

if (-not $SkipDocker -and (Test-Command "docker")) {
  Write-Step "Starting Postgres + Redis containers"
  docker compose up -d

  Write-Step "Initializing database schema + seed"
  powershell -ExecutionPolicy Bypass -File ".\Scripts\initialize-db.ps1"
} else {
  Write-Step "Skipping Docker, DB, and Redis setup"
  Write-Host "Web app will run in in-memory fallback mode."
}

Write-Step "Bootstrap complete"
Write-Host "Next run in separate terminals:"
Write-Host "1) powershell -ExecutionPolicy Bypass -File .\Scripts\start-web.ps1"
if (-not $SkipDocker -and (Test-Command "docker")) {
  Write-Host "2) powershell -ExecutionPolicy Bypass -File .\Scripts\start-worker.ps1"
  Write-Host "Then verify with:"
  Write-Host "3) powershell -ExecutionPolicy Bypass -File .\Scripts\verify-local.ps1"
} else {
  Write-Host "2) open http://localhost:3000 to verify UI + API in-memory mode"
  Write-Host "When Docker is available, rerun bootstrap without -SkipDocker for full ingestion stack."
}
