import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { api, getApiKey, setApiKey as persistApiKey } from './api';
import type { HealthPayload, SearchDetail, SiteCode, StatsOverview } from './types';
import { HealthBar } from './components/HealthBar';
import { SearchToolbar } from './components/SearchToolbar';
import { SearchProgressPanel } from './components/SearchProgressPanel';
import { RecentSearches } from './components/RecentSearches';
import { ResultsPanel } from './components/ResultsPanel';
import { DashboardSummary } from './components/DashboardSummary';
import { AppShell } from './components/AppShell';
import type { NavBadgeMap } from './components/AppSidebar';
import { HistoryPage } from './pages/HistoryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SystemPage } from './pages/SystemPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { pathMatches, type NavId } from './config/navigation';
import {
  subscribeSearchProgress,
  type CrawlProgressEvent,
} from './lib/socket';

const TERMINAL = new Set(['completed', 'partial', 'failed', 'cached']);
const PROGRESS_DONE = new Set(['completed', 'partial', 'failed']);
const UNVERIFIED_KEY = 'crawler.dashboard.investigation.unverified';

function readUnverifiedCount(): number {
  try {
    const n = Number(localStorage.getItem(UNVERIFIED_KEY) || '0');
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [apiKey, setApiKeyState] = useState(getApiKey());
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [detail, setDetail] = useState<SearchDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accordionOpen, setAccordionOpen] = useState<Partial<Record<NavId, boolean>>>(
    () => ({
      search: pathMatches('/search', location.pathname),
    }),
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  useEffect(() => {
    if (pathMatches('/search', location.pathname)) {
      setAccordionOpen((prev) => ({ ...prev, search: true }));
    }
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  function onApiKeyChange(value: string) {
    setApiKeyState(value);
    persistApiKey(value);
  }

  function onAccordionChange(id: NavId, open: boolean) {
    setAccordionOpen((prev) => ({ ...prev, [id]: open }));
  }

  async function loadSearch(id: string, keepBusy = false) {
    const next = await api.getSearch(id);
    setDetail(next);
    if (TERMINAL.has(next.status)) {
      setBusy(false);
      stopPoll();
      // WS 이벤트를 놓쳐도 폴링으로 완료되면 진행 패널 해제
      setProgress(null);
      stopProgressSocket();
      setActiveSearchId(null);
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
      void loadSearch(id, true)
        .then((next) => {
          if (TERMINAL.has(next.status)) {
            stopPoll();
          }
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : String(e));
          setBusy(false);
          setProgress(null);
          stopProgressSocket();
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
        setProgress(null);
        void refreshMeta();
        return;
      }

      attachProgress(id);
      const next = await loadSearch(id, true);
      if (!TERMINAL.has(next.status)) {
        startPolling(id);
      }
      // loadSearch가 이미 TERMINAL이면 progress/busy 정리됨
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

  function onSelectSearchFromHistory(id: string) {
    navigate('/');
    void onSelectSearch(id);
  }

  const queue = health?.info?.queue ?? stats?.queue ?? null;
  const workerCount = queue?.active ?? 0;
  const queueCount = (queue?.waiting ?? 0) + (queue?.delayed ?? 0);

  const badges: NavBadgeMap = {
    history: stats?.recentSearches?.length ?? 0,
    system: (() => {
      const info = health?.info;
      let n = queue?.failed ?? 0;
      if (!health) return Math.max(n, 1);
      if (info?.postgres?.status !== 'up') n += 1;
      if (info?.redis?.status !== 'up') n += 1;
      if (info?.elasticsearch?.status !== 'up') n += 1;
      if (health.status === 'error') n += 1;
      return n;
    })(),
    investigation: readUnverifiedCount(),
  };

  return (
    <AppShell
      badges={badges}
      accordionOpen={accordionOpen}
      onAccordionChange={onAccordionChange}
      workerCount={workerCount}
      queueCount={queueCount}
      mobileNavOpen={mobileNavOpen}
      onMobileNavOpenChange={setMobileNavOpen}
      title={
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
            Investigation console
          </p>
          <h1 className="mt-1 font-display text-2xl text-ink-950 sm:text-3xl">
            Search Crawler
          </h1>
        </div>
      }
      actions={
        <div className="w-full rounded-2xl border border-ink-100/80 bg-white/60 px-4 py-2.5 shadow-soft sm:w-auto sm:min-w-[320px]">
          <HealthBar
            health={health}
            apiKey={apiKey}
            onApiKeyChange={onApiKeyChange}
          />
        </div>
      }
      banner={
        error ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null
      }
    >
      <Routes>
        <Route
          path="/"
          element={
            <div className="space-y-5">
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

              <DashboardSummary stats={stats} />
            </div>
          }
        />
        <Route
          path="/search"
          element={<PlaceholderPage eyebrow="Search" title="상품 검색" />}
        />
        <Route
          path="/history"
          element={
            <HistoryPage
              stats={stats}
              activeId={detail?.searchId ?? activeSearchId}
              onSelectSearch={onSelectSearchFromHistory}
            />
          }
        />
        <Route
          path="/investigation"
          element={
            <PlaceholderPage eyebrow="Investigation" title="Coming Soon" />
          }
        />
        <Route path="/analytics" element={<AnalyticsPage stats={stats} />} />
        <Route path="/system" element={<SystemPage health={health} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
