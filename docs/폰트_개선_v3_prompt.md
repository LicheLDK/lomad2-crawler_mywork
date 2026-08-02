## 10. 단계별 실행 프롬프트 (AI에게 그대로 전달)

아래 STEP을 **하나씩 순서대로** Claude Code(또는 동일 코드베이스에 접근 가능한 AI 코딩 에이전트)에
그대로 붙여넣어 실행한다. 각 STEP은 이전 STEP이 이미 적용된 상태를 전제로 하며, STEP 하나가 끝나면
반드시 결과를 확인한 뒤 다음 STEP으로 넘어간다. 9장 우선순위 표의 1~8번과 1:1로 대응한다.

### STEP V3-00 (공통 컨텍스트 — 매 STEP 앞에 붙여도 됨)

```text
당신은 Senior Frontend Engineer이며 Design System Engineer입니다.

지금부터 docs/폰트_개선_v3.md에 정리된 UI 개선안을 단계별로 적용합니다.

원칙:
- 기존 기능은 절대 변경하지 않습니다.
- 기존 API는 절대 변경하지 않습니다.
- BackOffice 연동은 절대 변경하지 않습니다.
- 메뉴 구조(web/src/config/navigation.ts)는 변경하지 않습니다.
- Tailwind 토큰(web/tailwind.config.js)과 컴포넌트의 시각적 스타일만 개선합니다.
- 매 STEP 작업 완료 후, 변경한 파일 목록과 확인 방법(어느 화면에서 무엇이 달라졌는지)을
  출력하고 다음 지시가 있을 때까지 멈춥니다.

지금 진행할 STEP:
```

이어서 아래 STEP 중 하나의 본문을 붙여 넣는다.

### STEP V3-01 — Elevation 3단 토큰화

```text
web/tailwind.config.js의 boxShadow에 아래 3단계를 추가하세요.

shadow-1 (resting): 0 1px 0 rgba(15,23,42,.04), 0 8px 20px -14px rgba(15,23,42,.16)
shadow-2 (hover/popover): 0 2px 0 rgba(15,23,42,.05), 0 20px 36px -18px rgba(15,23,42,.26)
shadow-3 (drawer/modal): 0 30px 70px -24px rgba(15,23,42,.38)

기존 shadow-soft는 shadow-1과 동일한 값으로 유지하되, 새 카드/버튼 hover에는 shadow-2를 사용합니다.

적용 대상:
- web/src/components/ui/card.tsx: 기본 shadow-1, hover 가능한 카드는 hover:shadow-2 + hover:-translate-y-0.5 추가
- web/src/components/ResultDrawer.tsx: shadow-3 적용
- web/src/components/DashboardSummary.tsx, web/src/pages/OverviewPage.tsx의 카드형 요소: shadow-1 → hover:shadow-2

기존 레이아웃/여백/기능은 변경하지 않고 그림자·hover 트랜지션만 추가합니다.

작업 완료 후 변경 파일 목록을 출력하고 멈춥니다.
```

### STEP V3-02 — 타이포그래피를 Pretendard 단일 체계로 전환

```text
현재 web/src/index.css는 Fraunces(세리프)+IBM Plex Sans를 로드하고 있습니다. Fraunces는 한글
글리프가 없어 한글 텍스트에는 실제로 적용되지 않고 시스템 세리프로 폴백되고 있습니다. 이를
Pretendard Variable 단일 체계로 교체합니다.

1. web/src/index.css의 @import를 Pretendard 웹폰트 로드로 교체(CDN 사용 시 출처를 명시하고,
   실패 시 폴백 스택이 자연스럽게 동작하는지 확인)
   폴백 스택: 'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo',
   'Malgun Gothic', system-ui, sans-serif
2. web/tailwind.config.js의 fontFamily.display/sans를 위 스택으로 통일 (Fraunces 제거)
3. 헤딩/타이틀에 사용 중인 font-display 클래스들의 weight를 700(bold)이 아니라 600~650 사이로,
   큰 사이즈(페이지 타이틀 27px+, KPI 숫자 30px+)에는 letter-spacing -0.02~-0.03em을 추가
4. 숫자(KPI, 카운트, 테이블 수치)에는 tabular-nums가 전부 적용되어 있는지 점검하고 누락된 곳에 추가

기존 텍스트 내용/레이아웃/기능은 변경하지 않습니다.

작업 완료 후 변경 파일 목록과 폰트 전환으로 달라지는 화면(사이드바 로고, 페이지 타이틀, KPI 숫자)을
출력하고 멈춥니다.
```

### STEP V3-03 — 스켈레톤 로딩 상태

```text
web/src/components/ui/ 아래에 skeleton.tsx 프리미티브를 새로 만드세요 (shimmer 애니메이션,
기존 tailwind.config.js의 keyframes 패턴을 참고해 pulseSoft류 애니메이션 추가/재사용).

로딩 중 텍스트("불러오는 중…", "확인 불가" 등)로 표시되던 곳을 실제 카드 형태와 동일한 크기의
스켈레톤으로 교체하세요. 최소 대상:
- web/src/components/DashboardSummary.tsx (stats == null 분기)
- web/src/pages/OverviewPage.tsx의 Worker 상태 타일 (queue == null 분기)
- web/src/components/RecentSearches.tsx 등 목록 로딩 분기(있다면)

데이터 fetch 로직/상태 관리는 변경하지 않고, 로딩 중 표시되는 마크업만 교체합니다.

작업 완료 후 변경 파일 목록을 출력하고 멈춥니다.
```

### STEP V3-04 — 상태 도트 배지

```text
web/src/components/ui/badge.tsx에 dot 표시 옵션을 추가하세요 (예: dot?: boolean prop, 또는
variant="dot"). 활성화 시 배지 좌측에 currentColor 배경의 6px 원(span)을 렌더링합니다.

적용 대상: web/src/features/investigation/components/StatusBadge.tsx (Open/Review/Completed/
Archived 상태 표시). 기존 색상 매핑(variant)은 유지하고 dot만 추가합니다.

배지가 쓰이는 다른 곳(Worker/Queue 상태 등)에도 동일하게 적용할지는 화면별로 판단하되,
Investigation 상태 배지는 반드시 적용합니다.

기존 배지의 색상 의미/상태값은 변경하지 않습니다.

작업 완료 후 변경 파일 목록을 출력하고 멈춥니다.
```

### STEP V3-05 — KPI 타일 스파크라인 + 증감 표시

```text
web/src/pages/OverviewPage.tsx의 OverviewTile 컴포넌트에 두 가지를 추가하세요.

1. 미니 스파크라인: web/src/types.ts의 StatsOverview.searchTrend(있다면 그 필드, 없다면 stats
   API가 제공하는 시계열 필드를 확인)를 이용해 최근 추이를 12x64px 정도의 작은 SVG polyline으로
   렌더링. 데이터가 없으면 스파크라인 없이 숫자만 표시(에러 대신 조용히 숨김).
2. 전기간 대비 증감 배지: 이전 기간 대비 증감률을 계산할 수 있는 필드가 있으면 상승(초록)/하락
   (빨강)/보합(회색) 배지를 숫자 옆에 표시. 계산 가능한 데이터가 없으면 이 단계는 건너뛰고
   그 사실을 결과 보고에 명시하세요 (백엔드 API 변경은 이번 STEP 범위가 아닙니다).

DashboardSummary.tsx의 타일에도 동일 패턴을 적용할 수 있으면 적용합니다.

기존 API는 호출 방식을 변경하지 않고, 이미 오는 응답 필드만 활용합니다. 필드가 부족해 구현이
어려운 부분은 임의로 지어내지 말고 생략 후 보고하세요.

작업 완료 후 변경 파일 목록과, 실제 표시 가능했던 항목/생략한 항목을 출력하고 멈춥니다.
```

### STEP V3-06 — 사이드바 액티브 인디케이터

```text
web/src/components/AppSidebar.tsx의 navClass()가 active 상태를 배경색(bg-ink-900)만으로 표시하고
있습니다. 여기에 좌측 2~2.5px 폭의 accent(teal) 세로 바를 추가하세요 (relative 컨테이너 + absolute
포지션 span, 또는 border-left 활용). collapsed 모드에서는 기존 방식(작은 dot)을 유지합니다.

기존 active 판정 로직(pathMatches, childPathActive)과 네비게이션 동작은 변경하지 않습니다.

작업 완료 후 변경 파일 목록을 출력하고 멈춥니다.
```

### STEP V3-07 — Analytics 차트 도입

```text
web/src/pages/AnalyticsPage.tsx에 recharts(이미 web/package.json에 포함되어 있음)를 사용해
최소 아래 3개 차트를 추가하세요. 기존 섹션 구조(검색/사이트별/AI/Investigation 통계, ?section=
쿼리 파라미터)는 그대로 유지하고, 각 섹션 안에 숫자 나열 대신 차트를 보강하는 방식으로 넣습니다.

1. 검색 통계 섹션: 일별 검색량 바 차트 (StatsOverview에서 활용 가능한 시계열 필드 사용)
2. 사이트별 통계 섹션: 사이트별 비중 도넛 또는 가로 바 차트 (bySite/siteMetrics 필드 사용)
3. AI 분석 통계 섹션: 기간별 AI 호출 수 라인 차트 (AiUsageSummary/AiUsageMonthly 등 사용)

번들 크기를 고려해 AnalyticsPage 자체를 React.lazy로 지연 로드할 수 있으면 적용하세요(선택).
기존 API 호출/데이터 구조는 변경하지 않고, 이미 오는 응답을 차트에 매핑만 합니다.

작업 완료 후 변경 파일 목록과 각 차트가 사용한 실제 데이터 필드를 출력하고 멈춥니다.
```

### STEP V3-08 — 다크모드

```text
web/src/index.css의 color-scheme: light 고정을 제거하고 다크모드를 지원합니다.

1. web/tailwind.config.js에 darkMode: 'class' (또는 'media') 설정 추가
2. :root에 라이트 토큰(CSS 커스텀 프로퍼티 또는 Tailwind 다크 variant)을 정의하고,
   @media (prefers-color-scheme: dark)로 기본 오버라이드 → 사용자가 명시적으로 토글하면
   html[data-theme="dark"]/"light"가 최종 우선하도록 구성
3. sand 계열은 순수 슬레이트 다크가 아니라 웜톤을 유지한 다크(#17140f, #211c15 계열)로 별도 정의
4. teal 포인트는 다크에서 teal-400(#2dd4bf)로 밝기 보정
5. 사이드바/카드의 backdrop-blur는 다크에서 대비가 무너지므로 solid 배경으로 대체
6. AppShell 또는 사이드바 하단에 라이트/다크 토글 버튼 추가, 사용자 선택은 localStorage에 저장

전 페이지(Overview/Search/Rental/Investigation/Analytics/System)에서 다크모드로 전환했을 때
텍스트 대비가 무너지는 곳이 없는지 점검하세요. 기존 라이트 모드 스타일/레이아웃/기능은 변경하지
않습니다.

작업 완료 후 변경 파일 목록과 다크모드 토글 위치/저장 방식을 출력하고 멈춥니다.
```
