# STEP 1 - Delete UX Policy

현재 프로젝트에서 브라우저의 window.confirm()을 사용하고 있습니다.

이를 현대적인 AI SaaS Dashboard UX로 변경합니다.

참고 UI

- Linear
- GitHub
- Notion
- Cursor
- OpenAI Dashboard

목표

브라우저 기본 confirm()을 완전히 제거합니다.

삭제는 아래 정책을 따릅니다.

────────────────────────

검색 이력

→ 즉시 삭제하지 않습니다.

→ Custom Confirm Dialog를 표시합니다.

────────────────────────

Investigation

→ 반드시 Confirm Dialog를 거칩니다.

────────────────────────

System 설정

→ 반드시 Confirm Dialog를 거칩니다.

────────────────────────

Rental 계약

→ Confirm Dialog를 거칩니다.

────────────────────────

모든 Dialog는 동일한 Component를 사용합니다.

작업 완료 후 삭제 UX 정책을 설명합니다.

# STEP 2 - Create Confirm Dialog Component

재사용 가능한 Confirm Dialog Component를 생성합니다.

Component

ConfirmDialog

Props

title

description

confirmText

cancelText

variant

onConfirm

onCancel

loading

size

지원 Variant

default

danger

warning

success

Danger Variant

삭제 버튼은 Red

취소 버튼은 Outline

Dialog 규격

Width

440px

Radius

16px

Padding

24px

Animation

Fade + Scale

200ms

ESC 지원

Outside Click 지원

Focus Trap 지원

Keyboard Navigation 지원

Dialog는 Portal로 렌더링합니다.

Tailwind Component로 작성합니다.

기존 기능은 변경하지 않습니다.

# STEP 3 - Search History Delete

Search History 삭제 기능을 Confirm Dialog로 변경합니다.

현재

window.confirm()

↓

변경

ConfirmDialog

Dialog 내용

제목

검색 이력 삭제

본문

"임스 체어" 검색 이력을 삭제하시겠습니까?

아래 내용을 추가합니다.

삭제되는 항목

• 검색 결과 캐시

• 검색 이력

삭제되지 않는 항목

✓ Investigation

✓ AI 분석 결과

버튼

취소

삭제

삭제 버튼은 Danger Variant를 사용합니다.

삭제 완료 후

Toast를 표시합니다.

"검색 이력이 삭제되었습니다."

작업 완료 후 UX를 설명합니다.

# STEP 4 - Success Toast

삭제 성공 시 Toast를 추가합니다.

Toast 위치

우측 하단

표시 시간

3초

내용

✔ 검색 이력이 삭제되었습니다.

닫기 버튼 지원

Animation

Slide Up

Fade

Toast Component를 공통으로 사용합니다.

검색

Investigation

Rental

System

모든 곳에서 재사용합니다.

# STEP 5 - Delete Loading

삭제 중에는 Dialog를 닫지 않습니다.

삭제 버튼

↓

Loading Spinner

↓

Disabled

취소 버튼도 Disabled

삭제 완료 시

Dialog 자동 Close

Toast 표시

실패 시

Dialog 유지

Error Toast 표시

"삭제에 실패했습니다."

기존 API는 변경하지 않습니다.

# STEP 6 - History Item Action Menu

Search History Card의 우측 상단 휴지통 아이콘을 제거합니다.

대신

More Button

(⋯)

Dropdown Menu를 사용합니다.

메뉴

Search Again

Duplicate Search

Delete

Delete는 Danger Color를 사용합니다.

Delete 선택 시

Confirm Dialog를 표시합니다.

실수로 삭제되는 것을 방지합니다.

기존 기능은 변경하지 않습니다.

# STEP 7 - Investigation Delete

Investigation 삭제도 동일한 Confirm Dialog를 사용합니다.

단,

내용은 다르게 표시합니다.

제목

조사 삭제

본문

이 Investigation를 삭제하시겠습니까?

삭제되는 항목

• Investigation

• Evidence

• AI 분석 결과

• 이미지 비교 결과

경고 문구

이 작업은 되돌릴 수 없습니다.

Danger Variant를 사용합니다.

삭제 완료 후 Toast를 표시합니다.

# STEP 8 - Delete UX Refactoring

프로젝트 전체를 검사합니다.

window.confirm()

alert()

prompt()

를 모두 제거합니다.

아래 Component를 사용하도록 통일합니다.

ConfirmDialog

Toast

DropdownMenu

삭제 UX를 프로젝트 전반에 일관되게 적용합니다.

기존 API 및 Business Logic은 절대 변경하지 않습니다.

완료 후

변경된 삭제 UX 목록을 출력하고 종료합니다.
