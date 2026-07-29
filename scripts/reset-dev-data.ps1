#Requires -Version 5.1
<#
.SYNOPSIS
  로컬/개발 검색 테스트 데이터를 초기화합니다.

.DESCRIPTION
  - Postgres: investigation / search_jobs / 이력·매물·키워드 truncate
  - Elasticsearch: crawler_results 인덱스 삭제 (있으면)
  - Redis: search:* 키 삭제
  crawler_site, AI 규칙/프롬프트는 유지합니다.
  production 환경에서는 실행을 거부합니다.

.EXAMPLE
  .\scripts\reset-dev-data.ps1

.EXAMPLE
  .\scripts\reset-dev-data.ps1 -Force
#>
[CmdletBinding()]
param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

function Read-DotEnv {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if (
      ($val.StartsWith('"') -and $val.EndsWith('"')) -or
      ($val.StartsWith("'") -and $val.EndsWith("'"))
    ) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  return $map
}

$envMap = Read-DotEnv (Join-Path $Root ".env")
function EnvOr([string]$Key, [string]$Default) {
  if ($env:$Key) { return $env:$Key }
  if ($envMap.ContainsKey($Key) -and $envMap[$Key]) { return $envMap[$Key] }
  return $Default
}

$nodeEnv = EnvOr "NODE_ENV" "development"
if ($nodeEnv -eq "production") {
  throw "Refusing to reset data when NODE_ENV=production"
}

$dbHost = EnvOr "DB_HOST" "127.0.0.1"
$dbPort = EnvOr "DB_PORT" "5432"
$dbUser = EnvOr "DB_USER" "crawler"
$dbPassword = EnvOr "DB_PASSWORD" "crawler"
$dbName = EnvOr "DB_NAME" "search_crawler"
$redisHost = EnvOr "REDIS_HOST" "127.0.0.1"
$redisPort = EnvOr "REDIS_PORT" "6379"
$redisPassword = EnvOr "REDIS_PASSWORD" ""
$elasticNode = (EnvOr "ELASTIC_NODE" "http://127.0.0.1:9200").TrimEnd("/")
$elasticIndex = EnvOr "ELASTIC_INDEX" "crawler_results"

Write-Host "==> reset-dev-data" -ForegroundColor Cyan
Write-Host "    DB      ${dbHost}:${dbPort}/${dbName}" -ForegroundColor DarkGray
Write-Host "    Redis   ${redisHost}:${redisPort}" -ForegroundColor DarkGray
Write-Host "    Elastic ${elasticNode}/${elasticIndex}" -ForegroundColor DarkGray
Write-Host ""

if (-not $Force) {
  $answer = Read-Host "Wipe search/test data? Type YES to continue"
  if ($answer -ne "YES") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 1
  }
}

$sql = @"
TRUNCATE TABLE
  investigation_cases,
  search_jobs,
  search_history_results,
  image_hash,
  crawler_result,
  search_history,
  search_keyword
RESTART IDENTITY CASCADE;
"@

Write-Host "==> Postgres truncate" -ForegroundColor Cyan
$env:PGPASSWORD = $dbPassword
$psql = Get-Command psql -ErrorAction SilentlyContinue
if ($psql) {
  & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -c $sql
  if ($LASTEXITCODE -ne 0) { throw "psql truncate failed" }
} else {
  Write-Host "    psql not found; using docker compose exec postgres" -ForegroundColor DarkGray
  docker compose exec -T postgres `
    psql -U $dbUser -d $dbName -v ON_ERROR_STOP=1 -c $sql
  if ($LASTEXITCODE -ne 0) { throw "docker postgres truncate failed" }
}

Write-Host "==> Elasticsearch index delete" -ForegroundColor Cyan
try {
  $esRes = Invoke-WebRequest -Uri "$elasticNode/$elasticIndex" -Method DELETE -UseBasicParsing -TimeoutSec 10
  Write-Host "    deleted index (HTTP $($esRes.StatusCode))" -ForegroundColor DarkGray
} catch {
  $code = $null
  if ($_.Exception.Response) {
    $code = [int]$_.Exception.Response.StatusCode
  }
  if ($code -eq 404) {
    Write-Host "    index not found (ok)" -ForegroundColor DarkGray
  } else {
    Write-Host "    skip ES wipe: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Write-Host "==> Redis search:* keys" -ForegroundColor Cyan
$redisCli = Get-Command redis-cli -ErrorAction SilentlyContinue
$deleted = 0
if ($redisCli) {
  $authArgs = @()
  if ($redisPassword) { $authArgs = @("-a", $redisPassword) }
  $cursor = "0"
  do {
    $scanOut = & redis-cli -h $redisHost -p $redisPort @authArgs --raw SCAN $cursor MATCH "search:*" COUNT 100
    if (-not $scanOut) { break }
    $lines = @($scanOut)
    $cursor = $lines[0]
    for ($i = 1; $i -lt $lines.Count; $i++) {
      $key = $lines[$i]
      if (-not $key) { continue }
      & redis-cli -h $redisHost -p $redisPort @authArgs DEL $key | Out-Null
      $deleted++
    }
  } while ($cursor -ne "0")
} else {
  Write-Host "    redis-cli not found; using docker compose exec redis" -ForegroundColor DarkGray
  $cursor = "0"
  do {
    $scanOut = docker compose exec -T redis redis-cli --raw SCAN $cursor MATCH "search:*" COUNT 100
    if ($LASTEXITCODE -ne 0) { throw "redis SCAN failed" }
    $lines = @($scanOut | Where-Object { $_ -ne $null })
    if ($lines.Count -eq 0) { break }
    $cursor = [string]$lines[0]
    for ($i = 1; $i -lt $lines.Count; $i++) {
      $key = [string]$lines[$i]
      if (-not $key) { continue }
      docker compose exec -T redis redis-cli DEL $key | Out-Null
      $deleted++
    }
  } while ($cursor -ne "0")
}
Write-Host "    deleted $deleted redis key(s)" -ForegroundColor DarkGray

Write-Host ""
Write-Host "Done. Search/test data cleared. crawler_site and AI configs kept." -ForegroundColor Green
