#Requires -Version 5.1
<#
.SYNOPSIS
  테스트용으로 프로젝트 소스를 다른 폴더에 복사합니다.

.DESCRIPTION
  node_modules, dist, logs, storage 등 대용량/런타임 산출물을 제외하고
  새로 npm install / 빌드해서 돌릴 수 있는 파일만 복사합니다.
  기본 대상: 프로젝트 상위 폴더의 {프로젝트명}-test\

.EXAMPLE
  .\scripts\copy-for-test.ps1

.EXAMPLE
  .\scripts\copy-for-test.ps1 -Destination "D:\Temp\lomad2-crawler-test"

.EXAMPLE
  .\scripts\copy-for-test.ps1 -Destination "D:\Temp\lomad2-test" -IncludeEnv -Clean
#>
[CmdletBinding()]
param(
  [string]$Destination = "",
  [switch]$IncludeEnv,
  [switch]$IncludeGit,
  [switch]$Clean,
  [switch]$Open
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProjectName = Split-Path $ProjectRoot -Leaf

if (-not $Destination) {
  $Destination = Join-Path (Split-Path $ProjectRoot -Parent) "${ProjectName}-test"
}

$Destination = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Destination)

if ([System.IO.Path]::GetFullPath($Destination).TrimEnd("\", "/").Equals(
    [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd("\", "/"),
    [System.StringComparison]::OrdinalIgnoreCase
  )) {
  throw "Destination cannot be the same as the project root."
}

# 제외 디렉터리명
$ExcludeNames = @(
  "node_modules",
  "dist",
  "build",
  "coverage",
  "logs",
  ".turbo",
  ".nx",
  ".next",
  ".cache",
  ".eslintcache",
  ".pm2",
  "tmp",
  "temp",
  "storage",
  "uploads",
  "backups",
  ".cursor",
  ".idea",
  ".vscode",
  "playwright-report",
  "test-results",
  "blob-report",
  "pids"
)

if (-not $IncludeGit) {
  $ExcludeNames += ".git"
}

# 제외 파일 패턴 (파일명)
$ExcludeFiles = @(
  "*.log",
  "*.zip",
  "*.tsbuildinfo",
  "*.tmp",
  "*.temp",
  "*.pid",
  "req.local.json",
  "req.json",
  "tmp-*.json",
  "ld.json",
  "dump.rdb",
  "*.sql",
  "*.dump",
  "Thumbs.db",
  ".DS_Store",
  "Desktop.ini"
)

if (-not $IncludeEnv) {
  $ExcludeFiles += ".env"
  $ExcludeFiles += ".env.*"
}

function Test-ShouldExclude([System.IO.FileSystemInfo]$Item, [string]$Root) {
  $rel = $Item.FullName.Substring($Root.Length).TrimStart("\", "/")
  $parts = $rel -split "[\\/]"

  foreach ($name in $ExcludeNames) {
    if ($parts -contains $name) { return $true }
  }

  if (-not $Item.PSIsContainer) {
    # .env.example 은 항상 포함
    if ($Item.Name -eq ".env.example") { return $false }

    foreach ($pat in $ExcludeFiles) {
      if ($Item.Name -like $pat) { return $true }
    }
  }

  return $false
}

Write-Host "Source      : $ProjectRoot"
Write-Host "Destination : $Destination"
Write-Host "IncludeEnv  : $IncludeEnv"
Write-Host "IncludeGit  : $IncludeGit"
Write-Host "Clean       : $Clean"
Write-Host ""

if ($Clean -and (Test-Path $Destination)) {
  Write-Host "Cleaning destination..."
  Remove-Item -LiteralPath $Destination -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null

$copied = 0
$sw = [System.Diagnostics.Stopwatch]::StartNew()

Get-ChildItem -Path $ProjectRoot -Force -Recurse -ErrorAction SilentlyContinue |
  Where-Object { -not (Test-ShouldExclude $_ $ProjectRoot) } |
  ForEach-Object {
    $rel = $_.FullName.Substring($ProjectRoot.Length).TrimStart("\", "/")
    $dest = Join-Path $Destination $rel

    if ($_.PSIsContainer) {
      if (-not (Test-Path $dest)) {
        New-Item -ItemType Directory -Force -Path $dest | Out-Null
      }
    }
    else {
      $parent = Split-Path $dest -Parent
      if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
      }
      Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
      $copied++
    }
  }

# storage 런타임 디렉터리는 비우고 .gitkeep 만 맞춤
$storageImages = Join-Path $Destination "storage\images"
New-Item -ItemType Directory -Force -Path $storageImages | Out-Null
$gitkeep = Join-Path $storageImages ".gitkeep"
if (-not (Test-Path $gitkeep)) {
  New-Item -ItemType File -Force -Path $gitkeep | Out-Null
}

$sw.Stop()

Write-Host ""
Write-Host "Copy complete."
Write-Host "  Files : $copied"
Write-Host "  Time  : $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
Write-Host "  Dest  : $Destination"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  cd `"$Destination`""
if (-not $IncludeEnv) {
  Write-Host "  copy .env.example .env   # edit values if needed"
}
Write-Host "  npm install"
Write-Host "  npm --prefix web install"
Write-Host "  npm run infra:up:light    # or infra:up"
Write-Host "  npm run migration:run"
Write-Host "  npm run dev:light         # or npm run dev"

if ($Open) {
  Set-Location $Destination
  Write-Host ""
  Write-Host "Opened destination folder in current shell."
}
