[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

if (-not (Test-Path ".\infra\sql\schema.sql")) {
  throw "infra/sql/schema.sql not found."
}

Write-Step "Waiting for Postgres container to accept commands"
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
  try {
    docker compose exec -T postgres pg_isready -U postgres | Out-Null
    break
  } catch {
    Start-Sleep -Seconds 2
    $attempt++
  }
}

if ($attempt -ge $maxAttempts) {
  throw "Postgres did not become ready in time."
}

Write-Step "Applying schema.sql"
Get-Content ".\infra\sql\schema.sql" -Raw | docker compose exec -T postgres psql -U postgres -d eventscout -v ON_ERROR_STOP=1 -f -

if (Test-Path ".\infra\sql\seed.sql") {
  Write-Step "Applying seed.sql"
  Get-Content ".\infra\sql\seed.sql" -Raw | docker compose exec -T postgres psql -U postgres -d eventscout -v ON_ERROR_STOP=1 -f -
}

Write-Step "Database initialization complete"

