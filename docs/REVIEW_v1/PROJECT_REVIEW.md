# 프로젝트 점검 결과 및 운영 개선 우선순위

작성일: 2026-07-26  
대상: Search Crawler Server (`NestJS + BullMQ + PostgreSQL + Elasticsearch + Playwright + React`)

## 요약

이 프로젝트는 렌탈 상품이 중고거래 사이트에 재판매되었는지 탐지하는 시스템이다. API와 크롤러 워커를 분리하고, Redis 큐·PostgreSQL·Elasticsearch·React 대시보드를 조합한 구조는 확장하기 좋다.

다만 현재 Docker 기반 운영을 전제로 하면, **신규 운영 DB를 안전하게 생성하는 절차**와 **검색 이력 보존 방식**을 먼저 정리해야 한다. 또한 외부 이미지 다운로드와 기본 비밀값은 배포 전에 보완이 필요하다.

## 현재 구성

```text
React Dashboard
      │ REST / Socket.IO
NestJS API ── Redis/BullMQ ── NestJS Worker ── Playwright/HTTP Adapter
      │                         │
PostgreSQL                 Elasticsearch
      │
이미지 저장소 (Docker volume)
```

- Docker Compose가 PostgreSQL, Redis, Elasticsearch, API, Worker를 구성한다.
- API와 Worker는 동일한 애플리케이션 모듈을 사용하고 `ENABLE_WORKER` 값으로 워커 프로세서 등록을 제어한다.
- PostgreSQL 데이터, Elasticsearch 데이터, 수집 이미지는 Docker named volume에 보존된다.

## 우선 해결 항목

### P0. 운영 DB 초기화/스키마 변경 경로 없음

#### 현황

- 애플리케이션은 운영 환경에서 TypeORM `synchronize`를 비활성화한다.
- ~~마이그레이션 파일이 없고 Compose에 실행 단계가 없었다.~~

> **조치 (2026-07-27):** baseline migration + Compose `migrate` 서비스 추가.  
> 상세: [`database_migrations.md`](./database_migrations.md)  
> - `src/database/migrations/1753587600000-BaselineSchema.ts`  
> - `docker-compose.yml` → `migrate` 후 API/Worker 기동  
> - 기존 synchronize DB: `npm run migration:baseline:mark`

따라서 ~~비어 있는 PostgreSQL volume으로 운영 환경을 처음 기동하면 테이블이 생성되지 않아~~ 빈 volume에서는 `migrate` 서비스가 baseline을 적용한다. 이미 개발 환경에서 `synchronize`로 생성된 DB는 `migration:baseline:mark`로 기록만 남긴다.

#### Docker 환경에서의 권장 방향

1. 현재 엔티티를 기준으로 첫 번째 baseline migration을 생성한다.
2. 이후 엔티티 변경마다 migration을 생성해 저장소에 함께 커밋한다.
3. Compose에 일회성 `migrate` 서비스를 추가하거나, 배포 파이프라인에서 `migration:run`을 API/Worker 기동보다 먼저 실행한다.
4. API와 Worker는 migration 완료 후에만 시작하도록 의존성을 둔다.
5. 운영 DB에는 `synchronize: true`를 사용하지 않는다.

#### 확인 대상

- `src/database/database.module.ts`: 운영 환경의 `synchronize` 비활성화
- `src/database/data-source.ts`: migration 경로 선언
- `Dockerfile`, `docker-compose.yml`: migration 실행 단계 부재

### P0. 재검색 시 과거 검색 이력이 변경될 수 있음

#### 현황

~~`crawler_result.url`은 전역 unique이며, 이미 존재하는 URL을 다시 찾으면 기존 결과의 `searchHistoryId`를 새 검색 이력으로 갱신한다.~~

> **조치 (2026-07-27):** 매물 마스터(`crawler_result`)와 검색 스냅샷(`search_history_results`) 분리.  
> - 엔티티: `src/database/entities/search-history-result.entity.ts`  
> - migration: `src/database/migrations/1753601200000-SearchHistoryResults.ts` (기존 행 백필 포함)  
> - 크롤 저장: listing은 URL unique로 upsert, 검색 소속은 `(searchHistoryId, resultId)` 스냅샷으로 보존  
> - 조회/Investigation: `search_history_results` 기준  
> - `crawler_result.searchHistoryId`는 last-seen 참고용만 사용

과거에는 아래처럼 검색 A의 결과가 재검색 B에 의해 유실될 수 있었다.

```text
검색 A → URL X 저장 (X → A)
검색 B → 같은 URL X 발견
이전 구현 → X의 연결을 B로 변경 (X → B)
결과 → 검색 A 상세에서 X가 사라짐
```

#### 권장 방향

둘 중 하나를 명확히 선택한다.

1. **권장(적용됨): 매물 마스터와 검색 결과 스냅샷 분리**
   - `listing`(URL 기준의 최신 매물) 테이블을 전역 unique로 유지한다.
   - `search_history_results` 테이블로 검색 이력과 매물을 N:M으로 연결한다.
   - 검색 당시의 제목·가격·유사도·이미지 URL 등은 스냅샷으로 보존한다.

2. 검색 이력마다 결과 행을 별도로 생성한다.
   - URL 전역 unique 제약을 제거하고 `(search_history_id, url)` unique 제약으로 바꾼다.
   - 구현은 단순하지만 같은 매물 데이터가 중복 저장된다.

#### 확인 대상

- `src/database/entities/crawler-result.entity.ts`: URL 전역 unique 제약
- `src/crawler/crawler.service.ts`: 스냅샷 upsert
- `src/modules/search/search.service.ts` / `investigation.service.ts`: junction 조회
### P1. 외부 이미지 다운로드의 SSRF 및 메모리/디스크 고갈 위험

#### 현황

~~사용자가 전달하는 `referenceImageUrl`과 크롤러가 수집한 `imageUrl`을 서버가 직접 `fetch`한다. 현재는 다음 방어가 없다.~~

> **조치 (2026-07-27):** `ImageStorageService`에 SSRF·용량·형식 가드 적용.  
> - 유틸: `src/common/utils/safe-image-url.util.ts` (프로토콜/호스트 allowlist/DNS 후 사설·메타데이터 IP 차단)  
> - 설정: `src/config/image.config.ts` (`IMAGE_MAX_BYTES`, `IMAGE_ALLOW_HTTP`, `IMAGE_DOWNLOAD_ALLOW_HOSTS` 등)  
> - 다운로드: 수동 리다이렉트 + 각 hop 재검증, Content-Type/`Content-Length` 검사, 스트리밍 바이트 상한, Sharp 디코드 검증  
> - 단위 테스트: `safe-image-url.util.spec.ts`

과거에는 다음 방어가 없었다.

- 사설망·loopback·link-local IP 주소 차단
- HTTP/HTTPS 프로토콜 제한 및 허용 도메인 정책
- 리다이렉트 목적지 검증
- `Content-Type` 이미지 검증
- 응답 본문 최대 크기 제한

응답 전체를 `arrayBuffer()`로 메모리에 올린 후 파일로 저장하므로, 대용량 응답은 메모리와 이미지 Docker volume을 빠르게 소진시킬 수 있었다.

#### 권장 방향

1. ~~URL을 `https:` 중심으로 제한하고, 사용자 입력 URL은 허용 도메인 목록 또는 엄격한 네트워크 주소 검증을 적용한다.~~ ✅
2. ~~DNS 해석 후 loopback, RFC1918 사설 IP, link-local, metadata endpoint를 차단한다.~~ ✅
3. ~~리다이렉트를 수동 처리하고 각 이동마다 같은 검증을 적용한다.~~ ✅
4. ~~`Content-Type: image/*` 및 최대 바이트 크기를 확인한다.~~ ✅
5. ~~스트리밍 방식으로 저장하고, 저장 전 Sharp 등으로 실제 이미지인지 검증한다.~~ ✅

#### 확인 대상

- `src/storage/image-storage.service.ts`
- `src/common/utils/safe-image-url.util.ts`
- `src/config/image.config.ts`

### P1. 기본 API 키 및 JWT 비밀값 허용

#### 현황

~~`.env`가 존재하지만 현재 `API_KEY`와 `JWT_SECRET`은 예제 기본값으로 설정되어 있다. 애플리케이션도 환경변수가 없으면 같은 기본값으로 동작한다.~~

> **조치 (2026-07-27):** `NODE_ENV=production`이면 예제/짧은 비밀값으로 기동 거부.  
> - `src/config/validate-production-secrets.ts` (`main.ts` / `worker.ts` bootstrap)  
> - 개발(`development`)은 `change-me-*` 예제값 계속 허용  
> - 운영: `API_KEY`/`JWT_SECRET` 각각 24자 이상, `change-me` 접두 금지, 서로 다른 값  
> - 단위 테스트: `validate-production-secrets.spec.ts`

```env
# 로컬 OK
NODE_ENV=development
API_KEY=change-me-api-key
JWT_SECRET=change-me-jwt-secret

# 운영 필수 (예)
NODE_ENV=production
API_KEY=<24자+ 무작위>
JWT_SECRET=<다른 24자+ 무작위>
```

외부에서 API 포트에 접근할 수 있다면 알려진 API 키로 요청할 수 있다. Docker Compose의 PostgreSQL 계정도 기본값을 사용하므로, 개발용 Compose를 외부에 그대로 노출해서는 안 된다.

#### 권장 방향

1. ~~운영용 `.env` 또는 Secret Manager에서 충분히 긴 무작위 API 키와 JWT 비밀값을 주입한다.~~ ✅ (운영 배포 시 주입 필요)
2. ~~`NODE_ENV=production`일 때 비어 있거나 예제값인 `API_KEY`/`JWT_SECRET`이면 애플리케이션이 즉시 실패하도록 검증한다.~~ ✅
3. DB/Redis/Elasticsearch 포트는 ~~개발 PC 외부에 노출할 필요가 없다면 Compose `ports`를 제거하거나 방화벽으로 제한한다.~~ ✅ `127.0.0.1` 바인딩
4. Elasticsearch는 현재 보안 기능이 꺼져 있으므로 외부 네트워크에 직접 노출하지 않는다. ✅ (loopback only)

#### 확인 대상

- `src/config/validate-production-secrets.ts`
- `src/config/app.config.ts`
- `.env.example`
- `docker-compose.yml`

## 추가 권장 항목

### P2. 테스트 부재

~~자동 테스트 파일을 확인하지 못했다.~~

> **조치 (2026-07-27):** 회귀 단위 테스트 추가 (`npm test`).  
> | 범위 | 파일 |
> |------|------|
> | 검색 스냅샷 보존 | `crawler-history-snapshot.spec.ts` |
> | 큐 상태 전이 | `search-job-status.util.spec.ts` |
> | 어댑터 정규화 | `adapter-normalize.spec.ts` |
> | 이미지 SSRF/크기 | `safe-image-url.util.spec.ts`, `image-storage.service.spec.ts` |
> | API 키 / 운영 secrets | `api-key.guard.spec.ts`, `validate-production-secrets.spec.ts` |
> | 빈 volume migration | `npm run test:migration` (`docker-compose.migration-test.yml`) |

우선 다음 범위를 대상으로 단위/통합 테스트를 추가하는 것이 좋다.

- ~~검색 결과 저장 및 재검색 시 이력 보존~~ ✅
- ~~큐 작업 상태 전이: queued → running → completed/partial/failed~~ ✅
- ~~사이트 어댑터의 파싱 결과 정규화~~ ✅
- ~~이미지 URL 검증 및 크기 제한~~ ✅
- ~~API 키 검증과 운영 환경 설정 검증~~ ✅
- ~~DB migration을 빈 volume에 적용하는 Docker 통합 테스트~~ ✅

### P2. 프런트엔드 빌드 환경 확인

~~점검 시점에는 `web/node_modules`가 없어…~~

> **조치 (2026-07-27):**  
> - 로컬 검증: `npm run web:build:check`  
> - Compose `dashboard` 서비스 추가 (nginx, `127.0.0.1:8080`)  
> - `/api`·`/socket.io` → `crawler-api` 프록시 (`web/nginx.conf`)  
> - CORS에 `8080` 허용

```powershell
npm run web:build:check
docker compose up -d --build dashboard
# 대시보드: http://127.0.0.1:8080
```

### P1 잔여. Compose 포트 노출

> **조치 (2026-07-27):** Postgres / Redis / Elastic / API / Dashboard 포트를 `127.0.0.1`에만 바인딩.  
> DB 계정은 `${DB_USER}` / `${DB_PASSWORD}` / `${DB_NAME}` 로 `.env`와 연동 (기본값 `crawler`).

## 권장 실행 순서

1. ~~운영용 API 키·JWT 비밀값 가드~~ ✅. ~~Compose 포트 loopback 제한~~ ✅. DB 비밀번호는 운영 `.env`에서 교체.
2. ~~baseline migration~~ ✅
3. ~~검색 이력 스냅샷~~ ✅
4. ~~이미지 SSRF/크기~~ ✅
5. ~~회귀 테스트~~ ✅ (`npm test` + `npm run test:migration`)
6. ~~프론트 빌드·Compose dashboard~~ ✅

## 결론

Docker로 DB와 관련 인프라를 구성하는 현재 방식은 적절하다.  
**migration**·**검색 이력 스냅샷**·**이미지 SSRF 가드**·**운영 secrets 검증**·**회귀 테스트**·**Compose loopback 포트/대시보드**까지 리뷰 P0–P2 항목을 반영했다.  
운영 배포 시에는 `.env`의 `API_KEY`/`JWT_SECRET`/`DB_PASSWORD`를 예제값이 아닌 실값으로 교체하면 된다.
