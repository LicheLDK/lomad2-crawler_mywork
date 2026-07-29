# 작업지시서 v3 — 우선순위 B (운영 관측성)

작성일: 2026-07-29  
근거 문서: `docs/REVIEW_v3/PROJECT_REVIEW_v3.md` §7.1 P1-C, §8 우선순위 B, U6/U7  
선행 완료: 우선순위 0 (P0), A (Search Job 1:N), D (Investigation 실 API)  
대상: TASK B-1 ~ B-8 (8단계)

---

## 0. 이 작업의 목적

검색·크롤·AI·callback은 돌아가지만, 장애 분석은 대체로 **PM2 로그를 직접 보는 수준**이다.

| 질문 | 현재 |
|------|------|
| 오늘 중고나라만 실패율이 높은가? | 알 수 없음 (건수만 있음) |
| 파싱이 왜 깨졌는가? | 문자열 로그만 |
| 큐에서 재시도 소진된 job은? | `failed` 숫자만 |
| AI 비용이 왜 뛰었는가? | API는 있으나 System UI 미연결 |
| 백오피스 callback이 실패했는가? | `callbackError` 컬럼만, 재전송 없음 |

System / Analytics 메뉴 자리는 이미 있다. 이 작업은 **이미 있는 API를 먼저 화면에 연결**하고, 이어서 **사이트 시도 기록·큐·callback**을 운영 가능하게 만든다.

---

## 1. 선행 결정 (권고안으로 확정)

### B1. 착수 순서 — **연결 먼저, 계측 나중** 확정

1. B-1 · B-2 · B-6: 마이그레이션 없이 즉시 가치 (byStatus, AI usage, callback)
2. B-3 · B-4: crawl attempt 테이블 + 사이트 성공/실패/latency
3. B-5: failed job / DLQ
4. B-7 · B-8: System Prompt/Rules, retention

근거: instrumentation 전에 UI 연결만으로도 운영 가시성이 크게 오른다.

### B2. 메트릭 저장소 — **DB 테이블** 확정

사이트별 시도는 `crawl_site_attempts` (이름 가칭)에 저장한다.  
log-only / Redis-only는 대시보드·감사에 부적합하므로 채택하지 않는다.  
(선택) 최근 24h 요약만 Redis 캐시 보조.

### B3. DLQ — **실구현 + 조회/재실행 API** 확정

`QUEUE_NAMES.CRAWL_DLQ` 상수만 두지 않는다.  
재시도 소진 시 DLQ로 옮기거나, `removeOnFail`을 완화하고 `GET /api/queue/failed` + retry를 제공한다.  
미구현이면 상수를 **삭제**해 N7(죽은 코드)을 해소한다. 권고는 **실구현**.

### B4. Retention — **90 / 180 / 14** 확정

| 데이터 | 보존 |
|--------|------|
| `crawl_site_attempts` | 90일 |
| `ai_usage_logs` | 180일 |
| Bull failed / DLQ | 14일 또는 최근 500건 |

### B5. Analytics Investigation 패널 — **이중 byStatus** 확정

| 패널/섹션 | 소스 |
|-----------|------|
| 검색 상태 분포 | `GET /stats` → `byStatus` (SearchHistory) |
| Investigation 상태 분포 | `GET /investigations/stats` → `byStatus` (Case) |

라벨을 명확히 구분해 혼동을 막는다.

### B6. Callback — **자동 재시도 없음 + 수동 resend** 확정

현행 1회 전송 + `callbackSentAt` 멱등을 유지한다.  
실패 시 `callbackError` 노출 + `POST /api/search-jobs/:id/callback/resend`.  
자동 backoff 재시도는 2차(범위 밖 또는 B-6 후속).

### B7. Adapter 버전 — **코드 상수** 확정

각 adapter에 `ADAPTER_VERSION = '1'` (또는 semver 문자열)을 두고 attempt 행에 기록한다.  
배포마다 올리는 운영 규칙으로 둔다 (자동화는 후속).

---

## 2. 현재 코드 스냅샷 (기준)

### 이미 있는 것

| 자산 | 위치 | UI |
|------|------|-----|
| `GET /api/stats` (`bySite`, `byStatus`, `queue`) | `stats.service.ts` | Analytics 일부만 |
| `GET /api/health` | `health.controller.ts` | System 일부 |
| `GET /api/ai/usage/*` | `ai-usage.controller.ts` | Overview today만 |
| `GET /api/ai/prompts`, `/ai/rules` | prompt/rules controllers | System 준비중 |
| `search_jobs.callbackSentAt`, `callbackError` | entity | 재전송 API 없음 |
| `GET /api/investigations/stats` | D에서 추가 | Overview |

### 없는 것

- `errorCode` / `adapterVersion` / `responseStatus` / site latency 저장
- DLQ 실사용, failed job 목록 API
- callback resend, callback 실패율 집계
- System AI cost / Prompt / Rules 실데이터 카드

---

## 3. 공통 규칙

| 항목 | 내용 |
|------|------|
| 커밋 | TASK 1개 = 커밋 1개 |
| 채팅 | TASK마다 **새 채팅**. 「다음으로?」에 바로 예 금지 |
| push | 각 TASK 후 push → **build-test** (마이그레이션 있으면 **migration-test**) 초록 |
| 마이그레이션 | B-3 (및 B-8 선택). `down()` + `up`/`revert`/`up` 왕복 |
| 배포 | B-3 반영 운영 시 `npm run migration:run:prod` 필수 (`배포.md` B-5) |
| 범위 밖 | AI Vision 실구현(C), Investigation Evidence CRUD, 전역 API key(E), code splitting |

### 착수 전 baseline

```bash
git pull origin main
npm install && npm --prefix web install
npm run lint:ci
npm run web:lint:ci
npm run build
npx jest --runInBand
npm --prefix web run build
```

---

## TASK B-1. Analytics에 byStatus 연결 (빠른 가치)

**목적**: 이미 있는 집계를 화면에 표시한다. 백엔드 변경 최소.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `web/src/pages/AnalyticsPage.tsx` | 검색 상태 = `stats.byStatus`, Investigation = `investigations/stats.byStatus` |
| `web/src/api.ts` / types | 필요 시 stats·investigation stats 타입 정리 |
| `web/src/App.tsx` (선택) | investigation stats fetch |

### 구현 방향

1. B5 결정대로 **두 분포를 라벨 분리**해 표시.
2. AI 섹션은 이 TASK에서 건드리지 않는다 (B-2).
3. 데이터가 없으면 빈 상태 문구.

### 완료 조건

- [ ] Analytics에서 SearchHistory 상태 분포가 보인다
- [ ] Investigation 케이스 상태 분포가 보인다 (라벨 구분)
- [ ] `stats.byStatus` / investigations stats가 화면에 소비된다
- [ ] 웹 빌드·lint 통과

### 검증

```bash
npm --prefix web run build
npm run web:lint:ci
```

---

## TASK B-2. AI usage/cost → System + Analytics

**목적**: 존재하는 `/ai/usage/*`를 System·Analytics에 연결한다.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `web/src/api.ts` | `aiUsageSummary`, `aiUsageMonthly`, `aiUsageByProvider` |
| `web/src/pages/SystemPage.tsx` | AI Engine 카드 = 실데이터 (today/month/cost) |
| `web/src/pages/AnalyticsPage.tsx` | AI 섹션 = usage (키워드 대체 제거) |
| `web/src/App.tsx` (선택) | fetch 배선 |

### 구현 방향

1. Overview의 `aiUsageToday` 패턴을 재사용.
2. AI 비활성/401 시 카드에 「비활성·키 없음」 표시, 전체 화면 크래시 금지.
3. Prompt/Rules는 B-7. 이 TASK는 **usage/cost만**.

### 완료 조건

- [ ] System AI Engine이 usage/cost를 보여 준다 (준비중 아님)
- [ ] Analytics AI 섹션이 키워드 재사용이 아니라 usage 기반이다
- [ ] API 실패 시 우아한 fallback
- [ ] 웹 빌드 통과

### 검증

```bash
npm --prefix web run build
npm run web:lint:ci
```

---

## TASK B-6. Callback 실패 노출 + 재전송 API  
*(번호는 리뷰 순서이나, B1에 따라 B-1·B-2와 같이 먼저 실행)*

**목적**: `callbackError`를 운영 가능하게 하고 수동 resend를 제공한다.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `src/modules/search-job/search-job.controller.ts` | `POST :id/callback/resend` |
| `src/modules/search-job/search-job.service.ts` | resend 로직 (멱등 규칙 명시) |
| DTO | 요청/응답 |
| `web/src/api.ts`, Rental 또는 System UI | 실패 표시 + 재전송 버튼 |
| (선택) `stats` | callback 실패 건수 집계 |

### 구현 방향

1. B6: **자동 재시도 없음**. resend만.
2. resend 조건: `callbackError` 있음 또는 미전송. 이미 성공(`callbackSentAt` & error null)이면 409 또는 no-op 문서화.
3. 성공 시 `callbackSentAt` 갱신, `callbackError` null.
4. Rental Job 상세 또는 System에 실패 목록/배지.
5. spec: 성공 경로, 이미 전송된 경우, 실패 재기록.

### 완료 조건

- [ ] resend API가 Swagger에 있다
- [ ] 실패 Job을 UI에서 보고 재전송할 수 있다
- [ ] 기존 멱등(`callbackSentAt`)과 충돌하지 않는다
- [ ] jest 통과

### 검증

```bash
npm run build
npx jest --runInBand
npm --prefix web run build
```

---

## TASK B-3. Crawl attempt 구조화 기록 (마이그레이션)

**목적**: 사이트별 시도마다 성공/실패·지연·원인 코드를 저장한다.

### 스키마 권고 (`crawl_site_attempts`)

| 컬럼 | 내용 |
|------|------|
| `id` | uuid |
| `searchHistoryId` | uuid |
| `siteCode` | joonggonara / bungae / karrot |
| `success` | boolean |
| `durationMs` | int |
| `resultCount` | int |
| `errorCode` | varchar nullable (예: `HTTP_403`, `PARSE_EMPTY`, `TIMEOUT`) |
| `responseStatus` | int nullable |
| `adapterVersion` | varchar |
| `errorMessage` | text nullable (truncate) |
| `createdAt` | timestamptz |

인덱스: `(siteCode, createdAt)`, `(searchHistoryId)`.

### 변경 대상

| 파일 | 내용 |
|------|------|
| entity + migration | **신규**, `down()` 필수 |
| `crawler.service.ts` | 사이트 루프에서 attempt 기록 |
| adapters / base-* | HTTP status·errorCode throw/반환 |
| B7 | `ADAPTER_VERSION` 상수 |

### 구현 방향

1. 사이트 시작·종료 시각으로 `durationMs`.
2. HTTP 어댑터: non-OK 시 status를 error에 담거나 structured result.
3. 기록 실패가 크롤 전체를 실패시키지 않게 (warn 후 계속) — A-3 dual-write와 유사.
4. **집계 API는 B-4**. 이 단계는 기록 + migration.

### 완료 조건

- [ ] migration 왕복 + empty-volume test 통과
- [ ] 크롤 1회에 site당 attempt 행이 생긴다
- [ ] 실패 시 errorCode/responseStatus가 채워진다
- [ ] 기존 크롤/investigation spec 회귀 없음

### 검증

```bash
npm run build
npm run migration:run && npm run migration:revert && npm run migration:run
bash scripts/test-migration-empty-volume.sh
npx jest --runInBand
```

---

## TASK B-4. 사이트별 성공/실패/latency → stats + Analytics

**목적**: B-3 데이터를 운영 지표로 노출한다.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `stats.service.ts` / controller | `siteMetrics` (24h): successRate, failCount, avg/p95 latency |
| `web` Analytics Sites 섹션 | 위 지표 표시 |
| types / api.ts | |

### 구현 방향

1. 기본 창: last 24h (쿼리 `?hours=24` 선택).
2. `bySite` 건수와 병행 표시. 성공률 = success/total attempts.
3. 데이터 없으면 「아직 시도 기록 없음」.

### 완료 조건

- [ ] `/api/stats`(또는 하위 경로)에 site metrics 포함
- [ ] Analytics 사이트 섹션에 성공률·지연이 보인다
- [ ] 빌드·테스트 통과

### 검증

```bash
npm run build
npx jest --runInBand
npm --prefix web run build
```

---

## TASK B-5. Failed job / DLQ 관측

**목적**: 재시도 소진 job을 보고 재실행할 수 있게 한다.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `queue.ts`, `crawl-queue.service.ts`, processor | DLQ 이동 또는 failed 목록 API |
| controller (stats/health/queue) | `GET failed`, `POST :id/retry` |
| `SystemPage.tsx` Queue 카드 | 목록·재시도 |
| 미사용 `SITE_CRAWL` | 구현 또는 삭제 |

### 구현 방향

1. B3 결정: DLQ 실구현 권고.
2. `removeOnFail`과 보존 기간을 B4 retention과 맞춤.
3. 재실행은 동일 payload로 re-enqueue + 권한(ApiKey).
4. spec 또는 통합 테스트 최소 1개.

### 완료 조건

- [ ] failed/DLQ job을 API로 조회할 수 있다
- [ ] System Queue에서 확인·재시도 가능
- [ ] 죽은 큐 상수가 해소되었다 (구현 또는 삭제)
- [ ] 빌드·테스트 통과

### 검증

```bash
npm run build
npx jest --runInBand
npm --prefix web run build
```

---

## TASK B-7. System Prompt / Rules 실연결

**목적**: System의 Prompt·(가능하면) Rules 준비중 카드를 실 API로 채운다.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `web/src/api.ts` | prompts tree, rules active / threshold |
| `SystemPage.tsx` | Prompt / AI 관련 카드 |

### 구현 방향

1. 읽기 위주. 관리자 PUT 프롬프트 편집은 선택(권한·실수 위험 → 1차는 GET만 권고).
2. Proxy/Scheduler는 계속 준비중이어도 됨 (범위 밖).

### 완료 조건

- [ ] Prompt 카드가 실데이터(또는 명확한 빈 상태)
- [ ] create-threshold 등 rules 요약 표시(선택)
- [ ] 웹 빌드 통과

### 검증

```bash
npm --prefix web run build
```

---

## TASK B-8. Retention 정리 잡

**목적**: B4 retention을 실제로 지운다.

### 변경 대상

| 파일 | 내용 |
|------|------|
| 스케줄/스크립트 또는 Nest cron | attempts 90일, ai_usage 180일 삭제 |
| `.env.example` | retention 일수 |
| (선택) System에 마지막 cleanup 시각 |

### 구현 방향

1. 운영에서 끄기 쉬운 `METRICS_RETENTION_DAYS` 등.
2. 대량 delete는 배치(limit)로.
3. CI에서 cron까지 돌릴 필요는 없고, 서비스 메서드 단위 테스트면 충분.

### 완료 조건

- [ ] 오래된 attempt/usage를 삭제하는 경로가 있다
- [ ] env로 일수 조정 가능
- [ ] 문서(`.env.example` 또는 배포.md 한 줄)에 명시

### 검증

```bash
npm run build
npx jest --runInBand
```

---

## 4. 완료 판정

| TASK | 완료 판정 |
|------|-----------|
| B-1 | Analytics byStatus(검색+조사) 표시 |
| B-2 | System/Analytics AI usage·cost 실데이터 |
| B-6 | callback resend + UI 노출 |
| B-3 | attempt 테이블 + 크롤 기록 |
| B-4 | 사이트 성공률·latency 대시보드 |
| B-5 | failed/DLQ 조회·재시도 |
| B-7 | System Prompt(/Rules) 실연결 |
| B-8 | retention cleanup |

### 권장 실행 순서

```text
B-1 → B-2 → B-6 → B-3 → B-4 → B-5 → B-7 → B-8
```

B-1 / B-2 / B-6은 서로 독립이라 **각각 새 채팅**으로 연속 진행 가능.  
B-3 이후는 반드시 B-3 → B-4 순서.

---

## 5. 보고 형식

1. 변경 파일 + 커밋 해시  
2. 완료 조건 체크리스트  
3. 검증 결과 (B-3은 migration 왕복)  
4. 판단 근거  
5. 범위 밖으로 미룬 항목  

---

## 6. 실행 프롬프트 (복사용)

### STEP 1 — TASK B-1

```
@작업지시서_v3_B.md @PROJECT_REVIEW_v3.md

이 지시서의 TASK B-1 만 수행해줘.

먼저 §3 baseline 을 실행하고 통과하지 않으면 멈춰 보고해줘.

선행 결정 B5: Analytics 에서
- 검색 상태 분포 = GET /stats 의 byStatus
- Investigation 상태 분포 = GET /investigations/stats 의 byStatus
라벨을 구분해줘.

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- 백엔드 스키마/마이그레이션 변경 금지.
- AI 섹션·callback·crawl attempt 는 건드리지 마.
- 이 채팅에서 B-2 로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 2 — TASK B-2

```
@작업지시서_v3_B.md

이 지시서의 TASK B-2 만 수행해줘.

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- /ai/usage/summary, monthly, by-provider 를 api.ts 에 추가하고
  System AI Engine + Analytics AI 섹션에 연결.
- 키워드 차트로 AI를 대체하던 Analytics 문구/차트는 usage 기반으로 교체.
- Prompt/Rules 카드는 B-7 이므로 이번엔 건드리지 마.
- AI 미설정 시 화면이 깨지지 않게.
- 이 채팅에서 다음 TASK 로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 3 — TASK B-6

```
@작업지시서_v3_B.md

이 지시서의 TASK B-6 만 수행해줘.

선행 결정 B6: 자동 재시도 없음. POST /api/search-jobs/:id/callback/resend 만.
이미 성공한 callback 은 중복 전송하지 마 (409 또는 문서화한 no-op).

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- Rental 또는 System UI 에 callbackError 노출 + 재전송.
- spec 추가. 기존 Search Job 완료 경로 회귀 없게.
- 이 채팅에서 B-3 으로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 4 — TASK B-3

```
@작업지시서_v3_B.md

이 지시서의 TASK B-3 만 수행해줘.

선행 결정:
- B2 = DB 테이블 crawl_site_attempts (가칭)
- B7 = adapter 에 ADAPTER_VERSION 상수

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- down() 필수. up → revert → up + bash scripts/test-migration-empty-volume.sh.
- 기록 실패가 크롤 전체를 실패시키지 않게.
- 집계 API/Analytics 지표는 B-4. 이번엔 기록만.
- 이 채팅에서 B-4 로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 5 — TASK B-4

```
@작업지시서_v3_B.md

이 지시서의 TASK B-4 만 수행해줘.

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- B-3 attempt 테이블을 집계해 stats(또는 전용 엔드포인트) + Analytics Sites 에
  성공률·실패 수·평균/p95 latency 표시.
- 데이터 없을 때 빈 상태 처리.
- 이 채팅에서 B-5 로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 6 — TASK B-5

```
@작업지시서_v3_B.md

이 지시서의 TASK B-5 만 수행해줘.

선행 결정 B3: DLQ 실구현 권고. CRAWL_DLQ 상수를 구현하거나,
구현하지 않을 거면 죽은 상수를 삭제하고 failed 목록 API 로 대체해.
어느 쪽을 택했는지 보고에 명시해줘.

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- failed/DLQ 조회 + retry API + System Queue UI.
- SITE_CRAWL 미사용 상수 정리.
- 이 채팅에서 B-7 로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 7 — TASK B-7

```
@작업지시서_v3_B.md

이 지시서의 TASK B-7 만 수행해줘.

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- System Prompt 카드를 GET /ai/prompts 실데이터로.
- Rules/threshold 는 가능하면 요약 표시.
- 1차는 읽기만. PUT 프롬프트 편집 UI 는 만들지 마 (실수 위험).
- Proxy/Scheduler 준비중은 유지해도 됨.
- 이 채팅에서 B-8 로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 8 — TASK B-8

```
@작업지시서_v3_B.md @PROJECT_REVIEW_v3.md

이 지시서의 TASK B-8 만 수행해줘.

선행 결정 B4 retention: attempts 90일, ai_usage_logs 180일.

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- cleanup 서비스/스크립트 + .env.example.
- PROJECT_REVIEW_v3.md 우선순위 B / P1-C 에 해소 요약 기록.
- §3 baseline 검증까지 돌려줘.

완료 후 §5 보고 형식으로 보고해줘.
```

---

## 7. 사용자용 진행 체크

1. 이 파일 커밋·push (또는 `@작업지시서_v3_B.md` 로컬 참조)
2. STEP 1~3 (B-1, B-2, B-6) — 마이그레이션 없음, 빠르게
3. STEP 4~5 (B-3, B-4) — **migration:run:prod** 운영 필수
4. STEP 6~8 (B-5, B-7, B-8)
5. 각 STEP: 새 채팅 → 완료 → push → CI 초록 → 다음

에이전트가 「다음으로 넘어가도 될까요?」라고 하면:

```
아직 다음 TASK로 넘어가지 마.
이 채팅은 보고만 마무리해.
push 와 CI 는 내가 확인한 뒤, 다음 TASK 는 새 채팅에서 진행할 거야.
```
