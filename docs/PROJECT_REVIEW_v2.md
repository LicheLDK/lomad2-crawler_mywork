# PROJECT REVIEW v2

작성일: 2026-07-27  
대상: Search Crawler Server (`NestJS + BullMQ + PostgreSQL + Elasticsearch + React`)

## 1. 요약

이 프로젝트는 렌탈/백오피스 주문 정보를 기준으로 중고거래 사이트의 재판매 의심 매물을 검색하고, AI 점수와 Rule Engine을 통해 Investigation Case를 자동 생성하는 시스템이다.

1차 리뷰(`PROJECT_REVIEW.md`)에서 지적된 운영 DB migration, 검색 이력 보존, 이미지 다운로드 보안, 운영 secret 검증, Compose 포트 제한, 회귀 테스트 항목은 상당 부분 반영된 상태다.

현재 기준으로는 단순 크롤러가 아니라 다음 성격의 통합 업무 시스템에 가깝다.

- BackOffice 주문 연동 기반 Search Job
- 사이트별 Adapter 기반 크롤링
- Redis/BullMQ 기반 비동기 작업 처리
- PostgreSQL 원장 + Elasticsearch 캐시/검색 인덱스
- 이미지 저장 및 이미지 hash 유사도 계산
- AI Matching / Investigation Analysis / Recommendation
- React 대시보드와 Socket.IO 진행률 표시

검증 결과도 양호하다.

| 항목 | 결과 |
|------|------|
| 백엔드 테스트 | `npm.cmd test -- --runInBand` 통과, 8 suites / 52 tests |
| 백엔드 빌드 | `npm.cmd run build` 통과 |
| 프론트 빌드 | `npm.cmd run web:build` 통과 |
| 프론트 빌드 경고 | Vite chunk size 500KB 초과 경고 있음 |

## 2. 현재 아키텍처

```text
BackOffice / Dashboard
        │
        │ REST / Socket.IO
        ▼
NestJS API
        │
        ├── SearchJobService
        │       └── RentalService → BackOffice Rental API
        │
        ├── SearchService
        │       ├── Elasticsearch cache lookup
        │       └── BullMQ enqueue
        │
        ├── InvestigationService
        │       ├── AI Matching / Analysis / Recommendation
        │       └── Rule Engine
        │
        ▼
Redis / BullMQ
        │
        ▼
NestJS Worker
        │
        ▼
CrawlerService
        │
        ├── JoonggonaraAdapter
        ├── BungaeAdapter
        └── KarrotAdapter
        │
        ▼
PostgreSQL + Elasticsearch + Image Storage
```

## 3. 주요 모듈 역할

| 영역 | 주요 파일 | 역할 |
|------|-----------|------|
| 앱 구성 | `src/app.module.ts`, `src/main.ts`, `src/worker.ts` | Nest 모듈 조립, API/Worker bootstrap |
| 검색 API | `src/modules/search/search.service.ts` | 캐시 조회, 검색 이력 생성, crawl queue 등록, 결과 조회 |
| Search Job | `src/modules/search-job/search-job.service.ts` | 주문번호 기반 작업 생성, 키워드 생성, 검색 실행, 완료 callback |
| 크롤러 | `src/crawler/crawler.service.ts` | 사이트 adapter 실행, 결과 저장, 이미지 hash, Elastic index |
| Adapter | `src/crawler/adapter/*` | 사이트별 검색 URL/파싱/정규화 |
| 조사 케이스 | `src/modules/investigation/investigation.service.ts` | AI score/Rule 기반 case 자동 생성 |
| AI Engine | `src/ai/*` | provider 추상화, prompt 관리, 비용 기록, matching/analysis/report |
| DB | `src/database/entities/*`, `src/database/migrations/*` | 엔티티, baseline migration, 후속 migration |
| 프론트 | `web/src/*` | 대시보드, 검색, 렌탈, 조사 케이스, 통계/시스템 화면 |
| 운영 | `docker-compose.yml`, `Dockerfile`, `ecosystem.config.js` | Docker/PM2 운영 구성 |

## 4. 1차 리뷰 이후 반영된 개선 사항

### 4.1 운영 DB migration 경로

운영 환경에서 TypeORM `synchronize`를 끄고, baseline migration과 Compose `migrate` 서비스를 통해 빈 PostgreSQL volume에서도 스키마가 생성되도록 보완되어 있다.

확인 파일:

- `src/database/migrations/1753587600000-BaselineSchema.ts`
- `src/database/migrations/1753601200000-SearchHistoryResults.ts`
- `src/database/data-source.ts`
- `docker-compose.yml`
- `docs/database_migrations.md`

### 4.2 검색 이력 보존

기존에는 같은 URL을 재검색하면 `crawler_result.searchHistoryId`가 새 검색 이력으로 갱신되어 과거 검색 상세가 변질될 수 있었다. 현재는 매물 마스터(`crawler_result`)와 검색 결과 스냅샷(`search_history_results`)을 분리해 이 문제를 해결했다.

현재 구조:

- `crawler_result`: URL 기준 최신 매물 마스터
- `search_history_results`: 검색 시점의 제목, 가격, 판매자, 지역, 이미지 URL, 유사도 스냅샷
- `crawler_result.searchHistoryId`: last-seen 참고용

### 4.3 이미지 다운로드 보안

`ImageStorageService`에 SSRF 방어, 용량 제한, Content-Type 검증, redirect hop 검증, Sharp decode 검증이 추가되어 있다.

확인 파일:

- `src/storage/image-storage.service.ts`
- `src/common/utils/safe-image-url.util.ts`
- `src/config/image.config.ts`
- `src/storage/image-storage.service.spec.ts`
- `src/common/utils/safe-image-url.util.spec.ts`

### 4.4 운영 secret 검증

`NODE_ENV=production`에서 예제 API key/JWT secret 또는 짧은 secret으로 기동하지 못하도록 검증한다.

확인 파일:

- `src/config/validate-production-secrets.ts`
- `src/config/validate-production-secrets.spec.ts`
- `src/main.ts`
- `src/worker.ts`

### 4.5 회귀 테스트

핵심 리스크 중심 테스트가 추가되어 있다.

| 범위 | 테스트 |
|------|--------|
| 검색 이력 스냅샷 | `crawler-history-snapshot.spec.ts` |
| Adapter 정규화 | `adapter-normalize.spec.ts` |
| Search Job 상태 | `search-job-status.util.spec.ts` |
| 이미지 보안 | `safe-image-url.util.spec.ts`, `image-storage.service.spec.ts` |
| API key | `api-key.guard.spec.ts` |
| 운영 secret | `validate-production-secrets.spec.ts` |

## 5. 현재 남은 문제점

### P1. Search Job의 다중 키워드 처리 집계가 약하다

`SearchJobService.runSearch()`는 여러 키워드를 순차 실행하지만, crawl이 비동기로 큐에 들어가는 경우 첫 번째 pending history 중심으로 감시한다. 여러 키워드가 모두 cache miss라면 실제로는 여러 crawl job이 생성될 수 있는데, Search Job의 최종 `resultCount`, `searchHistoryId`, Investigation 생성 기준이 대표 history에 치우칠 수 있다.

영향:

- Search Job 상세에서 일부 키워드 결과가 누락되어 보일 수 있음
- BackOffice callback의 investigation count와 실제 생성 case 사이에 차이가 생길 수 있음
- 다중 키워드 검색의 성공/실패 판단이 불명확해질 수 있음

권장 보완:

1. `SearchJob`과 `SearchHistory`를 1:N으로 연결하는 별도 테이블을 둔다.
2. 각 keyword별 `searchHistoryId`, status, resultCount를 저장한다.
3. Search Job 완료 판단은 모든 search history가 terminal 상태가 되었을 때 수행한다.
4. Investigation 생성도 대표 history가 아니라 Job 전체 결과를 대상으로 수행한다.

### P1. AI provider 구현 상태가 문서보다 제한적이다

AI Engine 구조는 provider 교체가 가능하게 설계되어 있지만, 문서상 OpenAI Text는 실구현이고 Anthropic/Gemini Text 및 Vision 계열은 확장 포인트 성격이 강하다.

영향:

- `AI_PROVIDER=anthropic` 또는 `gemini` 설정 시 실제 운영 기대와 다를 수 있음
- Vision/OCR 기반 정확도 개선 로드맵이 아직 완결되지 않음
- AI score가 title/image heuristic 또는 text matching에 의존하는 구간이 남음

권장 보완:

1. provider별 `isConfigured()`와 실제 호출 구현 상태를 API나 health에 노출한다.
2. 미구현 provider 선택 시 bootstrap 단계에서 명확히 실패하거나 degraded 상태를 표시한다.
3. Vision provider 실구현 여부를 문서와 `.env.example`에 명확히 구분한다.
4. AI 기능별 fallback 정책을 정리한다.

### P1. 운영 관측성이 아직 최소 수준이다

현재 health check, AI usage, queue count 조회는 있으나 운영 장애 분석을 위한 지표 체계는 아직 제한적이다.

부족한 지표:

- 사이트별 crawl 성공/실패율
- 사이트별 평균 응답 시간
- Adapter parse 실패율
- BullMQ retry/exhausted job 추적
- 이미지 다운로드 실패 사유별 집계
- AI provider별 latency/error/cost 추세
- BackOffice callback 실패율

권장 보완:

1. `crawler_site_metrics` 또는 시계열 로그 집계를 추가한다.
2. crawl 결과에 `errorCode`, `adapterVersion`, `responseStatus` 같은 원인 필드를 남긴다.
3. `/api/stats`에 운영용 핵심 지표를 추가한다.
4. PM2/Docker 로그만 보지 않아도 장애 원인이 보이도록 dashboard를 보강한다.

### P1. 크롤링 정책과 법적/운영 기준이 코드 밖에 명확히 고정되어 있지 않다

이 시스템은 중고거래 사이트를 대상으로 검색/수집을 수행한다. 요청 속도 제한과 공개 정보만 수집한다는 방향은 문서에 있지만, 사이트별 허용 범위와 차단 대응 정책은 운영 절차로 더 명확히 남겨야 한다.

권장 보완:

1. 사이트별 robots.txt/약관 검토 결과를 문서화한다.
2. 수집 필드 정책을 명확히 한다. 예: 연락처/개인정보 저장 금지, 공개 매물 정보만 저장.
3. 차단 발생 시 proxy를 무조건 늘리는 방식이 아니라 중단/감속/검토 절차를 둔다.
4. `CRAWLER_REQUEST_DELAY_MS`, `CRAWL_CONCURRENCY` 운영 기준값을 사이트별로 분리한다.

### P2. 프론트 번들 크기 경고

`npm.cmd run web:build`는 통과하지만 Vite가 500KB 초과 chunk 경고를 낸다. 현재 JS bundle은 약 784KB다.

영향:

- 초기 로딩이 느려질 수 있음
- 대시보드 기능이 늘수록 악화될 가능성이 큼

권장 보완:

1. route 단위 `React.lazy()` 적용
2. Recharts, Investigation, Rental 화면을 별도 chunk로 분리
3. Vite `manualChunks` 설정 검토
4. 실제 운영 nginx gzip/brotli 압축 확인

### P2. 문서 인코딩/문서 중복 정리 필요

코드는 빌드되지만, 일부 문서는 Windows 콘솔 또는 잘못된 encoding 경로에서 mojibake처럼 보일 수 있다. 또한 `docs/` 안에 설계 문서, 최종 문서, 리팩토링 문서가 여러 버전으로 존재한다.

권장 보완:

1. 모든 문서를 UTF-8 without BOM 기준으로 통일한다.
2. 최신 문서와 과거 문서를 구분한다.
3. `README.md`는 운영/개발 quick start 중심으로 간결화한다.
4. 상세 설계는 `docs/architecture/`, 운영 절차는 `docs/ops/`, 리뷰 문서는 `docs/reviews/`처럼 분리한다.

### P2. API 보안 적용 방식이 컨트롤러별이다

주요 API에는 `ApiKeyGuard`가 붙어 있고 `/api/health`는 공개다. 현재 구조는 의도적으로 보이지만, 신규 컨트롤러 추가 시 guard 누락 가능성이 있다.

권장 보완:

1. 기본은 전역 API key guard로 전환하고, `@Public()` decorator로 health/docs만 제외한다.
2. Swagger docs 접근 정책을 운영 환경에서 별도로 정한다.
3. API key를 프론트 localStorage에 저장하는 운영 모델이 적절한지 재검토한다.

## 6. 수정/보완 우선순위

### 우선순위 A: 운영 정확성

1. Search Job과 Search History의 1:N 관계 명시
2. 다중 키워드 crawl 완료 감시 로직 개선
3. Job 단위 result/investigation 집계 정확도 보강
4. BackOffice callback payload에 keyword별 요약 또는 대표 결과 기준 명시

### 우선순위 B: 운영 관측성

1. 사이트별 crawl 성공/실패/latency 집계
2. Adapter parse 실패 원인 기록
3. queue retry/exhausted job dashboard 노출
4. AI usage/cost 화면과 System 화면 연결 강화
5. callback 실패 재시도 및 재전송 API 추가

### 우선순위 C: AI 정확도

1. AI provider 구현 상태 명확화
2. Vision similarity 실제 구현 또는 명시적 비활성화 표시
3. OCR 결과를 matching 점수에 반영
4. rule threshold 튜닝 UI 또는 운영 설정 API 제공
5. false positive/false negative 피드백을 rule/AI prompt 개선에 반영

### 우선순위 D: 프론트/사용성

1. route 단위 code splitting
2. Investigation case 상태 변경 기능 보강
3. 담당자/메모/최종 판단 저장 API 추가
4. 검색 결과와 Investigation 간 이동 동선 개선
5. 에러 메시지의 한글 사용자 문구 정리

### 우선순위 E: 문서/운영 절차

1. README, 배포 문서, architecture 문서 최신화
2. 운영 checklist 작성
3. 장애 대응 runbook 작성
4. 사이트별 adapter 유지보수 가이드 작성
5. 개인정보/크롤링 정책 문서화

## 7. 향후 추가 기능 제안

### 7.1 Investigation 워크플로우 고도화

- case 상태 전이: `Open → Reviewing → Confirmed / False Positive / Closed`
- 담당자 배정
- 내부 메모
- 증거 고정 기능
- 최종 판단과 AI 추천 분리 저장
- BackOffice로 최종 판단 callback

### 7.2 검색 품질 개선

- 브랜드/모델/색상/옵션별 keyword weight 적용
- 중복 매물 cluster 처리
- 판매자/지역 기반 risk scoring
- 렌탈 시작일 이후 등록 매물 우선순위
- 품절/삭제/거래완료 상태 추적

### 7.3 이미지/비전 강화

- 단순 average hash 외 perceptual hash 고도화
- CLIP/image embedding 기반 유사도
- OCR로 이미지 내 상품명/연락처/워터마크 추출
- 같은 이미지 재사용 탐지
- 이미지 다운로드 실패 시 원격 URL 기반 Vision fallback

### 7.4 운영 자동화

- 사이트 adapter health probe
- 차단 감지 시 자동 감속
- queue backlog 알림
- AI 비용 일일 한도
- callback 실패 알림
- 오래된 이미지/Elastic index retention 정책

### 7.5 데이터 관리

- 검색 이력 retention 정책
- 이미지 storage quota 및 cleanup job
- Elasticsearch reindex 스크립트
- DB backup/restore 문서
- 민감 정보 마스킹 및 usage log 보존 기간 설정

## 8. 검증 기준 제안

다음 작업부터는 기능 완료 기준을 아래처럼 잡는 것이 좋다.

| 변경 유형 | 최소 검증 |
|-----------|-----------|
| Entity/migration 변경 | `npm.cmd run build`, `npm.cmd run migration:show`, 빈 DB migration 테스트 |
| Search/Crawler 변경 | 관련 unit test + 실제 adapter probe |
| Search Job 변경 | 다중 키워드 통합 테스트 |
| Investigation 변경 | auto create threshold/rule 테스트 |
| AI 변경 | provider 미설정/실패 fallback 테스트, usage log 테스트 |
| Frontend 변경 | `npm.cmd run web:build`, 주요 화면 수동 확인 |
| Docker/운영 변경 | `docker compose up -d --build`, health/dashboard 확인 |

## 9. 결론

현재 프로젝트는 1차 리뷰에서 지적된 핵심 운영 리스크를 대부분 해소했고, 테스트/빌드 기준으로도 안정적인 상태다.

다음 단계의 핵심은 새 기능을 무리하게 붙이는 것보다 **Search Job 단위 정확성**, **운영 관측성**, **AI provider/vision 구현 상태 명확화**, **Investigation 업무 흐름 완성**이다.

특히 다중 키워드 Search Job 집계 구조는 백오피스 연동과 Investigation 자동 생성의 기준점이므로 가장 먼저 정리하는 것이 좋다.
