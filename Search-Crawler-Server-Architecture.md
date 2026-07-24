# Search-Crawler-Server-Architecture.md

---

# 1. 프로젝트 개요

## 1.1 프로젝트명

```
Search Crawler Server
```

## 1.2 목적

가구 렌탈 쇼핑몰에서 고객이 렌탈한 상품이 이후 중고거래 사이트(중고나라, 번개장터, 당근 등)에 판매되었는지 자동으로 검색하는 검색 서버를 구축한다.

검색 서버는 Laravel 쇼핑몰과 독립적으로 운영되며 REST API를 통해 연동한다.

---

## 1.3 개발 목표

예를 들어

- 여러 사이트 동시 검색
- 검색 결과 캐싱
- 검색 이력 저장
- 이미지 비교
- 빠른 검색
- 사이트 추가가 쉬운 구조
- Worker 확장 가능

---

# 2. 요구사항

## Functional Requirements

예를 들면

```
FR-001
상품명을 검색할 수 있어야 한다.

FR-002
여러 사이트를 동시에 검색해야 한다.

FR-003
검색 결과를 저장해야 한다.

FR-004
이미지 URL을 저장해야 한다.

FR-005
같은 URL은 중복 저장하지 않는다.

FR-006
이미지 유사도를 계산한다.

FR-007
검색 API를 제공한다.
```

---

## Non Functional

예)

```
100개의 검색 요청

동시 Worker 20개

응답시간 5초 이하

재시도 지원

Queue 기반

Docker 운영
```

---

# 3. 전체 아키텍처

여기에 큰 그림

```
Laravel

↓

REST API

↓

NestJS

↓

Redis Queue

↓

Crawler Worker

↓

Playwright

↓

중고나라

↓

DB 저장

↓

Elastic Index

↓

Laravel 조회
```

그리고

각 컴포넌트 설명

---

# 4. 기술 스택 선정

여기가 꽤 중요합니다.

예를 들어

## NestJS

왜 선택했는가

장점

단점

Express와 비교

Fastify와 비교

---

## Fastify

왜 Express가 아닌가

---

## Playwright

왜 Puppeteer가 아닌가

Cloudflare

SPA 대응

자동 로그인

---

## BullMQ

Queue

Retry

Delay

Priority

---

## Redis

왜 필요한가

---

## PostgreSQL

왜 Mongo가 아닌가

---

## Elasticsearch

왜 필요한가

언제 조회하는가

---

# 5. 프로젝트 구조

예를 들어

```
apps/

modules/

crawler/

adapter/

queue/

common/

config/

database/

elastic/

storage/

```

각 폴더 역할

---

# 6. 시스템 구성

API Server

Worker

Redis

Elastic

DB

설명

---

# 7. Adapter Pattern

여기가 핵심

예를 들어

```
interface SearchAdapter {

search()

parse()

normalize()

}
```

그리고

```
JoonggonaraAdapter

BungaeAdapter

KarrotAdapter

```

설명

---

# 8. 크롤러 동작 방식

예)

```
검색 요청

↓

Queue 등록

↓

Worker 선택

↓

Playwright 실행

↓

검색

↓

HTML 분석

↓

결과 저장

↓

Elastic Index

↓

응답
```

---

# 9. 검색 프로세스

예)

```
Laravel

↓

검색 API

↓

Elastic 조회

↓

결과 있음

↓

응답

--------

없음

↓

Crawler 실행

↓

저장

↓

응답
```

---

# 10. DB 설계

ERD

예)

```
search_history

crawler_site

crawler_result

image_hash

search_keyword

```

컬럼까지

설명

---

# 11. Elasticsearch

인덱스 설계

```
title

price

seller

site

image

url

createdAt

hash

```

Analyzer

Tokenizer

Synonym

검색 전략

---

# 12. API 설계

REST API

예)

```
POST /search

GET /search/{id}

GET /result

POST /crawl

DELETE /cache

```

Request

Response

Error

전부

---

# 13. Queue

BullMQ

Queue 이름

Retry

Dead Letter

Priority

Delay

---

# 14. Docker

```
crawler-api

crawler-worker

redis

postgres

elastic

```

compose 예시

---

# 15. 로그

Pino

Error

Crawler Log

Worker Log

Search Log

---

# 16. 모니터링

Health Check

Prometheus

Grafana

Worker 상태

Redis 상태

Elastic 상태

---

# 17. 배포

Docker Compose

Stage

Production

Rolling Update

---

# 18. 보안

API Key

JWT

Rate Limit

IP 제한

Crawler Proxy

robots.txt 고려

사이트 이용약관 준수

---

# 19. 성능

동시 Worker

Cache

Elastic

Image Hash

중복 제거

---

# 20. 향후 확장

예를 들어

- OCR로 이미지 내 텍스트 추출
- AI 기반 동일 상품 판별(CLIP 임베딩 등)
- 이미지 유사도 향상
- 판매자 패턴 분석
- 알림(메일/Slack)
- 관리자 대시보드
- 크롤링 대상 사이트 추가
- 분산 크롤러(Kubernetes)

---

# 21. 개발 로드맵

예)

```
1주차

프로젝트 생성

------------

2주차

Playwright

------------

3주차

검색 API

------------

4주차

Elastic

------------

5주차

Laravel 연동

------------

6주차

Docker

------------

7주차

운영 테스트
```

---

## 제가 추가하고 싶은 내용

이 프로젝트의 특성상 **"중고 판매 탐지"**가 핵심이므로 일반적인 크롤러 설계서보다 다음 내용을 더 깊게 다루는 것이 좋습니다.

1. **탐지 전략**
   - 상품명 유사도 검색(오타, 띄어쓰기 포함)
   - 이미지 유사도(pHash)
   - 브랜드/모델명 추출
   - 판매 시점과 렌탈 시점 비교
   - 판매자 정보(닉네임, 연락처 일부, 지역 등 공개 정보만) 기반 연관성 분석

2. **사이트별 전략**
   - 사이트별 검색 URL 및 검색 방식
   - SPA/SSR 여부
   - 로그인 필요 여부
   - 무한 스크롤 처리
   - 차단(봇 탐지) 대응 정책
   - 사이트별 Adapter 구현 가이드

3. **법적·운영 정책**
   - 크롤링 허용 범위와 이용약관 검토
   - 요청 속도 제한 및 예의 있는 크롤링 정책
   - 개인정보 수집 금지 원칙
   - 공개 정보만 저장 및 활용
   - 사이트 차단 시 대응 절차

이 정도 수준으로 작성하면 단순한 설명서가 아니라 **실제 개발과 운영을 위한 설계 명세서**가 됩니다. 이후 AI에게 "이 문서를 기준으로 구현해"라고 지시해도 일관성 있게 개발을 진행하기 훨씬 수월합니다.
