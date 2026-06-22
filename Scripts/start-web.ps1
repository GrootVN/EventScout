[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path ".\node_modules")) {
  throw "node_modules not found. Run .\Scripts\bootstrap-dev.ps1 first."
}

npm run dev

