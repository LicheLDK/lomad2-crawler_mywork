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
 * Google Search Console · Linear · Stripe 스타일: 섹션 + 명확한 IA
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
    label: 'Workspace',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/',
      },
      {
        id: 'search',
        label: 'Search',
        icon: Search,
        path: '/search',
        badge: 'secondary',
        children: [
          { id: 'product', label: '상품 검색', path: '/search' },
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
        label: 'Rental',
        icon: Package,
        path: '/rental',
        children: [
          {
            id: 'contracts',
            label: '계약 목록',
            path: '/rental?tab=contracts',
          },
          { id: 'auto', label: '자동 검색', path: '/rental?tab=auto' },
          {
            id: 'inv-history',
            label: '조사 이력',
            path: '/rental?tab=investigations',
          },
        ],
      },
      {
        id: 'investigation',
        label: 'Investigation',
        icon: ShieldAlert,
        path: '/investigation',
        badge: 'teal',
        children: [
          {
            id: 'open',
            label: 'Open',
            path: '/investigation?status=Open',
          },
          {
            id: 'reviewing',
            label: 'Reviewing',
            path: '/investigation?status=Review',
          },
          {
            id: 'completed',
            label: 'Completed',
            path: '/investigation?status=Completed',
          },
          {
            id: 'archived',
            label: 'Archived',
            path: '/investigation?status=Archived',
          },
        ],
      },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        path: '/analytics',
        children: [
          {
            id: 'search-stats',
            label: '검색 통계',
            path: '/analytics?section=search',
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
            label: 'Investigation 통계',
            path: '/analytics?section=investigation',
          },
        ],
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      {
        id: 'system',
        label: 'System',
        icon: Settings,
        path: '/system',
        badge: 'destructive',
        children: [
          { id: 'worker', label: 'Worker', path: '/system?section=worker' },
          { id: 'queue', label: 'Queue', path: '/system?section=queue' },
          { id: 'api', label: 'API', path: '/system?section=api' },
          { id: 'proxy', label: 'Proxy', path: '/system?section=proxy' },
          {
            id: 'scheduler',
            label: 'Scheduler',
            path: '/system?section=scheduler',
          },
          { id: 'ai-engine', label: 'AI Engine', path: '/system?section=ai' },
          { id: 'prompt', label: 'Prompt', path: '/system?section=prompt' },
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
    // rental 기본 contracts, analytics 기본 search, system 기본 worker, investigation 기본 Open
    const defaults: Record<string, string> = {
      '/rental': 'tab=contracts',
      '/analytics': 'section=search',
      '/system': 'section=worker',
      '/investigation': 'status=Open',
    };
    const def = defaults[base];
    if (def && queryPart === def) return true;
    return false;
  }

  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false;
  }
  return true;
}

