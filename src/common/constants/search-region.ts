/**
 * 검색 지역 프리셋 (로마드 — 광역 단위).
 * - 당근: 시·도 in= 은 반경 제한으로 누락 큼 → 읍·면·동 타깃(JSON) 순회
 * - 중고나라/번개: 결과 region 문자열에 matchTokens 포함 여부로 필터
 */
import karrotRegionIns from './karrot-region-ins.json';

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

export interface SearchRegionPreset {
  code: SearchRegionCode;
  /** UI 라벨 */
  label: string;
  /** 당근 in= 파라미터용 시·도명-ID (폴백) */
  karrotIn?: string;
  /** 결과 region 문자열 매칭용 (중고나라/번개) */
  matchTokens: string[];
}

export const SEARCH_REGION_PRESETS: SearchRegionPreset[] = [
  {
    code: 'seoul',
    label: '서울',
    karrotIn: '서울특별시-1',
    matchTokens: ['서울'],
  },
  {
    code: 'gyeonggi',
    label: '경기',
    karrotIn: '경기도-1256',
    matchTokens: ['경기'],
  },
  {
    code: 'incheon',
    label: '인천',
    karrotIn: '인천광역시-825',
    matchTokens: ['인천'],
  },
  {
    code: 'busan',
    label: '부산',
    karrotIn: '부산광역시-451',
    matchTokens: ['부산'],
  },
  {
    code: 'daegu',
    label: '대구',
    karrotIn: '대구광역시-675',
    matchTokens: ['대구'],
  },
  {
    code: 'daejeon',
    label: '대전',
    karrotIn: '대전광역시-1094',
    matchTokens: ['대전'],
  },
  {
    code: 'ulsan',
    label: '울산',
    karrotIn: '울산광역시-1179',
    matchTokens: ['울산'],
  },
  {
    code: 'sejong',
    label: '세종',
    karrotIn: '세종특별자치시-1241',
    matchTokens: ['세종'],
  },
  {
    code: 'gangwon',
    label: '강원',
    karrotIn: '강원특별자치도-1873',
    matchTokens: ['강원'],
  },
  {
    code: 'chungbuk',
    label: '충북',
    karrotIn: '충청북도-2092',
    matchTokens: ['충북', '충청북'],
  },
  {
    code: 'chungnam',
    label: '충남',
    karrotIn: '충청남도-2261',
    matchTokens: ['충남', '충청남'],
  },
  {
    code: 'jeonbuk',
    label: '전북',
    karrotIn: '전북특별자치도-2488',
    matchTokens: ['전북', '전라북'],
  },
  {
    code: 'gwangju_jeonnam',
    label: '광주·전남',
    karrotIn: '전남광주통합특별시-13371',
    matchTokens: ['광주', '전남', '전라남'],
  },
  {
    code: 'gyeongbuk',
    label: '경북',
    karrotIn: '경상북도-3093',
    matchTokens: ['경북', '경상북'],
  },
  {
    code: 'gyeongnam',
    label: '경남',
    karrotIn: '경상남도-3464',
    matchTokens: ['경남', '경상남'],
  },
  {
    code: 'jeju',
    label: '제주',
    karrotIn: '제주특별자치도-3811',
    matchTokens: ['제주'],
  },
];

const BY_CODE = new Map(
  SEARCH_REGION_PRESETS.map((p) => [p.code, p] as const),
);

const KARROT_INS = karrotRegionIns as Record<string, string[]>;

/** UI/API 입력 → 유효 프리셋 (all/빈 배열이면 전체) */
export function resolveSearchRegions(
  codes?: string[] | null,
): SearchRegionPreset[] {
  if (!codes || codes.length === 0 || codes.includes('all')) {
    return [...SEARCH_REGION_PRESETS];
  }
  const out: SearchRegionPreset[] = [];
  const seen = new Set<string>();
  for (const raw of codes) {
    const code = String(raw || '').trim() as SearchRegionCode;
    if (!code || code === 'all' || seen.has(code)) continue;
    const preset = BY_CODE.get(code);
    if (!preset) continue;
    seen.add(code);
    out.push(preset);
  }
  return out.length > 0 ? out : [...SEARCH_REGION_PRESETS];
}

export function isNationwideRegions(codes?: string[] | null): boolean {
  if (!codes || codes.length === 0 || codes.includes('all')) return true;
  const resolved = resolveSearchRegions(codes);
  return resolved.length >= SEARCH_REGION_PRESETS.length;
}

/**
 * 당근 검색용 in= 타깃 목록.
 * 시·도/시 단위는 반경 누락이 커서 읍·면(및 필요 시 동)을 순회한다.
 * 요청 폭주(403)를 막기 위해 동 전체 순회는 피하고 읍·면 위주로 둔다.
 */
export function resolveKarrotIns(codes?: string[] | null): string[] {
  const presets = resolveSearchRegions(codes);
  const nationwide = isNationwideRegions(codes);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const preset of presets) {
    const towns = KARROT_INS[preset.code] || [];
    const eupMyeon = towns.filter((t) => /읍-|면-/.test(t));
    // 광역에 읍·면이 충분하면 그것만(경기 등). 서울처럼 동만 있으면 동 목록 사용(상한).
    const dense =
      eupMyeon.length >= 15
        ? eupMyeon
        : towns.slice(0, nationwide ? 40 : 120);

    const list = nationwide
      ? [
          ...(preset.karrotIn ? [preset.karrotIn] : []),
          ...eupMyeon.slice(0, 30),
        ]
      : dense.length > 0
        ? dense
        : preset.karrotIn
          ? [preset.karrotIn]
          : [];

    for (const inn of list) {
      if (!inn || seen.has(inn)) continue;
      seen.add(inn);
      out.push(inn);
    }
  }

  return out;
}

/** 중고나라/번개: region 텍스트가 선택 광역에 속하는지 */
export function regionMatchesPresets(
  regionText: string | null | undefined,
  presets: SearchRegionPreset[],
): boolean {
  if (!regionText) return false;
  const hay = regionText.replace(/\s+/g, '');
  return presets.some((p) =>
    p.matchTokens.some((t) => hay.includes(t.replace(/\s+/g, ''))),
  );
}
