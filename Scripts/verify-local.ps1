[CmdletBinding()]
param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

Write-Step "Checking /api/health"
$health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get
$health | ConvertTo-Json -Depth 5

Write-Step "Checking /api/events"
$events = Invoke-RestMethod -Uri "$BaseUrl/api/events?lat=39.1031&lng=-84.512&radiusKm=10&time_range=today" -Method Get
"events_count=" + $events.meta.count

Write-Step "Checking /api/facets"
$facets = Invoke-RestMethod -Uri "$BaseUrl/api/facets?lat=39.1031&lng=-84.512&radiusKm=10" -Method Get
$facets | ConvertTo-Json -Depth 5

Write-Step "Local verification passed"
