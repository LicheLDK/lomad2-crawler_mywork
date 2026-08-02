# 프로젝트 스펙 & 기술 스택 (재사용 레퍼런스)

> 이 문서는 이 프로젝트(중고거래 재판매 탐지 크롤러)의 스펙과 기술 스택을 정리한 문서입니다.
> 목적은 **동일한 스택·아키텍처 패턴으로 다른 업무(도메인)를 수행하는 새 대시보드/서버를 만들 때**,
> 이 프로젝트에서 그대로 가져갈 부분과 도메인에 맞게 새로 짤 부분을 구분해서 참고하기 위함입니다.
> 관련 문서: [`README.md`](../README.md) · [`Search-Crawler-Server-Architecture.md`](./Search-Crawler-Server-Architecture.md) ·
> [`환경변수.md`](./환경변수.md) · [`배포.md`](./배포.md) · [`database_migrations.md`](./database_migrations.md) ·
> [`ai_engine_final.md`](./ai_engine_final.md) · [`백오피스_연동_가이드.md`](./백오피스_연동_가이드.md) · [`폰트_개선_v3.md`](./폰트_개선_v3.md)

---

## 0. 이 프로젝트가 하는 일 (컨텍스트)

가구 렌탈 상품이 중고거래 사이트(중고나라·번개장터·당근마켓)에 재판매되는지 탐지하는 독립 서버.
Laravel 백오피스(쇼핑몰)와 REST API로만 연동하고, DB를 공유하지 않는다. 주문 → 검색 잡 생성 →
사이트별 크롤링 → AI 매칭 스코어링 → 의심 케이스(Investigation) 자동 생성 → 백오피스로 콜백,
이 흐름 전체가 하나의 코드베이스(API + Worker + Web 3프로세스)로 동작한다.

새 프로젝트를 만들 때 위 도메인 로직(크롤러 대상 사이트, 렌탈/주문, Investigation)은 걷어내고
**스택·프로세스 구조·설계 패턴만** 가져가면 된다. 어디까지가 스택이고 어디까지가 도메인인지는
4장·5장에서 명시적으로 구분한다.

---

## 1. 기술 스택

### 1.1 Backend (루트 `package.json`)

| 구성 | 기술 | 비고 |
|---|---|---|
| Runtime | Node.js 22 | `Dockerfile`: `node:22-bookworm-slim` |
| 언어 | TypeScript 5.7 | `target: ES2021`, `module: commonjs`, `@/* → src/*` 경로 alias |
| 프레임워크 | NestJS 11 | `@nestjs/common` `@nestjs/core` `@nestjs/platform-express` |
| 설정 | `@nestjs/config` 4 | `registerAs` 패턴, 파일별 분리 (2.3 참고) |
| API 문서 | `@nestjs/swagger` 11 | `/docs`, `/docs/swagger` |
| 헬스체크 | `@nestjs/terminus` 11 | `GET /api/health` |
| Rate limit | `@nestjs/throttler` 6 | 전역 `ThrottlerGuard` |
| ORM/DB | `typeorm` 0.3 + `pg` 8 | PostgreSQL 16 |
| Queue | `bullmq` 5 + `@nestjs/bullmq` 11 | Redis(`ioredis`) 백엔드 |
| 검색 인덱스 | `@elastic/elasticsearch` 8 | Elasticsearch 8.17, 한국어 분석기 |
| 브라우저 자동화 | `playwright` 1.50 (Chromium) | DOM 스크래핑 필요한 소스용 |
| 실시간 | `socket.io` 4 + `@nestjs/websockets`/`platform-socket.io` | 진행률 push |
| Validation | `class-validator` + `class-transformer` | 전역 `ValidationPipe` |
| 로깅 | `nestjs-pino` + `pino-http` + `pino-roll` | 이중 transport (2.4 참고) |
| 이미지 처리 | `sharp`, `looks-same`, `@techstark/opencv-js` | 로컬 이미지 유사도 게이트용 |
| AI/LLM | **SDK 없음** — `fetch`로 REST 직접 호출 | 벤더 종속 최소화 (5.3 참고) |
| 테스트 | `jest` + `ts-jest` | `*.spec.ts`, `rootDir: src` |

### 1.2 Frontend (`web/package.json`)

| 구성 | 기술 | 비고 |
|---|---|---|
| 프레임워크 | React 18 | |
| 언어 | TypeScript 5.2 (strict) | path alias 없음, 상대경로 import |
| 빌드 | Vite 5 | `@vitejs/plugin-react` |
| 라우팅 | `react-router-dom` 7 | `BrowserRouter`, 쿼리스트링 기반 서브탭 |
| 스타일 | Tailwind CSS 3 | 커스텀 컬러/폰트/그림자 토큰, 공식 플러그인 미사용 |
| UI 프리미티브 | shadcn/ui **패턴만** 차용 (CLI 미사용) | `class-variance-authority` + `clsx` + `tailwind-merge` |
| 아이콘 | `lucide-react` | 전 화면 통일 |
| HTTP | 순수 `fetch` 래핑 (`api.ts`) | axios 없음 |
| 실시간 | `socket.io-client` | `/crawl` 네임스페이스 |
| 차트 | `recharts` | Analytics 페이지 |
| 폼/검증 | 없음 | `useState` 컨트롤드 폼, react-hook-form/zod 미사용 |
| 날짜 | 없음 | 네이티브 `Date` + `toLocaleString('ko-KR')` |
| Lint | ESLint 9 flat config | 전 규칙 `warn` (빌드 비차단) |

### 1.3 Infra (`docker-compose.yml`)

| 서비스 | 이미지 | 바인딩 |
|---|---|---|
| `postgres` | `postgres:16-alpine` | `127.0.0.1:5432` |
| `redis` | `redis:7-alpine` | `127.0.0.1:6379` |
| `elastic` | `elasticsearch:8.17.0` | `127.0.0.1:9200`, 단일 노드, 보안 비활성 |
| `migrate` | 루트 `Dockerfile` | 1회성, `depends_on: postgres healthy` |
| `crawler-api` / `crawler-worker` | 루트 `Dockerfile` | `ENABLE_WORKER` 플래그로 분기 |
| `dashboard` | `web/Dockerfile` (nginx) | `127.0.0.1:8080`, `/api`+socket.io 프록시 |

---

## 2. 프로세스 구조 & 아키텍처

### 2.1 3프로세스, 1개 AppModule

API/Worker/Web은 별도 앱이 아니라 **같은 `AppModule`을 다르게 부팅**한 것.

| 프로세스 | 엔트리포인트 | 부팅 방식 | 역할 |
|---|---|---|---|
| API | `src/main.ts` | `NestFactory.create` (HTTP 서버) | REST, `ENABLE_WORKER=false` |
| Worker | `src/worker.ts` | `NestFactory.createApplicationContext` (HTTP 없음) | BullMQ Processor 활성, `ENABLE_WORKER=true` |
| Web | `web/` (Vite 빌드) | 정적 서빙 (`serve` or nginx) | 대시보드 SPA |

추가로 `src/retention-cleanup.ts` — cron으로 도는 1회성 CLI 엔트리(`createApplicationContext`),
오래된 메트릭 행 정리 후 종료. 새 프로젝트에서 배치 작업이 필요하면 이 패턴을 그대로 쓴다.

`ENABLE_WORKER` 플래그 하나로 같은 코드가 API/Worker로 갈리는 구조라, 모듈에서
`providers: [...(configService.get('ENABLE_WORKER') ? [CrawlProcessor] : [])]` 식으로
조건부 등록하면 된다 (`src/queue/queue.module.ts` 참고).

### 2.2 데이터 흐름

```
외부 시스템(Laravel 등) → REST API (x-api-key 인증)
        ↓
   작업 단위 생성 (search_history / search_jobs)
        ↓
   BullMQ Queue 등록 ──────────────→ Worker 프로세스가 소비
                                          ↓
                                   Adapter로 외부 소스 수집
                                          ↓
                              DB 저장 + Elastic 색인 + 실시간 진행률(Socket.IO)
                                          ↓
                              AI 매칭/스코어링 (선택)
                                          ↓
                              규칙 엔진 → 케이스 자동 생성 (선택)
                                          ↓
                              외부 시스템으로 콜백 POST (선택)
```

이 흐름 자체(비동기 잡 + 큐 + 실시간 진행률 + 완료 콜백)는 도메인 무관하게 재사용 가능한 골격이다.

### 2.3 Config 모듈 패턴

`src/config/`에 관심사별로 파일을 쪼개고 `registerAs('app', () => ({...}))` 형태로 선언,
`src/config/index.ts`가 `configs` 배열로 모아 `ConfigModule.forRoot({ load: configs })`에 전달.
새 프로젝트에서도 관심사(예: `payment.config.ts`, `notification.config.ts`)별로 파일을 추가하는
방식을 그대로 따르면 된다. `validate-production-secrets.ts`(부팅 시 기본 시크릿 값이면 부팅 거부)도
그대로 재사용 가치가 높다.

### 2.4 로깅 파이프라인

`nestjs-pino` → 커스텀 CommonJS transport 2개(`logging/pino-json-file-transport.cjs`,
`logging/pino-json-stdout-transport.cjs`) 동시 사용:

- 파일: `pino-roll`로 일/용량 기준 로테이션, `logs/{api|worker|web}/current.log`
- stdout: PM2/Docker가 그대로 캡처 (컨테이너 로그 = 구조화 JSON)
- `x-api-key`/`authorization`/`cookie` 등 민감 헤더는 `redact`로 마스킹
- Ubuntu에서는 `deploy/logrotate/`가 PM2 stdout 캡처 파일까지 추가로 로테이션

---

## 3. 폴더 구조

### 3.1 Backend (`src/`)

```
src/
  main.ts                # API 엔트리
  worker.ts              # Worker 엔트리 (같은 AppModule, HTTP 없음)
  retention-cleanup.ts    # 배치 CLI 엔트리
  register-paths.ts       # dist 실행 시 @/* alias 리졸버
  app.module.ts

  config/                # 관심사별 registerAs 설정 (app/db/redis/elastic/...)
  common/                 # Guard(ApiKeyGuard), Filter(전역 예외), Utils, 상수
  database/                # Entity, Migration, Seed, TypeORM datasource
  queue/                   # BullMQ Producer/Processor/DLQ 관리 API
  elastic/                 # 색인/검색 서비스
  storage/                 # 파일(이미지) 저장/서빙
  progress/                # Socket.IO 게이트웨이 (실시간 진행률)

  crawler/                 # ── 도메인 특화: 외부 소스 수집 ──
    adapter/                 어댑터 인터페이스 + Base 2종 + 사이트별 구현 + Registry
    crawler.module.ts / crawler.service.ts

  ai/                       # ── 도메인 특화: 판단/매칭 엔진 ──
    ai.service.ts             단일 진입점
    providers/                 openai/anthropic/gemini 구현체
    prompt/                    버전 관리되는 프롬프트 템플릿
    rules/                     규칙 엔진 (케이스 자동 생성)
    local-image/                Vision 호출 전 무료 로컬 게이트
    cost/                       호출 비용/사용량 로깅

  api/                      # ── 도메인 특화: 외부 시스템(백오피스) 연동 클라이언트 ──
    rental.client.ts / rental.service.ts / rental.types.ts

  modules/
    search/  crawl/  cache/  health/  stats/    # 범용 API
    investigation/  search-job/  retention/      # 도메인 특화 API

web/                       # Vite 대시보드 (3.2 참고)
ecosystem.config.js        # PM2 (api + worker + web)
docker-compose.yml
```

### 3.2 Frontend (`web/src/`)

```
web/src/
  main.tsx        # Provider 조립 (Router → Feature Context → App → ToastHost)
  App.tsx          # 라우트 + 공유 상태(health/stats/progress) 오케스트레이션
  api.ts            # 단일 request<T>() + 플랫 메서드 객체
  types.ts           # 전역 API 응답/도메인 타입
  index.css

  components/         # 페이지 조립용 공유 컴포넌트 (AppShell, AppSidebar, Toast 등)
  components/ui/       # 디자인시스템 프리미티브 (button/badge/card/timeline/...)
  config/
    navigation.ts       # 사이드바+라우트 단일 소스 (NAV_SECTIONS)
  pages/                # 라우트 단위 페이지
  features/             # 도메인별 기능 모듈 (아래 패턴)
    investigation/
      types.ts                    도메인 타입 + 서버 DTO
      <feature>-context.ts        createContext<T | null>
      use<Feature>.ts              useContext 훅 (+ Optional 변형)
      <Feature>Provider.tsx         상태/뮤테이션 + 전역 오버레이(Drawer) 렌더
      index.ts                      배럴 export (다른 코드는 여기서만 import)
      components/ hooks/ lib/       기능 전용 UI/훅/순수함수
  lib/
    utils.ts   # cn() = twMerge(clsx(...))
    format.ts  # 라벨/날짜/가격 포맷터
    socket.ts  # socket.io 싱글턴 + subscribe 헬퍼
```

---

## 4. 재사용 가능한 핵심 설계 패턴 (새 프로젝트로 그대로 가져갈 것)

### 4.1 Backend

| 패턴 | 위치 | 요지 |
|---|---|---|
| **외부 API 연동 3파일 분리** | `src/api/rental.*` | `*.client.ts`(순수 HTTP) / `*.service.ts`(도메인 매핑) / `*.types.ts`. 컨트롤러는 client를 직접 호출하지 않고 service만 의존 |
| **비동기 Job + 콜백** | `search-job` 모듈 | 요청 즉시 `{jobId, status:'pending'}` 반환 → 완료 후 외부 시스템에 콜백 POST. 동기 대기 금지 |
| **Adapter 패턴** | `crawler/adapter/` | 인터페이스 1개(`search/parse/normalize/crawl`) + 성격이 다른 Base 추상클래스 2종(HTTP fetch용 / 브라우저 자동화용) + `Registry`가 `Map<code, adapter>`로 관리. "여러 외부 소스를 동일 인터페이스로 다룬다"는 요건이면 도메인 무관하게 재사용 |
| **Queue Producer/Consumer + DLQ** | `src/queue/` | enqueue 시 `attempts`+지수 backoff, 실패 소진 시 별도 DLQ 큐로 이동 + 재시도 Admin API |
| **Provider 추상화 + 사용량 로깅** | `src/ai/` | 인터페이스 + DI 토큰으로 벤더 교체 가능하게, 모든 호출(성공/실패/재시도)을 별도 테이블에 기록 — LLM이 아니어도 "과금되는 외부 API 호출"이면 재사용 가치 있음 |
| **정책 기반 자동화(규칙 엔진)** | `src/ai/rules/` | 임계값 기반 조건들을 DB/env로 구성 가능하게 분리 |
| **API Key Guard + 프로덕션 시크릿 가드** | `common/guards/api-key.guard.ts`, `config/validate-production-secrets.ts` | 헤더 기반 서버-to-서버 인증 + 기본값으로 프로덕션 부팅 거부 |
| **전역 예외 필터** | `common/filters/all-exceptions.filter.ts` | 응답 포맷 통일 |
| **마이그레이션 워크플로우** | `docs/database_migrations.md` | dev는 `synchronize: true`, prod는 마이그레이션 전용. 파일명 `<epoch>-<PascalCase>.ts` |
| **로깅 파이프라인** | 2.4 참고 | 그대로 복사해서 서비스명만 바꿔도 됨 |

### 4.2 Frontend

| 패턴 | 위치 | 요지 |
|---|---|---|
| **Feature 모듈** | `features/investigation/` | Context+Provider+hook+types+index 배럴로 도메인 단위 캡슐화. 새 기능 추가 시 이 6종 파일 세트를 그대로 복제 |
| **Nav 단일 소스** | `config/navigation.ts` | `NAV_SECTIONS` 배열 하나가 사이드바+active 판정+서브탭(쿼리스트링) 전부의 근거. 새 메뉴는 여기 항목 추가 + `App.tsx`에 라우트 1줄 추가로 끝 |
| **API client 단일 헬�터** | `api.ts` | `request<T>()` 하나 + 플랫 메서드 객체. 타입은 호출부에서 `import('./types').X`로 지연 import |
| **UI 프리미티브** | `components/ui/` | `cva` 기반 variant API(button/badge) + `cn()` 유틸. 새 프리미티브 추가 시 이 컨벤션 유지 |
| **반응형 3단 Shell** | `AppShell.tsx` | Desktop(고정 사이드바) / Tablet(아이콘만) / Mobile(드로어) — breakpoint만 프로젝트 취향대로 조정 |
| **Realtime + Poll fallback** | `lib/socket.ts` + `App.tsx`의 setInterval | 소켓 이벤트를 우선 쓰되 유실 대비 2초 폴링 병행 |
| **디자인 토큰** | `tailwind.config.js`, [`폰트_개선_v3.md`](./폰트_개선_v3.md) | 컬러/타이포/그림자를 Tailwind theme.extend로 토큰화. v3 문서가 최신 가이드(Pretendard, elevation 3단, 다크모드) |

---

## 5. 이 프로젝트 고유 도메인 로직 (새 프로젝트에서는 교체 대상)

새 업무용 대시보드를 만들 때 **아래는 걷어내고 새 도메인 것으로 대체**한다.

1. **크롤러 어댑터 3종** (`joonggonara.adapter.ts`, `bungae.adapter.ts`, `karrot.adapter.ts`) —
   중고거래 사이트별 스크래핑 로직. → 새 프로젝트의 "외부 데이터 소스"에 맞는 어댑터로 교체
   (Adapter 패턴 자체는 4.1에서 재사용).
2. **Investigation(조사 케이스) 워크플로우** — 상태(Open/Investigating/Review/Completed/Archived),
   우선순위, 담당자, 타임라인/최종판정. → 새 프로젝트의 "사람이 검토해야 하는 단위" 개념으로 교체
   (있다면). 없는 도메인이면 이 모듈 자체를 제거.
3. **Rental/백오피스 연동** (`src/api/rental.*`, `search-job` 모듈) — 렌탈 주문/계약 조회 및
   콜백. → 새 프로젝트가 연동할 실제 외부 시스템(다른 어드민, ERP 등)의 client/service로 교체
   (3파일 분리 패턴은 재사용).
4. **AI 매칭 엔진의 도메인 가중치·프롬프트** — 브랜드/모델/가격/이미지 등 9개 항목 가중 평균,
   `matching`/`ocr`/`investigation`/`report` 프롬프트 템플릿. → 프로바이더 추상화·비용 로깅·로컬
   게이트 구조는 재사용하되, 스코어링 기준과 프롬프트 내용은 새 판단 기준으로 전면 교체.
5. **DB 엔티티** — `search_history*`, `crawler_result`, `crawler_site`, `investigation_cases`,
   `image_hash` 등. → 새 도메인 스키마로 교체, 마이그레이션 워크플로우만 재사용.
6. **사이드바 메뉴 구성** (`NAV_SECTIONS`: Search/Rental/Investigation/Analytics/System) → 새
   도메인 메뉴로 교체 (구조/패턴은 재사용).

---

## 6. 새 업무용 대시보드 제작 체크리스트

1. **레포 복제** → 루트 `package.json`/`web/package.json`의 `name`, `README.md`, `ecosystem.config.js`의
   앱 이름(`crawler-api` 등), `docker-compose.yml`의 서비스명/컨테이너명을 새 프로젝트명으로 변경.
2. **그대로 유지**: 1장 스택 전체, 2장 프로세스 구조(API/Worker/Web 3분리, `ENABLE_WORKER` 플래그),
   Config 모듈 패턴, 로깅 파이프라인, Guard/Filter, 마이그레이션 워크플로우, 4장의 모든 설계 패턴,
   디자인 토큰 기반(팔레트/폰트/굵기만 새 브랜드에 맞게 교체 — [`폰트_개선_v3.md`](./폰트_개선_v3.md) 3장 참고).
3. **교체**: 5장 항목 전부 — 어댑터를 새 데이터 소스로, Investigation을 새 검토 단위로(불필요하면
   제거), Rental client를 새 외부 연동으로, AI 가중치/프롬프트를 새 판단 기준으로, DB 엔티티를 새
   스키마로, 사이드바 메뉴를 새 도메인으로.
4. **환경변수 재정의**: 8장 카탈로그의 카테고리 구조(App/Logging/DB/Queue/Elastic/외부연동/AI 등)는
   유지하되, 도메인 특화 변수명(`RENTAL_*`, `INVESTIGATION_*`, `AI_LOCAL_*` 등)은 새 도메인에 맞는
   이름으로 다시 정의. `validate-production-secrets.ts`의 필수 시크릿 목록도 새 프로젝트 기준으로 갱신.
5. **AI 사용 여부 재검토**: 매칭/판단 로직이 필요 없는 대시보드라면 `src/ai/` 모듈 전체와 관련 env를
   드롭 — 억지로 유지할 필요 없음.
6. **배포 방식 그대로 재사용**: `ecosystem.config.js`(PM2 3프로세스) / `docker-compose.yml` 골격을
   복사해서 서비스명·포트만 바꾸면 됨 (7장 스크립트 표 참고).

---

## 7. 개발/배포 스크립트 (그대로 재사용 가능)

### 7.1 `r.bat` (Windows 로컬 개발)

| 명령 | 동작 |
|---|---|
| `r` | 인프라 + API + Worker + Web 전체 기동 |
| `r all` | 인프라는 이미 떠 있다고 가정, 앱 3개만 |
| `r infra` | `postgres`/`redis`/`elastic`만 up |
| `r api` / `r worker` / `r web` | 개별 프로세스만 |
| `r down` | 인프라 중지 |

### 7.2 npm 스크립트

| 스크립트 | 설명 |
|---|---|
| `npm run dev` | `r`과 동일 |
| `npm run start:dev:api` | Nest API watch (`ENABLE_WORKER=false`) |
| `npm run start:worker:dev` | Worker (ts-node, `ENABLE_WORKER=true`) |
| `npm run web:dev` | Vite 개발 서버 (`127.0.0.1:5173`, `/api` → `127.0.0.1:3100` 프록시) |
| `npm run build` / `web:build` / `build:all` | Nest / 웹 / 둘 다 빌드 |
| `npm run migration:run` / `:prod` | 마이그레이션 실행 (dev/prod datasource) |
| `npm run pm2:start` / `:reload` / `:stop` / `:logs` | PM2 운영 명령 |
| `npm run infra:up` / `infra:down` | Docker Compose 인프라만 |

### 7.3 로컬 접속 URL

| 항목 | URL |
|---|---|
| Web 대시보드 | http://127.0.0.1:5173 |
| API | http://127.0.0.1:3100 |
| API Docs | http://127.0.0.1:3100/docs |
| Health | http://127.0.0.1:3100/api/health |

> Windows에서 `localhost`는 IPv6(`::1`)로 풀려 `ENOBUFS`가 날 수 있음 — DB/Redis/Elastic/브라우저
> 접속은 항상 `127.0.0.1` 사용.

---

## 8. 환경변수 카탈로그 (카테고리별, 이름/용도만)

전체 값·기본값은 [`환경변수.md`](./환경변수.md) 참고. 아래는 새 프로젝트 설계 시 "이 카테고리는
반드시 있어야 한다"는 체크리스트 용도.

| 카테고리 | 대표 변수 | 새 프로젝트에서 |
|---|---|---|
| App/보안 | `NODE_ENV` `PORT` `API_KEY` `JWT_SECRET` `RATE_LIMIT_*` | 그대로 |
| 로깅 | `LOG_APP` `LOG_LEVEL` `LOG_DIR` `LOG_RETENTION` `TYPEORM_LOGGING` | 그대로 |
| DB | `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | 그대로 |
| Queue/Redis | `REDIS_HOST` `CRAWL_QUEUE_NAME` `CRAWL_CONCURRENCY` `CRAWL_ATTEMPTS` `QUEUE_FAILED_*` | 큐 이름만 도메인에 맞게 |
| 검색 인덱스 | `ELASTIC_NODE` `ELASTIC_INDEX` | 인덱스명만 교체 |
| 외부 소스 수집 | `PLAYWRIGHT_HEADLESS` `ENABLE_WORKER` `CRAWLER_*` | 어댑터 성격에 맞게 재정의 |
| 이미지 다운로드 가드(SSRF) | `IMAGE_MAX_BYTES` `IMAGE_DOWNLOAD_ALLOW_HOSTS` `IMAGE_ALLOW_HTTP` | 파일 다운로드 있으면 그대로 |
| 외부 시스템 연동 | `RENTAL_API_BASE_URL` `RENTAL_API_KEY` `RENTAL_*_PATH` `RENTAL_SEARCH_CALLBACK_*` | 변수명을 새 연동 대상으로 rename |
| 도메인 자동화 임계값 | `INVESTIGATION_AI_SCORE_THRESHOLD` `INVESTIGATION_AUTO_CREATE` | 새 도메인 판정 기준으로 재정의 |
| AI 엔진 | `AI_ENABLED` `AI_PROVIDER` `AI_VISION_PROVIDER` `OPENAI_*` `ANTHROPIC_*` `GEMINI_*` `AI_MAX_RETRIES` | AI 미사용 시 전체 드롭 가능 |
| 로컬 이미지 게이트 | `AI_LOCAL_IMAGE_GATE` `AI_LOCAL_*_THRESHOLD` | 이미지 비교 도메인이 아니면 드롭 |
| Frontend(Vite) | `VITE_API_BASE` `VITE_SOCKET_URL` | 그대로 (백오피스 URL 템플릿류만 교체) |

---

## 9. API 요약 (현재 프로젝트 예시 — 새 도메인 설계 시 참고용 형태)

인증: 헤더 `x-api-key: <API_KEY>`

| 메서드/경로 | 설명 |
|---|---|
| `POST /api/search` | 캐시 있으면 즉시 반환, 없으면 Queue 등록 (동기 응답 + 비동기 처리 하이브리드) |
| `GET /api/search/:id` | 작업 상태 + 결과 조회 |
| `GET /api/result` | 결과 목록 (필터/페이지네이션) |
| `POST /api/crawl` | 캐시 무시 강제 실행 |
| `DELETE /api/cache` | 캐시 삭제 |
| `GET /api/health` | 헬스 체크 (Terminus) |
| `GET /api/stats` | 대시보드 통계 |
| `POST /api/search-jobs` | 외부 시스템발 비동기 잡 생성 (`{jobId, status:'pending'}` 즉시 응답) |
| `GET /api/search-jobs/:id/progress` | 폴링용 진행률 조회 (Socket.IO 보완) |

외부 시스템(Laravel 등) 연동 예시는 [`README.md`](../README.md) "Laravel 연동 예시" 섹션 참고 —
`x-api-key` 헤더 + POST 후 반환된 `searchId`/`jobId`로 상태를 조회하는 패턴 자체가 재사용 템플릿이다.
