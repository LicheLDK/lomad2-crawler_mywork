# PROJECT REVIEW v3

작성일: 2026-07-28  
대상: Search Crawler Server (`NestJS + BullMQ + PostgreSQL + Elasticsearch + React`)  
기준 커밋: `476f083` (UI 개선)  
선행 문서: `PROJECT_REVIEW.md` (1차), `PROJECT_REVIEW_v2.md` (2차)

---

## 1. 요약

v3는 `PROJECT_REVIEW_v2.md`의 모든 항목을 포괄하면서, 다음 두 가지를 추가한다.

1. **UI 개선 커밋(`476f083`) 검증 결과** — 메뉴 IA 리팩토링 9단계(STEP MENU-00~09)의 실제 반영 상태와 그 과정에서 새로 생긴 문제
2. **v2에 기재되지 않았던 신규 문제 발견** — 백엔드 AI 판단 경로의 실질적 무력화, 개발 기반(lint/CI) 부재, 프론트 Investigation의 목업 의존

v2의 결론("핵심 운영 리스크는 대부분 해소, 다음은 정확성·관측성·AI 명확화·조사 워크플로우")은 여전히 유효하다. 다만 v3에서 새로 확인한 사실은 **AI 판단 결과가 조사 케이스에 반영되지 않는 경로가 존재한다**는 점이며, 이는 v2의 우선순위 A(운영 정확성)보다 앞서 처리해야 한다.

### 1.1 실측 검증 결과 (Linux, `npm install` 직후)

v2는 Windows(`npm.cmd`) 기준이었다. v3는 Linux에서 재검증했다.

| 항목          | 명령                   | 결과                                            |
| ------------- | ---------------------- | ----------------------------------------------- |
| 백엔드 빌드   | `npm run build`        | 통과                                            |
| 백엔드 테스트 | `npx jest --runInBand` | 통과, **8 suites / 52 tests**                   |
| 프론트 빌드   | `npm run web:build`    | 통과 (`tsc --noEmit` + `vite build`)            |
| 프론트 번들   | —                      | **794.68 KB** (gzip 235.67 KB), 500KB 초과 경고 |
| 백엔드 lint   | `npm run lint`         | **실패 — `eslint: not found`**                  |
| CI            | —                      | **없음** (`.github/workflows` 부재)             |

v2 대비 변화: 번들이 784KB → 794.68KB로 증가(UI 개선 커밋 반영). 테스트/빌드는 동일하게 통과. **lint 실패와 CI 부재는 v2에 기재되지 않았던 신규 발견 사항이다.**

---

## 2. v2 항목 이관 상태 (Traceability)

v2의 모든 항목이 v3에서 어디로 이어지는지 명시한다.

| v2 위치    | 항목                         | v3 판정                             | v3 위치       |
| ---------- | ---------------------------- | ----------------------------------- | ------------- |
| v2 §2      | 아키텍처 구성도              | 유지 + 프론트 IA 추가               | §3            |
| v2 §3      | 주요 모듈 역할               | 유지 + 신규 파일 반영               | §4            |
| v2 §4.1    | 운영 DB migration            | 해소 유지                           | §5.1          |
| v2 §4.2    | 검색 이력 보존               | 해소 유지                           | §5.2          |
| v2 §4.3    | 이미지 다운로드 보안         | 해소 유지                           | §5.3          |
| v2 §4.4    | 운영 secret 검증             | 해소 유지 (범위 한계 신규 지적)     | §5.4, §7.2 N7 |
| v2 §4.5    | 회귀 테스트                  | 해소 유지 (커버리지 범위 신규 지적) | §5.5, §7.2 N5 |
| —          | UI 메뉴 IA 리팩토링          | **신규 반영**                       | §5.6          |
| v2 §5 P1-1 | 다중 키워드 집계 취약        | **해소** (TASK A-1~A-6, 2026-07-29) | §7.1 P1-A     |
| v2 §5 P1-2 | AI provider 구현 상태 제한적 | **미해소, 근거 보강**               | §7.1 P1-B     |
| v2 §5 P1-3 | 운영 관측성 최소 수준        | **해소** (TASK B-1~B-8, 2026-07-29) | §7.1 P1-C     |
| v2 §5 P1-4 | 크롤링 정책 미고정           | **미해소, 유효**                    | §7.1 P1-D     |
| v2 §5 P2-1 | 프론트 번들 크기             | **악화 (784→794KB)**                | §7.1 P2-A     |
| v2 §5 P2-2 | 문서 인코딩/중복             | **미해소, 대상 확대**               | §7.1 P2-B     |
| v2 §5 P2-3 | API 보안 컨트롤러별          | **미해소, 유효**                    | §7.1 P2-C     |
| v2 §6      | 수정 우선순위 A~E            | 재정렬 (우선순위 0 신설)            | §8            |
| v2 §7      | 향후 추가 기능 7.1~7.5       | 전체 포괄                           | §11           |
| v2 §8      | 검증 기준                    | 포괄 + Linux/CI 기준 추가           | §10           |
| v2 §9      | 결론                         | 갱신                                | §12           |

---

## 3. 현재 아키텍처

### 3.1 백엔드 (v2 유지)

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
        ├── JoonggonaraAdapter   (Playwright · DOM)
        ├── BungaeAdapter        (HTTP · JSON API)
        └── KarrotAdapter        (HTTP · JSON-LD)
        │
        ▼
PostgreSQL + Elasticsearch + Image Storage
```

API와 Worker는 **동일한 `AppModule`** 을 로드하고 `ENABLE_WORKER`로 분기한다.

| 컴포넌트                 | API (`ENABLE_WORKER=false`) | Worker (`true`)                                 |
| ------------------------ | --------------------------- | ----------------------------------------------- |
| `CrawlProcessor`         | 미등록                      | 등록 (`src/queue/queue.module.ts:31`)           |
| `CrawlProgressGateway`   | 등록                        | 미등록 (`src/progress/progress.module.ts:5-11`) |
| `CrawlProgressPublisher` | 등록                        | 등록                                            |
| REST 컨트롤러            | HTTP 기동                   | 컨텍스트만                                      |

### 3.2 프론트 IA (`476f083` 반영 · 신규)

```text
Dashboard (/)                      — OverviewPage (요약 전용)
Search
├── 상품 검색      (/search)        — 실제 검색 UI (구 `/`에서 이동)
├── 이미지 검색    (disabled)
├── 예약 검색      (disabled)
└── 검색 이력      (/history)
Rental
├── 계약 목록      (/rental?tab=contracts)
├── 자동 검색      (/rental?tab=auto)
└── 조사 이력      (/rental?tab=investigations)
Investigation
├── Open           (?status=Open)
├── Reviewing      (?status=Review)
├── Completed      (?status=Completed)
└── Archived       (?status=Archived)
Analytics
├── 검색 통계      (?section=search)
├── 사이트별 통계  (?section=sites)
├── AI 분석 통계   (?section=ai)
└── Investigation 통계 (?section=investigation)
System
└── Worker / Queue / API / Proxy / Scheduler / AI Engine / Prompt (?section=)
```

라우팅 정의는 `web/src/App.tsx:327-436`, 메뉴 단일 소스는 `web/src/config/navigation.ts:53-199`.

---

## 4. 주요 모듈 역할

| 영역        | 주요 파일                                                              | 역할                                                                      |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 앱 구성     | `src/app.module.ts`, `src/main.ts`, `src/worker.ts`                    | Nest 모듈 조립, API/Worker bootstrap, Swagger, 전역 Pipe/Filter/Throttler |
| 검색 API    | `src/modules/search/search.service.ts`                                 | 캐시 조회, 검색 이력 생성, crawl queue 등록, 결과 조회                    |
| Search Job  | `src/modules/search-job/search-job.service.ts`                         | 주문번호 기반 작업 생성, 키워드 생성, 검색 실행, 완료 callback            |
| 크롤러      | `src/crawler/crawler.service.ts`                                       | 사이트 adapter 실행, 결과 저장, 이미지 hash, Elastic index                |
| Adapter     | `src/crawler/adapter/*`                                                | 사이트별 검색 URL/파싱/정규화                                             |
| 조사 케이스 | `src/modules/investigation/investigation.service.ts`                   | AI score/Rule 기반 case 자동 생성                                         |
| AI Engine   | `src/ai/*`                                                             | provider 추상화, prompt 버전 관리, rule engine, 비용 기록                 |
| 진행률      | `src/progress/*`, `src/modules/search-job/search-job-progress.sync.ts` | Redis pub/sub → Socket.IO 브로드캐스트                                    |
| 외부 연동   | `src/api/rental.client.ts`, `rental.service.ts`                        | BackOffice 주문 조회 및 완료 callback                                     |
| DB          | `src/database/entities/*`, `src/database/migrations/*`                 | 엔티티, baseline migration, 후속 migration                                |
| 프론트 IA   | `web/src/config/navigation.ts`, `web/src/components/AppSidebar.tsx`    | **신규** 메뉴 단일 소스, accordion 사이드바                               |
| 프론트 화면 | `web/src/pages/*`, `web/src/features/investigation/*`                  | Overview, 검색, Rental, 조사 케이스, 통계, 시스템                         |
| 운영        | `docker-compose.yml`, `Dockerfile`, `ecosystem.config.js`              | Docker/PM2 운영 구성                                                      |

**규모**: 백엔드 TypeScript 138파일 약 13,220줄, 프론트 약 80파일, 문서 19개.

---

## 5. 반영된 개선 사항

### 5.1 운영 DB migration 경로 (v2 §4.1 유지)

운영에서 TypeORM `synchronize`를 끄고 baseline migration과 Compose `migrate` 서비스로 빈 volume에서도 스키마가 생성된다.

- `src/database/migrations/1753587600000-BaselineSchema.ts`
- `src/database/migrations/1753601200000-SearchHistoryResults.ts`
- `src/database/data-source.ts:49` — CLI는 `synchronize: false` 고정
- `src/database/database.module.ts:45` — Nest는 `app.env !== 'production'`일 때만 sync
- `docker-compose.yml:45-60` — `migrate` 원샷 서비스, `restart: "no"`
- `docker-compose.yml:80-88` — 앱은 `service_completed_successfully` 대기

앱 컨테이너가 스스로 마이그레이션을 돌리지 않는 올바른 패턴이다.

### 5.2 검색 이력 보존 (v2 §4.2 유지)

매물 마스터와 검색 시점 스냅샷을 분리했다.

| 테이블                           | 성격                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `crawler_result`                 | URL unique, 최신 매물 마스터                                                               |
| `search_history_results`         | `(searchHistoryId, resultId)` unique, 검색 시점 제목·가격·판매자·지역·이미지·유사도 스냅샷 |
| `crawler_result.searchHistoryId` | last-seen 참고용                                                                           |

회귀 테스트: `src/crawler/crawler-history-snapshot.spec.ts`.

### 5.3 이미지 다운로드 보안 (v2 §4.3 유지)

`ImageStorageService`에 SSRF 방어, 용량 제한, Content-Type 검증, redirect hop 검증, Sharp decode 검증이 있다.

- `src/storage/image-storage.service.ts`, `src/common/utils/safe-image-url.util.ts`, `src/config/image.config.ts`
- 테스트 2종으로 사설 IP 차단·크기 초과·Content-Type 차단이 검증된다.

### 5.4 운영 secret 검증 (v2 §4.4 유지)

`NODE_ENV=production`에서 예제 키 또는 24자 미만 secret으로 기동을 차단한다. `src/main.ts:12`, `src/worker.ts:13`에서 호출된다.

- `src/config/validate-production-secrets.ts:39-79`, spec 6 케이스

한계는 §7.2 N7에서 다룬다(`API_KEY`/`JWT_SECRET`만 검증, DB/Redis/Rental/AI 키는 미검증).

### 5.5 회귀 테스트 (v2 §4.5 유지)

| 범위             | 테스트                                                         |
| ---------------- | -------------------------------------------------------------- |
| 검색 이력 스냅샷 | `crawler-history-snapshot.spec.ts`                             |
| Adapter 정규화   | `adapter-normalize.spec.ts`                                    |
| Search Job 상태  | `search-job-status.util.spec.ts`                               |
| 이미지 보안      | `safe-image-url.util.spec.ts`, `image-storage.service.spec.ts` |
| API key          | `api-key.guard.spec.ts`                                        |
| 운영 secret      | `validate-production-secrets.spec.ts`                          |
| 문자열 유틸      | `string.util.spec.ts`                                          |

리스크 지점을 잘 골랐다. 커버리지 범위 문제는 §7.2 N5.

### 5.6 UI 메뉴 IA 리팩토링 (신규 · `476f083`)

`docs/UI_개선/작업_지시서.md`의 STEP MENU-00~09에 대한 검증 결과다.

| STEP    | 지시 내용                                   | 검증 결과                                                           |
| ------- | ------------------------------------------- | ------------------------------------------------------------------- |
| MENU-00 | BackOffice 흐름 유지                        | **정상** — API·연동 코드 무변경                                     |
| MENU-01 | 메뉴 IA 재편, History 단독 제거             | **정상** — `navigation.ts:53-199`                                   |
| MENU-02 | 검색 UI를 `/` → `/search`, Placeholder 제거 | **정상** — `App.tsx:353-389`                                        |
| MENU-03 | Rental `?tab=` 3개                          | **정상** — URL 파생 방식으로 구현                                   |
| MENU-04 | Investigation `?status=` 4개                | **부분** — 기본 필터 불일치(§7.3 U2), `Investigating` 누락(§7.3 U4) |
| MENU-05 | History를 Search 하위로                     | **정상** — 라우트·페이지 유지                                       |
| MENU-06 | Analytics 4섹션                             | **부분** — AI·Investigation 섹션이 대체 데이터(§7.3 U7)             |
| MENU-07 | System 7섹션                                | **부분** — 4개가 플레이스홀더(§7.3 U6)                              |
| MENU-08 | Dashboard → Overview                        | **부분** — 지표 2개 오류(§7.3 U1)                                   |
| MENU-09 | 원칙 준수                                   | **정상** — API/BackOffice/URL/기능 삭제 없음                        |

**원칙 준수 측면은 양호하다.** "API 변경 없음", "URL 유지", "기능 삭제 없음" 10개 원칙을 모두 지켰고, `tsc --noEmit`도 통과한다. 잘 구현된 부분은 다음 두 가지다.

1. **쿼리 파라미터 동기화 패턴** — Rental/Analytics/System은 `useState`가 아니라 URL에서 매 렌더 파생하는 방식이라, 사이드바에서 같은 pathname의 다른 쿼리로 이동해도(리마운트가 안 일어나는 상황) 상태가 갱신된다. `CaseListPage`는 `useState`를 쓰지만 `useEffect [searchParams]`로 보정했다(`CaseListPage.tsx:38-45`). React Router에서 흔히 발생하는 stale state 버그를 회피했다.
2. **메뉴 단일 소스** — `NAV_SECTIONS` 하나로 사이드바와 활성 판별을 모두 처리한다.

---

## 6. 검증 결과 요약

| 구분                | v2 (Windows)             | v3 (Linux)                        |
| ------------------- | ------------------------ | --------------------------------- |
| 백엔드 테스트       | 8 suites / 52 tests 통과 | 동일 통과                         |
| 백엔드 빌드         | 통과                     | 통과                              |
| 프론트 빌드         | 통과                     | 통과                              |
| 프론트 번들         | 784 KB                   | **794.68 KB** (gzip 235.67 KB)    |
| 백엔드 lint         | 미기재                   | **실패 (`eslint: not found`)**    |
| 마이그레이션 테스트 | PowerShell로 수행        | **Linux에서 실행 불가** (§7.2 N8) |
| CI                  | 미기재                   | **없음**                          |

---

## 7. 남은 문제점

### 7.1 v2에서 계속 유효한 문제

#### P1-A. Search Job의 다중 키워드 처리 집계가 약하다 (v2 §5 P1-1) — **해소**

> **해소일**: 2026-07-29 · **작업**: `docs/REVIEW_v3/작업지시서_v3_A.md` TASK A-1 ~ A-6  
> **핵심 커밋**: `search_job_histories` 스키마 → dual-write → 판정·집계 전환 → API/UI 노출 → 정리

##### 해소 전 문제 (기록)

`SearchJobService.runSearch()`가 키워드 N개를 실행해도 crawl 감시·완료 판정·`resultCount`·조사 생성이 **첫 번째** `searchHistoryId`에만 묶였다. 나머지 키워드 크롤이 진행 중인데 Job이 완료되고, callback·조사가 부분 숫자만 반영되었다.

##### 해소 내용

| TASK | 내용 |
| ---- | ---- |
| A-1 | 빈 볼륨 마이그레이션 테스트 sh 래퍼 + CI job |
| A-2 | `search_job_histories` 테이블·엔티티, `SearchJobStatus.PARTIAL`, 기존 Job backfill |
| A-3 | `runSearch()` dual-write (완료 판정은 기존 유지) |
| A-4 | 전체 히스토리 감시, 이중 타임아웃, partial 판정, distinct `resultCount`, 전 히스토리 조사 |
| A-5 | API·callback·Rental UI에 `keywordHistories` 노출 (기존 필드 유지) |
| A-6 | deprecated 미사용 메서드 정리, `search_jobs.searchHistoryId` 참조 전수 조사, 본 기록 |

##### 확정 정책 (A1~A5)

| ID | 정책 | 확정 내용 |
| -- | ---- | --------- |
| **A1** | 중복 매물 카운트 | Job `resultCount` = 소속 히스토리의 **고유 `resultId` 수**. 키워드별 합계 ≠ Job 합계가 정상. |
| **A2** | `search_jobs.searchHistoryId` | **컬럼 유지 + `@deprecated`**. 첫 크롤 히스토리를 대표로 계속 채움. |
| **A3** | 타임아웃 | 키워드별 상한(`SEARCH_JOB_KEYWORD_TIMEOUT_MS`) + Job 전체 상한(`SEARCH_JOB_TOTAL_TIMEOUT_MS`, 기본 10분). |
| **A4** | 부분 실패 | 전부 성공 → `completed` / 일부 실패·타임아웃 → `partial` / 전부 실패 → `failed`. |
| **A5** | 기존 데이터 | 마이그레이션 `up()`에서 `searchHistoryId` NOT NULL Job을 `search_job_histories`에 1행씩 backfill. |

##### A-6 `search_jobs.searchHistoryId` 참조 전수 조사 (2026-07-29)

**결론: 참조가 다수이므로 컬럼 제거 금지. 담당자 확정(2026-07-29): 컬럼 유지.**

| 구분 | 읽는 곳 | 용도 |
| ---- | ------- | ---- |
| 백엔드 쓰기 | `search-job.service.ts` `runSearch()` | 첫 히스토리를 대표로 채움 (A2) |
| 백엔드 읽기 | `listRecentJobs`, `toDetailResponse`, `publishFromJob`/`getProgress` | API·WS 응답의 대표 `searchHistoryId` |
| 백엔드 읽기 | `getRentalJobDetail` → `searchHistories` | 레거시 단일 항목 배열 (호환) |
| 백엔드 fallback | `finalizeJob`, `triggerAutoInvestigation`, progress sync | `search_job_histories` 없을 때 레거시 Job 처리 |
| 백엔드 삭제 | `search.service.ts` `deleteSearch()` | 해당 history 삭제 시 Job 컬럼만 null |
| 프론트 | `web/src/api.ts`, `RentalPage.tsx`, `socket.ts`, `types.ts` | Job/progress 타입·목록 필드 (표시는 `keywordHistories` 중심) |
| 문서 | `docs/백오피스_연동_가이드.md` (Progress·폴링 예시), 리뷰/지시서 | 외부 연동 예시가 대표 ID를 읽음 |
| 스키마 | Baseline + `SearchJobHistories` 마이그레이션 | 컬럼·인덱스·backfill 소스 |

정리한 미사용 deprecated: `SearchJobService.listRecentRentalOrders()`, `web` `api.listRentalOrders`.  
부수: A-4/A-5에서 늘어난 spec `any` 경고로 `lint:ci`(max-warnings 8)가 깨져 있던 상태를 A-6에서 복구 — `*.spec.ts`에 `no-explicit-any` off, 미사용 `eslint-disable` 제거.

#### P1-B. AI provider 구현 상태가 문서보다 제한적이다 (v2 §5 P1-2)

v2의 지적이 정확했고, v3에서 코드 근거를 확정했다. 6개 프로바이더 중 **`OpenAiProvider`만 실구현**이며 나머지 5개는 `NOT_IMPLEMENTED`를 던지는 stub이다.

| 프로바이더          | 상태                    | 근거                                         |
| ------------------- | ----------------------- | -------------------------------------------- |
| `OpenAiProvider`    | 실구현 (native `fetch`) | `src/ai/providers/openai.provider.ts:91-103` |
| `AnthropicProvider` | stub                    | `anthropic.provider.ts:28-31`                |
| `GeminiProvider`    | stub                    | `gemini.provider.ts:28-31`                   |
| Vision 3종 전부     | stub                    | 예: `openai.vision.provider.ts:28-31`        |

추가로 확인한 구조적 문제:

- **`ai.enabled` 판정이 프로바이더와 무관** — `AI_ENABLED` 미설정 시 `OPENAI_API_KEY` 존재만으로 활성화된다(`src/ai/ai.config.ts:16-20`). `AI_PROVIDER=anthropic`인데 `OPENAI_API_KEY`가 있으면 "활성"으로 보인다.
- **`isConfigured()`가 실구현 여부와 무관** — Anthropic 키만 있으면 `canGenerateKeywords()`가 true를 반환하지만 실제 호출은 실패한다.
- **재시도 정책이 비합리적** — `AiService.complete()`는 모든 에러를 재시도하므로 `NOT_IMPLEMENTED`·인증 실패도 `AI_MAX_RETRIES`만큼 반복한다(`src/ai/ai.service.ts:116-188`).
- **실제 호출되는 태스크는 4개** — keyword, matching, investigation, recommendation만 호출부가 있다. image·ocr·report는 프롬프트·서비스 메서드만 존재하고 호출하는 곳이 없다.

권장 보완 (v2 항목 + 보강):

1. provider별 `isConfigured()`와 실제 호출 구현 상태를 API나 health에 노출한다.
2. 미구현 provider 선택 시 bootstrap 단계에서 명확히 실패하거나 degraded 상태를 표시한다.
3. Vision provider 실구현 여부를 문서와 `.env.example`에 명확히 구분한다.
4. AI 기능별 fallback 정책을 정리한다.
5. **(신규)** `ai.enabled` 판정을 선택된 provider 기준으로 바꾼다.
6. **(신규)** 재시도 대상을 timeout·5xx·rate limit으로 제한한다.

#### P1-C. 운영 관측성이 아직 최소 수준이다 (v2 §5 P1-3) — **해소**

> **해소일**: 2026-07-29 · **작업**: `docs/REVIEW_v3/작업지시서_v3_B.md` TASK B-1 ~ B-8

##### 해소 전 문제 (기록)

부족한 지표 (v2와 동일):

- 사이트별 crawl 성공/실패율, 평균 응답 시간
- Adapter parse 실패율
- BullMQ retry/exhausted job 추적
- 이미지 다운로드 실패 사유별 집계
- AI provider별 latency/error/cost 추세
- BackOffice callback 실패율

v3에서 추가로 확인한 사실:

- `QUEUE_NAMES.CRAWL_DLQ`가 상수로 정의되어 있으나 **DLQ 구현 자체가 없다**(`src/common/constants/queue.ts:3-8`). retry 소진 job은 `removeOnFail: 200` 이후 사라진다.
- `stats.byStatus`는 백엔드가 제공하고(`src/modules/stats/stats.service.ts:113-116`) 프론트 타입에도 있으나(`web/src/types.ts:43`) **어느 화면에서도 소비하지 않는다.** Analytics 확장 시 즉시 쓸 수 있는 데이터가 방치되어 있다.
- UI 개선으로 System·Analytics 메뉴 골격이 생겼으므로, 지표를 추가하면 표시할 자리는 이미 준비된 상태다.

##### 해소 내용

| TASK | 내용 |
| ---- | ---- |
| B-1 | Analytics에 SearchHistory·Investigation `byStatus` 분포 연결 (라벨 분리) |
| B-2 | System AI Engine·Analytics AI 섹션을 `/ai/usage/*` 실데이터로 연결 |
| B-3 | `crawl_site_attempts` 테이블 + 크롤 시도 기록 (`errorCode`, `adapterVersion`, `responseStatus`) |
| B-4 | `siteMetrics` (24h 성공률·latency) → `/api/stats` + Analytics Sites |
| B-5 | DLQ 실구현, failed job 조회·재시도 API + System Queue UI |
| B-6 | `POST /search-jobs/:id/callback/resend` + Rental/System callback 실패 노출 |
| B-7 | System Prompt·Rules 카드를 GET `/ai/prompts`·`/ai/rules` 실데이터로 연결 |
| B-8 | 메트릭 retention 정리 — `crawl_site_attempts` 90일, `ai_usage_logs` 180일 (`RetentionCleanupService` + `npm run retention:cleanup`) |

##### B4 retention 정책 (확정)

| 데이터 | 보존 | 구현 |
| ------ | ---- | ---- |
| `crawl_site_attempts` | 90일 | `METRICS_RETENTION_CRAWL_ATTEMPTS_DAYS` + 배치 삭제 |
| `ai_usage_logs` | 180일 | `METRICS_RETENTION_AI_USAGE_DAYS` + 배치 삭제 |
| Bull failed / DLQ | 14일 또는 최근 500건 | `QUEUE_FAILED_RETENTION_DAYS` / `QUEUE_FAILED_MAX_COUNT` (B-5) |

##### 후속 (범위 밖·미구현)

- 이미지 다운로드 실패 사유별 집계
- callback 실패율 시계열 집계 (resend API는 B-6에서 제공)
- System UI에 마지막 retention cleanup 시각 표시 (선택 항목)

권장 보완 (v2 원문 — 위 TASK로 대부분 해소, 아래는 후속 참고):

1. ~~`crawler_site_metrics` 또는 시계열 로그 집계를 추가한다.~~ → B-3/B-4
2. ~~crawl 결과에 `errorCode`, `adapterVersion`, `responseStatus` 원인 필드를 남긴다.~~ → B-3
3. ~~`/api/stats`에 운영용 핵심 지표를 추가하고 `byStatus`부터 화면에 연결한다.~~ → B-1/B-4
4. ~~DLQ를 실제로 구현하거나 상수를 제거한다.~~ → B-5
5. PM2/Docker 로그를 보지 않아도 장애 원인이 보이도록 dashboard를 보강한다. → B-1~B-7 (이미지 실패 집계는 후속)

#### P1-D. 크롤링 정책과 법적/운영 기준이 코드 밖에 고정되어 있지 않다 (v2 §5 P1-4)

v2 내용 그대로 유효하다.

권장 보완:

1. 사이트별 robots.txt/약관 검토 결과를 문서화한다.
2. 수집 필드 정책을 명확히 한다(연락처·개인정보 저장 금지, 공개 매물 정보만).
3. 차단 시 proxy 증설이 아니라 중단/감속/검토 절차를 둔다.
4. `CRAWLER_REQUEST_DELAY_MS`, `CRAWL_CONCURRENCY` 기준값을 사이트별로 분리한다.

v3 추가 근거: 현재 요청 간격은 어댑터 기반별 단일값이고(HTTP 500ms — `base-http.adapter.ts:42`, Playwright 1500ms — `base-playwright.adapter.ts:78`), 사이트별 분리가 없다. 프록시는 **Playwright(중고나라)만 지원**하고 HTTP 어댑터(번개장터·당근)는 프록시를 타지 않는다(`base-playwright.adapter.ts:94-99`). 차단 대응 시 사이트별로 가용 수단이 다르다는 점을 정책에 반영해야 한다.

#### P2-A. 프론트 번들 크기 경고 (v2 §5 P2-1 · 악화)

v2 시점 784KB → 현재 **794.68KB** (gzip 235.67KB). UI 개선으로 페이지가 늘어 예상대로 증가했다. `React.lazy()`가 아직 적용되지 않아 Recharts를 쓰는 Analytics가 초기 번들에 포함된다.

권장 보완 (v2와 동일):

1. route 단위 `React.lazy()` 적용 — 현재 라우트가 7개로 분리되어 있어 적용이 쉬워졌다.
2. Recharts, Investigation, Rental 화면을 별도 chunk로 분리
3. Vite `manualChunks` 설정 검토
4. 운영 nginx gzip/brotli 압축 확인 — `web/nginx.conf`에 압축 설정이 없으므로 확인 필요

#### P2-B. 문서 인코딩/중복 정리 필요 (v2 §5 P2-2 · 대상 확대)

문서가 17개 → **19개**로 늘었다(`docs/UI_개선/` 2개 추가). v2가 지적한 "설계/최종/리팩토링 문서 다중 버전" 문제가 리뷰 문서 3개(`PROJECT_REVIEW`, `_v2`, `_v3`)와 UI 문서로 더 확대되었다.

v3에서 확인한 인코딩 손상 실제 위치:

- `web/src/features/investigation/lib/store.ts:220-221, 300` — 타임라인 문자열 mojibake
- `web/src/features/investigation/data/mock.ts:8-11` — `???` 플레이스홀더
- `web/src/features/investigation/lib/workflow.ts:17-31` — 주석 mojibake

즉 **문서만의 문제가 아니라 소스 문자열에도 손상이 있다.** 사용자에게 노출되는 타임라인 텍스트이므로 실제 UI 결함이다.

권장 보완:

1. 모든 문서·소스를 UTF-8 without BOM으로 통일하고, 위 3개 파일의 손상 문자열을 복구한다.
2. 최신 문서와 과거 문서를 구분한다.
3. `README.md`는 quick start 중심으로 간결화한다.
4. `docs/architecture/`, `docs/ops/`, `docs/reviews/`, `docs/ui/`로 분리한다.

#### P2-C. API 보안 적용 방식이 컨트롤러별이다 (v2 §5 P2-3)

`ApiKeyGuard`가 전역이 아니라 컨트롤러별 `@UseGuards`로 적용된다. `/api/health`와 `GET /api/storage/images/:id`는 의도적으로 공개다.

권장 보완 (v2와 동일):

1. 전역 API key guard로 전환하고 `@Public()` decorator로 health/docs만 제외한다.
2. Swagger docs 접근 정책을 운영 환경에서 별도로 정한다.
3. API key를 프론트 localStorage에 저장하는 모델이 적절한지 재검토한다.

v3 추가 근거: 프론트는 localStorage 미설정 시 **`'change-me-api-key'`를 하드코딩 기본값으로 전송**한다(`web/src/api.ts:8`). 이 값은 `validate-production-secrets.ts`가 금지하는 예제 키 목록과 같은 성격이므로, 운영 API는 이 요청을 거부한다 — 즉 첫 방문 사용자는 반드시 수동으로 키를 입력해야 하는데 UI 안내가 없다. 또한 `HealthBar.tsx:61-68`에서 평문 `input`으로 노출된다.

### 7.2 신규 발견 — 백엔드

#### N1. Investigation 자동 생성이 이중 트리거되며 AI 매칭 결과가 버려진다 (심각)

조사 케이스를 만드는 경로가 두 개 있다.

| 경로                 | 위치                                                   | 사용 점수                         |
| -------------------- | ------------------------------------------------------ | --------------------------------- |
| ① 크롤 완료 직후     | `src/crawler/crawler.service.ts:180-195`               | **휴리스틱** (title/image 유사도) |
| ② Search Job 완료 후 | `src/modules/search-job/search-job.service.ts:408-519` | **AI Matching 결과**              |

①이 Worker에서 먼저 실행되어 케이스를 생성하고, ②는 `resultId` unique 중복 판정으로 skip된다(`src/modules/investigation/investigation.service.ts:210-216`).

**결과: 비용을 지불하고 호출한 AI 매칭 점수가 조사 케이스에 반영되지 않고, 휴리스틱 점수 기준으로 생성된 케이스가 남는다.** Rule Engine의 `auto_exclude_low_score` / `auto_create_high_score` 판정도 휴리스틱 점수로 이루어진다. AI 판단 엔진을 도입한 목적 자체가 부분적으로 무력화된 상태다.

- **검증 상태**: 런타임 재현은 BackOffice Rental API 의존으로 미확정이다. InvestigationService 단위 테스트로 문제를 확정했으며, 실주문 기반 런타임 검증은 우선순위 A 작업에서 별도로 진행한다.
- **확정된 업무 규칙**:
  1. AI 재평가가 Rule Engine `exclude`를 권고해도 기존 케이스는 삭제하거나 상태를 변경하지 않고, timeline에 권고 기록만 남긴다.
  2. 기존 케이스가 없는 상태에서 `exclude`가 나오면 새 케이스를 생성하지 않는다.

권장 보완:

1. 어느 경로를 정본으로 할지 결정한다. AI 판단을 쓰려면 ①에서 자동 생성을 제거하고 ②로 단일화한다.
2. ①을 유지해야 한다면(Search Job 없이 직접 검색한 경우 대비), ②가 기존 케이스를 **갱신**하도록 upsert 시맨틱으로 바꾼다.
3. 어느 점수 소스로 생성된 케이스인지 `scoreSource` 필드로 기록한다.

#### N2. AI 매칭에 brand/model이 항상 null로 전달된다 (심각)

`SearchJobService.create()`는 "주문 마스터 복제 금지" 원칙에 따라 `brand`, `modelName`, `option`, `color`를 명시적으로 `null` 저장한다.

```
src/modules/search-job/search-job.service.ts:62-71
  brand: null,
  modelName: null,
  option: null,
  color: null,
```

그런데 이후 AI 매칭 호출은 저장된 `job.brand`, `job.modelName`을 읽어 프롬프트에 넣는다(`:448-456`).

**결과: 매칭 판단에 가장 강력한 신호인 브랜드·모델이 통째로 비어 있는 상태로 AI에 전달된다.** `productName`과 `referenceImageUrl`만 유효하다. BackOffice에서 데이터를 받아왔는데도 사용하지 않는 것이므로 순손실이다.

권장 보완:

1. `searchInput`을 `runSearch()` → `triggerAutoInvestigation()`까지 전달해 매칭 시점에 원본 값을 쓴다. **주문 마스터를 DB에 복제하지 않는 원칙을 지키면서 해결 가능하다.**
2. 또는 검색 실행 스냅샷으로 간주해 저장한다(`productName`을 이미 저장하고 있으므로 일관성 측면에서는 이쪽이 자연스럽다).
3. 어느 쪽이든 매칭 프롬프트에 어떤 필드가 실제로 채워지는지 테스트로 고정한다.

#### N3. lint와 CI가 존재하지 않는다 (심각)

```
$ npm run lint
> eslint "{src,apps,libs,test}/**/*.ts" --fix
sh: 1: eslint: not found
```

원인이 두 가지 겹쳐 있다.

1. 루트 `devDependencies`에 `eslint`, `@typescript-eslint/*`가 **없다**(`package.json:72-87`).
2. 루트에 `.eslintrc*` / `eslint.config.*`가 **없다**. `web/.eslintrc.cjs`만 존재하며, 그쪽도 `lint` npm script가 연결되어 있지 않다(`web/package.json:6-9`).

또한 `.github/workflows`, `.gitlab-ci.yml` 등 **CI 설정이 전무하고** pre-commit hook도 없다. 즉 이 프로젝트는 정적 분석을 한 번도 수행한 적이 없고, 빌드·테스트 통과 여부는 매번 사람이 로컬에서 확인해야 한다.

이 항목을 심각으로 분류한 이유는, §7의 다른 모든 수정 작업의 안전망이기 때문이다. 다중 키워드 집계 구조 변경처럼 침습적인 작업을 CI 없이 진행하는 것은 위험하다.

권장 보완:

1. 루트에 `eslint` + `@typescript-eslint/*` 설치, `eslint.config.mjs` 추가.
2. `web:lint` script를 추가해 프론트 ESLint도 실제로 실행되게 한다.
3. GitHub Actions에 최소 워크플로를 만든다: `npm ci` → `npm run build` → `npx jest` → `npm run web:build:check`.
4. 마이그레이션 통합 테스트를 CI에 넣는다(§N8의 sh 래퍼 선행 필요).

#### N4. PM2 cluster 2 + Socket.IO에 Redis adapter가 없다

`ecosystem.config.js:30-31`은 API를 cluster 2 인스턴스로 띄운다. 각 워커가 자기 Socket.IO 서버와 Redis subscriber를 따로 만들고, Redis 메시지를 받으면 자기 로컬 room에만 emit한다(`src/progress/crawl-progress.gateway.ts:41-73`).

Redis pub/sub 팬아웃 덕분에 순수 WebSocket 전송에서는 우연히 동작한다. 그러나:

- `@socket.io/redis-adapter`가 없고 sticky session 설정도 없어 **long-polling 폴백 시 handshake가 깨진다.**
- Docker Compose는 `crawler-api` 단일 replica이므로 안전한데, **PM2 운영 경로만 취약**하다. 즉 운영 방식에 따라 동작이 달라진다.

관련하여, 커밋된 `docs/error.txt`의 스택 트레이스가 바로 WebSocket 핸들러 버그(`handleUnsubscribe`에서 `client`가 undefined)이고, 커밋 `584f479`가 `if (!client) return { ok: false }`로 방어했다(`crawl-progress.gateway.ts:107, 123`). 증상은 막혔으나 `client`가 왜 undefined로 들어왔는지에 대한 근본 원인은 코드에서 확인되지 않는다.

권장 보완:

1. PM2 API를 `instances: 1`로 내리거나, `@socket.io/redis-adapter`를 도입한다.
2. Compose와 PM2의 API 인스턴스 수 정책을 문서에서 일치시킨다.
3. WebSocket subscribe/unsubscribe에 단위 테스트를 추가한다.

#### N5. 테스트 커버리지가 파일 기준 약 6%다

spec 8개는 리스크 지점을 잘 골랐지만(§5.5), 나머지 약 120개 파일에 테스트가 하나도 없다.

**미검증 핵심 모듈**:

| 영역            | 파일                                                                                |
| --------------- | ----------------------------------------------------------------------------------- |
| 큐              | `crawl.processor.ts`, `crawl-queue.service.ts`                                      |
| 크롤 실행       | `crawler.service.ts`, HTTP/Playwright 베이스 어댑터                                 |
| 검색 파이프라인 | `search.service.ts`, `search-job.service.ts`, `search-keyword-generator.service.ts` |
| 조사            | `investigation.service.ts` (약 740줄)                                               |
| AI 엔진         | `src/ai/**` **전체** — 프로바이더, rule engine, prompt manager, 비용                |
| 외부 연동       | `rental.client.ts`, `elastic.service.ts`                                            |
| WebSocket       | `crawl-progress.gateway.ts`, `crawl-progress.publisher.ts`                          |
| HTTP 계층       | 모든 컨트롤러                                                                       |
| DB              | 마이그레이션, `site-seed.service.ts`                                                |

`jest`의 `forceExit: true`(`package.json:101`)는 Redis·Playwright 핸들이 정리되지 않는다는 신호이기도 하다.

N1·N2가 테스트 없이 오래 남아 있었던 것이 이 커버리지 공백의 직접적 결과다.

권장 보완 (우선순위 순):

1. `investigation.service.ts`의 `autoCreateFromSearch()` — 중복 판정·threshold·rule 평가
2. `ai-rule-engine.service.ts`의 `evaluate()` — exclude/create/warning 조합
3. `ai.service.ts`의 JSON 파서와 재시도 동작 (fetch mock)
4. `search-job.service.ts`의 다중 키워드 완료 판정 (P1-A 수정과 함께)
5. `prompt-manager.service.ts`의 파일→DB sync와 렌더링

#### N6. AI Vision 경로에 구조적 결함이 있다

- **렌더링한 프롬프트를 프로바이더에 넘기지 않는다** — `compareImages()`는 `promptManager.render('image', …)`를 호출한 뒤(`src/ai/ai.service.ts:520-527`) `visionProvider.compareImages(input)`을 호출하며 렌더 결과를 전달하지 않는다(`:534`). 사용되지 않은 프롬프트 텍스트가 비용 로그에 기록된다.
- **Vision에는 재시도가 없다** — 텍스트 `complete()`와 달리 재시도 루프가 없다(`:529-566`).
- **Vision 비용이 항상 0으로 기록된다** — 토큰 수를 0으로 넣으므로, 실구현 후에는 지출이 과소 집계된다.
- **`ANTHROPIC_VISION_MODEL`, `GEMINI_VISION_MODEL`이 `.env.example`에 없다** — 코드는 읽는다(`ai.config.ts:39, 47`).

#### N7. 죽은 설정·죽은 코드가 상당히 있다

| 항목                                            | 위치                                        | 문제                                                                           |
| ----------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| `JWT_SECRET`                                    | `app.config.ts:14`                          | 프로덕션 검증만 하고 **런타임에서 전혀 쓰이지 않는다.** 운영자에게 오해를 준다 |
| `CRAWL_QUEUE_NAME`                              | `redis.config.ts:7`                         | 큐 이름이 상수 하드코딩이라 무시된다                                           |
| `QUEUE_NAMES.CRAWL_DLQ`, `JOB_NAMES.SITE_CRAWL` | `common/constants/queue.ts:3-8`             | 정의만 있고 구현 없음                                                          |
| `ElasticService.search()`, `deleteByKeyword()`  | `elastic.service.ts:186-256`                | 호출부 없음                                                                    |
| `CacheService.getSearchJob()`                   | `cache.service.ts:25-27`                    | set만 사용됨                                                                   |
| `describeImageCompareInput()`                   | `ai/prompt/builders/image.builder.ts:17-29` | import 없음                                                                    |
| `getAiScoreThresholdSync()`                     | `investigation.service.ts:59-63`            | 호출 없음. 게다가 기본값 85로 나머지(90)와 불일치                              |
| `analyzeOcr`, `generateReport`, `compareImages` | `ai.service.ts`                             | 외부 호출부 없음                                                               |

`validate-production-secrets.ts`의 검증 범위도 `API_KEY`/`JWT_SECRET` 2개로 한정된다. DB/Redis 비밀번호, `RENTAL_API_KEY`, AI 키는 검증하지 않는다. **실제로 쓰이지 않는 `JWT_SECRET`은 강제하고, 실제로 외부와 통신하는 `RENTAL_API_KEY`는 검증하지 않는 역전 상태다.**

#### N8. Windows 전용 스크립트로 CI에서 검증 불가한 항목이 있다

| npm script       | 내용                                           | Linux         |
| ---------------- | ---------------------------------------------- | ------------- |
| `test:migration` | `powershell … test-migration-empty-volume.ps1` | **실행 불가** |
| `backup`         | `powershell … backup-source.ps1`               | 실행 불가     |
| `dev:ps`         | `powershell … dev.ps1`                         | 실행 불가     |
| `r.bat`          | Windows 배치                                   | 실행 불가     |

특히 `test:migration`은 v2 §8이 "Entity/migration 변경 시 필수 검증"으로 지정한 항목인데 CI에서 돌릴 수 없다. `scripts/verify-migrated-schema.sh`는 이미 sh이므로, `docker-compose.migration-test.yml`을 호출하는 sh 래퍼만 추가하면 해결된다.

부수적으로 디버그 잔여물이 git에 추적되고 있다: `scripts/probe-adapters.js`, `probe-http.js`, `probe-karrot.js`, `probe-karrot-ld.js`, `probe-karrot-urls.js`, `test-http-adapters.mjs`(라이브 사이트 호출), `req.json`, `docs/error.txt`. `.gitignore:67`은 `req.local.json`만 제외한다.

#### N9. Docker 운영 구성의 보완점

- **앱 컨테이너에 healthcheck가 없다** — postgres/redis/elastic에만 있다. `/api/health`가 있는데 Compose가 쓰지 않는다.
- **리소스 제한이 Elasticsearch 힙 외에는 없다** — Playwright Worker는 메모리를 많이 쓸 수 있는데 가드가 없다.
- **컨테이너가 root로 실행된다** — `USER` 지시자가 없다.
- **`Dockerfile`의 기본 CMD가 `node dist/main.js`** — `-r ./dist/register-paths.js`가 빠져 있다. Compose가 command를 덮어쓰므로 현재는 문제가 없지만, 이미지를 직접 실행하면 path alias 해석이 실패한다.
- 기본 자격증명 `crawler`/`crawler`, Redis 무인증, ES `xpack.security.enabled=false`. 포트가 `127.0.0.1`에 바인딩되어 있어 로컬에서는 안전하지만, 포트 포워딩 시 위험하다.

### 7.3 신규 발견 — UI 개선 커밋 관련

#### U1. Overview 지표 3개 중 2개가 잘못되었다 (심각)

`web/src/pages/OverviewPage.tsx:47-80`의 타일과 백엔드 stats 의미(`src/modules/stats/stats.service.ts:44-48`)를 대조한 결과다.

| 타일                   | 사용 필드                           | 판정                                                                          |
| ---------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| 오늘 검색              | `stats.last24h.searches`            | 정상 — 24시간 검색 수                                                         |
| **오늘 Investigation** | `stats.last24h.results`             | **오류** — 크롤 **결과** 건수이며 조사 케이스 수가 아니다                     |
| **오늘 AI 분석**       | `stats.last24h.searches`            | **오류 + 중복** — "오늘 검색"과 **완전히 동일한 값**을 다른 레이블로 표시한다 |
| Worker 상태            | `health.info.queue` / `stats.queue` | 정상                                                                          |

즉 stats가 로드되면 첫 번째와 세 번째 타일에 **항상 같은 숫자가 뜬다.** 운영자가 대시보드 첫 화면에서 보는 수치이므로 신뢰도에 직접 타격이다.

Analytics의 대체 데이터 섹션은 "기존 통계 데이터 재사용 · 별도 API 없음"이라는 안내를 화면에 노출하는데(`AnalyticsPage.tsx:183-185`), Overview 타일에는 그런 안내가 없어 실제 지표로 오인된다.

권장 보완:

1. "오늘 AI 분석"은 백엔드에 이미 있는 `GET /api/ai/usage/today`(`src/ai/cost/ai-usage.controller.ts`)를 `web/src/api.ts`에 추가해 연결한다.
2. "오늘 Investigation"은 조사 케이스 카운트 API를 추가하거나(현재 `GET /api/investigations`는 목록만), 레이블을 "오늘 수집 결과"로 정정한다.
3. 데이터 출처가 대체값인 타일에는 Analytics처럼 명시적 안내를 붙인다.

#### U2. Investigation 기본 필터와 사이드바 활성 표시가 불일치한다

`childPathActive()`는 쿼리 없는 `/investigation`을 **`status=Open`으로 간주**한다(`navigation.ts:236-246`). 그런데 `CaseListPage`는 쿼리가 없으면 `statusFilter = ''`, 즉 **전체 목록**을 보여준다(`CaseListPage.tsx:29, 42-43`).

결과: Overview의 Quick link가 `/investigation`(쿼리 없음)으로 이동하면(`OverviewPage.tsx:102`) **사이드바는 Open을 강조하는데 목록은 전체가 표시된다.** 페이지 내 "상태 전체"를 선택해 필터를 지워도 같은 불일치가 발생한다.

추가로, `?status=`에 알 수 없는 값이 오면 `useEffect`가 아무것도 하지 않아(`CaseListPage.tsx:38-45`) 직전 필터가 그대로 남는다. URL 정규화도 없다.

권장 보완:

1. 쿼리 없는 `/investigation`의 의미를 하나로 정한다. "전체"로 하려면 `childPathActive`의 defaults에서 `/investigation`을 제거하고, "Open"으로 하려면 페이지 기본값을 `'Open'`으로 바꾸고 링크를 `?status=Open`으로 통일한다.
2. 알 수 없는 status 값은 기본값으로 정규화하고 URL을 `replace`로 정리한다.

#### U3. `childPathActive`의 기본값 맵이 페이지 기본값과 이중 관리된다

```
web/src/config/navigation.ts:238-243
const defaults: Record<string, string> = {
  '/rental': 'tab=contracts',
  '/analytics': 'section=search',
  '/system': 'section=worker',
  '/investigation': 'status=Open',
};
```

각 페이지의 fallback과 반드시 일치해야 하는데, 현재 3개는 일치하고(`RentalPage.tsx:99-102`, `AnalyticsPage.tsx:49`, `SystemPage.tsx:239`) **`/investigation` 하나가 불일치**한다(U2). 쿼리 파라미터 섹션을 추가할 때마다 `NAV_SECTIONS`와 이 맵 두 곳을 고쳐야 한다.

권장 보완: 기본 쿼리를 `NavChild`의 속성(`isDefault?: boolean`)으로 옮겨 단일 소스로 만든다.

#### U4. `Investigating` 상태가 사이드바에서 누락되었다

실제 상태 유니온은 5개다.

```
web/src/features/investigation/types.ts:1-6
export type InvestigationStatus =
  | 'Open' | 'Investigating' | 'Review' | 'Completed' | 'Archived';
```

사이드바에는 Open / Review / Completed / Archived 4개만 있다(`navigation.ts:114-135`). `Investigating`은 워크플로 전이에 정의되어 있고(`lib/workflow.ts:4-9`) 목업 데이터에도 2건 존재하는데(`data/mock.ts`), 사이드바로는 접근할 수 없다. 지시서 STEP MENU-04가 4개만 요구했으므로 지시 이행 자체는 맞지만, **상태 5개 중 4개만 필터를 제공하면 특정 케이스가 메뉴에서 사라진다.**

권장 보완: `Investigating`을 사이드바에 추가하거나, 워크플로에서 `Review`와 통합한다.

#### U5. 태블릿(md) 폭에서 하위 메뉴에 접근할 수 없다

`AppSidebar`의 축약 아이콘 레일 모드에서는 하위 메뉴가 있는 항목이 **부모 `NavLink` 하나로만 렌더된다**(`AppSidebar.tsx:83-102`). 즉 md 폭에서는 검색 이력, Rental 탭, Investigation 필터, Analytics·System 섹션에 **전혀 도달할 수 없다.** 부모 경로(`/search`, `/rental` 등)만 열린다.

UI 개선으로 기능 대부분이 하위 메뉴로 이동했기 때문에, 이 커밋으로 인해 태블릿 폭의 사용성이 이전보다 나빠졌다.

권장 보완: 축약 모드에서 hover/click 시 flyout 서브메뉴를 띄우거나, 하위 메뉴가 있는 항목은 축약 모드에서 확장 사이드바로 전환하도록 한다.

#### U6. System의 AI Engine·Prompt가 플레이스홀더인데 백엔드 API는 이미 있다

| 섹션          | 데이터                                                      |
| ------------- | ----------------------------------------------------------- |
| Worker        | 실제 (`health.info.queue`)                                  |
| Queue         | 실제                                                        |
| API           | 실제                                                        |
| Proxy         | 준비중 카드                                                 |
| Scheduler     | 준비중 카드                                                 |
| **AI Engine** | health 응답 여부로 ONLINE 추정만 (`SystemPage.tsx:147-154`) |
| **Prompt**    | 준비중 카드 (`:156-161`)                                    |

백엔드에는 `GET /api/ai/usage/summary`, `GET /api/ai/prompts`, `GET /api/ai/rules`가 **이미 구현되어 있다.** `web/src/api.ts`가 이 엔드포인트를 노출하지 않아 화면이 플레이스홀더로 남았다.

추가로, Redis/Postgres/Elastic 카드는 화면에 렌더되지만(`SystemPage.tsx:163-191`) 사이드바 항목이 없어 `?section=redis`를 직접 입력해야 도달한다.

권장 보완: `api.ts`에 AI usage/prompts/rules 함수를 추가하고 세 섹션을 실제 데이터로 채운다. 백엔드 작업이 필요 없어 비용이 낮다.

#### U7. Analytics의 AI·Investigation 섹션이 대체 데이터를 쓴다

| 섹션                   | 데이터                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------- |
| 검색 통계              | 실제 (`stats.totals`, `last24h`, `searchTrend`)                                         |
| 사이트별 통계          | 실제 (`stats.bySite`)                                                                   |
| **AI 분석 통계**       | `stats.topKeywords` 검색 횟수 — AI와 무관 (`AnalyticsPage.tsx:182-228`)                 |
| **Investigation 통계** | `stats.totals.results`, `last24h.results`, `queue.waiting` — 케이스와 무관 (`:238-245`) |

두 섹션은 화면에 "기존 통계 데이터 재사용 · 별도 API 없음", "Case 상세 집계는 Investigation 메뉴에서 확인합니다"라는 안내를 노출하므로 **의도적 임시 구현임을 정직하게 밝힌 점은 적절하다.** 다만 메뉴 이름과 내용이 불일치하는 상태가 남는다.

`stats.byStatus`(백엔드 제공, 프론트 미사용)를 쓰면 Investigation 섹션을 일부라도 실제화할 수 있다.

#### U8. 준비중 메뉴 직접 진입 시 안내 없이 Overview로 튕긴다

`/search/image`, `/search/scheduled`는 라우트가 없어 catch-all(`App.tsx:435`)로 `/`(Overview)로 리다이렉트된다. 사이드바에서는 `disabled` 버튼이라 클릭이 막히지만, URL을 직접 입력하거나 북마크한 경우 아무 설명 없이 대시보드로 이동한다.

아이러니하게도 이 커밋은 `PlaceholderPage`(준비중 안내 컴포넌트)를 라우트에서 제거해 **완전한 데드 코드로 만들었다** — `web/src/pages/PlaceholderPage.tsx`는 이제 어디서도 import되지 않는다. 이 컴포넌트를 두 경로에 다시 연결하면 문제가 해결된다.

#### U9. 프론트 Investigation이 여전히 localStorage 목업이다 (심각 · v2 미기재) — **해소**

> **해소일**: 2026-07-29 · **작업**: `docs/REVIEW_v3/작업지시서_v3_D.md` TASK D-1 ~ D-7  
> **핵심**: 읽기 전환 → DTO 매핑 → 스키마 → 쓰기 API → Drawer 연결 → 수동생성·Rental·Overview → mock/휴리스틱 정리

##### 해소 전 문제 (기록)

이것은 UI 개선 커밋이 만든 문제는 아니지만, v2에 기재되지 않았고 UI 개선으로 **Investigation이 최상위 메뉴 4개 하위 항목으로 격상되면서 문제가 더 두드러졌다.**

현재 `/investigation` 페이지, Overview의 `CaseSummaryCard`, 검색 결과의 "조사 시작" 버튼은 모두 서버 API가 아니라 **브라우저 localStorage**를 읽고 쓴다.

| 근거                                                    | 위치                                                  |
| ------------------------------------------------------- | ----------------------------------------------------- |
| 첫 방문 시 `MOCK_INVESTIGATION_CASES`를 시드로 심는다   | `web/src/features/investigation/lib/store.ts:170-175` |
| 케이스 생성이 localStorage에만 기록된다                 | `store.ts:482-524`                                    |
| AI 분석 패널이 서버 AI가 아니라 클라이언트 휴리스틱이다 | `features/investigation/lib/ai.ts:20-35`              |
| `api.ts`에 investigation 관련 함수가 **하나도 없다**    | `web/src/api.ts:42-173`                               |

반면 `RentalPage`는 `api.getRentalJob()`으로 **서버의 실제 investigation**을 읽는다(`RentalPage.tsx:150, 437-471`). 즉 같은 대시보드 안에 **서버 케이스와 로컬 케이스라는 두 개의 진실이 공존하며 서로 동기화되지 않는다.**

백엔드에는 `GET /api/investigations`, `GET /api/investigations/:id`, `GET /api/investigations/config`가 이미 있다. 다만 상태 변경·담당자 배정·메모·최종 판단 저장용 쓰기 API는 없어서, 프론트를 완전히 전환하려면 백엔드 작업이 함께 필요하다.

##### 해소 내용

| TASK | 내용 |
| ---- | ---- |
| D-1 | `api.ts` investigation GET + Provider 서버 전환, mock 시드 중단, 쓰기 UI 차단 |
| D-2 | `mapServerCase` 단일 매퍼, Drawer AI/timeline 서버 우선 |
| D-3 | `notes`/`finalDecision`/`decidedAt`/`dueDate` 컬럼 + 마이그레이션 |
| D-4 | status·assignment·notes·final-decision·수동 POST·stats 쓰기 API |
| D-5 | Drawer 섹션 → 쓰기 API 연결, localStorage 쓰기 제거 |
| D-6 | 수동 「조사 시작」POST, Rental→동일 CaseDrawer, Overview `stats.last24h` |
| D-7 | `mock.ts`/`store.ts` 삭제, `deriveAi*` 휴리스틱 제거, 본 기록 |

##### 확정 정책 (D1~D7)

| ID | 정책 | 확정 내용 |
| -- | ---- | --------- |
| **D1** | 전환 순서 | **읽기 먼저, 쓰기 나중**. D-1·D-2 목록/상세 GET → D-3·D-4 스키마·쓰기 → D-5·D-6 UI 연결 → D-7 정리 |
| **D2** | 수동 「조사 시작」 | `POST /api/investigations`. `resultId` 중복 시 **기존 케이스 반환**(새 row 금지) |
| **D3** | Evidence | 1차 범위 **읽기 전용**. evidence 테이블/컬럼 미추가. 편집 UI disabled |
| **D4** | dueDate | DB 컬럼 추가 (`timestamptz`, nullable) |
| **D5** | Overview 「오늘 Investigation」 | `GET /api/investigations/stats`의 **케이스 건수**(`last24h`). 크롤 결과 수 아님 |
| **D6** | AI 표시 | 서버 `aiAnalysis` / timeline 요약·`aiRecommendation` **우선**. D-7에서 클라이언트 `deriveAi*` 휴리스틱 **제거** (부재 시 empty state) |
| **D7** | Rental ↔ Investigation | Rental 조사 행 → `InvestigationProvider.openCase`로 **동일 CaseDrawer**. 별도 Rental-only 상세 없음 |

##### D-7 정리 판정 (2026-07-29)

| 항목 | 판정 | 근거 |
| ---- | ---- | ---- |
| `data/mock.ts` | **삭제** | 시드 경로 없음. 서버가 단일 소스 |
| `lib/store.ts` | **삭제** | localStorage 쓰기/시드 API 전부 미사용. Provider·`api.ts`가 대체 |
| `deriveAi*` | **제거** | 케이스 생성 시 서버가 `buildAiAnalysis`로 메트릭을 채움. 점수만으로 바를 합성하면 운영자가 서버 AI로 오인. 부재 시 empty state |
| Analytics Investigation `byStatus` | **범위 밖** | Overview/stats는 D-6에서 연결. Analytics 패널은 후속(우선순위 B U7) |
| Evidence CRUD | **범위 밖** | D3 정책 유지 |

#### U10. 프론트 데드 코드 정리 필요

**이 커밋으로 새로 죽은 것**:

- `web/src/pages/PlaceholderPage.tsx` — import 0건 (U8)
- `findNavItem()` (`navigation.ts:204-206`) — import 0건
- `findNavByLocation()` (`:256-274`) — breadcrumb용으로 추가되었으나 import 0건. 작업내용 문서는 "AppShell 헤더는 고정"이라고 밝혀 breadcrumb을 구현하지 않았다
- `NAV_ITEMS` export — 파일 내부에서만 사용

**이전부터 죽어 있던 것** (v2 미기재):

- 재수출 shim 9개: `web/src/lib/investigation-{ai,evidence,store,workflow}.ts`, `web/src/types/investigation.ts`, `web/src/data/investigation-mock.ts`, `web/src/components/InvestigationDrawer.tsx`, `web/src/components/InvestigationSummaryCard.tsx`, `web/src/pages/InvestigationPage.tsx` — 전부 `@deprecated` 주석이 달려 있고 **import하는 곳이 하나도 없다.** 즉시 삭제 가능
- `api.ts` 미사용 함수: `crawl`, `createSearchJob`, `getSearchJob`, `getSearchJobProgress`, `results` (`listRentalOrders`는 TASK A-6에서 삭제)
- `socket.ts`의 `pollSearchJobProgress()` — 호출부 없음
- `web/package.json`의 `search-crawler-server: file:..` 의존성 — 소스에서 import 0건
- 커밋된 빌드 산출물: `web/vite.config.js`, `web/vite.config.d.ts`. `tsconfig.node.json`에 `noEmit`이 없어 생긴 부산물이며 `.gitignore`에도 없다

#### U11. 반쯤 연결된 기능들이 그대로 남아 있다

| 기능                     | 문제                                                                                       | 위치                           |
| ------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------ |
| 사이드바 "미확인" 배지   | `crawler.dashboard.investigation.unverified`를 **읽기만** 하고 쓰는 코드가 없어 **항상 0** | `App.tsx:34-43, 302`           |
| History 저장/즐겨찾기 탭 | `savedSearches`, `favoriteSearches` 키에 writer가 없어 **영구히 빈 목록**                  | `HistoryPage.tsx:16-17, 54-55` |
| `stats.byStatus`         | 백엔드가 제공하나 어느 화면도 소비하지 않음                                                | `web/src/types.ts:43`          |

UI 개선 커밋에서 배지 키가 `history` → `search`로 변경되었으나(`App.tsx:290-292`), 값이 항상 0인 근본 문제는 그대로다.

#### U12. 기타 접근성·하드코딩

- `CaseDrawer`에 `role="dialog"`, `aria-modal`, Escape 닫기는 있으나 **focus trap과 닫을 때 포커스 복귀가 없다**
- accordion 토글에 `aria-expanded`는 있으나(`AppSidebar.tsx:109`) `aria-controls` 연결이 없다
- 목록 행이 `role="button"` 패턴인데 활성 행에 `aria-selected`가 없다
- 결과 이미지 다수가 `alt=""`
- 사이트 목록이 `SearchToolbar.tsx:5-9`, `CaseListPage.tsx:11-16` 두 곳에 하드코딩 (백엔드 `GET /api/crawl/sites`가 있는데 사용하지 않음)
- `APP_VERSION = '1.0.0'`이 `navigation.ts:51`에 하드코딩되어 `package.json`과 연동되지 않음
- `AppSidebar.tsx:165`에 포맷 깨짐 (`})}          </ul>`) — lint가 없어 잡히지 않은 흔적

---

## 8. 수정/보완 우선순위

v2의 A~E를 유지하되, v3 신규 발견 중 즉시 처리 항목을 **우선순위 0**으로 신설하고 각 항목에 관련 문제 번호를 명시한다.

### 우선순위 0: 즉시 처리 (영향 대비 작업량이 매우 작음)

| #   | 작업                                                         | 관련   | 변경 범위                                                    |
| --- | ------------------------------------------------------------ | ------ | ------------------------------------------------------------ |
| 0-1 | Investigation 자동 생성 경로 단일화                          | N1     | `crawler.service.ts` 또는 `investigation.service.ts` 1~2파일 |
| 0-2 | AI 매칭에 brand/model 실제 전달                              | N2     | `search-job.service.ts` 1파일                                |
| 0-3 | Overview 지표 타일 정정 (`오늘 AI 분석`은 AI usage API 연결) | U1     | `OverviewPage.tsx`, `api.ts`                                 |
| 0-4 | Investigation 기본 필터/사이드바 활성 일치                   | U2, U3 | `navigation.ts`, `CaseListPage.tsx`                          |
| 0-5 | 루트 ESLint 설치·설정, `web:lint` script 추가                | N3     | `package.json`, `eslint.config.mjs` 신규                     |
| 0-6 | 최소 CI 워크플로 (build + jest + web:build)                  | N3     | `.github/workflows/ci.yml` 신규                              |
| 0-7 | `PlaceholderPage`를 준비중 라우트에 재연결                   | U8     | `App.tsx`                                                    |
| 0-8 | 프론트 데드 코드 shim 9개 삭제, 커밋된 빌드 산출물 정리      | U10    | 삭제 위주                                                    |

### 우선순위 A: 운영 정확성 (v2 §6 A + N1·N2 반영) — P1-A **해소** (TASK A-1~A-6)

1. ~~Search Job과 Search History의 1:N 관계 명시 (P1-A)~~ ✅
2. ~~다중 키워드 crawl 완료 감시 로직 개선 (P1-A)~~ ✅
3. ~~Job 단위 result/investigation 집계 정확도 보강 (P1-A)~~ ✅
4. ~~BackOffice callback payload에 keyword별 요약 또는 대표 결과 기준 명시 (P1-A)~~ ✅
5. Investigation 생성 경로 단일화 후 회귀 테스트 고정 (N1) — 우선순위 0에서 처리
6. 매칭 입력 필드가 실제로 채워지는지 테스트로 고정 (N2, N5) — 우선순위 0에서 처리

### 우선순위 B: 운영 관측성 (v2 §6 B 유지) — P1-C **해소** (TASK B-1~B-8, 2026-07-29)

1. ~~사이트별 crawl 성공/실패/latency 집계 (P1-C)~~ ✅ (B-3, B-4)
2. ~~Adapter parse 실패 원인 기록 (`errorCode`, `adapterVersion`, `responseStatus`) (P1-C)~~ ✅ (B-3)
3. ~~queue retry/exhausted job dashboard 노출 — DLQ 실구현 또는 상수 제거 (P1-C, N7)~~ ✅ (B-5)
4. ~~AI usage/cost 화면과 System 화면 연결 강화 — 백엔드 API 이미 존재 (P1-C, U6)~~ ✅ (B-2, B-7)
5. ~~callback 실패 재시도 및 재전송 API 추가 (P1-C)~~ ✅ (B-6, 수동 resend)
6. ~~`stats.byStatus`를 Analytics에 연결 (U7, U11)~~ ✅ (B-1)
7. ~~메트릭 테이블 retention 정리 (`crawl_site_attempts` 90일, `ai_usage_logs` 180일)~~ ✅ (B-8, `RetentionCleanupService` + `npm run retention:cleanup`)

### 우선순위 C: AI 정확도 (v2 §6 C + N6 반영)

1. AI provider 구현 상태 명확화 — health/API 노출, 미구현 선택 시 명시적 실패 (P1-B)
2. Vision similarity 실제 구현 또는 명시적 비활성화 표시 (P1-B)
3. `compareImages()`의 프롬프트 미전달 수정, Vision 재시도·비용 집계 보완 (N6)
4. `ai.enabled` 판정을 선택된 provider 기준으로 변경 (P1-B)
5. 재시도 대상을 transient 오류로 제한 (P1-B)
6. OCR 결과를 matching 점수에 반영 (v2 C-3)
7. rule threshold 튜닝 UI 또는 운영 설정 API 제공 (v2 C-4)
8. false positive/negative 피드백을 rule/prompt 개선에 반영 (v2 C-5)

### 우선순위 D: 프론트/사용성 (v2 §6 D + UI 신규 반영) — U9 Investigation 실 API **해소** (TASK D-1~D-7)

1. ~~**Investigation을 localStorage에서 실 API로 전환** (U9)~~ ✅ — v2 D-2·D-3을 포괄 (TASK D-1~D-7, 2026-07-29)
2. ~~케이스 상태 변경·담당자·메모·최종 판단 저장 API 추가 (U9, v2 D-3)~~ ✅ (TASK D-3~D-5)
3. route 단위 code splitting (P2-A)
4. 태블릿(md) 축약 사이드바에서 하위 메뉴 접근 수단 제공 (U5)
5. System AI Engine·Prompt 섹션을 실제 API로 연결 (U6)
6. `Investigating` 상태 메뉴 노출 또는 워크플로 통합 (U4)
7. ~~검색 결과와 Investigation 간 이동 동선 개선 (v2 D-4)~~ ✅ (TASK D-6 수동 POST·Drawer)
8. 에러 메시지 한글 문구 정리, 소스 문자열 인코딩 손상 복구 (P2-B, v2 D-5)
9. 사이드바 배지·History 저장/즐겨찾기 기능 완성 또는 제거 (U11)
10. focus trap, `aria-controls`, `aria-selected` 등 접근성 보완 (U12)

### 우선순위 E: 보안·운영 강화 (신규)

1. 전역 API key guard + `@Public()` 전환 (P2-C)
2. 프론트 API key 기본값 `change-me-api-key` 제거, 미설정 시 안내 UI (P2-C)
3. `validate-production-secrets`에 `RENTAL_API_KEY` 등 실사용 secret 추가, 미사용 `JWT_SECRET` 정리 (N7)
4. PM2 API `instances: 1` 또는 Socket.IO Redis adapter 도입 (N4)
5. Docker 앱 healthcheck·리소스 제한·비root 사용자 추가 (N9)
6. `Dockerfile` CMD에 `register-paths` 반영 (N9)
7. `ANTHROPIC_VISION_MODEL`, `GEMINI_VISION_MODEL`을 `.env.example`에 추가 (N6)

### 우선순위 F: 문서/개발 기반 (v2 §6 E + N3·N8 반영)

1. `test:migration`의 sh 래퍼 추가 후 CI에 편입 (N8)
2. probe 스크립트·`req.json`·`docs/error.txt` 정리 또는 `.gitignore` 반영 (N8)
3. README, 배포 문서, architecture 문서 최신화 (v2 E-1)
4. 운영 checklist 작성 (v2 E-2)
5. 장애 대응 runbook 작성 (v2 E-3)
6. 사이트별 adapter 유지보수 가이드 작성 (v2 E-4)
7. 개인정보/크롤링 정책 문서화 (v2 E-5, P1-D)
8. `docs/` 디렉터리 구조 재편 및 인코딩 통일 (P2-B)

---

## 9. 우선순위 0 실행 상세

가장 먼저 처리할 8개 항목의 구체적 접근이다.

### 0-1. Investigation 경로 단일화

현재 상태:

```
Worker: CrawlerService.executeCrawl()
  → investigationService.autoCreateFromSearch({ searchHistoryId })   ← 휴리스틱 점수로 먼저 생성

API:    SearchJobService.triggerAutoInvestigation()
  → aiService.matchSearchResults()                                   ← AI 매칭 수행
  → investigationService.autoCreateFromSearch({ ..., aiResults })     ← resultId 중복으로 skip
```

선택지:

- **(권장) AI 결과 우선** — `crawler.service.ts:180-195`의 자동 생성을 Search Job 경유가 아닌 직접 검색에만 적용하도록 조건을 추가하거나, `autoCreateFromSearch`에 `mode: 'heuristic' | 'ai'`를 주고 AI 모드가 기존 휴리스틱 케이스를 갱신하게 한다.
- **차선** — `investigation.service.ts:210-216`의 중복 판정을 skip에서 upsert로 바꿔, AI 점수가 들어오면 `aiScore`, timeline, recommendation을 갱신한다.

검증: `investigation.service.spec.ts`를 신설해 "휴리스틱 생성 후 AI 결과 도착 시 점수가 갱신된다"를 고정한다.

### 0-2. brand/model 전달

`create()`가 만든 `searchInput`을 `runSearch()`까지 넘기거나(메모리 전달), Job 엔티티에 검색 스냅샷으로 저장한다. `productName`을 이미 스냅샷으로 저장하고 있으므로 후자가 일관성 측면에서 자연스럽다. 어느 쪽이든 "주문 마스터 복제 금지" 원칙과 충돌하지 않는다(브랜드·모델은 상품 속성이며 고객 개인정보가 아니다).

### 0-3. Overview 지표

```
web/src/api.ts 에 추가
  aiUsageToday()  → GET /ai/usage/today
```

"오늘 AI 분석" 타일을 여기에 연결한다. "오늘 Investigation"은 `GET /api/investigations/stats`의 케이스 건수로 연결한다(TASK D-5·D-6, U9 해소).

### 0-4. Investigation 기본 필터

`navigation.ts`의 `defaults`에서 `/investigation`을 제거하고 `NavChild`에 `isDefault` 속성을 도입해 기본 쿼리를 단일 소스로 만든다. 동시에 `CaseListPage`에서 알 수 없는 status를 기본값으로 정규화한다.

### 0-5 / 0-6. lint와 CI

```yaml
# .github/workflows/ci.yml (개요)
- npm ci
- npm run lint
- npm run build
- npx jest --runInBand
- npm --prefix web ci
- npm --prefix web run build
```

lint를 먼저 도입하면 `AppSidebar.tsx:165` 포맷 깨짐, 미사용 export(`findNavItem`, `findNavByLocation`), 빈 import(`store.ts:2-4`) 등이 자동으로 드러난다.

### 0-7 / 0-8. 데드 코드 정리

`PlaceholderPage`를 `/search/image`, `/search/scheduled` 라우트에 연결하고, shim 9개와 `web/vite.config.{js,d.ts}`를 삭제한다. 후자는 `tsconfig.node.json`에 `noEmit: true`를 추가해 재생성을 막는다.

---

## 10. 검증 기준

v2 §8을 포괄하고 Linux/CI 기준을 추가한다.

| 변경 유형             | 최소 검증                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Entity/migration 변경 | `npm run build`, `npm run migration:show`, 빈 DB migration 테스트 (**sh 래퍼로 CI 실행 가능하게 한 뒤**) |
| Search/Crawler 변경   | 관련 unit test + 실제 adapter probe                                                                      |
| Search Job 변경       | **다중 키워드 통합 테스트** (P1-A 수정 시 필수)                                                          |
| Investigation 변경    | auto create threshold/rule 테스트 + **생성 경로 단일화 회귀 테스트** (N1)                                |
| AI 변경               | provider 미설정/실패 fallback 테스트, usage log 테스트, **매칭 입력 필드 채움 테스트** (N2)              |
| Frontend 변경         | `npm run web:build`, **`npm run web:lint`**, 주요 화면 수동 확인 (**lg / md / 모바일 3개 폭** — U5)      |
| Navigation/IA 변경    | 사이드바 활성 상태와 페이지 기본값 일치 확인 (U2, U3)                                                    |
| 지표/통계 변경        | 표시 값의 **데이터 출처를 문서에 명시** (U1, U7)                                                         |
| Docker/운영 변경      | `docker compose up -d --build`, health/dashboard 확인                                                    |
| **모든 변경**         | **CI 통과** (build + lint + test + web:build)                                                            |

---

## 11. 향후 추가 기능 제안

v2 §7 전체를 유지한다. v3에서 상태 주석을 덧붙였다.

### 11.1 Investigation 워크플로우 고도화

- case 상태 전이: `Open → Reviewing → Confirmed / False Positive / Closed`
- 담당자 배정
- 내부 메모
- 증거 고정 기능
- 최종 판단과 AI 추천 분리 저장
- BackOffice로 최종 판단 callback

> v3 주석: Investigation Drawer 섹션(Assignment, Notes, Evidence, FinalDecision, Workflow, Timeline)은 **서버 API에 연결 완료**(TASK D-1~D-7, U9 해소). Evidence CRUD·BackOffice final-decision callback은 후속.

### 11.2 검색 품질 개선

- 브랜드/모델/색상/옵션별 keyword weight 적용
- 중복 매물 cluster 처리
- 판매자/지역 기반 risk scoring
- 렌탈 시작일 이후 등록 매물 우선순위
- 품절/삭제/거래완료 상태 추적

> v3 주석: 첫 항목은 **N2(brand/model이 null로 전달되는 문제)를 먼저 고쳐야 의미가 있다.** 현재는 가중치를 줄 필드 자체가 비어 있다.

### 11.3 이미지/비전 강화

- 단순 average hash 외 perceptual hash 고도화
- CLIP/image embedding 기반 유사도
- OCR로 이미지 내 상품명/연락처/워터마크 추출
- 같은 이미지 재사용 탐지
- 이미지 다운로드 실패 시 원격 URL 기반 Vision fallback

> v3 주석: Vision 프로바이더 3종이 모두 stub이고 `compareImages()`의 프롬프트가 프로바이더에 전달되지 않으므로(N6), 이 로드맵은 **우선순위 C-2·C-3 선행이 필수**다.

### 11.4 운영 자동화

- 사이트 adapter health probe
- 차단 감지 시 자동 감속
- queue backlog 알림
- AI 비용 일일 한도
- callback 실패 알림
- 오래된 이미지/Elastic index retention 정책

> v3 주석: `scripts/probe-*.js`가 이미 어댑터 probe의 원형이다(N8). 정리해서 정식 health probe로 승격시키면 재사용 가능하다. AI 비용 한도는 `ai_usage_logs`와 `AiCostService`가 이미 있어 집계 기반이 준비되어 있다.

### 11.5 데이터 관리

- 검색 이력 retention 정책
- 이미지 storage quota 및 cleanup job
- Elasticsearch reindex 스크립트
- DB backup/restore 문서
- 민감 정보 마스킹 및 usage log 보존 기간 설정

> v3 주석: 마지막 항목은 실제 리스크가 있다. `ai_usage_logs`에 프롬프트 최대 4000자·응답 2000자가 저장되며(`src/ai/cost/ai-cost.service.ts:72-73`), 여기에 주문·상품 정보가 포함된다. 보존 기간과 마스킹 정책을 정해야 한다.

---

## 12. 결론

v2 시점의 판단은 유효하다. 1차 리뷰의 핵심 운영 리스크(migration, 이력 보존, 이미지 보안, secret 검증)는 해소된 상태이고, 빌드·테스트도 Linux에서 재확인한 결과 모두 통과한다. UI 개선 커밋도 "API·연동·URL·기능을 건드리지 않는다"는 원칙을 지키면서 메뉴 IA를 정리해, 앞으로 지표와 화면을 붙일 자리를 만들어 두었다.

v3에서 새로 확인한 가장 중요한 사실은 **AI 판단 엔진이 구조적으로는 완성되어 있지만 실제 판단 경로에서 두 번 무력화되고 있다**는 점이다.

1. 조사 케이스가 휴리스틱 점수로 먼저 생성되어 AI 매칭 결과가 반영되지 않는다 (N1)
2. AI 매칭 프롬프트에 브랜드·모델이 항상 비어서 전달된다 (N2)

두 항목 모두 v2에 기재되지 않았고, 수정 범위는 각각 파일 1~2개로 작다. **v2가 최우선으로 지목한 다중 키워드 집계 구조 개편보다 먼저 처리해야 한다** — 집계를 정확히 해도 그 위에서 계산되는 점수가 AI를 거치지 않으면 의미가 반감되기 때문이다.

두 번째로 중요한 것은 **개발 기반의 부재**다. lint가 실행되지 않고 CI가 없는 상태(N3)에서 다중 키워드 1:N 구조 개편 같은 침습적 작업을 진행하는 것은 위험하다. 실제로 N1·N2 같은 결함이 오래 남아 있었던 것, `AppSidebar.tsx`의 포맷 깨짐과 미사용 export가 걸러지지 않은 것 모두 이 공백의 결과다. 우선순위 0에 lint·CI를 넣은 이유다.

세 번째는 ~~**프론트 Investigation의 목업 의존**(U9)~~ ✅ **해소** (2026-07-29, TASK D-1~D-7). `/investigation`·Overview·검색 「조사 시작」·Rental 조사 이력이 서버 `investigation_cases`를 단일 소스로 쓰며, mock 시드·localStorage 쓰기·클라이언트 `deriveAi*` 휴리스틱을 제거했다. Evidence CRUD·Analytics byStatus·BackOffice final-decision callback은 후속이다.

정리하면 다음 순서를 권한다.

1. **AI 판단 정확도 복구** (N1, N2) — 작업량 최소, 효과 즉각
2. **개발 기반 복구** (N3) — 이후 모든 작업의 안전망
3. ~~**Search Job 1:N 구조 정리** (P1-A)~~ ✅ 해소 (2026-07-29, TASK A-1~A-6)
4. ~~**Investigation 실 API 전환** (U9)~~ ✅ 해소 (2026-07-29, TASK D-1~D-7)
5. ~~**운영 관측성·AI provider 명확화** (P1-B, P1-C)~~ — P1-C ✅ 해소 (2026-07-29, TASK B-1~B-8). P1-B(AI provider)는 우선순위 C 잔여.
