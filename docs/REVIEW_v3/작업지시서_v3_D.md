# 작업지시서 v3 — 우선순위 D (Investigation 실 API 전환)

작성일: 2026-07-29  
근거 문서: `docs/REVIEW_v3/PROJECT_REVIEW_v3.md` §7.3 U9, §8 우선순위 D, §11.1  
선행 완료: 우선순위 0 (P0), 우선순위 A (Search Job 1:N)  
대상: TASK D-1 ~ D-7 (7단계)

---

## 0. 이 작업의 목적

조사(Investigation) UI는 이미 있다. 문제는 **데이터가 서버가 아니라 브라우저 localStorage**라는 점이다.

| 구분 | 현재 |
|------|------|
| 백엔드 | 검색·AI 후 `investigation_cases`에 자동 생성 (P0·A로 개선됨) |
| `/investigation` · Overview 카드 · 검색 「조사 시작」 | **localStorage + mock 시드** |
| `/rental?tab=investigations` | 서버 케이스 (읽기만, Drawer 미연결) |

같은 대시보드에 **두 개의 진실**이 있다. 이 작업은 Investigation을 **서버 DB를 단일 소스로** 쓰게 만든다.

---

## 1. 선행 결정 (권고안으로 확정)

담당자 검토 없이 아래 확정안으로 진행한다. 이견이 있으면 해당 TASK 착수 전에 수정한다.

### D1. 전환 순서 — **읽기 먼저, 쓰기 나중** 확정

1. D-1 · D-2: 목록/상세를 서버 GET으로 전환 (쓰기 UI는 잠시 비활성 또는 “저장 준비중”)
2. D-3 · D-4: 스키마 + 쓰기 API
3. D-5 · D-6: Drawer·수동 생성·Rental 연결
4. D-7: mock 제거·정리

근거: 쓰기 API 없이 화면만 바꾸면 담당자가 상태를 바꿔도 사라진다.  
반대로 스키마부터 크게 바꾸면 읽기 전환이 늦어진다. **먼저 서버 목록을 보여 주는 것**이 체감이 크다.

### D2. 수동 「조사 시작」 — **서버 POST 생성** 확정

검색 결과에서 「조사 시작」은 `POST /api/investigations`로 서버에 케이스를 만든다.  
`resultId`가 이미 있으면 **기존 케이스를 열어** 중복 생성을 막는다 (백엔드 `resultId` unique와 동일 정책).

근거: 지금 버튼은 localStorage만 쓰므로 서버 자동 생성과 단절된다.  
자동 생성(threshold)과 수동 생성(담당자 판단)을 공존시킨다.

### D3. Evidence — **1차 범위에서 읽기 전용** 확정

`EvidenceSection`은 서버에 별도 evidence 테이블/컬럼을 **당장 만들지 않는다.**  
표시는 listing URL·이미지·기존 스냅샷 필드로 충분하게 두고, 삭제/추가 UI는 disabled 또는 숨긴다.

근거: notes·status·finalDecision이 업무 핵심이다. evidence CRUD는 후속(우선순위 D 확장)으로 미룬다.

### D4. dueDate — **컬럼 추가** 확정

프론트 `AssignmentSection`이 쓰는 `dueDate`를 DB 컬럼으로 추가한다 (`timestamptz`, nullable).

### D5. Overview 「오늘 Investigation」 — **케이스 건수 API** 확정

P0에서 레이블을 「오늘 수집 결과」로 바꿔 둔 상태다. D에서는  
`GET /api/investigations/stats` 또는 list의 집계로 **오늘(또는 24h) 케이스 수**를 Overview에 연결하고 레이블을 「오늘 Investigation」으로 되돌린다.

### D6. AI 표시 — **서버 데이터 우선** 확정

Drawer의 AI 분석/추천은 `deriveAi*` 클라이언트 휴리스틱보다  
서버 `aiAnalysis` / timeline의 `investigationSummary`·`aiRecommendation`을 우선 표시한다.  
없을 때만 휴리스틱 fallback (D-7에서 fallback 제거 검토).

### D7. Rental ↔ Investigation — **같은 Drawer** 확정

Rental 조사 이력 행 클릭 시 `InvestigationProvider.openCase`로 **동일 CaseDrawer**를 연다.  
별도 Rental-only 상세를 만들지 않는다.

---

## 2. 현재 코드 스냅샷 (기준)

### 백엔드 (읽기만)

| Method | Path | 파일 |
|--------|------|------|
| GET | `/api/investigations?limit=` | `investigation.controller.ts` |
| GET | `/api/investigations/config` | 同上 |
| GET | `/api/investigations/:id` | 同上 |

쓰기 HTTP: **없음**.  
생성: `autoCreateFromSearch()`만 (Search Job / Crawler 내부).

Status enum: `Open` | `Investigating` | `Review` | `Completed` | `Archived`

엔티티에 **없는** 프론트 필드: `notes` / `noteEntries`, `finalDecision`, `decidedAt`, `dueDate`, `evidence`

### 프론트 (localStorage)

| Key | 용도 |
|-----|------|
| `crawler.dashboard.investigation.cases` | 케이스 JSON |
| `crawler.dashboard.investigation.seq` | caseNo 시퀀스 |
| `crawler.dashboard.investigation.seeded.v6` | mock 시드 플래그 |

`web/src/api.ts`에 investigation 전용 함수 **없음** (Rental nested만).

---

## 3. 공통 규칙

| 항목 | 내용 |
|------|------|
| 커밋 단위 | TASK 1개 = 커밋 1개 |
| 채팅 | TASK마다 **새 채팅**. 같은 채팅에서 다음 TASK로 넘어가지 말 것 |
| push | 각 TASK 후 push → Actions **build-test** (마이그레이션 있으면 **migration-test**도) 초록 확인 후 다음 |
| 마이그레이션 | D-3만. `down()` 필수, `up` → `revert` → `up` 왕복 |
| Rental 계약 | `GET .../search-jobs/rental/jobs/:id`의 `investigations[]` 필드 **제거·이름 변경 금지** (추가만) |
| P0 회귀 | `investigation.service.spec.ts`의 upsert·exclude 정책 **깨지 말 것** |
| 범위 밖 | 관측성(B), AI Vision(C), code splitting 전체, md 축약 사이드바 flyout, lint refs/purity 대량 수정 |

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

통과하지 않으면 작업하지 말고 보고한다.

---

## TASK D-1. 읽기 API 클라이언트 + Provider 서버 전환

**목적**: `/investigation` 목록과 Overview 카드가 **서버 케이스**를 보게 한다.  
쓰기는 아직 localStorage에 두지 말고, **쓰기 UI는 disabled** 또는 안내 문구로 막는다.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `web/src/api.ts` | `listInvestigations`, `getInvestigation`, `getInvestigationConfig` |
| `web/src/types.ts` (또는 features types) | 서버 응답 타입 |
| `web/src/features/investigation/InvestigationProvider.tsx` | fetch → state |
| `web/src/features/investigation/components/CaseListPage.tsx` | Provider 데이터 사용 유지·로딩/에러 |
| `web/src/features/investigation/components/CaseSummaryCard.tsx` | localStorage 직접 로드 제거 |
| `web/src/features/investigation/lib/store.ts` | **시드 중단** (`SEEDED_KEY` / mock 주입 제거 또는 no-op) |

### 구현 방향

1. `GET /api/investigations?limit=100` (또는 200)으로 목록 로드.
2. Provider 마운트·focus·수동 refresh 시 재조회.
3. mock 시드를 **더 이상 넣지 않는다.** 기존 localStorage에 남은 샘플은 무시하거나 1회 클리어 안내.
4. Workflow / Assignment / Notes / FinalDecision 조작은 **이 단계에서 서버에 저장하지 않는다.**  
   UI는 disabled + 「쓰기 API 연결 전」 문구.
5. CaseDrawer 열기는 id로 `GET /api/investigations/:id` 보강(목록에 없는 필드)해도 된다.
6. **백엔드 변경 없음.**

### 완료 조건

- [ ] `/investigation`이 DB에 있는 케이스를 표시한다 (자동 생성된 케이스 포함)
- [ ] mock 시드가 새로 심히지 않는다
- [ ] Overview `CaseSummaryCard`가 서버 건수/상태를 반영한다
- [ ] 쓰기 버튼이 localStorage에 쓰지 않는다 (disabled 또는 no-op + 안내)
- [ ] Rental 조사 탭 회귀 없음
- [ ] `npm --prefix web run build` 통과

### 검증

```bash
npm --prefix web run build
npm run web:lint:ci
```

수동: 서버에 케이스가 있는 상태에서 `/investigation` 목록 확인.  
없으면 Search Job/검색으로 케이스 1건 생성 후 확인.

---

## TASK D-2. 서버 DTO ↔ 프론트 모델 어댑터

**목적**: Drawer 섹션이 서버 필드(`aiAnalysis`, timeline 요약 등)를 깨지지 않게 매핑한다.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `web/src/features/investigation/lib/mapServerCase.ts` (신규 권장) | 매핑 단일 함수 |
| `web/src/features/investigation/types.ts` | 서버 optional 필드 허용 |
| `.../sections/AiAnalysisSection.tsx` 등 | 서버 데이터 우선 (D6) |
| `.../sections/RecommendationSection.tsx` | 同上 |
| `.../sections/TimelineSection.tsx` | 서버 timeline |

### 구현 방향

1. 백엔드 `toDto()` 응답 형태를 읽고 매퍼 작성.  
   특히 `aiScore` 스케일(0~1 vs 0~100), `orderUrl`, timeline 이벤트 타입.
2. AI 섹션: 서버 값 있으면 표시, 없을 때만 `deriveAi*` fallback.
3. notes/finalDecision이 아직 없으면 빈 배열/undefined로 안전하게 렌더.
4. 단위 테스트 또는 매퍼 순수 함수 테스트 권장.

### 완료 조건

- [ ] 서버에서 온 케이스의 AI 요약/추천/타임라인이 Drawer에 보인다
- [ ] 필드 부재 시 화면이 크래시하지 않는다
- [ ] 매핑이 Provider/목록/상세에서 **한곳**을 거친다

### 검증

```bash
npm --prefix web run build
npx jest --runInBand   # 매퍼를 백엔드/웹 테스트로 둔 경우
```

---

## TASK D-3. Entity 확장 + 마이그레이션

**목적**: 쓰기 API에 필요한 컬럼을 DB에 추가한다.

### 추가 컬럼 (권고)

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `notes` | jsonb | 메모 배열 (`id`, `body`, `author`, `createdAt`, `updatedAt`) |
| `finalDecision` | varchar nullable | 최종 판단 코드/라벨 |
| `finalDecisionNote` | text nullable | 판단 메모 (필요 시) |
| `decidedAt` | timestamptz nullable | 판단 시각 |
| `dueDate` | timestamptz nullable | 마감 (D4) |

evidence 컬럼/테이블: **추가하지 않음** (D3 결정).

### 변경 대상

| 파일 | 내용 |
|------|------|
| `src/database/entities/investigation-case.entity.ts` | 컬럼 |
| `src/database/migrations/<ts>-InvestigationWorkflowFields.ts` | **신규**, `down()` 필수 |
| `src/modules/investigation/investigation.service.ts` | `toDto`에 새 필드 노출 |

### 구현 방향

1. A 작업과 동일하게 `up`/`down` 왕복 + `bash scripts/test-migration-empty-volume.sh`.
2. 기존 행은 NULL/빈 배열로 둔다 (backfill 불필요).
3. `toDto`가 새 필드를 반환하도록 확장. **기존 필드 이름 변경 금지.**
4. 애플리케이션 쓰기 API는 **아직 만들지 않는다** (D-4).

### 완료 조건

- [ ] `migration:run` / `revert` / `run` 왕복 성공
- [ ] 빈 볼륨 migration-test 통과
- [ ] GET 상세 응답에 새 필드가 포함된다 (null/[])
- [ ] 기존 investigation spec 회귀 없음

### 검증

```bash
npm run build
npm run migration:run
npm run migration:revert
npm run migration:run
bash scripts/test-migration-empty-volume.sh
npx jest --runInBand
```

---

## TASK D-4. 쓰기 API

**목적**: 상태·담당·메모·최종 판단·수동 생성을 HTTP로 제공한다.

### 엔드포인트 (권고)

| Method | Path | 내용 |
|--------|------|------|
| PATCH | `/api/investigations/:id/status` | `{ status }` + timeline 이벤트 |
| PATCH | `/api/investigations/:id` | `{ assignee?, priority?, dueDate? }` |
| POST | `/api/investigations/:id/notes` | 메모 추가 |
| PATCH | `/api/investigations/:id/notes/:noteId` | 메모 수정 |
| DELETE | `/api/investigations/:id/notes/:noteId` | 메모 삭제 |
| POST | `/api/investigations/:id/final-decision` | `{ decision, note? }` → 상태 Completed + decidedAt |
| POST | `/api/investigations` | 수동 생성 `{ resultId, searchHistoryId?, searchJobId?, orderNo? }` |
| GET | `/api/investigations/stats` | `{ last24h, byStatus }` (D5 Overview용) |

모두 `ApiKeyGuard` 유지. DTO는 `class-validator`로.

### 구현 방향

1. 상태 전이는 프론트 `workflow.ts`와 **동일한 허용 그래프**를 서버에서도 검증. 불법 전이는 400.
2. 최종 판단 시 timeline에 이벤트 추가 + `Completed` (이미 Completed면 idempotent).
3. 수동 POST: `resultId` 중복 시 **409 또는 200으로 기존 케이스 반환** (택1, 문서화). 권고는 **200 + 기존 케이스** (프론트가 바로 open).
4. P0 exclude/upsert 경로와 충돌하지 않게 `autoCreateFromSearch`는 유지.
5. spec: 전이 거부, 메모 CRUD, final-decision, 중복 resultId.

### 완료 조건

- [ ] 위 엔드포인트가 Swagger에 보인다
- [ ] 불법 status 전이 400
- [ ] 중복 수동 생성이 새 row를 만들지 않는다
- [ ] `investigation.service.spec.ts` + 신규 spec 통과
- [ ] Rental nested DTO 회귀 없음

### 검증

```bash
npm run build
npx jest --runInBand
npm run lint:ci
```

---

## TASK D-5. Drawer 섹션 → API 연결

**목적**: disabled였던 쓰기 UI를 서버에 연결한다.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `web/src/api.ts` | PATCH/POST/DELETE 클라이언트 |
| `WorkflowSection.tsx` | status API |
| `AssignmentSection.tsx` | assignment API |
| `NotesSection.tsx` | notes API |
| `FinalDecisionSection.tsx` | final-decision API |
| `EvidenceSection.tsx` | 읽기 전용 / 편집 disabled (D3) |
| `store.ts` | 로컬 쓰기 함수 호출 제거 또는 API 래퍼로 대체 |
| `InvestigationProvider.tsx` | mutation 후 목록/선택 갱신 |

### 구현 방향

1. 성공 시 Provider 상태 갱신 + toast.
2. 실패 시 에러 표시, optimistic update를 쓰면 rollback.
3. `changeInvestigationStatus` 등 localStorage 직접 쓰기 **제거**.
4. Evidence 편집 UI는 disabled 유지.

### 완료 조건

- [ ] 상태 변경이 새로고침 후에도 유지된다
- [ ] 메모 추가/수정/삭제가 DB에 남는다
- [ ] 최종 판단 후 Completed + decidedAt
- [ ] localStorage `cases` 키에 더 이상 의존하지 않는다 (잔여 키 정리 가능)
- [ ] 웹 빌드·lint 통과

### 검증

```bash
npm --prefix web run build
npm run web:lint:ci
```

수동: Drawer에서 상태·메모·판단 후 F5 → 유지 확인.

---

## TASK D-6. 수동 생성 + Rental Drawer 통합 + Overview 통계

**목적**: 검색→조사, Rental→조사, Overview 숫자 정합.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `useStartInvestigation.ts` | POST 또는 기존 케이스 open |
| `ResultsPanel` / `ResultDrawer` | 조사 시작 플로우 |
| `web/src/pages/RentalPage.tsx` | 조사 행 → `openCase` |
| `web/src/pages/OverviewPage.tsx` | 오늘 Investigation = stats |
| `web/src/api.ts` | `getInvestigationStats` |

### 구현 방향

1. 「조사 시작」→ `POST /api/investigations` → Drawer open.
2. Rental 탭 행 클릭 → 서버 id로 open (가능하면 GET 상세).
3. Overview 타일을 `stats.last24h` 케이스 수로 연결, 레이블 「오늘 Investigation」.
4. `createInvestigationFromResult` localStorage 경로 삭제.

### 완료 조건

- [ ] 검색 결과에서 만든 케이스가 `/investigation`에 보인다
- [ ] 같은 매물 재클릭 시 중복 없이 기존 케이스 open
- [ ] Rental 조사 목록에서 Drawer가 열린다
- [ ] Overview 「오늘 Investigation」이 크롤 결과 수가 아닌 케이스 수다

### 검증

```bash
npm run build
npm --prefix web run build
npx jest --runInBand
```

---

## TASK D-7. 정리

**목적**: mock·이중 소스·문서 마감.

### 변경 대상

| 파일 | 내용 |
|------|------|
| `web/src/features/investigation/data/mock.ts` | 삭제 또는 테스트 전용으로 격리 |
| `lib/ai.ts` `deriveAi*` | 서버 데이터 없을 때만 쓸지, 제거할지 보고 후 처리 |
| `store.ts` | 죽은 localStorage API 제거 |
| `docs/REVIEW_v3/PROJECT_REVIEW_v3.md` | U9 / 우선순위 D 해소 기록 |
| (선택) Analytics Investigation 섹션 | 서버 byStatus 연결 — 시간 되면, 아니면 범위 밖으로 보고 |

### 완료 조건

- [ ] mock 시드 경로 없음
- [ ] investigation localStorage 키가 런타임에 필수가 아님
- [ ] 리뷰 문서에 D 해소·D1~D7 정책 기록
- [ ] 전체 baseline 검증 통과

### 검증

```bash
npm run lint:ci
npm run web:lint:ci
npm run build
npx jest --runInBand
npm --prefix web run build
bash scripts/test-migration-empty-volume.sh
```

---

## 4. 우선순위 D 완료 판정

| TASK | 완료 판정 |
|------|-----------|
| D-1 | 목록/카드 = 서버, mock 시드 중단, 쓰기 UI 차단 |
| D-2 | 서버 AI/timeline이 Drawer에 표시 |
| D-3 | 워크플로 컬럼 마이그레이션 + toDto |
| D-4 | 쓰기 API + spec |
| D-5 | Drawer 쓰기가 DB에 유지 |
| D-6 | 수동 생성·Rental Drawer·Overview 케이스 수 |
| D-7 | mock 제거·문서 기록 |

### 범위 밖

- 운영 관측성 (B)
- AI Vision / provider 실구현 (C)
- Evidence CRUD
- BackOffice로 최종 판단 callback (§11.1 후속)
- route code splitting, md 사이드바 flyout, react-hooks refs/purity 일괄 수정

---

## 5. 보고 형식

TASK 완료 시:

1. 변경 파일 목록과 커밋 해시  
2. 완료 조건 체크리스트  
3. 검증 명령 결과 (D-3은 migration 왕복 로그)  
4. 판단이 필요했던 지점과 선택 근거  
5. 범위 밖으로 미룬 항목  

**「다음 TASK로 넘어가도 될까요?」에는 바로 예라고 하지 말 것.**  
push → CI 초록 → **새 채팅**에서 다음 TASK.

---

## 6. 실행 프롬프트 (복사용)

각 STEP = **새 채팅**. `@작업지시서_v3_D.md` 를 첨부한다.

### STEP 1 — TASK D-1

```
@작업지시서_v3_D.md @PROJECT_REVIEW_v3.md

이 지시서의 TASK D-1 만 수행해줘.

먼저 §3 「착수 전 baseline」을 실행해서 통과를 확인하고,
통과하지 않으면 작업하지 말고 보고해줘.

선행 결정:
- D1 = 읽기 먼저. 이 단계에서 쓰기 API/스키마는 만들지 마.
- mock 시드를 중단하고, Workflow/Assignment/Notes/FinalDecision 쓰기는
  disabled 또는 안내 문구로 막아. localStorage 에 쓰지 마.

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- 백엔드 파일은 변경하지 마.
- 「완료 조건」을 모두 만족시키고 「검증」을 실행해줘.
- 이 채팅에서 D-2 로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 2 — TASK D-2

```
@작업지시서_v3_D.md

이 지시서의 TASK D-2 만 수행해줘.

선행 결정 D6: 서버 aiAnalysis / timeline 요약을 우선 표시하고,
없을 때만 deriveAi* fallback.

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- 매핑은 한 모듈(권장 mapServerCase.ts)로 모아.
- 스키마/쓰기 API는 아직 만들지 마.
- 「완료 조건」을 만족시키고 「검증」을 실행해줘.
- 이 채팅에서 D-3 으로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 3 — TASK D-3

```
@작업지시서_v3_D.md

이 지시서의 TASK D-3 만 수행해줘.

선행 결정:
- D3 = evidence 컬럼 추가 안 함
- D4 = dueDate 컬럼 추가
- notes(jsonb), finalDecision, finalDecisionNote(선택), decidedAt, dueDate 추가

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- down() 필수. up → revert → up 왕복을 실제로 실행해줘.
- bash scripts/test-migration-empty-volume.sh 통과 필수.
- 쓰기 HTTP 엔드포인트는 이 단계에서 만들지 마. toDto 노출까지만.
- P0 investigation upsert/exclude spec 회귀 없게.
- 이 채팅에서 D-4 로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 4 — TASK D-4

```
@작업지시서_v3_D.md

이 지시서의 TASK D-4 만 수행해줘.

선행 결정 D2: POST /api/investigations 수동 생성.
resultId 중복 시 새 row 만들지 말고 기존 케이스를 반환해줘 (권고: 200).

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- status 전이는 서버에서 허용 그래프 검증. 불법이면 400.
- GET /api/investigations/stats 포함 (Overview용).
- Rental nested investigations 응답 필드를 제거/개명하지 마.
- 관련 spec 을 추가하고 npx jest --runInBand 통과.
- 이 채팅에서 D-5 로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 5 — TASK D-5

```
@작업지시서_v3_D.md

이 지시서의 TASK D-5 만 수행해줘.

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- Drawer 의 Workflow/Assignment/Notes/FinalDecision 을 D-4 API 에 연결.
- Evidence 편집은 disabled 유지 (D3).
- localStorage 에 케이스/메모/상태를 쓰지 마.
- 새로고침 후 변경이 유지되는지 수동 확인 방법을 보고에 적어줘.
- 이 채팅에서 D-6 으로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 6 — TASK D-6

```
@작업지시서_v3_D.md

이 지시서의 TASK D-6 만 수행해줘.

선행 결정:
- D2 = 조사 시작은 POST (중복 시 기존 open)
- D7 = Rental 조사 행 → 동일 CaseDrawer
- D5 = Overview 「오늘 Investigation」 = stats 케이스 수

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- createInvestigationFromResult 의 localStorage 경로 제거.
- 「완료 조건」 4개를 만족시키고 「검증」을 실행해줘.
- 이 채팅에서 D-7 로 넘어가지 마.

완료 후 §5 보고 형식으로 보고해줘.
```

### STEP 7 — TASK D-7

```
@작업지시서_v3_D.md @PROJECT_REVIEW_v3.md

이 지시서의 TASK D-7 만 수행해줘.

규칙:
- 로컬 커밋 1개. push 는 내가 할게.
- mock 시드 경로 제거. deriveAi* 는 서버 데이터 없을 때 필요한지 판단해
  보고한 뒤, 불필요하면 제거.
- PROJECT_REVIEW_v3.md 의 U9 / 우선순위 D 에 해소와 D1~D7 정책 기록.
- §3 baseline + migration-test 스크립트까지 돌려줘.
- Analytics Investigation 섹션은 시간 되면 연결, 아니면 범위 밖으로 보고.

완료 후 §5 보고 형식으로 보고해줘.
```

---

## 7. 진행 체크리스트 (사용자용)

1. 이 파일을 저장소에 커밋·push (없으면 로컬 `@` 만으로도 가능)
2. STEP 1 새 채팅 → 완료 → push → CI 초록
3. STEP 2 ~ 7 동일
4. D-3·D-4 이후 운영 배포 시 `npm run migration:run:prod` 필수 (`배포.md` B-5)
