import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Radar } from 'lucide-react';
import { api, getApiKey, setApiKey as persistApiKey } from './api';
import type { HealthPayload, SearchDetail, SiteCode, StatsOverview } from './types';
import { HealthBar } from './components/HealthBar';
import { SearchToolbar } from './components/SearchToolbar';
import { SearchProgressPanel } from './components/SearchProgressPanel';
import { RecentSearches } from './components/RecentSearches';
import { ResultsPanel } from './components/ResultsPanel';
import { StatsStrip } from './components/StatsStrip';
import {
  subscribeSearchProgress,
  type CrawlProgressEvent,
} from './lib/socket';

type NavId = 'dashboard';

const NAV_ITEMS: {
  id: NavId;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const TERMINAL = new Set(['completed', 'partial', 'failed', 'cached']);
const PROGRESS_DONE = new Set(['completed', 'partial', 'failed']);

export default function App() {
  const [apiKey, setApiKeyState] = useState(getApiKey());
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [detail, setDetail] = useState<SearchDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nav, setNav] = useState<NavId>('dashboard');
  const [progress, setProgress] = useState<CrawlProgressEvent | null>(null);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopProgressSocket = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  const refreshMeta = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([api.health(), api.stats()]);
      setHealth(h);
      setStats(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refreshMeta();
    const id = window.setInterval(() => void refreshMeta(), 15000);
    return () => window.clearInterval(id);
  }, [refreshMeta, apiKey]);

  useEffect(
    () => () => {
      stopPoll();
      stopProgressSocket();
    },
    [stopPoll, stopProgressSocket],
  );

  function onApiKeyChange(value: string) {
    setApiKeyState(value);
    persistApiKey(value);
  }

  async function loadSearch(id: string, keepBusy = false) {
    const next = await api.getSearch(id);
    setDetail(next);
    if (TERMINAL.has(next.status)) {
      setBusy(false);
      stopPoll();
      void refreshMeta();
    } else if (!keepBusy) {
      setBusy(true);
    }
    return next;
  }

  function attachProgress(searchId: string) {
    stopProgressSocket();
    setActiveSearchId(searchId);
    setProgress({
      searchId,
      keyword: '',
      status: 'queued',
      percent: 2,
      currentSite: null,
      completedSites: [],
      pendingSites: [],
      resultCount: 0,
      totalSites: 0,
      message: '진행 대기…',
      at: new Date().toISOString(),
    });

    unsubRef.current = subscribeSearchProgress(searchId, (event) => {
      setProgress(event);
      if (PROGRESS_DONE.has(event.status)) {
        setBusy(false);
        stopPoll();
        void loadSearch(searchId, true).finally(() => {
          void refreshMeta();
          window.setTimeout(() => {
            setProgress(null);
            stopProgressSocket();
            setActiveSearchId(null);
          }, 800);
        });
      }
    });
  }

  function startPolling(id: string) {
    stopPoll();
    pollRef.current = window.setInterval(() => {
      void loadSearch(id, true).catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
        stopPoll();
      });
    }, 2000);
  }

  async function onSubmit(payload: {
    keyword: string;
    sites: SiteCode[];
    maxResultsPerSite: number;
    forceCrawl: boolean;
  }) {
    setBusy(true);
    setError(null);
    stopPoll();
    stopProgressSocket();
    setProgress(null);
    try {
      const body = {
        keyword: payload.keyword,
        sites: payload.sites,
        maxResultsPerSite: payload.maxResultsPerSite,
        useCache: !payload.forceCrawl,
      };
      const started = payload.forceCrawl
        ? await api.crawl(body)
        : await api.search(body);

      const id = started.searchId;
      if (
        'results' in started &&
        Array.isArray(started.results) &&
        started.results.length > 0 &&
        TERMINAL.has(started.status)
      ) {
        setDetail(started as SearchDetail);
        setBusy(false);
        void refreshMeta();
        return;
      }

      attachProgress(id);
      await loadSearch(id, true);
      if (!TERMINAL.has(started.status)) {
        startPolling(id);
      } else {
        setBusy(false);
        setProgress(null);
        stopProgressSocket();
      }
    } catch (e) {
      setBusy(false);
      setProgress(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onSelectSearch(id: string) {
    setBusy(true);
    setError(null);
    stopPoll();
    stopProgressSocket();
    setProgress(null);
    try {
      const next = await loadSearch(id, true);
      if (!TERMINAL.has(next.status)) {
        attachProgress(id);
        startPolling(id);
      } else {
        setBusy(false);
      }
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="min-h-screen bg-app-grid text-ink-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-ink-100/70 bg-white/40 px-5 py-8 backdrop-blur md:flex">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-teal-700" />
            <div>
              <div className="font-display text-xl leading-none">Lomad</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink-500">
                Crawler
              </div>
            </div>
          </div>

          <nav className="mt-10 space-y-1 text-sm">
            {NAV_ITEMS.map((item) => {
              const active = nav === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setNav(item.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition ${
                    active
                      ? 'bg-ink-900 text-sand-50'
                      : 'text-ink-600 hover:bg-sand-100 hover:text-ink-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <p className="mt-auto pt-16 text-xs leading-relaxed text-ink-500">
            중고나라 · 번개장터 · 당근
            <br />
            렌탈 가구 재판매 탐지
          </p>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-6">
          <header className="mb-4 animate-fadeUp sm:mb-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
                  Investigation console
                </p>
                <h1 className="mt-1 font-display text-2xl text-ink-950 sm:text-3xl">
                  Search Crawler
                </h1>
              </div>
              <div className="w-full rounded-2xl border border-ink-100/80 bg-white/60 px-4 py-2.5 shadow-soft sm:w-auto sm:min-w-[320px]">
                <HealthBar
                  health={health}
                  apiKey={apiKey}
                  onApiKeyChange={onApiKeyChange}
                />
              </div>
            </div>
            {error ? (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
          </header>

          {nav === 'dashboard' ? (
            <div className="space-y-5">
              {/* 검색이 항상 최상단 · 스크롤해도 유지 */}
              <div className="sticky top-0 z-20 space-y-3 bg-[#f7f5f1]/95 py-2 backdrop-blur-md">
                <SearchToolbar busy={busy} onSubmit={onSubmit} />
                <SearchProgressPanel progress={progress} />
              </div>

              <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
                <div className="lg:sticky lg:top-[7.5rem] lg:self-start">
                  <RecentSearches
                    stats={stats}
                    activeId={detail?.searchId ?? activeSearchId}
                    onSelectSearch={onSelectSearch}
                  />
                </div>
                <ResultsPanel detail={detail} busy={busy} />
              </div>

              <StatsStrip stats={stats} />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
