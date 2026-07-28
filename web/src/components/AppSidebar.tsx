import { ChevronDown, Radar, X } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Badge } from './ui/badge';
import {
  NAV_SECTIONS,
  childPathActive,
  pathMatches,
  type NavBadgeVariant,
  type NavId,
  type NavItem,
} from '../config/navigation';

export type NavBadgeMap = Partial<Record<NavId, number>>;

function navClass(active: boolean, collapsed: boolean) {
  return `flex w-full items-center gap-2 rounded-lg text-left transition ${
    collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
  } ${
    active
      ? 'bg-ink-900 text-sand-50'
      : 'text-ink-600 hover:bg-sand-100 hover:text-ink-900'
  }`;
}

function NavBadge({
  count,
  active,
  variant = 'secondary',
  collapsed,
}: {
  count: number;
  active?: boolean;
  variant?: NavBadgeVariant;
  collapsed?: boolean;
}) {
  if (count <= 0) return null;
  if (collapsed) {
    return (
      <span
        className={`absolute right-1 top-1 h-2 w-2 rounded-full ${
          variant === 'destructive'
            ? 'bg-rose-500'
            : variant === 'teal'
              ? 'bg-teal-600'
              : 'bg-ink-500'
        }`}
        aria-label={`${count}`}
      />
    );
  }
  return (
    <Badge
      variant={active ? 'outline' : variant}
      className={`ml-auto min-w-[1.25rem] shrink-0 ${
        active ? 'border-sand-50/40 bg-white/15 text-sand-50' : ''
      }`}
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}

function AccordionItem({
  item,
  open,
  onOpenChange,
  badges,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badges: NavBadgeMap;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const Icon = item.icon;
  const children = item.children ?? [];
  const active = pathMatches(item.path, location.pathname);

  if (collapsed) {
    return (
      <NavLink
        to={item.path}
        title={item.label}
        onClick={onNavigate}
        className={() => `relative ${navClass(active, true)}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="sr-only">{item.label}</span>
        {item.badge ? (
          <NavBadge
            count={badges[item.id] ?? 0}
            variant={item.badge}
            collapsed
          />
        ) : null}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={navClass(active, false)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <ul className="ml-4 mt-1 space-y-0.5 border-l border-ink-100/80 pl-2">
            {children.map((sub) => {
              const subActive =
                !sub.disabled &&
                childPathActive(sub.path, location.pathname, location.search);
              return (
                <li key={sub.id}>
                  {sub.disabled ? (
                    <button
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-300"
                    >
                      <span>{sub.label}</span>
                      {sub.disabledHint ? (
                        <span className="shrink-0 rounded bg-sand-100 px-1.5 py-0.5 text-[10px] tracking-wide text-ink-400">
                          {sub.disabledHint}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <NavLink
                      to={sub.path}
                      onClick={() => {
                        onOpenChange(true);
                        onNavigate?.();
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${
                        subActive
                          ? 'bg-sand-100 font-medium text-ink-900'
                          : 'text-ink-600 hover:bg-sand-100 hover:text-ink-900'
                      }`}
                    >
                      {sub.label}
                    </NavLink>
                  )}
                </li>
              );
            })}          </ul>
        </div>
      </div>
    </div>
  );
}

function LinkItem({
  item,
  badges,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  badges: NavBadgeMap;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={({ isActive }) => `relative ${navClass(isActive, collapsed)}`}
    >
      {({ isActive }) => (
        <>
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed ? (
            <span className="flex-1">{item.label}</span>
          ) : (
            <span className="sr-only">{item.label}</span>
          )}
          {item.badge ? (
            <NavBadge
              count={badges[item.id] ?? 0}
              active={isActive}
              variant={item.badge}
              collapsed={collapsed}
            />
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export function AppSidebar({
  mode,
  accordionOpen,
  onAccordionChange,
  badges,
  appVersion,
  workerCount,
  queueCount,
  onNavigate,
  onClose,
}: {
  mode: 'expanded' | 'collapsed';
  /** accordion 부모 id → open */
  accordionOpen: Partial<Record<NavId, boolean>>;
  onAccordionChange: (id: NavId, open: boolean) => void;
  badges: NavBadgeMap;
  appVersion: string;
  workerCount: number;
  queueCount: number;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const collapsed = mode === 'collapsed';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={`flex items-center ${
          collapsed ? 'justify-center px-0' : 'gap-2'
        }`}
      >
        <Radar className="h-5 w-5 shrink-0 text-teal-700" />
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl leading-none">Lomad</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink-500">
              Crawler
            </div>
          </div>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-500 transition hover:bg-sand-100 hover:text-ink-900"
            aria-label="메뉴 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav
        className={`min-h-0 flex-1 space-y-5 overflow-y-auto text-sm ${
          collapsed ? 'mt-8' : 'mt-10'
        }`}
        aria-label="Primary"
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.id}>
            {!collapsed && section.label ? (
              <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-300">
                {section.label}
              </p>
            ) : null}
            <div className="space-y-1">
              {section.items.map((item) =>
                item.children?.length ? (
                  <AccordionItem
                    key={item.id}
                    item={item}
                    open={Boolean(accordionOpen[item.id])}
                    onOpenChange={(open) => onAccordionChange(item.id, open)}
                    badges={badges}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <LinkItem
                    key={item.id}
                    item={item}
                    badges={badges}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className={`mt-auto shrink-0 ${collapsed ? 'pt-6' : 'pt-8'}`}>
        <div className="border-t border-ink-100/70" />
        {collapsed ? (
          <div className="space-y-1 pt-3 text-center text-[10px] tabular-nums leading-tight text-ink-500">
            <p>v{appVersion}</p>
            <p title="Worker">{workerCount}</p>
            <p title="Queue">{queueCount}</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 pt-4 text-xs tabular-nums text-ink-500">
              <p>v{appVersion}</p>
              <p>Worker {workerCount}</p>
              <p>Queue {queueCount}</p>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
              중고나라 · 번개장터 · 당근
              <br />
              렌탈 가구 재판매 탐지
            </p>
          </>
        )}
      </div>
    </div>
  );
}
