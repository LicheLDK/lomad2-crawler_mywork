# Database Migrations

## 개요

운영(`NODE_ENV=production`)에서는 TypeORM `synchronize`가 **꺼져 있습니다**.  
스키마는 **migration**으로만 생성·변경합니다.

| 환경 | synchronize | 스키마 적용 |
|------|-------------|-------------|
| development | on (기본) | 앱 기동 시 자동 (편의) |
| production / Docker | off | `migrate` 서비스 또는 `migration:run` |

## 명령

```powershell
# 대기 중인 migration 적용 (개발)
npm run migration:run

# 적용 상태 확인
npm run migration:show

# 운영/빌드 산출물 기준
npm run build
npm run migration:run:prod

# 이미 synchronize 로 테이블이 있는 DB → baseline 만 기록
npm run migration:baseline:mark
```

## Docker Compose

`migrate` 서비스가 API/Worker보다 먼저 실행됩니다.

```powershell
docker compose up -d --build
```

빈 `pgdata` volume이면 baseline migration이 전체 테이블을 생성합니다.

인프라 포트(Postgres/Redis/Elastic/API/Dashboard)는 **`127.0.0.1`에만 바인딩**됩니다.  
LAN에 노출하려면 compose의 `ports`를 `0.0.0.0`으로 바꾸되, Elastic 보안이 꺼져 있으므로 권장하지 않습니다.

### 빈 volume 통합 테스트

임시 프로젝트로 빈 DB에 migration → 필수 테이블 존재를 검증합니다.

```powershell
npm run test:migration
```

- Compose: `docker-compose.migration-test.yml`
- 검증 스크립트: `scripts/verify-migrated-schema.sh`

## 기존 개발 DB (이미 테이블 있음)

`migration:run` 은 `CREATE IF NOT EXISTS` 기반이라 대부분 안전하지만,  
FK/인덱스 이름 충돌을 피하려면 먼저:

```powershell
npm run migration:baseline:mark
```

## 새 migration 추가

1. 엔티티 수정
2. `npm run migration:generate -- src/database/migrations/DescribeChange`
3. 생성된 파일 검토 후 커밋
4. `npm run migration:run`

## Baseline

- 파일: `src/database/migrations/1753587600000-BaselineSchema.ts`
- 이름: `BaselineSchema1753587600000`

## 후속 migration

| 파일 | 내용 |
|------|------|
| `1753601200000-SearchHistoryResults.ts` | `search_history_results` 스냅샷 테이블 + 기존 `crawler_result` 백필 |
