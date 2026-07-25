# Rental Integration — FINAL Architecture

> BackOffice = **Master** · Search Server = **Search Service**  
> 주문 DB 직접 접근 금지 · 모든 연동은 API Client Layer · Search = 비동기 Job

---

## Principles

| # | 원칙 | 구현 |
|---|------|------|
| 1 | 주문 DB 직접 접근 금지 | TypeORM 주문 엔티티 없음 |
| 2 | API Client Layer | `src/api/rental.{client,service,types,module}.ts` |
| 3 | Search = 비동기 Job | `POST /search-jobs` → 즉시 `jobId` → `runSearch` |
| 4 | Investigation ↔ Job | `investigation_cases.searchJobId` + `orderNo` |
| 5 | UI Job Status 실시간 | WS `job:progress` + Progress Bar (`/rental`) |
| 6 | 독립 배포 | 자체 Postgres/Redis/ES + `RENTAL_API_*` |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Laravel BackOffice (Master)                                │
│  · 주문 / 계약 / 고객 / 상품 DB                              │
│  · [중고 검색] → POST /api/search-jobs { orderNo } + Toast   │
│  · [조사 이력 보기] → Investigation 조회                     │
│  · GET  /api/internal/orders/:orderId                       │
│  · POST /api/internal/search-jobs/callback  (Badge)         │
└───────────────┬─────────────────────────────▲───────────────┘
                │ orderNo only                │ callback
                ▼                             │
┌─────────────────────────────────────────────────────────────┐
│  Search Server (독립 배포)                                   │
│  RentalClient → RentalService (주문 조회 · 비영속)            │
│       ↓                                                     │
│  SearchJobService (async Job · Progress · Callback)         │
│       ↓              ↓                 ↓                    │
│  search_jobs    search_history   investigation_cases        │
│  (orderNo)      (crawl)          (searchJobId+orderNo)      │
│  /rental — Job Status realtime (WS job:progress)            │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
        중고나라 / 번개 / 당근 (Playwright)
```

### BackOffice UX (권장)

```
주문 상세
  [중고 검색]        → Job 생성 → Toast「검색이 시작되었습니다.」
                     → 백그라운드 크롤/AI → Callback → Badge
  [조사 이력 보기]    → 기존 Investigation 조회 (결과 대기 없음)
```

### Architecture Diagram (내부 상세)

```
┌─────────────────────────────────────────────────────────────┐
│  Laravel BackOffice (Master)                                │
│  · 주문 / 계약 / 고객 / 상품 DB                              │
│  · 「중고 검색」 → POST /api/search-jobs { orderNo } + Toast  │
│  · 「조사 이력 보기」 → Investigation 조회                     │
│  · GET  /api/internal/orders/:orderId   (JSON API)          │
│  · POST /api/internal/search-jobs/callback  (Badge)         │
└───────────────┬─────────────────────────────▲───────────────┘
                │ orderNo only                │ callback
                ▼                             │
┌─────────────────────────────────────────────────────────────┐
│  Search Server (lomad2-crawler) — 독립 배포                  │
│                                                             │
│  ┌──────────────┐    ┌─────────────────┐                    │
│  │ API Client   │───▶│ RentalService   │  주문 조회 (비영속) │
│  │ RentalClient │    └────────┬────────┘                    │
│  └──────────────┘             │                             │
│                               ▼                             │
│  ┌──────────────────────────────────────┐                   │
│  │ SearchJobService                     │                   │
│  │  · create(orderNo) → keywords[]      │                   │
│  │  · runSearch (async)                 │                   │
│  │  · progress sync → Redis / WS        │                   │
│  │  · Investigation auto-create         │                   │
│  │  · Callback                          │                   │
│  └──────────────┬───────────────────────┘                   │
│                 │                                           │
│     ┌───────────┼───────────┐                               │
│     ▼           ▼           ▼                               │
│  search_jobs  search_history  investigation_cases           │
│  (orderNo FK) (crawl results) (searchJobId + orderNo)       │
│                                                             │
│  Dashboard /rental — Job Status realtime                    │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
        중고나라 / 번개 / 당근 (Playwright)
```

---

## Folder Tree

```
lomad2-crawler/
├── src/
│   ├── api/                          # ★ Client Layer (유일한 외부 주문 진입점)
│   │   ├── rental.client.ts
│   │   ├── rental.service.ts
│   │   ├── rental.types.ts
│   │   ├── rental.module.ts
│   │   └── index.ts
│   ├── config/
│   │   └── rental.config.ts
│   ├── database/entities/
│   │   ├── search-job.entity.ts      # orderNo + 검색 실행 필드
│   │   └── investigation-case.entity.ts  # searchJobId + orderNo
│   ├── modules/
│   │   ├── search-job/
│   │   │   ├── dto/create-search-job.dto.ts  # orderNo only
│   │   │   ├── search-job.controller.ts
│   │   │   ├── search-job.service.ts
│   │   │   ├── search-job-progress.sync.ts
│   │   │   └── search-keyword-generator.service.ts
│   │   ├── investigation/
│   │   └── search/
│   └── progress/
│       └── crawl-progress.gateway.ts # job:progress
└── web/src/
    ├── pages/RentalPage.tsx          # Job 목록 + realtime Status
    ├── api.ts
    ├── lib/socket.ts
    └── features/investigation/
```

---

## API Flow

```
1) BackOffice
   POST /api/search-jobs
   Body: { "orderNo": "30001234", "useCache": true }
   → 201 { jobId, orderNo, status: "pending", keywords, progress }

2) Search Server (내부)
   RentalClient.GET {RENTAL_API}/api/internal/orders/30001234
   → KeywordGenerator → keywords[]
   → save search_jobs (orderNo + keywords + snapshot)
   → async runSearch()

3) Progress
   GET /api/search-jobs/{jobId}/progress
   WS  /crawl  emit subscribe { jobId }  →  on job:progress

4) Complete
   Investigation auto-create (searchJobId, orderNo)
   RentalClient.POST callback { jobId, investigationCount, completedAt }

5) Rental Dashboard
   GET /api/search-jobs/rental/recent
   GET /api/search-jobs/rental/jobs/{jobId}
       → job + order(via Rental API) + histories + investigations
```

---

## Sequence Diagram

```
BO                Search API           RentalClient         Crawler/ES         Investigation
 │                    │                     │                   │                   │
 │ POST /search-jobs  │                     │                   │                   │
 │ {orderNo}          │                     │                   │                   │
 │───────────────────▶│                     │                   │                   │
 │                    │ GET /orders/:id     │                   │                   │
 │                    │────────────────────▶│                   │                   │
 │                    │◀── order JSON ──────│                   │                   │
 │                    │ keywords[]          │                   │                   │
 │◀── {jobId} ────────│                     │                   │                   │
 │                    │                     │                   │                   │
 │                    │════ async runSearch ═══════════════════▶│                   │
 │                    │◀──── results / progress ────────────────│                   │
 │                    │ WS job:progress ──────────────────────────────────────────▶ UI
 │                    │                     │                   │                   │
 │                    │ autoCreate ────────────────────────────────────────────────▶│
 │                    │                     │                   │  searchJobId+orderNo
 │                    │ POST callback       │                   │                   │
 │◀── Badge ──────────│────────────────────▶│                   │                   │
```

---

## Component Tree

```
AppShell
├── AppSidebar
│   └── Nav: Dashboard · Search · Rental · History · Investigation · …
└── Routes
    ├── /                Dashboard (기존 유지)
    ├── /rental          RentalPage ★
    │   ├── JobList (최근 Search Job + status/progress)
    │   └── JobDetail
    │       ├── JobStatusBar (WS job:progress realtime)
    │       ├── OrderPanel (Rental API 조회 · 비영속)
    │       ├── SearchHistoryList
    │       └── InvestigationList (searchJobId)
    ├── /history         HistoryPage
    └── /investigation   CaseListPage
            └── CaseDrawer → InvestigationOrderPanel (orderNo + BO 링크)
```

---

## Data Ownership

| 데이터 | Owner | Search Server |
|--------|-------|---------------|
| 주문/계약/고객/상품 | BackOffice | `orderNo` 참조만 · 표시 시 Rental API |
| Search Job | Search Server | `search_jobs` |
| Crawl 결과 | Search Server | `search_history` / results |
| Investigation | Search Server | `searchJobId` + `orderNo` |
| 검색 완료 Badge | BackOffice | Callback 수신 |

---

## Env (필수)

```env
RENTAL_API_BASE_URL=https://admin.example.com
RENTAL_API_KEY=…
RENTAL_ORDER_PATH=/api/internal/orders/:orderId
RENTAL_SEARCH_CALLBACK_PATH=/api/internal/search-jobs/callback
```
