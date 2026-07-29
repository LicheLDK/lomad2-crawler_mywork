# 작업지시서 v3 — Priority C: AI 정확도

## 현황 요약

| Provider | Text | Vision | 상태 |
|---|---|---|---|
| **OpenAI** | 구현 완료 | **NOT_IMPLEMENTED** | Text만 동작 |
| **Anthropic** | stub | stub | 전부 미구현 |
| **Gemini** | stub | stub | 전부 미구현 |

**주요 문제**: `ai.enabled`가 선택된 provider 무관하게 `OPENAI_API_KEY`로만 판정 / Vision prompt 미전달 / 모든 에러에 무조건 재시도 / OCR 미활용 / Rules CRUD 없음

---

## 의사결정 사항 (STEP 시작 전 확인)

| # | 결정 | 기본값 | 비고 |
|---|---|---|---|
| DC-1 | Vision 실구현 vs 명시적 비활성 | 명시적 비활성 (C-3 skip) | Vision 실구현은 별도 작업 |
| DC-2 | OCR → matching 기본 활성 여부 | `AI_OCR_BEFORE_MATCH=false` | 추가 API 비용 발생 |
| DC-3 | Rules CRUD 인증 방식 | 기존 `ApiKeyGuard` 유지 | — |

---

## STEP 1 — C-1: `ai.enabled` 를 선택된 provider 키 기준으로 변경

### 대상 파일

- `src/ai/ai.config.ts`

### 프롬프트

> **목표**: `AI_ENABLED` 미설정 시, 선택된 `AI_PROVIDER`의 API key 존재 여부로 `ai.enabled`를 판정하도록 수정한다.
>
> **현재 문제** (`src/ai/ai.config.ts:17-20`):
> ```typescript
> enabled:
>   (process.env.AI_ENABLED ||
>    (process.env.OPENAI_API_KEY ? 'true' : 'false')
>   ).toLowerCase() === 'true',
> ```
> `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY=xxx` + `OPENAI_API_KEY=` 이면 `ai.enabled=false`.
>
> **작업**:
> 1. `AI_ENABLED`가 명시적으로 설정되어 있으면 그 값 사용
> 2. 미설정 시 → 선택된 `AI_PROVIDER`에 해당하는 key 존재 여부로 결정
>    - `openai` → `OPENAI_API_KEY`
>    - `anthropic` → `ANTHROPIC_API_KEY`
>    - `gemini` → `GEMINI_API_KEY`
>    - 미설정/기타 → `OPENAI_API_KEY` (하위호환)
> 3. Vision도 동일: `AI_VISION_PROVIDER` 또는 fallback `AI_PROVIDER`의 키로 판정
>
> **금지**: 다른 파일 수정 금지. 기존 config 구조(registerAs) 유지.
>
> **검증**:
> ```bash
> npm run build
> npx jest --testPathPattern=ai --runInBand
> ```

### 체크리스트

- [ ] `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY=xxx` → `enabled=true`
- [ ] `AI_PROVIDER=openai` + `OPENAI_API_KEY=` → `enabled=false`
- [ ] `AI_ENABLED=false` → 무조건 `false`
- [ ] 기존 .env (`OPENAI_API_KEY`만 설정) 동작 변화 없음

---

## STEP 2 — C-5: 재시도 대상을 transient 오류로 제한

### 대상 파일

- `src/ai/ai.service.ts` (retry loop: ~line 132-189)

### 프롬프트

> **목표**: `complete()` 재시도를 transient 에러(429, 5xx, timeout, 네트워크)로만 제한한다.
>
> **현재 문제** (`src/ai/ai.service.ts:132-189`):
> catch 블록에서 에러 종류 무관하게 모든 에러를 재시도한다. 4xx(auth 실패, 잘못된 요청) 도 최대 retry 회수만큼 반복.
>
> **작업**:
> 1. `isRetryable(error)` private 헬퍼 함수 추가:
>    - `AiEngineError`인 경우: `RATE_LIMITED`, `PROVIDER_UNAVAILABLE` → retryable
>    - `INVALID_REQUEST`, `CONTENT_FILTER`, `TOKEN_LIMIT` → non-retryable
>    - `Error.cause`에 HTTP status가 있으면: 429, 5xx → retryable, 4xx → non-retryable
>    - 네트워크 에러 (`ECONNREFUSED`, `ECONNRESET`, `AbortError`, `ETIMEDOUT`) → retryable
>    - 그 외 → non-retryable
> 2. catch 블록에서 `isRetryable(error)` false면 즉시 throw
> 3. 기존 retry delay 로직(exponential backoff) 유지
>
> **금지**: `complete()` 외 다른 메서드 수정 금지(Vision retry는 C-4에서). 기존 maxRetries 기본값 변경 금지.
>
> **검증**:
> ```bash
> npm run build
> npx jest --testPathPattern=ai --runInBand
> ```

### 체크리스트

- [ ] `INVALID_REQUEST` 에러 → retry 없이 즉시 throw
- [ ] 429 에러 → retry 수행
- [ ] 네트워크 에러 → retry 수행
- [ ] 기존 성공 경로 동작 변화 없음

---

## STEP 3 — C-2: 미구현 provider 명시적 실패 + health endpoint

### 대상 파일

- `src/ai/ai.service.ts`
- `src/ai/ai.module.ts`
- (신규) `src/ai/ai-health.controller.ts`

### 프롬프트

> **목표**: (1) AI health endpoint 추가, (2) `canCompareImages()`가 stub provider일 때 false 반환.
>
> **현재 문제**:
> - `canCompareImages()`가 `isEnabled() && visionProvider.isConfigured()`로 판단하지만, OpenAI Vision provider는 `isConfigured()=true`이면서 `compareImages()`에서 NOT_IMPLEMENTED throw.
> - AI 상태를 외부에서 확인할 방법 없음.
>
> **작업**:
> 1. `AiProvider` 및 `AiVisionProvider` 인터페이스에 `isImplemented(): boolean` 메서드 추가
>    - 실제 구현 provider → `true`, stub → `false`
> 2. `canCompareImages()`에서 `this.visionProvider.isImplemented()` 추가 체크
> 3. `canMatch()`, `canInvestigate()` 등도 `this.provider.isImplemented()` 체크 추가
> 4. `GET /ai/health` endpoint 신규 생성:
>    ```json
>    {
>      "enabled": true,
>      "provider": { "name": "openai", "configured": true, "implemented": true },
>      "visionProvider": { "name": "openai", "configured": true, "implemented": false },
>      "capabilities": { "match": true, "investigate": true, "vision": false }
>    }
>    ```
> 5. `ApiKeyGuard` 적용
>
> **금지**: stub provider 내부 로직 변경 금지. 기존 `can*()` 외부 호출자 수정 금지.
>
> **검증**:
> ```bash
> npm run build
> npx jest --testPathPattern=ai --runInBand
> ```

### 체크리스트

- [ ] `GET /ai/health` 응답 정상
- [ ] Vision stub → `canCompareImages()` = `false`
- [ ] OpenAI text → `canMatch()` = `true`
- [ ] 빌드 에러 없음

---

## STEP 4 — C-7: Rule threshold 튜닝 CRUD API

### 대상 파일

- `src/ai/rules/ai-rules.controller.ts`
- (신규) `src/ai/rules/dto/update-rule.dto.ts`
- `src/ai/rules/ai-rule-engine.service.ts`

### 프롬프트

> **목표**: AI Rules에 CRUD API를 추가하여 운영 중 threshold/규칙 변경이 가능하도록 한다.
>
> **현재 상태**: GET 2개만 존재 (`/ai/rules`, `/ai/rules/active`, `/ai/rules/create-threshold`).
>
> **작업**:
> 1. DTO 생성 — `UpdateRuleDto`:
>    - `enabled?: boolean`
>    - `value?: Record<string, any>` (threshold 등)
> 2. `PATCH /ai/rules/:code` — 규칙 활성/비활성 토글, value 업데이트
> 3. `PATCH /ai/rules/create-threshold` — body `{ threshold: number }` 로 빠른 변경
> 4. Service에 `updateRule(code, dto)`, `updateCreateThreshold(threshold)` 메서드 추가
> 5. 변경 후 메모리 캐시(rules 배열) refresh
> 6. `ApiKeyGuard` 적용
>
> **금지**: 기존 GET endpoint 시그니처 변경 금지. DB 스키마 변경(migration) 금지.
>
> **검증**:
> ```bash
> npm run build
> npx jest --testPathPattern=rule --runInBand
> ```

### 체크리스트

- [ ] `PATCH /ai/rules/:code` 정상 동작
- [ ] `PATCH /ai/rules/create-threshold` 정상 동작
- [ ] 변경 후 active rules 목록에 반영
- [ ] 빌드 에러 없음

---

## STEP 5 — C-4: Vision prompt 전달 수정 + 재시도 + cost 토큰 집계

### 대상 파일

- `src/ai/ai.vision.provider.ts` (인터페이스)
- `src/ai/ai.service.ts` (`compareImages()`)
- `src/ai/providers/openai.vision.provider.ts` (stub 유지하되 시그니처 맞춤)
- `src/ai/providers/anthropic.vision.provider.ts`, `gemini.vision.provider.ts`

### 프롬프트

> **목표**: Vision `compareImages()` 가 (1) prompt를 provider에 전달, (2) retry loop 적용, (3) cost에 token 집계하도록 수정한다.
>
> **현재 문제** (`src/ai/ai.service.ts:497-567`):
> - prompt 렌더 후 버려짐, `visionProvider.compareImages(input)`에 prompt 미포함
> - retry 없음 (try-catch 1회)
> - cost record 시 `promptTokens`/`completionTokens` 미전달 → 항상 0
>
> **작업**:
> 1. `AiVisionProvider.compareImages` 시그니처 확장:
>    ```typescript
>    compareImages(
>      input: AiImageCompareRequest,
>      options?: { systemPrompt?: string; userPrompt?: string },
>    ): Promise<AiImageCompareResponse>
>    ```
> 2. `AiImageCompareResponse`에 `usage?: { promptTokens: number; completionTokens: number }` 추가
> 3. `AiService.compareImages()` 수정:
>    - 렌더된 prompt를 `options`로 전달
>    - `complete()`와 동일한 retry loop 적용 (STEP 2의 `isRetryable` 재사용)
>    - response.usage 값을 cost record에 전달
> 4. 모든 stub provider의 시그니처를 새 인터페이스에 맞춤 (내부는 여전히 NOT_IMPLEMENTED throw)
>
> **금지**: Vision 실제 구현 금지 (C-3 범위). `complete()` 로직 변경 금지.
>
> **검증**:
> ```bash
> npm run build
> npx jest --testPathPattern=ai --runInBand
> ```

### 체크리스트

- [ ] `compareImages` 시그니처에 prompt 옵션 포함
- [ ] retry loop 존재 (isRetryable 사용)
- [ ] cost record에 token 값 전달
- [ ] 모든 stub provider 빌드 통과

---

## STEP 6 — C-6: OCR 결과를 matching 점수에 반영

### 대상 파일

- `src/ai/ai.service.ts` (`matchListing`, `matchSearchResults`)
- `src/ai/prompt/builders/matching.builder.ts`
- `src/ai/ai.config.ts` (config 추가)

### 프롬프트

> **목표**: `matchListing()` 호출 시 listing에 `ocrText`가 있으면 OCR 분석 결과를 matching prompt에 포함하여 정확도를 높인다.
>
> **현재 상태**: `MATCH_WEIGHTS.ocr = 0.05` 가중치 존재하지만, `analyzeOcr()` 결과가 prompt에 반영되지 않음. LLM이 자체 추론한 값.
>
> **작업**:
> 1. `ai.config.ts`에 `ocrBeforeMatch: boolean` 추가 (env: `AI_OCR_BEFORE_MATCH`, 기본 `false`)
> 2. `.env.example`에 `AI_OCR_BEFORE_MATCH=false` 추가
> 3. `matchListing()` 또는 `matchSearchResults()`에서:
>    - `ocrBeforeMatch=true` && listing.ocrText 존재 시 → `analyzeOcr()` 호출
>    - 결과의 정규화된 필드(brand, model, serialFragments 등)를 matching prompt vars에 추가
> 4. `matching.builder.ts`에 OCR 분석 결과 섹션 추가:
>    ```
>    ## OCR Analysis Result (pre-processed)
>    - Detected Brand: {{ocrBrand}}
>    - Detected Model: {{ocrModel}}
>    - Serial Fragments: {{ocrSerials}}
>    ```
> 5. OCR 호출 실패 시 무시 (matching은 계속 진행)
>
> **금지**: `MATCH_WEIGHTS` 값 변경 금지. `ocrBeforeMatch=false` 시 기존 동작과 100% 동일해야 함.
>
> **검증**:
> ```bash
> npm run build
> npx jest --testPathPattern=ai --runInBand
> ```

### 체크리스트

- [ ] `AI_OCR_BEFORE_MATCH=false` → 기존 동작 동일
- [ ] `AI_OCR_BEFORE_MATCH=true` + ocrText 존재 → prompt에 OCR 분석 결과 포함
- [ ] OCR 호출 실패 → matching 정상 진행
- [ ] 빌드 에러 없음

---

## STEP 7 — 최종 검증 및 커밋

### 프롬프트

> **목표**: C 전체 작업 통합 검증 후 단일 커밋.
>
> **검증 명령**:
> ```bash
> npm run lint:ci
> npm run build
> npx jest --runInBand
> npm --prefix web run build
> npm run web:lint:ci
> ```
>
> **커밋**:
> ```bash
> git add -A
> git status
> git commit -m "feat(ai): improve AI accuracy — provider-aware enable, transient retry, health endpoint, rules CRUD, vision prompt fix, OCR matching"
> ```
>
> **금지**: `git push` 금지 (검증 후 수동 push).

---

## 실행 순서 요약

| STEP | Task | 예상 시간 | 의존성 |
|---|---|---|---|
| 1 | C-1: ai.enabled provider 키 기준 | 5분 | 없음 |
| 2 | C-5: retry transient 제한 | 15분 | 없음 |
| 3 | C-2: health + isImplemented | 20분 | 없음 |
| 4 | C-7: Rules CRUD API | 30분 | 없음 |
| 5 | C-4: Vision prompt/retry/cost | 30분 | STEP 2 (isRetryable) |
| 6 | C-6: OCR → matching | 30분 | 없음 |
| 7 | 통합 검증 + 커밋 | 5분 | 전체 |

**총 예상 소요: ~2시간 15분**
