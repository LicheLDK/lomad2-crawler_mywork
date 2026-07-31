# Search Crawler Server

가구 렌탈 상품이 중고거래 사이트(중고나라, 번개장터, 당근)에 재판매되었는지 탐지하는 검색 크롤러 서버입니다.  
Laravel 쇼핑몰과 독립적으로 동작하며 REST API로 연동합니다.

## 기술 스택

| 구성 | 기술 |
|------|------|
| API / Worker | NestJS |
| 브라우저 자동화 | Playwright |
| Queue | BullMQ + Redis |
| DB | PostgreSQL + TypeORM |
| 검색 인덱스 | Elasticsearch |
| 웹 대시보드 | Vite + React (`web/`) |
| 로그 | Pino |
| 운영 | PM2 / Docker Compose |

## 아키텍처 요약

```
Laravel → REST API (NestJS) → Elastic 캐시 조회
                ↓ (miss)
           BullMQ Queue → Crawler Worker → Playwright Adapter
                ↓
           PostgreSQL 저장 + Elastic Index
```

사이트별 크롤링은 Adapter Pattern으로 분리되어 있습니다.

- `JoonggonaraAdapter`
- `BungaeAdapter`
- `KarrotAdapter`

실행 시 프로세스는 항상 **3개**입니다.

| 프로세스 | 역할 |
|----------|------|
| API 서버 | REST (`ENABLE_WORKER=false`) |
| Worker 서버 | BullMQ 크롤 처리 (`ENABLE_WORKER=true`) |
| Web | 운영 대시보드 (통계 · 검색 · 결과 · 헬스) |

## 디렉터리 구조

```
src/
  config/          # 환경설정
  common/          # Guard, Filter, Utils
  database/        # Entity, Seed
  crawler/         # Adapter + CrawlerService
  queue/           # BullMQ Producer/Processor
  elastic/         # Elasticsearch
  storage/         # 이미지 저장
  modules/
    search/        # POST /api/search, GET /api/search/:id, GET /api/result
    crawl/         # POST /api/crawl
    cache/         # DELETE /api/cache
    health/        # GET /api/health
    stats/         # GET /api/stats
web/               # Vite 대시보드
ecosystem.config.js  # PM2 (api + worker + web)
```

---

## 최초 준비 (개발 · 운영 공통)

```powershell
# 1) 환경 파일
cp .env.example .env

# 2) 의존성
npm install
npm --prefix web install
npx playwright install chromium

# Windows에서 sharp 오류 시:
# npm install --os=win32 --cpu=x64 --include=optional sharp
```

`.env` 핵심 값:

| 키 | 설명 | 예시 |
|----|------|------|
| `API_KEY` | REST / 대시보드 인증 헤더 `x-api-key` | `change-me-api-key` |
| `PORT` | API 포트 | `3100` |
| `DB_HOST` / `REDIS_HOST` / `ELASTIC_NODE` | 인프라 주소 | `127.0.0.1` 권장 |
| `CRAWL_CONCURRENCY` | Worker 병렬도 | `5` |

전체 환경변수 설명: [`docs/환경변수.md`](docs/환경변수.md) · 사용 안내: [`docs/사용법.md`](docs/사용법.md)

> Windows에서 `localhost`가 `::1`(IPv6)로 해석되며 `ENOBUFS`가 날 수 있습니다.  
> DB / Redis / Elastic / 브라우저 접속은 모두 **`127.0.0.1`** 을 사용하세요.

---

## 개발 (Development)

핫 리로드 · 소스 직접 실행. 인프라는 Docker, 앱은 npm / `r.bat`.

### `r.bat` (권장)

프로젝트 루트에서:

```bat
r              인프라 + API + Worker + Web   (npm run dev)
r all          API + Worker + Web만          (인프라 이미 떠 있을 때)
r infra        postgres / redis / elastic up
r down         인프라 중지
r api          API only (watch)
r worker       Worker only
r web          대시보드 only
r help         도움말
```

```bat
r
```

| 항목 | URL |
|------|-----|
| Web 대시보드 | http://127.0.0.1:5173 |
| API | http://127.0.0.1:3100 |
| Docs | http://127.0.0.1:3100/docs |
| Swagger Try it out | http://127.0.0.1:3100/docs/swagger |
| Health | http://127.0.0.1:3100/api/health |

- `Ctrl+C` → API / Worker / Web 함께 종료 (인프라 Docker는 유지)
- 대시보드 API Key = `.env`의 `API_KEY`
- 웹 API base = `web/.env`의 `VITE_API_BASE` (기본 `http://127.0.0.1:3100/api`)

### npm / PowerShell (동일 동작)

```powershell
npm run infra:up
npm run infra:down
npm run dev          # = r
npm run dev:all      # = r all
npm run start:dev:api
npm run start:worker:dev
npm run web:dev
npm run dev:ps       # scripts/dev.ps1
npm run backup
```

| 스크립트 | 설명 |
|----------|------|
| `npm run start:dev` / `start:dev:api` | Nest API watch (`ENABLE_WORKER=false`) |
| `npm run start:worker:dev` | Worker (ts-node, `ENABLE_WORKER=true`) |
| `npm run web:dev` | Vite 개발 서버 |
| `npm run backup` | 소스 백업 스크립트 |

### 개발 시 참고

- Cursor 내장 미리보기는 Swagger JS 로딩이 불안정할 수 있음 → Chrome에서 `/docs` · `/docs/swagger` 사용
- PowerShell에서 한글 JSON body: UTF-8 파일 + `curl --data-binary @file.json`

---

## 운영 (Production)

빌드된 결과물로 기동. **인프라 = Docker**, **앱 3개 = PM2** (`crawler-api` · `crawler-worker` · `crawler-web`).

### 1) PM2 설치 (최초 1회)

```powershell
npm i -g pm2
```

### 2) 기동

```powershell
# 인프라
npm run infra:up

# Nest + 웹 빌드
npm run build:all

# 로그 폴더 (최초 1회)
New-Item -ItemType Directory -Force -Path logs

# PM2 기동 (API + Worker + Web)
npm run pm2:start
pm2 status
```

| PM2 앱 | 역할 | 모드 | 포트 |
|--------|------|------|------|
| `crawler-api` | REST API | cluster × 2 | 3100 |
| `crawler-worker` | BullMQ Worker | fork × 1 | — |
| `crawler-web` | `web/dist` 정적 서빙 (`serve`) | fork × 1 | 5173 |

| 항목 | URL |
|------|-----|
| Web | http://127.0.0.1:5173 |
| API | http://127.0.0.1:3100 |
| Docs | http://127.0.0.1:3100/docs |
| Health | http://127.0.0.1:3100/api/health |

설정은 루트 `.env`를 사용합니다. Worker 병렬도는 `CRAWL_CONCURRENCY`.

### 3) 일상 운영 명령

```powershell
npm run pm2:logs          # 로그 스트리밍
pm2 status                # 상태
pm2 monit                 # 모니터(선택)

# 코드 반영 후 재시작
npm run build:all
npm run pm2:reload        # API는 cluster 무중단 reload

# 앱만 중지 (인프라 Docker는 유지)
npm run pm2:stop

# 인프라 중지
npm run infra:down
```

| 스크립트 | 설명 |
|----------|------|
| `npm run build` | Nest `dist/` 빌드 |
| `npm run web:build` | 대시보드 `web/dist/` 빌드 |
| `npm run build:all` | 위 둘 모두 |
| `npm run pm2:start` | `ecosystem.config.js` 기동 |
| `npm run pm2:reload` | 재로드 |
| `npm run pm2:stop` | 중지 |
| `npm run pm2:logs` | 로그 |
| `npm run start:prod` | PM2 없이 API만 (`dist/main.js`) |
| `npm run start:worker` | PM2 없이 Worker만 (`dist/worker.js`) |

### 4) 전체 Docker (대안)

앱까지 Compose로 올릴 때:

```powershell
docker compose up -d --build
```

- API: http://127.0.0.1:3100  
- (웹 대시보드를 Compose에 포함하지 않은 경우 PM2/`web:dev`로 별도 기동)

---

## API 요약

인증: 헤더 `x-api-key: <API_KEY>`

### POST `/api/search`

Elastic에 결과가 있으면 즉시 반환, 없으면 Queue에 크롤 등록.

```json
{
  "keyword": "시몬스 침대 퀸",
  "externalProductId": "PROD-123",
  "sites": ["joonggonara", "bungae", "karrot"],
  "maxResultsPerSite": 20,
  "useCache": true
}
```

### GET `/api/search/:id`

검색 상태 및 결과 조회.

### GET `/api/result?keyword=&site=&searchId=&page=1&limit=20`

결과 목록.

### POST `/api/crawl`

캐시 무시 강제 크롤.

### DELETE `/api/cache`

Redis 검색 캐시 삭제.

### GET `/api/health`

헬스 체크.

### GET `/api/stats`

대시보드용 통계.

## DB 테이블

- `search_history` — 검색 요청 이력
- `search_keyword` — 키워드 집계
- `crawler_site` — 대상 사이트
- `crawler_result` — 크롤 결과 (URL unique)
- `image_hash` — 이미지 aHash

## 운영 시 주의

- 사이트 DOM/URL은 자주 변경되므로 Adapter 셀렉터를 주기적으로 점검하세요.
- robots.txt·이용약관을 준수하고, `CRAWLER_REQUEST_DELAY_MS`로 예의 있는 요청 간격을 유지하세요.
- 공개 정보만 저장하며 개인정보(연락처 등)는 수집하지 않습니다.
- 차단 시 Proxy(`CRAWLER_PROXY_URL`) 및 concurrency 조정을 검토하세요.

## Laravel 연동 예시

```php
$response = Http::withHeaders([
    'x-api-key' => config('services.crawler.key'),
])->post(config('services.crawler.url') . '/api/search', [
    'keyword' => $product->name,
    'externalProductId' => (string) $product->id,
]);

$searchId = $response->json('searchId');
```
