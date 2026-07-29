#!/usr/bin/env bash
# 빈 PostgreSQL volume에 migration 적용 검증 (플랫폼 중립)
# 사용: bash scripts/test-migration-empty-volume.sh  (npm run test:migration:sh)
# Windows 전용 동등 스크립트: test-migration-empty-volume.ps1
# 요구: docker / docker compose
set -euo pipefail

PROJECT="${MIGRATION_TEST_PROJECT:-crawler-migtest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.migration-test.yml"

compose() {
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT" "$@"
}

cleanup() {
  echo "==> Cleanup"
  compose down -v --remove-orphans >/dev/null 2>&1 || true
}

echo "==> Migration empty-volume test (project=$PROJECT)"
cleanup
trap cleanup EXIT

echo "==> Build + migrate + verify"
if ! compose run --rm --build verify; then
  # 컨테이너가 cleanup 으로 사라지기 전에 원인을 남긴다
  echo "==> FAILED: migrate/verify container logs follow"
  compose logs --no-color migrate || true
  compose logs --no-color postgres || true
  exit 1
fi

echo "==> PASSED"
