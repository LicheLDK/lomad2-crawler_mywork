# 신규 프로젝트 스펙 템플릿

> **사용법**: `[ ]`로 표시된 항목만 채우면 됩니다. 나머지(스택/아키텍처/설계 패턴/화면 디자인 토큰)는
> 이 크롤러 프로젝트(`search-crawler-server`)에서 검증된 **기본값**이 이미 채워져 있고, 대부분의 새
> 대시보드/서버 프로젝트에 그대로 재사용 가능합니다. 원본 근거 문서: [`spec.md`](./spec.md)(스택/구조) ·
> [`폰트_개선_v3.md`](./폰트_개선_v3.md)(화면 디자인).

---

## 0. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 프로젝트명 | `[ ]` |
| 한 줄 설명 (무슨 업무를 하는가) | `[ ]` |
| 핵심 사용자 (누가 매일 이 화면을 보는가) | `[ ]` |
| 연동할 외부 시스템 (있다면) | `[ ]` |
| 참고 원본 | `lomad2-crawler_mywork` (`search-crawler-server`) |

---

## 1. 기술 스택 (기본값 — 대부분 그대로 사용)

### 1.1 Backend

| 구성 | 기술 | 변경 필요? |
|---|---|---|
| Runtime | Node.js 22 | 아니오 |
| 언어 | TypeScript 5.7 | 아니오 |
| 프레임워크 | NestJS 11 | 아니오 |
| 설정 | `@nestjs/config` 4 (`registerAs` 파일 분리) | 아니오 |
| ORM/DB | `typeorm` 0.3 + `pg` 8 (PostgreSQL 16) | DB 종류 바꿀 경우만 |
| Queue | `bullmq` 5 + Redis | 비동기 작업 없으면 드롭 |
| 검색 인덱스 | `@elastic/elasticsearch` 8 | 전문검색/대량조회 없으면 드롭 |
| 브라우저 자동화 | `playwright` 1.50 | 외부 사이트 스크래핑 없으면 드롭 |
| 실시간 | `socket.io` 4 | 실시간 진행률 UI 없으면 드롭 |
| 로깅 | `nestjs-pino` (이중 transport) | 아니오 |
| AI/LLM | SDK 없이 `fetch` 직접 호출 | AI 판단 로직 필요할 때만 포함 |
| 테스트 | `jest` + `ts-jest` | 아니오 |

### 1.2 Frontend

| 구성 | 기술 | 변경 필요? |
|---|---|---|
| 프레임워크 | React 18 + TypeScript 5 (strict) | 아니오 |
| 빌드 | Vite 5 | 아니오 |
| 라우팅 | `react-router-dom` 7 | 아니오 |
| 스타일 | Tailwind CSS 3 (커스텀 토큰) | 컬러 토큰만 브랜드에 맞게 (10장) |
| UI 프리미티브 | shadcn 패턴 (`cva` + `clsx` + `tailwind-merge`) | 아니오 |
| 아이콘 | `lucide-react` | 아니오 |
| HTTP | 순수 `fetch` 래핑 | 아니오 |
| 실시간 | `socket.io-client` | 백엔드와 동일하게 결정 |
| 차트 | `recharts` | 데이터 시각화 필요할 때만 |

### 1.3 Infra

| 서비스 | 기본 이미지 | 변경 필요? |
|---|---|---|
| DB | `postgres:16-alpine` | DB 종류 바꿀 경우만 |
| Queue 백엔드 | `redis:7-alpine` | Queue 안 쓰면 드롭 |
| 검색 인덱스 | `elasticsearch:8.17.0` | 안 쓰면 드롭 |
| 배포 | PM2 (`ecosystem.config.js`) + Docker Compose (인프라) | 프로세스/서비스 이름만 변경 |

---

## 2. 프로세스 구조 (기본값 — 그대로 사용)

같은 `AppModule`을 API(`main.ts`, HTTP 서버)/Worker(`worker.ts`, `createApplicationContext`)로
다르게 부팅하고, `ENABLE_WORKER` 플래그로 큐 프로세서 등록 여부를 가른다. Web은 별도 정적 SPA.
비동기 처리(Queue/Worker)가 필요 없는 단순 CRUD 프로젝트라면 Worker 프로세스 자체를 생략하고
API 단일 프로세스로 단순화해도 된다 — 그 경우 `[ ] Worker 프로세스 필요 여부: 예 / 아니오`.

```
[외부 요청] → API (x-api-key 인증)
       ↓
   [작업 단위 생성] ──(비동기 처리 필요시)──→ Queue → Worker → 처리 로직
       ↓                                                    ↓
   즉시 응답                                    DB 저장 + (선택)실시간 진행률 + (선택)콜백
```

---

## 3. 폴더 구조 (기본값, 도메인 폴더만 이름 교체)

```
src/
  main.ts / worker.ts / register-paths.ts / app.module.ts   # 그대로
  config/  common/  database/  queue/                       # 그대로 (Queue 쓸 경우)

  [ 데이터 수집/연동 모듈명 — 예: crawler/ → ??? ]/
    adapter/           # 외부 소스별 어댑터 (인터페이스 + Base 추상클래스 + Registry는 그대로 재사용)

  [ 판단/자동화 엔진명 — 예: ai/ → ??? ]/          # 필요 없으면 폴더 자체 삭제
    providers/  prompt/  rules/  cost/

  [ 외부 시스템 연동명 — 예: api/rental.* → ??? ]/   # client.ts / service.ts / types.ts 3분리 유지

  modules/
    [ 도메인 검토 단위 모듈명 — 예: investigation/ → ??? ]/
    search/  crawl/  cache/  health/  stats/         # 범용 API는 이름만 프로젝트에 맞게

web/src/
  main.tsx  App.tsx  api.ts  types.ts                # 그대로
  components/  components/ui/  lib/                  # 그대로
  config/navigation.ts                                 # 9.2에서 채움
  pages/                                                # 라우트별로 새로 작성
  features/
    [ 새 도메인 기능명 ]/
      types.ts  <feature>-context.ts  use<Feature>.ts  <Feature>Provider.tsx  index.ts
      components/  hooks/  lib/
```

---

## 4. 재사용 설계 패턴 (기본값 — 그대로 적용)

| 패턴 | 요지 |
|---|---|
| 외부 API 연동 3파일 분리 | `*.client.ts`(순수 HTTP) / `*.service.ts`(도메인 매핑) / `*.types.ts`, 컨트롤러는 service만 의존 |
| 비동기 Job + 콜백 | 요청 즉시 `{jobId, status:'pending'}` 반환, 완료 후 콜백 POST — 동기 대기 금지 |
| Adapter 패턴 | 인터페이스 1개 + 성격별 Base 추상클래스 2종(HTTP/브라우저) + `Map` 기반 Registry |
| Queue Producer/Consumer + DLQ | 지수 backoff 재시도 + 실패 소진 시 DLQ 이동 + 재시도 Admin API |
| Provider 추상화 + 사용량 로깅 | 벤더 교체 가능한 인터페이스 + 모든 외부 호출(성공/실패) 별도 테이블 기록 |
| API Key Guard + 프로덕션 시크릿 가드 | 헤더 기반 인증 + 기본값으로 프로덕션 부팅 거부 |
| 전역 예외 필터 | 응답 포맷 통일 |
| 마이그레이션 워크플로우 | dev `synchronize:true`, prod는 마이그레이션 전용, 파일명 `<epoch>-<PascalCase>.ts` |
| Feature 모듈(프론트) | Context+Provider+hook+types+index 배럴 6종 파일 세트 |
| Nav 단일 소스 | `NAV_SECTIONS` 배열 하나가 사이드바+active판정+서브탭 근거 |
| API client 단일 헬퍼 | `request<T>()` 하나 + 플랫 메서드 객체, 타입은 지연 import |
| 반응형 3단 Shell | Desktop 고정 / Tablet 아이콘만 / Mobile 드로어 |
| Realtime + Poll fallback | 소켓 이벤트 우선 + 유실 대비 폴링 병행 |

---

## 5. 도메인 로직 정의 — **여기를 채우세요**

| 축 | 질문 | 답변 |
|---|---|---|
| ① 데이터 수집 대상 | 어떤 외부 소스에서 데이터를 가져오나요? (API / 스크래핑 / 파일 업로드 / 내부 DB 등) | `[ ]` |
| ② 검토 단위 | 사람이 검토·판단해야 하는 단위가 있나요? 있다면 무엇이고, 상태값은 어떻게 되나요? | `[ ]` |
| ③ 외부 시스템 연동 | 어떤 외부 시스템과 연동하나요? 인증 방식은? 데이터는 어느 방향으로 흐르나요? | `[ ]` |
| ④ 판단/자동화 로직 | AI나 규칙 기반 자동 판정이 필요한가요? 필요하면 판단 기준은 무엇인가요? | `[ ]` |
| ⑤ DB 스키마 | 핵심 엔티티(테이블)는 무엇인가요? (3~7개 정도로 나열) | `[ ]` |
| ⑥ 핵심 메뉴 | 사이드바 최상위 메뉴는 몇 개, 각각 무슨 역할인가요? | `[ ]` |
| ⑦ 브랜딩 | 프로젝트명/로고 텍스트, 포인트 컬러(하나)는? | `[ ]` |
| ⑧ 프로세스명 | PM2/Docker 서비스명 접두어는? (기존: `crawler-*`) | `[ ]` |

---

## 6. 제작 체크리스트

- [ ] 레포 복제 후 `package.json`/`web/package.json` name, `README.md`, `ecosystem.config.js` 앱 이름,
      `docker-compose.yml` 서비스명을 5장 ⑧로 교체
- [ ] 1·2·4·7장(스택/프로세스/패턴/스크립트)은 원칙적으로 그대로 유지
- [ ] 3장 폴더의 도메인 폴더명을 5장 답변에 맞게 실제로 rename
- [ ] Queue/Elastic/AI/실시간 중 이 프로젝트에 불필요한 것은 과감히 드롭 (1장 "변경 필요?" 열 참고)
- [ ] 8장 환경변수 표를 5장 답변 기준으로 실제 변수명으로 확정
- [ ] 9장 API 표를 실제 엔드포인트로 채움
- [ ] 10장 화면 스펙에서 브랜드 컬러(10.2 accent)와 사이드바 메뉴(10.9)를 5장 답변으로 채움
- [ ] `docs/database_migrations.md` 방식 그대로 첫 마이그레이션(`migration:generate`) 생성

---

## 7. 개발/배포 스크립트 (기본값 — 그대로 사용)

| 명령 | 동작 |
|---|---|
| `r` / `npm run dev` | 인프라 + API + Worker + Web 전체 기동 |
| `npm run start:dev:api` | API watch (`ENABLE_WORKER=false`) |
| `npm run start:worker:dev` | Worker (`ENABLE_WORKER=true`) — Worker 없는 프로젝트면 삭제 |
| `npm run web:dev` | Vite 개발 서버 (`/api` 프록시) |
| `npm run build:all` | Nest + Web 빌드 |
| `npm run migration:run:prod` | 프로덕션 마이그레이션 |
| `npm run pm2:start` / `:reload` / `:logs` | 운영 명령 |

---

## 8. 환경변수 카탈로그 템플릿

| 카테고리 | 대표 변수(예시) | 이 프로젝트의 실제 변수명 |
|---|---|---|
| App/보안 | `NODE_ENV` `PORT` `API_KEY` `JWT_SECRET` | 그대로 |
| 로깅 | `LOG_APP` `LOG_LEVEL` `LOG_DIR` | 그대로 |
| DB | `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | 그대로 |
| Queue/Redis | `REDIS_HOST` `〈QUEUE〉_CONCURRENCY` `〈QUEUE〉_ATTEMPTS` | `[ ]` |
| 검색 인덱스 | `ELASTIC_NODE` `ELASTIC_INDEX` | `[ ]` |
| 데이터 수집 | `〈SOURCE〉_TIMEOUT_MS` `〈SOURCE〉_USER_AGENT` | `[ ]` |
| 외부 시스템 연동 | `〈EXT〉_API_BASE_URL` `〈EXT〉_API_KEY` `〈EXT〉_CALLBACK_PATH` | `[ ]` |
| 자동화 임계값 | `〈DOMAIN〉_AUTO_CREATE` `〈DOMAIN〉_SCORE_THRESHOLD` | `[ ]` |
| AI 엔진 (필요시) | `AI_ENABLED` `AI_PROVIDER` `OPENAI_API_KEY` | 그대로 (AI 미사용 시 전체 삭제) |
| Frontend(Vite) | `VITE_API_BASE` `VITE_SOCKET_URL` | 그대로 |

---

## 9. API 설계 템플릿

인증 방식: `[ ]` (기본값: 헤더 `x-api-key: <API_KEY>`)

| 메서드/경로 | 설명 |
|---|---|
| `[ ]` | `[ ]` |
| `[ ]` | `[ ]` |
| `GET /api/health` | 헬스 체크 (그대로) |
| `GET /api/stats` | 대시보드 통계 (그대로) |

비동기 작업이 있다면: `POST /api/[ ]` → `{jobId, status:'pending'}` 즉시 응답 →
`GET /api/[ ]/:id/progress` 폴링 + Socket.IO `job:progress` 이벤트 병행 (README 예시 패턴 재사용).

---

## 10. 화면 구성 (Screen / UI Spec)

> 근거: [`폰트_개선_v3.md`](./폰트_개선_v3.md). 이 크롤러 프로젝트에서 실제로 다듬어 검증한 디자인
> 토큰이며, 대부분 도메인과 무관하게 그대로 재사용 가능하다. **10.2의 accent 컬러와 10.9의 메뉴만
> 프로젝트별로 채우면 된다.**

### 10.1 디자인 컨셉

- 이 프로젝트 컨셉 키워드: `[ ]` (기존 예시: "Warm Editorial Intelligence" — 웜톤 베이스 + 정밀한 디테일)
- 톤: `[ ]` 전문적/차분함(운영 대시보드) vs 활기참/친근함(고객향) 등 한 축 선택

### 10.2 컬러 토큰

라이트/다크 모두 아래 8개 토큰만 정의하면 전 컴포넌트에 적용 가능 (CSS 커스텀 프로퍼티 또는
Tailwind `theme.extend.colors`로 구현).

| 토큰 | 역할 | 기본값(Light) | 기본값(Dark) | 교체 필요? |
|---|---|---|---|---|
| `bg` | 페이지 배경 | `#f7f5f1` | `#120f0c` | 브랜드에 맞게 톤만 조정 |
| `surface` | 카드/패널 배경 | `rgba(255,253,250,.86)` | `rgba(28,23,18,.82)` | 아니오 |
| `border` | 기본 보더 | `#e4ddd0` | `#322a20` | 아니오 |
| `text` / `text-muted` / `text-faint` | 본문/보조/희미 텍스트 | `#141c2e` / `#64748b` / `#94a3b8` | `#f3ede2` / `#a89e8c` / `#756b5b` | 아니오 |
| **`accent`** | **브랜드 포인트 컬러** | `#0f766e` (teal) | `#2dd4bf` | **`[ ] 프로젝트 브랜드 컬러로 교체`** |
| `success` | 긍정/완료 | `#3f7d5c` | `#7fbf9a` | 아니오 (semantic, accent와 별개) |
| `warning` | 주의 | `#b45309` | `#f0a94e` | 아니오 |
| `danger` | 위험/오류 | `#b3413a` | `#e2897f` | 아니오 |

원칙: semantic 컬러(success/warning/danger)는 accent와 분리해서 유지한다 — accent를 바꿔도
상태 표현은 항상 동일한 규칙으로 읽혀야 한다.

### 10.3 타이포그래피 — Pretendard 단일 체계

**그대로 재사용 권장** (한글 프로젝트는 예외 없이 이 조합이 가장 안전 — 이유는 `폰트_개선_v3.md` 3.1 참고).

| 토큰 | 크기/굵기/자간 | 용도 |
|---|---|---|
| `display-lg` | Pretendard 32/650, -0.025em | 페이지 타이틀 |
| `display-md` | Pretendard 22/650, -0.02em | 섹션 타이틀 |
| `display-sm` | Pretendard 18/600, -0.015em | 서브 섹션 |
| `metric` | Pretendard 30/650, -0.025em, tabular-nums | 대시보드 숫자(KPI) |
| `body` | Pretendard 14/400 | 본문 |
| `caption` | Pretendard 12/400 | 보조 텍스트 |
| `eyebrow` | Pretendard 11/500, tracking 0.16em, uppercase | 상단 라벨 |
| `data` | JetBrains Mono 12~13/400, tabular-nums | ID, 타임스탬프, 코드성 데이터 |

폴백 스택: `'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif`

### 10.4 Elevation (그림자 3단계)

```
shadow-1 (resting card)    0 1px 0 rgba(15,23,42,.04), 0 8px 20px -14px rgba(15,23,42,.16)
shadow-2 (hover / popover) 0 2px 0 rgba(15,23,42,.05), 0 20px 36px -18px rgba(15,23,42,.26)
shadow-3 (drawer / modal)  0 30px 70px -24px rgba(15,23,42,.38)
```

카드 hover: `shadow-1 → shadow-2` + `translateY(-2px)`. Drawer/Modal은 `shadow-3`.

### 10.5 컴포넌트 가이드 (그대로 재사용)

| 컴포넌트 | 규칙 |
|---|---|
| 카드 | `rounded-2xl`(16px), 1px border, `shadow-1`, hover 시 `shadow-2`+lift |
| 배지 | 상태 표현은 pill이 아니라 **도트+라벨** (`● Open`) — 색맹 접근성 + 정보 밀도 동시 확보 |
| 요약/KPI 타일 | 숫자만 나열 금지 — 미니 스파크라인 또는 전기간 대비 증감 화살표 병기 |
| 로딩 상태 | 텍스트("불러오는 중…") 대신 카드 형태 그대로의 스켈레톤(shimmer) |
| 사이드바 활성 항목 | 풀필 배경 + 좌측 2px accent 인디케이터 바 |
| 테이블 | 헤더 sticky, hover row 강조, 클릭 가능 row는 우측 chevron |
| 검색/입력 | height 44px, focus 시 accent ring |

### 10.6 데이터 시각화

숫자 나열만으로 "분석" 메뉴를 표방하지 않는다. 최소한: 기간별 추이(바/라인), 카테고리 비중(도넛/가로바).
라이브러리: `recharts` (Tailwind와 궁합 좋음, 이미 `web/package.json`에 포함).

### 10.7 모션 토큰

| 대상 | 지속시간 | easing |
|---|---|---|
| Hover(버튼/카드) | 150ms | ease-out |
| 아코디언/드로어 | 250~300ms | cubic-bezier(0.32,0.72,0,1) |
| 페이지 전환 | 200ms | fadeUp, stagger 없이 1회 |
| 리스트 아이템 등장 | 40ms stagger, 최대 6개까지 | fadeUp |

### 10.8 다크모드

CSS 커스텀 프로퍼티를 `:root`에 정의 → `@media (prefers-color-scheme: dark)`로 기본 오버라이드 →
`:root[data-theme="dark"]`/`[data-theme="light"]`로 사용자 토글이 최종 우선하도록 구성. surface는
다크에서 blur 대신 solid 배경 권장(대비 확보).

### 10.9 사이드바 메뉴 구성 — **여기를 채우세요**

5장 ⑥ 답변을 아래 표로 구체화한다 (`web/src/config/navigation.ts`의 `NAV_SECTIONS` 그대로 대응).

| 섹션 | 최상위 메뉴 | 하위 메뉴(있다면) | 배지 필요? |
|---|---|---|---|
| `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| `[ ]` | `[ ]` | `[ ]` | `[ ]` |

### 10.10 대시보드 요약 지표 — **여기를 채우세요**

Overview 화면 상단 KPI 타일 4개 (5장 ①~④ 답변에서 자연스럽게 도출되는 경우가 많음).

| 지표 | 값 출처 | 클릭 시 이동 |
|---|---|---|
| `[ ]` | `[ ]` | `[ ]` |
| `[ ]` | `[ ]` | `[ ]` |
| `[ ]` | `[ ]` | `[ ]` |
| `[ ]` | `[ ]` | `[ ]` |
