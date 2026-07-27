# 빈 PostgreSQL volume에 migration 적용 검증
# 요구: Docker Desktop / docker compose
$ErrorActionPreference = 'Stop'
$Project = 'crawler-migtest'
$ComposeFile = Join-Path $PSScriptRoot '..\docker-compose.migration-test.yml'

Write-Host "==> Migration empty-volume test (project=$Project)"

docker compose -f $ComposeFile -p $Project down -v --remove-orphans 2>$null | Out-Null

try {
  Write-Host "==> Build + migrate + verify"
  docker compose -f $ComposeFile -p $Project run --rm --build verify
  if ($LASTEXITCODE -ne 0) {
    throw "verify failed with exit $LASTEXITCODE"
  }
  Write-Host "==> PASSED"
  exit 0
}
finally {
  Write-Host "==> Cleanup"
  docker compose -f $ComposeFile -p $Project down -v --remove-orphans | Out-Null
}
