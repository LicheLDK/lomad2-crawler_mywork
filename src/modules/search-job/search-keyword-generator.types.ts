/** 주문정보 → 검색어 생성 입력 (사용자 검색어 입력 없음) */
export interface SearchKeywordInput {
  brand?: string | null;
  productName?: string | null;
  modelName?: string | null;
  option?: string | null;
  color?: string | null;
}

export type SearchKeywordOutput = string[];
