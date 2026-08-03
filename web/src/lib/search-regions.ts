/** 프론트 검색 UI용 지역 프리셋 (서버 search-region.ts 와 코드 동기화) */
export type SearchRegionCode =
  | 'all'
  | 'seoul'
  | 'gyeonggi'
  | 'incheon'
  | 'busan'
  | 'daegu'
  | 'daejeon'
  | 'ulsan'
  | 'sejong'
  | 'gangwon'
  | 'chungbuk'
  | 'chungnam'
  | 'jeonbuk'
  | 'gwangju_jeonnam'
  | 'gyeongbuk'
  | 'gyeongnam'
  | 'jeju';

export const SEARCH_REGION_OPTIONS: {
  code: SearchRegionCode;
  label: string;
}[] = [
  { code: 'all', label: '전체' },
  { code: 'seoul', label: '서울' },
  { code: 'gyeonggi', label: '경기' },
  { code: 'incheon', label: '인천' },
  { code: 'busan', label: '부산' },
  { code: 'daegu', label: '대구' },
  { code: 'daejeon', label: '대전' },
  { code: 'ulsan', label: '울산' },
  { code: 'sejong', label: '세종' },
  { code: 'gangwon', label: '강원' },
  { code: 'chungbuk', label: '충북' },
  { code: 'chungnam', label: '충남' },
  { code: 'jeonbuk', label: '전북' },
  { code: 'gwangju_jeonnam', label: '광주·전남' },
  { code: 'gyeongbuk', label: '경북' },
  { code: 'gyeongnam', label: '경남' },
  { code: 'jeju', label: '제주' },
];
