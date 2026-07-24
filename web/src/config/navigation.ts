import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  History,
  LayoutDashboard,
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
  | 'history'
  | 'investigation'
  | 'analytics'
  | 'system';

export type NavBadgeVariant = 'secondary' | 'destructive' | 'teal';

export type NavChild = {
  id: string;
  label: string;
  path: string;
  disabled?: boolean;
  disabledHint?: string;
};

export type NavItem = {
  id: NavId;
  label: string;
  icon: LucideIcon;
  path: string;
  /** Accordion 하위 메뉴 (Search 등) */
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
        children: [
          { id: 'product', label: '상품 검색', path: '/search' },
          {
            id: 'scheduled',
            label: '예약 검색',
            path: '/search/scheduled',
            disabled: true,
            disabledHint: '준비중',
          },
        ],
      },
      {
        id: 'history',
        label: 'History',
        icon: History,
        path: '/history',
        badge: 'secondary',
      },
      {
        id: 'investigation',
        label: 'Investigation',
        icon: ShieldAlert,
        path: '/investigation',
        badge: 'teal',
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
      },
    ],
  },
];

/** 플랫 목록 (배지·활성 판별용) */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function findNavItem(id: NavId): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.id === id);
}

export function pathMatches(itemPath: string, pathname: string): boolean {
  if (itemPath === '/') return pathname === '/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
