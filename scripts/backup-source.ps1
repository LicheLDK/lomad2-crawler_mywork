#Requires -Version 5.1
<#
.SYNOPSIS
  lomad2-crawler 소스 백업 (zip)

.DESCRIPTION
  node_modules, dist, logs 등 대용량/빌드 산출물을 제외하고 zip으로 묶습니다.
  기본 저장 위치: 프로젝트 상위 폴더의 backups\

.EXAMPLE
  .\scripts\backup-source.ps1

.EXAMPLE
  .\scripts\backup-source.ps1 -IncludeEnv -IncludeGit

.EXAMPLE
  .\scripts\backup-source.ps1 -OutputDir "D:\Backups\lomad2"
#>
[CmdletBinding()]
param(
  [string]$OutputDir = "",
  [switch]$IncludeEnv,
  [switch]$IncludeGit,
  [switch]$IncludeNodeModules
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProjectName = Split-Path $ProjectRoot -Leaf
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not $OutputDir) {
  $OutputDir = Join-Path (Split-Path $ProjectRoot -Parent) "backups"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$ZipName = "${ProjectName}-src-${Stamp}.zip"
$ZipPath = Join-Path $OutputDir $ZipName
$Staging = Join-Path $env:TEMP ("${ProjectName}-backup-${Stamp}")

if (Test-Path $Staging) {
  Remove-Item -Recurse -Force $Staging
}
New-Item -ItemType Directory -Force -Path $Staging | Out-Null

# 제외 패턴 (상대 경로 / 디렉터리명)
$ExcludeNames = @(
  "node_modules",
  "dist",
  "coverage",
  "logs",
  ".turbo",
  ".nx",
  ".next",
  "tmp",
  "temp",
  "storage",
  "uploads",
  "backups",
  ".cursor"
)

if (-not $IncludeGit) {
  $ExcludeNames += ".git"
}

$ExcludeFiles = @(
  "*.log",
  "*.zip",
  "req.json",
  "tmp-*.json",
  "ld.json"
)

if (-not $IncludeEnv) {
  $ExcludeFiles += ".env"
}

function Test-ShouldExclude([System.IO.FileSystemInfo]$Item, [string]$Root) {
  $rel = $Item.FullName.Substring($Root.Length).TrimStart("\", "/")
  $parts = $rel -split "[\\/]"

  foreach ($name in $ExcludeNames) {
    if ($parts -contains $name) { return $true }
  }

  if (-not $Item.PSIsContainer) {
    foreach ($pat in $ExcludeFiles) {
      if ($Item.Name -like $pat) { return $true }
    }
  }

  return $false
}

Write-Host "Project : $ProjectRoot"
Write-Host "Staging : $Staging"
Write-Host "Output  : $ZipPath"
Write-Host ""

$copied = 0
Get-ChildItem -Path $ProjectRoot -Force -Recurse -ErrorAction SilentlyContinue |
  Where-Object { -not (Test-ShouldExclude $_ $ProjectRoot) } |
  ForEach-Object {
    $rel = $_.FullName.Substring($ProjectRoot.Length).TrimStart("\", "/")
    $dest = Join-Path $Staging $rel

    if ($_.PSIsContainer) {
      New-Item -ItemType Directory -Force -Path $dest | Out-Null
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

if ($IncludeNodeModules -and (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
  Write-Host "Including node_modules (large)..."
  Copy-Item -Path (Join-Path $ProjectRoot "node_modules") -Destination (Join-Path $Staging "node_modules") -Recurse -Force
}

Write-Host "Copied files: $copied"
Write-Host "Compressing..."

if (Test-Path $ZipPath) {
  Remove-Item -Force $ZipPath
}

# tar 가 있으면 더 빠르고 안정적 (Windows 10+)
$tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if ($tar) {
  Push-Location $Staging
  try {
    & tar.exe -a -cf $ZipPath *
    if ($LASTEXITCODE -ne 0) { throw "tar failed with exit $LASTEXITCODE" }
  }
  finally {
    Pop-Location
  }
}
else {
  Compress-Archive -Path (Join-Path $Staging "*") -DestinationPath $ZipPath -Force
}

Remove-Item -Recurse -Force $Staging

$sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "Backup complete."
Write-Host "  File : $ZipPath"
Write-Host "  Size : $sizeMb MB"
Write-Host "  Env  : $(if ($IncludeEnv) { 'included' } else { 'excluded (.env)' })"
Write-Host "  Git  : $(if ($IncludeGit) { 'included' } else { 'excluded (.git)' })"
