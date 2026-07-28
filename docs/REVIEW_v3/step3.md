@작업지시서\_v3_P0.md @PROJECT_REVIEW_v3.md

이 지시서의 TASK 0-2 만 수행해줘.

선행 결정 (D2):

- (A) 스냅샷 허용을 채택한다. brand·modelName·option·color 를 SearchJob 저장 시
  searchInput 값으로 채운다. 컬럼이 이미 존재하므로 마이그레이션은 만들지 않는다.
- customerName 과 contractNo 는 계속 null 로 유지한다. 이건 고객 개인정보다.

규칙:

- 로컬 커밋 1개로 끝낸다. push 는 하지 마.
- BackOffice 에서 브랜드·모델이 없는 주문도 오류 없이 처리되어야 한다(null 허용).
- 매칭 입력에 해당 필드가 실제로 채워지는지 검증하는 spec 을 추가해줘.
- 「완료 조건」 4개를 모두 만족시키고 「검증」을 실행해줘.

완료 후 §4 보고 형식으로 보고해줘.
