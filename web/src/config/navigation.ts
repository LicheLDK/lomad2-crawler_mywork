import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  LayoutDashboard,
  Package,
  Search,
  Settings,
  ShieldAlert,
} from 'lucide-react';

/**
 * Sidebar / Route 단일 소스 (확장 시 여기만 추가)
 * 메뉴 라벨은 한글 통일. id/path는 라우팅용 영문 유지.
 */
export type NavId =
  | 'dashboard'
  | 'search'
  | 'rental'
  | 'investigation'
  | 'analytics'
  | 'system';

export type NavBadgeVariant = 'secondary' | 'destructive' | 'teal';

export type NavChild = {
  id: string;
  label: string;
  /** pathname 또는 pathname?query */
  path: string;
  isDefault?: boolean;
  disabled?: boolean;
  disabledHint?: string;
};

export type NavItem = {
  id: NavId;
  label: string;
  icon: LucideIcon;
  path: string;
  /** Accordion 하위 메뉴 */
  children?: NavChild[];
  /** Sidebar badge 키 — App에서 수치 주입 */
  badge?: NavBadgeVariant;
};

export type NavSection = {
  id: string;
  label?: string;
  items: NavItem[];
};

export const APP_VERSION = '1.0.0';

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'workspace',
    label: '작업 공간',
    items: [
      {
        id: 'dashboard',
        label: '대시보드',
        icon: LayoutDashboard,
        path: '/',
      },
      {
        id: 'search',
        label: '검색',
        icon: Search,
        path: '/search',
        badge: 'secondary',
        children: [
          { id: 'product', label: '상품 검색', path: '/search', isDefault: true },
          {
            id: 'image',
            label: '이미지 검색',
            path: '/search/image',
            disabled: true,
            disabledHint: '준비중',
          },
          {
            id: 'scheduled',
            label: '예약 검색',
            path: '/search/scheduled',
            disabled: true,
            disabledHint: '준비중',
          },
          { id: 'history', label: '검색 이력', path: '/history' },
        ],
      },
      {
        id: 'rental',
        label: '주문 연동',
        icon: Package,
        path: '/rental',
        children: [
          {
            id: 'contracts',
            label: '주문 작업',
            path: '/rental?tab=contracts',
            isDefault: true,
          },
          { id: 'auto', label: '자동 검색', path: '/rental?tab=auto' },
          {
            id: 'inv-history',
            label: '연결 조사',
            path: '/rental?tab=investigations',
          },
        ],
      },
      {
        id: 'investigation',
        label: '조사',
        icon: ShieldAlert,
        path: '/investigation',
        badge: 'teal',
        children: [
          {
            id: 'open',
            label: '대기',
            path: '/investigation?status=Open',
            isDefault: true,
          },
          {
            id: 'reviewing',
            label: '검토중',
            path: '/investigation?status=Review',
          },
          {
            id: 'completed',
            label: '완료',
            path: '/investigation?status=Completed',
          },
          {
            id: 'archived',
            label: '보관',
            path: '/investigation?status=Archived',
          },
        ],
      },
    ],
  },
  {
    id: 'insights',
    label: '인사이트',
    items: [
      {
        id: 'analytics',
        label: '분석',
        icon: BarChart3,
        path: '/analytics',
        children: [
          {
            id: 'search-stats',
            label: '검색 통계',
            path: '/analytics?section=search',
            isDefault: true,
          },
          {
            id: 'site-stats',
            label: '사이트별 통계',
            path: '/analytics?section=sites',
          },
          {
            id: 'ai-stats',
            label: 'AI 분석 통계',
            path: '/analytics?section=ai',
          },
          {
            id: 'inv-stats',
            label: '조사 통계',
            path: '/analytics?section=investigation',
          },
        ],
      },
    ],
  },
  {
    id: 'platform',
    label: '플랫폼',
    items: [
      {
        id: 'system',
        label: '시스템',
        icon: Settings,
        path: '/system',
        badge: 'destructive',
        children: [
          {
            id: 'worker',
            label: '워커',
            path: '/system?section=worker',
            isDefault: true,
          },
          { id: 'queue', label: '큐', path: '/system?section=queue' },
          { id: 'api', label: 'API', path: '/system?section=api' },
          { id: 'proxy', label: '프록시', path: '/system?section=proxy' },
          {
            id: 'scheduler',
            label: '스케줄러',
            path: '/system?section=scheduler',
          },
          { id: 'ai-engine', label: 'AI 엔진', path: '/system?section=ai' },
          { id: 'prompt', label: '프롬프트', path: '/system?section=prompt' },
        ],
      },
    ],
  },
];

export function pathMatches(itemPath: string, pathname: string): boolean {
  if (itemPath === '/') return pathname === '/';
  const base = itemPath.split('?')[0] || itemPath;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** 하위 메뉴 활성: pathname + search 비교 */
export function childPathActive(
  childPath: string,
  pathname: string,
  search: string,
): boolean {
  const [pathPart, queryPart] = childPath.split('?');
  const base = pathPart || childPath;
  if (pathname !== base) return false;

  const have = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  );

  if (!queryPart) {
    // 쿼리 없는 링크: 동일 path에서 다른 ?key= 형 형제와 겹치지 않을 때만
    return true;
  }

  const want = new URLSearchParams(queryPart);
  // 기본 탭: 쿼리 비어 있고 want가 해당 path의 첫 기본값인 경우
  const empty = [...have.keys()].length === 0;
  if (empty) {
    return NAV_SECTIONS.some((section) =>
      section.items.some((item) =>
        item.children?.some(
          (child) =>
            child.path === childPath && child.isDefault === true && child.path.startsWith(base),
        ) ?? false,
      ),
    );
  }

  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false;
  }
  return true;
}
