# 작업지시서 v3 — 우선순위 A (Search Job 단위 정확성)

작성일: 2026-07-29
근거 문서: `docs/REVIEW_v3/PROJECT_REVIEW_v3.md` §7.1 P1-A, §8 우선순위 A
선행 완료: 우선순위 0 (P0) 8개 항목 — CI 통과 확인됨
대상: TASK A-1 ~ A-6 (6단계)

---

## 0. 이 작업의 목적

주문 하나로 만든 Search Job이 키워드 N개를 검색하는데, `SearchJob` 테이블은
`searchHistoryId`를 **하나만** 가지고 있다. 그 결과:

- `runSearch()`가 **첫 번째** 크롤 히스토리만 감시하고 완료 판정을 내린다
- 나머지 크롤이 진행 중인데도 Job이 완료로 바뀐다
- `resultCount`가 첫 키워드 것만 반영된다
- 조사 케이스 생성도 첫 히스토리만 대상으로 한다
- 백오피스 callback이 미완료 상태의 부분 숫자를 보낸다

`SearchJob : SearchHistory`를 1:N으로 명시해 이 문제를 해소한다.

---

## 1. 선행 결정 (권고안으로 확정)

담당자 검토 없이 아래 확정안으로 진행한다. 이견이 있으면 해당 TASK 착수 전에 수정한다.

### A1. 중복 매물 카운트 — **distinct(고유 매물 수)** 확정

키워드 3개가 같은 매물 URL을 찾으면 Job의 `resultCount`는 **1로 센다.**

- Job `resultCount` = Job에 속한 모든 히스토리의 **고유 `resultId` 수**
- 키워드별 `resultCount` = 그 키워드가 찾은 수 그대로
- 따라서 **키워드별 합계 ≠ Job resultCount 가 정상**이다. 이 관계를 코드 주석과 API 문서에 명시한다

근거: 백오피스 담당자에게 "3건 발견"으로 보고되는 숫자다. 같은 매물이 중복 계상되면
조사 규모를 잘못 판단한다.

구현 힌트: `search_history_results`를 Job의 모든 `searchHistoryId`로 조회해
`resultId` distinct count.

### A2. 기존 `search_jobs.searchHistoryId` — **유지 + `@deprecated`** 확정

컬럼을 제거하지 않는다. 첫 크롤 히스토리를 "대표 히스토리"로 계속 채우고
`@deprecated` 주석을 붙인다.

근거: 백오피스나 프론트가 이 값을 읽는지 확실하지 않다. 컬럼 제거는 롤백이 어렵고
외부 연동을 깨뜨릴 수 있다. 실제 참조 여부는 TASK A-6에서 확인한 뒤 별도 판단한다.

### A3. 타임아웃 — **이중 상한** 확정

| 상한               | 값                             | 환경변수                        |
| ------------------ | ------------------------------ | ------------------------------- |
| 키워드별 개별 상한 | 현재와 동일 (2초 × 90회 = 3분) | `SEARCH_JOB_KEYWORD_TIMEOUT_MS` |
| Job 전체 상한      | 10분                           | `SEARCH_JOB_TOTAL_TIMEOUT_MS`   |

전체 상한 초과 시 미완료 히스토리는 timeout 처리하고 Job은 A4 규칙에 따라 판정한다.

근거: 키워드 5개 × 3분 = 15분은 백오피스가 기다리기에 너무 길다. 반대로 상한이 너무
짧으면 정상 크롤이 실패로 뜬다. 환경변수로 빼면 운영 중 조정할 수 있다.

두 값은 `.env.example`에 반드시 추가한다.

### A4. 부분 실패 — **partial 구분** 확정

| 히스토리 결과                  | Job status  |
| ------------------------------ | ----------- |
| 전부 성공                      | `completed` |
| 일부 성공 + 일부 실패/타임아웃 | `partial`   |
| 전부 실패                      | `failed`    |

근거: `SearchStatus`에 이미 `PARTIAL`이 있고 `CrawlerService`가 사이트 단위로 같은
방식을 쓴다. 일관성을 유지한다. 백오피스가 상태를 보고 재시도를 결정할 수 있어야 한다.

**확인 필요**: `SearchJobStatus` enum에 `PARTIAL`이 없으면 추가해야 하고,
DB enum 타입이면 마이그레이션이 필요하다. TASK A-2에서 함께 처리한다.

### A5. 기존 데이터 이관 — **backfill 한다** 확정

마이그레이션 `up()`에서 기존 `search_jobs` 중 `searchHistoryId`가 NOT NULL인 행을
새 테이블에 1행씩 삽입한다. `keyword`는 `search_jobs.keywords` 배열의 첫 원소를 쓰고,
비어 있으면 NULL로 둔다.

근거: backfill 없이는 과거 Job 상세 조회가 빈 목록으로 보인다.
선례가 있다 — `1753601200000-SearchHistoryResults.ts`가 이미 legacy backfill을 수행한다.
같은 패턴을 따른다.

---

## 2. 공통 규칙 (P0와 다른 점)

| 항목         | 내용                                                                           |
| ------------ | ------------------------------------------------------------------------------ |
| 커밋 단위    | TASK 1개 = 커밋 1개                                                            |
| 마이그레이션 | **`down()` 필수.** `up()` → `revert` → `up()` 왕복이 성공해야 완료             |
| 검증         | 빈 볼륨 생성 + **기존 데이터 위 적용** 두 경우를 모두 확인                     |
| 순서         | A-1 → A-6 순서를 지킨다. 특히 A-3(이중 쓰기)와 A-4(판정 전환)를 합치지 않는다  |
| 롤백         | 각 TASK 후 `git revert` + `npm run migration:revert`로 되돌아갈 수 있어야 한다 |
| 범위         | Investigation을 실 API로 전환하는 작업(우선순위 D)은 포함하지 않는다           |

### 착수 전 baseline

```bash
git pull origin main
npm ci && npm --prefix web ci
npm run lint:ci
npm run build
npx jest --runInBand
npm run migration:show      # 현재 적용된 마이그레이션 2건 확인
```

baseline이 통과하지 않으면 작업하지 말고 보고한다.

> `install`이 아니라 `ci`를 쓴다. 저장소 루트에서 `npm --prefix web install`을 실행하면
> npm 10이 루트 프로젝트를 `web/package.json`에 `"search-crawler-server": "file:.."`
> 의존성으로 추가해 작업 트리를 오염시킨다. CI(`.github/workflows/ci.yml`)도 `ci`를 쓴다.
> `npm ci`는 `node_modules`를 먼저 지우므로 **dev 서버(`npm run dev`)를 멈춘 뒤** 실행한다.
> 실행 중이면 Windows 파일 잠금으로 esbuild·rollup 네이티브 모듈이 깨진다.

---

## TASK A-1. 마이그레이션 테스트를 CI에서 실행 가능하게 (선행)

**목적**: 이후 5개 TASK가 마이그레이션을 다루므로, 자동 검증 수단을 먼저 만든다.
우선순위 F-1을 앞으로 당긴 것이다.

### 현재 문제

```json
"test:migration": "powershell -ExecutionPolicy Bypass -File scripts/test-migration-empty-volume.ps1"
```

PowerShell 의존이라 Ubuntu 러너에서 실행할 수 없다. `docker-compose.migration-test.yml`과
`scripts/verify-migrated-schema.sh`는 이미 플랫폼 중립이므로 래퍼만 필요하다.

### 변경 대상

| 파일                                     | 내용                                                      |
| ---------------------------------------- | --------------------------------------------------------- |
| `scripts/test-migration-empty-volume.sh` | **신규** — PowerShell 스크립트와 동일 동작                |
| `package.json`                           | `test:migration:sh` 스크립트 추가 (기존 Windows용은 유지) |
| `.github/workflows/ci.yml`               | 마이그레이션 테스트 job 추가                              |

### 구현 방향

1. 기존 `.ps1`이 무엇을 하는지 읽고 동일 절차를 sh로 옮긴다. 빈 볼륨 생성 →
   `migrate` 실행 → `verify-migrated-schema.sh` → 정리.
2. CI에는 **별도 job**으로 넣는다. Docker Compose를 띄우므로 기존 lint/build/test job보다
   느리다. 기존 job을 느리게 만들지 않는다.
3. 실패 시 컨테이너 로그를 출력해 원인이 보이게 한다.
4. 기존 Windows용 `test:migration`은 삭제하지 않는다.

### 완료 조건

- [ ] `bash scripts/test-migration-empty-volume.sh`가 로컬에서 통과한다
- [ ] CI에 마이그레이션 job이 추가되고 통과한다
- [ ] 기존 lint/build/test job의 실행 시간이 늘어나지 않는다
- [ ] 마이그레이션을 의도적으로 깨뜨리면 CI가 실패한다 (1회 확인 후 되돌리기)

### 검증

```bash
bash scripts/test-migration-empty-volume.sh
# push 후 Actions에서 마이그레이션 job 확인
```

---

## TASK A-2. 엔티티 + 마이그레이션 (스키마만)

**목적**: 스키마 변경만 독립적으로 검증한다. 이 단계에서 애플리케이션 코드는
새 테이블을 사용하지 않는다.

### 변경 대상

| 파일                                                        | 내용                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `src/database/entities/search-job-history.entity.ts`        | **신규**                                                     |
| `src/database/entities/index.ts`                            | export 추가                                                  |
| `src/database/entities/search-job.entity.ts`                | `searchHistoryId`에 `@deprecated` 주석 / `PARTIAL` 상태 확인 |
| `src/database/migrations/<timestamp>-SearchJobHistories.ts` | **신규**                                                     |

### 스키마

테이블 `search_job_histories`:

| 컬럼                      | 타입              | 비고                                                                  |
| ------------------------- | ----------------- | --------------------------------------------------------------------- |
| `id`                      | uuid PK           |                                                                       |
| `searchJobId`             | uuid              | FK → `search_jobs.id`, ON DELETE CASCADE                              |
| `keyword`                 | varchar           | nullable (backfill 시 비어 있을 수 있음)                              |
| `searchHistoryId`         | uuid              | `search_history` 참조 (기존 관행대로 FK 엔티티 관계는 두지 않아도 됨) |
| `status`                  | varchar 또는 enum | 개별 검색 상태                                                        |
| `resultCount`             | int               | 기본 0                                                                |
| `createdAt` / `updatedAt` | timestamp         |                                                                       |

인덱스와 제약:

- unique `(searchJobId, searchHistoryId)` — 중복 등록 방지
- index `searchJobId` — Job 단위 조회용

### 구현 방향

1. 기존 마이그레이션 2건의 스타일을 그대로 따른다.
   특히 `1753601200000-SearchHistoryResults.ts`의 backfill 패턴을 참고한다.
2. **A5 backfill을 `up()`에 포함한다.** 기존 `search_jobs.searchHistoryId`가 NOT NULL인
   행마다 새 테이블에 1행 삽입. `keyword`는 `keywords` 배열 첫 원소 또는 NULL.
   `status`와 `resultCount`는 기존 Job 값에서 복사한다.
3. **`down()`을 반드시 구현한다.** 테이블 drop으로 충분하다.
4. A4를 위해 `SearchJobStatus`에 `PARTIAL`이 있는지 확인한다.
   없으면 이 마이그레이션에서 함께 추가한다. DB enum 타입이면 `ALTER TYPE`이 필요하고,
   varchar면 코드만 고치면 된다. 어느 쪽인지 먼저 확인하고 보고해줘.
5. **애플리케이션 코드는 아직 이 테이블을 읽거나 쓰지 않는다.** 엔티티 등록까지만.

### 완료 조건

- [ ] `npm run migration:run` 성공
- [ ] `npm run migration:revert` 성공 (테이블이 깨끗이 제거됨)
- [ ] 다시 `npm run migration:run` 성공 (왕복 확인)
- [ ] 기존 데이터가 있는 DB에서 backfill이 정상 동작한다 (Job 1건 이상으로 확인)
- [ ] 빈 볼륨 마이그레이션 테스트 통과 (A-1의 sh 스크립트)
- [ ] 기존 59개 테스트에 회귀 없음
- [ ] `SearchJobStatus.PARTIAL` 존재 여부를 확인하고 결과를 보고했다

### 검증

```bash
npm run build
npm run migration:run
npm run migration:show
npm run migration:revert
npm run migration:run
bash scripts/test-migration-empty-volume.sh
npx jest --runInBand
```

---

## TASK A-3. 이중 쓰기 (동작 변경 없음)

**목적**: 새 테이블에 데이터를 쌓기 시작하되 **완료 판정·집계는 기존 로직을 그대로 둔다.**
동작이 바뀌지 않으므로 안전하고, 실제 데이터가 어떻게 쌓이는지 관찰할 수 있다.

### 변경 대상

| 파일                                           | 내용                           |
| ---------------------------------------------- | ------------------------------ |
| `src/modules/search-job/search-job.service.ts` | `runSearch()`에 기록 로직 추가 |
| `src/modules/search-job/search-job.module.ts`  | 새 엔티티 repository 주입      |

### 구현 방향

1. `runSearch()`가 키워드별 검색을 실행할 때마다 `search_job_histories`에 행을 하나
   생성한다. 캐시 hit이면 그 시점 상태와 결과 수를, 크롤 필요면 `queued` 상태로 기록한다.
2. **완료 판정, `resultCount` 집계, `triggerAutoInvestigation()` 호출은 손대지 않는다.**
   여전히 첫 히스토리 기준으로 동작한다.
3. `SearchJobProgressSync`가 크롤 진행 이벤트를 받을 때 해당 히스토리의 행 상태와
   `resultCount`도 함께 갱신한다. Job 진행률 계산은 아직 바꾸지 않는다.
4. 기록 실패가 검색 자체를 실패시키지 않게 한다. 이 단계는 관찰용이므로
   기록 오류는 warn 로그로 남기고 진행한다.

### 완료 조건

- [ ] 키워드 N개 Job 실행 시 `search_job_histories`에 N개 행이 생긴다
- [ ] Job의 기존 동작(완료 판정, resultCount, 조사 생성)에 **변화가 없다**
- [ ] 크롤 진행에 따라 각 행의 status·resultCount가 갱신된다
- [ ] 기록 실패가 검색 실패로 전파되지 않는다
- [ ] 다중 키워드 시나리오 spec 추가 (행이 N개 생성되는지)

### 검증

```bash
npm run build
npx jest --runInBand
```

런타임 확인 (권장): `npm run infra:up` 후 키워드가 2개 이상 나오는 주문으로
Search Job을 실행해 `search_job_histories` 행을 직접 조회한다.
BackOffice 접근이 어려우면 spec 검증으로 대체하고 그 사실을 보고한다.

---

## TASK A-4. 판정·집계·조사 경로 전환 (핵심)

**목적**: 실제 동작을 새 테이블 기준으로 바꾼다. **이 TASK가 이번 작업의 핵심이며
가장 위험하다.**

### 변경 대상

| 파일                                                 | 내용                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/modules/search-job/search-job.service.ts`       | `runSearch()` 감시 로직, 완료 판정, 집계, `triggerAutoInvestigation()` |
| `src/modules/search-job/search-job-progress.sync.ts` | Job 진행률 계산                                                        |
| `src/modules/search-job/search-job-status.util.ts`   | partial 판정 규칙 (필요 시)                                            |
| `src/config/*.ts`                                    | A3 타임아웃 환경변수                                                   |
| `.env.example`                                       | 새 환경변수 2개                                                        |

### 구현 방향

1. **감시 로직 교체.** `pendingWatchId` 하나 대신 Job의 모든 비종료 히스토리를 감시한다.
   모든 행이 terminal 상태가 될 때 완료 판정을 수행한다.

2. **타임아웃(A3).** 키워드별 개별 상한과 Job 전체 상한을 각각 적용한다.
   전체 상한 초과 시 미완료 행을 timeout으로 표시한다. 두 값은 환경변수에서 읽는다.

3. **상태 판정(A4).** 전부 성공 → `completed`, 일부 실패/타임아웃 → `partial`,
   전부 실패 → `failed`.

4. **resultCount 집계(A1).** Job의 모든 `searchHistoryId`에 대해
   `search_history_results`의 **고유 `resultId` 수**를 센다.
   키워드별 합계와 다를 수 있다는 점을 주석에 남긴다.

5. **조사 케이스 생성.** `triggerAutoInvestigation()`이 하나의 히스토리 대신
   Job의 모든 히스토리를 순회한다. **P0 TASK 0-1에서 만든 upsert 동작과
   exclude 정책을 깨뜨리지 않도록 주의한다.** 기존 spec이 통과해야 한다.

6. **진행률.** 키워드 N개에 걸쳐 진행률을 합산한다. 단일 크롤 진행률을 Job 진행률에
   그대로 매핑하던 로직을 바꾼다.

7. **대표 히스토리(A2).** `search_jobs.searchHistoryId`는 첫 크롤 히스토리로 계속 채운다.

### 완료 조건

- [ ] 키워드 3개가 모두 캐시 miss인 Job이 **3개 크롤이 모두 끝난 뒤** 완료된다
- [ ] `resultCount`가 고유 매물 수로 집계된다 (중복 URL 테스트 포함)
- [ ] 일부 키워드 실패 시 Job이 `partial`이 된다
- [ ] 전체 타임아웃 초과 시 미완료 행이 timeout으로 표시되고 Job이 판정된다
- [ ] 조사 케이스가 모든 히스토리의 결과를 대상으로 생성된다
- [ ] **P0 TASK 0-1의 upsert·exclude spec이 그대로 통과한다**
- [ ] 진행률이 키워드 수에 맞게 계산된다
- [ ] 도달 불가 분기(`result.status === 'failed'`)가 제거되거나 정당화된다
- [ ] 다중 키워드 통합 테스트가 위 항목들을 고정한다

### 검증

```bash
npm run build
npx jest --runInBand
npm run lint:ci
```

**이 TASK는 테스트 없이 완료로 보고하지 않는다.** 다중 키워드 시나리오
(전부 성공 / 일부 실패 / 타임아웃 / 중복 매물) 4개를 spec으로 고정한다.

---

## TASK A-5. API·callback·프론트 노출

**목적**: 키워드별 내역을 외부에서 볼 수 있게 한다.

### 변경 대상

| 파일                                              | 내용                                      |
| ------------------------------------------------- | ----------------------------------------- |
| `src/modules/search-job/search-job.service.ts`    | `getOne()`, progress 응답에 키워드별 내역 |
| `src/modules/search-job/search-job.controller.ts` | 응답 타입/Swagger                         |
| `src/api/rental.service.ts`                       | callback payload에 키워드별 요약          |
| `web/src/api.ts`, `web/src/types.ts`              | 타입 추가                                 |
| `web/src/pages/RentalPage.tsx`                    | 키워드별 결과 표시                        |

### 구현 방향

1. `GET /api/search-jobs/:id` 응답에 키워드별 배열을 추가한다.
   각 항목: keyword, status, resultCount, searchHistoryId.
2. **기존 응답 필드는 제거하지 않는다.** 추가만 한다 (백오피스 호환).
3. callback payload에 키워드별 요약을 추가한다. 여기서도 기존 필드는 유지한다.
4. 프론트 Rental 화면에 키워드별 내역을 표시한다.
   Job `resultCount`와 키워드별 합계가 다를 수 있으니(A1),
   화면에 그 이유를 짧게 안내한다. 예: "고유 매물 기준".

### 완료 조건

- [ ] `GET /api/search-jobs/:id`가 키워드별 내역을 반환한다
- [ ] 기존 응답 필드가 그대로 유지된다
- [ ] callback payload에 키워드별 요약이 포함된다
- [ ] Rental 화면에서 키워드별 결과가 보인다
- [ ] Job resultCount와 키워드별 합계 차이가 화면에서 오해되지 않는다
- [ ] Swagger 문서가 갱신된다

### 검증

```bash
npm run build
npx jest --runInBand
npm --prefix web run lint:ci   # 또는 web:lint:ci
npm --prefix web run build
```

---

## TASK A-6. 정리

**목적**: deprecated 처리와 죽은 코드 제거.

### 변경 대상

| 파일                                         | 내용                                   |
| -------------------------------------------- | -------------------------------------- |
| `src/database/entities/search-job.entity.ts` | `searchHistoryId` deprecated 확정 판단 |
| `src/modules/search-job/*`                   | 죽은 코드 제거                         |
| `docs/REVIEW_v3/PROJECT_REVIEW_v3.md`        | P1-A 항목에 해소 기록                  |

### 구현 방향

1. `search_jobs.searchHistoryId`를 실제로 읽는 곳을 전수 조사한다
   (백엔드 · 프론트 · 문서). 결과를 보고하고, **참조가 없으면 제거 여부를 물어본다.**
   내 판단으로 제거하지 마.
2. `SearchJobService.listRecentRentalOrders()` 등 `@deprecated` 표시된 미사용 메서드를
   정리한다.
3. 리뷰 문서 §7.1 P1-A에 해소 내용과 확정된 정책(A1~A5)을 기록한다.

### 완료 조건

- [ ] `searchHistoryId` 참조 현황이 보고되었다
- [ ] 미사용 deprecated 메서드가 정리되었다
- [ ] 리뷰 문서에 P1-A 해소와 A1~A5 정책이 기록되었다
- [ ] 전체 검증 통과

### 검증

```bash
npm run lint:ci
npm run build
npx jest --runInBand
npm --prefix web run build
bash scripts/test-migration-empty-volume.sh
```

---

## 3. 우선순위 A 완료 판정

```bash
npm run lint:ci
npm run web:lint:ci
npm run build
npx jest --runInBand
npm --prefix web run build
bash scripts/test-migration-empty-volume.sh
npm run migration:show
```

| TASK | 완료 판정                                                                |
| ---- | ------------------------------------------------------------------------ |
| A-1  | 마이그레이션 테스트가 CI에서 실행되고 통과                               |
| A-2  | 테이블 생성 + backfill + `up`/`revert` 왕복 성공                         |
| A-3  | 키워드 N개 → 행 N개, 기존 동작 무변화                                    |
| A-4  | 모든 크롤 완료 후 Job 완료, 고유 매물 집계, partial 구분, 조사 전체 대상 |
| A-5  | API·callback·화면에 키워드별 내역 노출                                   |
| A-6  | deprecated 정리 및 문서 기록                                             |

### 범위 밖

- Investigation을 localStorage에서 실 API로 전환 → 우선순위 D
- 사이트별 crawl 지표 수집 → 우선순위 B
- AI provider 상태 노출 / Vision 실구현 → 우선순위 C
- 남은 lint 경고(`react-hooks/refs`, `purity`) 수정 → 우선순위 D

---

## 4. 보고 형식

TASK 완료 시:

1. 변경 파일 목록과 커밋 해시
2. 완료 조건 체크리스트 결과
3. 검증 명령 실행 결과 (마이그레이션은 `up`/`revert` 왕복 로그 포함)
4. 판단이 필요했던 지점과 선택 근거
5. 범위 밖으로 판단해 미룬 항목
