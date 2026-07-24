#Requires -Version 5.1
<#
.SYNOPSIS
  인프라(Docker) + API + Worker + Web 을 한 번에 기동

.EXAMPLE
  .\scripts\dev.ps1
  .\scripts\dev.ps1 -SkipInfra
#>
[CmdletBinding()]
param(
  [switch]$SkipInfra
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (-not $SkipInfra) {
  Write-Host "==> docker compose up -d postgres redis elastic" -ForegroundColor Cyan
  docker compose up -d postgres redis elastic
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose failed"
  }
}

Write-Host "==> API + Worker + Web (Ctrl+C 로 모두 종료)" -ForegroundColor Cyan
Write-Host "    API  http://127.0.0.1:3100" -ForegroundColor DarkGray
Write-Host "    Web  http://127.0.0.1:5173" -ForegroundColor DarkGray
Write-Host ""

npm run dev:all
