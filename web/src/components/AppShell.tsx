import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { AppSidebar, type NavBadgeMap } from './AppSidebar';
import type { NavId } from '../config/navigation';
import { APP_VERSION } from '../config/navigation';

/**
 * Desktop 고정 / Tablet 축소 / Mobile Drawer — Sidebar 셸 일관성 보장
 */
export function AppShell({
  badges,
  accordionOpen,
  onAccordionChange,
  workerCount,
  queueCount,
  mobileNavOpen,
  onMobileNavOpenChange,
  title,
  actions,
  banner,
  children,
}: {
  badges: NavBadgeMap;
  accordionOpen: Partial<Record<NavId, boolean>>;
  onAccordionChange: (id: NavId, open: boolean) => void;
  workerCount: number;
  queueCount: number;
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
  title: ReactNode;
  actions?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const sidebarProps = {
    accordionOpen,
    onAccordionChange,
    badges,
    appVersion: APP_VERSION,
    workerCount,
    queueCount,
  };

  return (
    <div className="h-dvh overflow-hidden bg-app-grid text-ink-900">
      <div className="mx-auto flex h-full max-w-[1600px]">
        <aside className="hidden h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-ink-100/70 bg-white/40 px-5 py-8 backdrop-blur dark:bg-sand-dark-800 dark:backdrop-blur-none lg:flex">
          <AppSidebar mode="expanded" {...sidebarProps} />
        </aside>

        <aside className="hidden h-full w-[4.5rem] shrink-0 flex-col overflow-y-auto border-r border-ink-100/70 bg-white/40 px-2 py-8 backdrop-blur dark:bg-sand-dark-800 dark:backdrop-blur-none md:flex lg:hidden">
          <AppSidebar mode="collapsed" {...sidebarProps} />
        </aside>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-ink-950/30"
              aria-label="메뉴 닫기"
              onClick={() => onMobileNavOpenChange(false)}
            />
            <aside className="relative flex h-full w-56 max-w-[85vw] flex-col border-r border-ink-100/70 bg-[#fbfaf7] px-5 py-8 shadow-2xl dark:bg-sand-dark-800">
              <AppSidebar
                mode="expanded"
                {...sidebarProps}
                onNavigate={() => onMobileNavOpenChange(false)}
                onClose={() => onMobileNavOpenChange(false)}
              />
            </aside>
          </div>
        ) : null}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-5 sm:px-8 sm:py-6">
          <header className="mb-4 shrink-0 animate-fadeUp sm:mb-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  className="mt-1 rounded-lg border border-ink-100/80 bg-white/70 p-2 text-ink-700 transition hover:bg-sand-100 md:hidden dark:bg-sand-dark-800"
                  aria-label="메뉴 열기"
                  onClick={() => onMobileNavOpenChange(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
                {title}
              </div>
              {actions}
            </div>
            {banner}
          </header>
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
}
