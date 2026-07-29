== 1. Investigation Feature Review ===================================================

당신은

- Senior Product Manager
- Senior UX Designer
- Senior Full Stack Architect
- Senior QA Engineer

입니다.

당신의 역할은 코드를 수정하는 것이 아니라

"현재 구현된 Investigation 기능이 원래 기획 의도에 맞게 구현되었는지"

제품 관점에서 검토하는 것입니다.

== 2. Investigation Feature Review ===================================================

# Investigation Feature Review

현재 Search Crawler Dashboard에는 Investigation 기능이 구현되어 있습니다.

이 기능은 단순히 검색 결과를 보여주는 화면이 아닙니다.

Investigation은

렌탈 상품의 재판매 의심 사례(Case)를 조사하는

Case Management System입니다.

목표는

검색

↓

AI 분석

↓

증거 수집

↓

담당자 검토

↓

최종 판정

까지 관리하는 것입니다.

당신은

Senior Product Manager

Senior UX Designer

Senior QA Engineer

Senior System Architect

관점에서

현재 구현을 검토합니다.

## 반드시 확인할 항목

### 1.

Investigation이

단순 검색 결과 화면인지

Case Workspace인지 평가

###

2.

검색(Search)과

Investigation의 역할이 명확하게 분리되어 있는지

###

3.

사용자가

조사를 진행하기 위한 정보가 충분한지

###

4.

Evidence를 관리할 수 있는 구조인지

###

5.

Timeline이 필요한지

현재 구조가 적절한지

###

6.

담당자 메모 기능이 필요한지

###

7.

상태 관리

OPEN

REVIEW

CONFIRMED

CLOSED

가 가능한지

###

8.

AI Summary 위치가 적절한지

###

9.

AI Recommendation이 필요한지

###

10.

Drawer 구조가

Case 조사에 적합한지

###

11.

Investigation 화면이

향후

수천 건의 사건을 관리하기 적합한지

###

12.

운영자가

하루 수백 건을 처리하기 좋은 UX인지

###

13.

중복 기능이 있는지

###

14.

빠진 기능은 무엇인지

###

15.

업무 흐름이 자연스러운지

Rental

↓

Search

↓

Investigation

↓

Complete

###

16.

현재 구조에서

가장 먼저 개선해야 할 UX는 무엇인지

###

17.

Investigation이

"Case Management System"

으로 충분한지 평가

##

출력 형식

### Overall Score

100점 만점

### 잘 구현된 부분

###

문제점

###

UX 개선사항

###

빠진 기능

###

추천 기능

###

화면 구성 개선

###

메뉴 개선

###

Drawer 개선

###

Case Flow

###

최종 의견

구현 완료도가

몇 %

인지

정량적으로 평가합니다.

점수만 주지 말고

왜 그렇게 판단했는지 설명합니다.

코드 수정은 하지 않습니다.

오직 제품 리뷰만 수행합니다.

== 3. Investigation 화면의 UI 평가 ===================================================

Investigation 화면의 UI만 평가합니다.

아래 기준으로 평가합니다.

1. 정보 구조

2. 사용성

3. 가독성

4. 작업 효율

5. 정보 우선순위

6. 버튼 위치

7. Drawer UX

8. AI 정보 노출 방식

9. 상태 관리 UX

10. 운영자가 하루 수백 건을 처리할 수 있는 구조인지

출력은

좋은 점

아쉬운 점

반드시 수정해야 할 점

추천 개선안

으로 작성합니다.

== 4. Investigation Workflow 평가 ===================================================

현재 Investigation Workflow를 검토합니다.

Rental

↓

Search

↓

Crawler

↓

AI

↓

Investigation

↓

Evidence

↓

Review

↓

Complete

이 Workflow가 자연스러운지

불필요한 단계가 있는지

빠진 단계가 있는지

자동화 가능한 단계가 있는지

평가합니다.

개선된 Workflow를 제안합니다.

== 5. Investigation 화면의 UX 평가 ===================================================

Investigation 기능을

Case Management System 관점에서 평가합니다.

Investigation이

단순히 검색 결과를 저장하는 기능인지

아니면

사건을 관리하는 Workspace인지

평가합니다.

현재 구조에서

Case를 조사하는데 부족한 기능을 모두 나열합니다.

향후

100만 건 이상의 Investigation을 관리한다고 가정하고

확장성까지 고려하여 평가합니다.

개선안을 우선순위별로 작성합니다.

P1

반드시 수정

P2

추천

P3

향후 기능

으로 구분합니다.

== 6. Investigation 화면의 UX 평가 ===================================================

이 프로젝트의 목표는 "검색 시스템"을 만드는 것이 아니라 "렌탈 상품 재판매 조사 시스템(Case Management Platform)"을 만드는 것이다.

모든 리뷰는 이 목표를 기준으로 수행한다.

검색 기능 중심이 아니라 조사(Investigation) 중심으로 평가한다.

현재 구현이 이 목표에 얼마나 부합하는지 객관적으로 평가하고, 과도한 기능 추가보다는 운영 효율과 확장성을 기준으로 개선점을 제안한다.
