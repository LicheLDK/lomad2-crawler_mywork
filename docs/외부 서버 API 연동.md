# 외부 서버 API 연동 가이드

Laravel 쇼핑몰 등 **외부 서버**에서 렌탈 상품명으로 중고거래 재판매 여부를 조회할 때 사용하는 REST API 정리입니다.

- Base URL: `http://{host}:3100/api`
- 대화형 문서: `http://{host}:3100/docs` · Swagger `http://{host}:3100/docs/swagger`
- 인증: 모든 보호 API에 헤더 `x-api-key` 필수 (값은 서버 `.env`의 `API_KEY`)

> API 프로세스와 **Worker**가 모두 떠 있어야 크롤 검색이 완료됩니다.  
> 캐시 히트만 쓰는 경우에도 API는 필요하며, 강제 크롤·신규 키워드는 Worker 필수입니다.

---

## 1. 추천 연동 흐름 (상품 1건 검색)

```
외부 서버                    Search Crawler
   │                              │
   │  POST /api/search            │
   │  { keyword, externalProductId, sites, referenceImageUrl? }
   │ ─────────────────────────────►│
   │                              │  Elastic 캐시 있으면 → 즉시 results
   │                              │  없으면 Queue → Worker 크롤
   │  { searchId, status, ... }   │
   │ ◄─────────────────────────────│
   │                              │
   │  (status 가 queued/running 이면 폴링)
   │  GET /api/search/{searchId}  │
   │ ─────────────────────────────►│
   │  { status, results[] }       │
   │ ◄─────────────────────────────│
   │                              │
   │  status ∈ completed|partial|failed|cached 이면 종료
```

### 상태(`status`) 의미

| status | 의미 | 외부 서버 동작 |
|--------|------|----------------|
| `cached` | Elastic 캐시 히트, 결과 즉시 포함 | 폴링 불필요, `results` 사용 |
| `queued` | 크롤 대기열 등록됨 | 1~2초 간격 폴링 |
| `running` | Worker 크롤 중 | 폴링 계속 |
| `completed` | 정상 완료 | `results` 사용 |
| `partial` | 일부 사이트만 성공 | `results` + `errorMessage` 확인 |
| `failed` | 실패 | `errorMessage` 확인 |
| `pending` | 생성 직후(드묾) | 폴링 |

---

## 2. 인증

```http
x-api-key: {API_KEY}
Content-Type: application/json
```

- 누락/불일치 → `401 Unauthorized`
- Rate limit: `.env`의 `RATE_LIMIT_TTL` / `RATE_LIMIT_LIMIT` (기본 60초 100회)

---

## 3. 사이트 코드

| code | 사이트 |
|------|--------|
| `joonggonara` | 중고나라 |
| `bungae` | 번개장터 |
| `karrot` | 당근 |

`sites` 생략 시 위 3개 전부 검색합니다.

---

## 4. API 목록

### 4.1 상품 검색 (핵심)

```http
POST /api/search
```

**Request body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `keyword` | string | ✅ | 검색 키워드 (상품명), 1~255자 |
| `externalProductId` | string | | 외부 상품 ID (추적용, 예: Laravel product id) |
| `sites` | string[] | | 검색 사이트. 생략 시 전체 |
| `maxResultsPerSite` | int | | 사이트당 최대 결과 (1~50, 기본 20) |
| `referenceImageUrl` | string(url) | | 렌탈 상품 원본 이미지 URL (이미지 유사도용) |
| `useCache` | boolean | | `true`(기본): Elastic 캐시 우선. `false`: 캐시 무시하고 크롤 큐 |
| `cacheOnly` | boolean | | `true`: 캐시만 조회, 없으면 크롤하지 않음 |

**Response 예시 — 캐시 히트**

```json
{
  "searchId": "2b2faffa-fb37-4fe9-b433-001506757942",
  "status": "cached",
  "source": "cache",
  "resultCount": 2,
  "results": [
    {
      "id": "a3251570-999f-45b5-9100-bc58fe333256",
      "searchHistoryId": "2b2faffa-fb37-4fe9-b433-001506757942",
      "siteCode": "joonggonara",
      "title": "브리온베가 스피커 라디오포노그라포 …",
      "price": null,
      "seller": null,
      "region": null,
      "url": "https://web.joongna.com/product/218828249",
      "imageUrl": "https://img2.joongna.com/…",
      "screenshotUrl": null,
      "titleSimilarity": 0.31,
      "imageSimilarity": null,
      "createdAt": "2026-07-24T08:52:38.877Z",
      "source": "elastic-cache"
    }
  ]
}
```

**Response 예시 — 크롤 큐 등록**

```json
{
  "searchId": "a069851d-b90c-4e18-b77c-10a3b5043905",
  "status": "queued",
  "source": "crawl",
  "jobId": "12",
  "resultCount": 0,
  "results": []
}
```

---

### 4.2 검색 상태 · 결과 조회 (폴링)

```http
GET /api/search/{searchId}
```

- `searchId`: UUID (`POST /search` 응답값)

**Response**

```json
{
  "searchId": "a069851d-…",
  "keyword": "라디오포노그라포",
  "status": "completed",
  "resultCount": 2,
  "sites": ["joonggonara", "bungae", "karrot"],
  "errorMessage": null,
  "startedAt": "2026-07-24T08:52:33.813Z",
  "finishedAt": "2026-07-24T08:52:42.352Z",
  "createdAt": "2026-07-24T08:52:33.734Z",
  "referenceImageUrl": null,
  "results": [ /* Result 객체 배열 — 아래 스키마 */ ]
}
```

**결과 객체(`results[]`) 필드**

| 필드 | 설명 |
|------|------|
| `id` | 결과 UUID |
| `siteCode` | `joonggonara` / `bungae` / `karrot` |
| `title` | 게시글 제목 |
| `price` | 가격 문자열 또는 null |
| `seller` / `region` | 판매자 · 지역 (있으면) |
| `url` | 원본 게시글 URL (항상 새 탭으로 열 것) |
| `imageUrl` | 원본 썸네일 URL |
| `screenshotUrl` | 서버 저장 이미지 상대경로 `storage/images/{id}` (없으면 null) |
| `titleSimilarity` | 제목 유사도 0~1 |
| `imageSimilarity` | 이미지 유사도 0~1 (referenceImageUrl 있을 때) |
| `description` | 설명 (크롤 저장분) |
| `createdAt` | 수집 시각 |

**스크린샷 절대 URL**

```
http://{host}:3100/api/storage/images/{resultId}
```

(`GET /api/storage/images/:resultId` 는 API Key 없이 img 태그용)

---

### 4.3 결과 목록 조회 (필터 · 페이지)

```http
GET /api/result?keyword=&site=&searchId=&page=1&limit=20
```

| 쿼리 | 설명 |
|------|------|
| `keyword` | 제목 ILIKE 검색 |
| `site` | 사이트 코드 |
| `searchId` | 특정 검색 이력만 |
| `page` / `limit` | 페이지 (limit 최대 100) |

**Response**

```json
{
  "page": 1,
  "limit": 20,
  "total": 2,
  "items": [ /* Result DTO */ ]
}
```

---

### 4.4 강제 크롤 (캐시 무시)

```http
POST /api/crawl
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `keyword` | ✅ | 검색어 |
| `sites` | | 사이트 배열 |
| `maxResultsPerSite` | | 1~50 |
| `externalProductId` | | 외부 상품 ID |

**Response**

```json
{
  "searchId": "…",
  "jobId": "…",
  "status": "queued",
  "sites": ["joonggonara", "bungae", "karrot"]
}
```

이후 `GET /api/search/{searchId}` 로 폴링합니다.

---

### 4.5 지원 사이트 목록

```http
GET /api/crawl/sites
```

```json
[
  { "code": "joonggonara", "name": "중고나라" },
  { "code": "bungae", "name": "번개장터" },
  { "code": "karrot", "name": "당근" }
]
```

---

### 4.6 헬스 체크

```http
GET /api/health
```

- API Key **불필요**
- Postgres / Redis / Elastic / Queue 상태 포함

---

### 4.7 통계 (운영)

```http
GET /api/stats
```

검색·결과 집계, 사이트별, 인기 키워드, 최근 검색, 14일 추세, Queue 카운트.

---

### 4.8 캐시 삭제

```http
DELETE /api/cache
```

Redis 검색 캐시 flush. (Elastic 인덱스는 유지)

---

## 5. 실시간 진행률 (선택)

폴링 대신 Socket.IO 를 쓸 수 있습니다.

| 항목 | 값 |
|------|-----|
| URL | `http://{host}:3100/crawl` (namespace) |
| 구독 | emit `subscribe` `{ "searchId": "…" }` |
| 이벤트 | `progress` / `progress:broadcast` |

**progress payload**

```json
{
  "searchId": "…",
  "keyword": "…",
  "status": "running",
  "percent": 45,
  "currentSite": "bungae",
  "completedSites": ["joonggonara"],
  "pendingSites": ["karrot"],
  "resultCount": 12,
  "totalSites": 3,
  "message": "번개장터 수집 중",
  "at": "2026-07-24T09:00:00.000Z"
}
```

외부 서버( Laravel 등)는 보통 **폴링만으로 충분**합니다. 브라우저 대시보드용 실시간 UI에 WebSocket을 쓰는 것을 권장합니다.

---

## 6. 호출 예시

### 6.1 curl (Windows PowerShell)

한글 body는 UTF-8 파일로 보내는 것이 안전합니다.

`req.json`:

```json
{
  "keyword": "라디오포노그라포",
  "externalProductId": "PROD-10001",
  "sites": ["joonggonara", "bungae", "karrot"],
  "maxResultsPerSite": 20,
  "useCache": true,
  "referenceImageUrl": "https://example.com/rental/product.jpg"
}
```

```powershell
curl.exe -X POST http://127.0.0.1:3100/api/search `
  -H "Content-Type: application/json; charset=utf-8" `
  -H "x-api-key: change-me-api-key" `
  --data-binary "@req.json"

curl.exe http://127.0.0.1:3100/api/search/{searchId} `
  -H "x-api-key: change-me-api-key"
```

### 6.2 PHP (Laravel Http)

```php
use Illuminate\Support\Facades\Http;

$base = rtrim(config('services.crawler.base'), '/'); // 예: http://127.0.0.1:3100/api
$key  = config('services.crawler.key');

// 1) 검색 시작
$start = Http::withHeaders(['x-api-key' => $key])
    ->post("{$base}/search", [
        'keyword' => $product->name,
        'externalProductId' => (string) $product->id,
        'sites' => ['joonggonara', 'bungae', 'karrot'],
        'maxResultsPerSite' => 20,
        'useCache' => true,
        'referenceImageUrl' => $product->image_url, // 선택
    ])
    ->throw()
    ->json();

$searchId = $start['searchId'];
$status = $start['status'];
$results = $start['results'] ?? [];

// 2) 캐시 미히트면 폴링 (최대 ~60초)
$terminal = ['completed', 'partial', 'failed', 'cached'];
$attempts = 0;

while (!in_array($status, $terminal, true) && $attempts < 30) {
    usleep(2_000_000); // 2초
    $detail = Http::withHeaders(['x-api-key' => $key])
        ->get("{$base}/search/{$searchId}")
        ->throw()
        ->json();

    $status = $detail['status'];
    $results = $detail['results'] ?? [];
    $attempts++;
}

// 3) 유사도 높은 순으로 활용
usort($results, fn ($a, $b) =>
    ($b['titleSimilarity'] ?? 0) <=> ($a['titleSimilarity'] ?? 0)
);

return [
    'searchId' => $searchId,
    'status' => $status,
    'results' => $results,
];
```

`config/services.php` 예시:

```php
'crawler' => [
    'base' => env('CRAWLER_API_BASE', 'http://127.0.0.1:3100/api'),
    'key'  => env('CRAWLER_API_KEY', 'change-me-api-key'),
],
```

### 6.3 최신 결과만 다시 가져오기

이미 `searchId`를 저장해 둔 경우:

```http
GET /api/search/{searchId}
```

또는 상품 ID로 과거 결과를 모을 때는 `externalProductId`를 검색 시 넣고, 운영 DB(`search_history`)에서 조회하거나 `GET /api/result?keyword=` 로 보완합니다.

---

## 7. 에러 · 주의사항

| 상황 | 대응 |
|------|------|
| `401` | `x-api-key` 확인 |
| `404` on `GET /search/:id` | 잘못된 UUID |
| `429` | Rate limit — 폴링 간격 늘리기 |
| `status=queued` 가 오래 유지 | Worker 미기동 (`r worker` / PM2 `crawler-worker`) |
| `results` 비어 있고 `completed` | 해당 키워드 매칭 게시글 없음, 또는 사이트 차단 |
| 이미지 안 보임 | `imageUrl` 사용. 상대경로 `screenshotUrl`은 `{API}/storage/images/{id}` |
| Windows `localhost` | `127.0.0.1` 사용 권장 |

**운영 체크리스트**

1. Docker 인프라(Postgres/Redis/Elastic) UP  
2. API + Worker 기동  
3. 외부 서버에서 `CRAWLER_API_BASE` / `CRAWLER_API_KEY` 설정  
4. `GET /api/health` → `status: ok`  
5. `POST /api/search` → `GET /api/search/{id}` 폴링

---

## 8. 엔드포인트 빠른 표

| Method | Path | Auth | 설명 |
|--------|------|------|------|
| `POST` | `/api/search` | ✅ | 검색 (캐시 → 크롤) |
| `GET` | `/api/search/:id` | ✅ | 상태·결과 조회 |
| `GET` | `/api/result` | ✅ | 결과 목록 |
| `POST` | `/api/crawl` | ✅ | 강제 크롤 |
| `GET` | `/api/crawl/sites` | ✅ | 사이트 목록 |
| `GET` | `/api/stats` | ✅ | 통계 |
| `DELETE` | `/api/cache` | ✅ | Redis 캐시 삭제 |
| `GET` | `/api/health` | ❌ | 헬스 |
| `GET` | `/api/storage/images/:resultId` | ❌ | 저장 이미지 |

Socket.IO namespace: `/crawl` (진행률, 선택)
