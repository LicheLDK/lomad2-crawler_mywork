@작업지시서\_v3_P0.md @PROJECT_REVIEW_v3.md

이 지시서의 TASK 0-5 만 수행해줘.

선행 결정 (D4):

- (A) 단계적 도입을 채택한다. 기존 코드 위반은 warn 으로 두고,
  CI 에 --max-warnings 상한을 걸어 회귀만 막는다.

규칙:

- 로컬 커밋 1개로 끝낸다. push 는 하지 마.
- eslint 와 @typescript-eslint 는 npm 으로 최신 버전을 설치해줘.
  버전 번호를 임의로 적어넣지 마.
- flat config(eslint.config.mjs)로 작성하고 dist, node_modules, coverage, web,
  scripts/probe-\*.js 를 ignore 해줘.
- --fix 를 전체 소스에 돌리지 마. 자동 수정으로 수백 파일이 바뀌면 리뷰가 불가능해진다.
  자동 수정이 필요하다고 판단되면 별도 커밋 제안만 하고 이 작업에는 포함하지 마.
- web/package.json 에 lint script 를 추가해서 프론트 ESLint 도 실행되게 해줘.
- TASK 0-6 에서 만든 .github/workflows/ci.yml 에 lint 단계를 추가해줘.
- 「완료 조건」 4개를 모두 만족시키고 「검증」 3개를 실행해줘.

완료 후 §4 보고 형식으로 보고해줘.
