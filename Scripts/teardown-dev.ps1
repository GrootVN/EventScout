[CmdletBinding()]
param(
  [switch]$RemoveData
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($RemoveData) {
  docker compose down -v
} else {
  docker compose down
}

