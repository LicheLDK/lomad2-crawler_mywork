import { useEffect, useRef, useState } from 'react';
import { siteLabel } from '../lib/format';

const TERMINAL = new Set(['completed', 'partial', 'failed', 'cached']);
const EXIT_MS = 400;

/** 대시보드 크롤 progress 또는 Search Job progress 공통 뷰 */
export type ProgressBarView = {
  status: string;
  currentSite?: string | null;
  /** 0~100 */
  percent: number;
  resultCount: number;
  message?: string;
  completedSites?: string[];
  pendingSites?: string[];
};

export function SearchProgressPanel({
  progress,
}: {
  progress: ProgressBarView | null;
}) {
  const [view, setView] = useState<ProgressBarView | null>(null);
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden');
  const exitTimer = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const clearExit = () => {
      if (exitTimer.current != null) {
        window.clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
    };

    const active = Boolean(progress && !TERMINAL.has(progress.status));

    if (active && progress) {
      clearExit();
      setView(progress);
      setPhase('in');
      return clearExit;
    }

    // 완료·실패·캐시 또는 progress 해제 → 페이드아웃 후 제거
    if (phaseRef.current === 'hidden') {
      return clearExit;
    }

    if (progress) setView(progress);
    setPhase('out');
    clearExit();
    exitTimer.current = window.setTimeout(() => {
      setView(null);
      setPhase('hidden');
      exitTimer.current = null;
    }, EXIT_MS);

    return clearExit;
  }, [progress]);

  if (phase === 'hidden' || !view) return null;

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-in ${
        phase === 'out'
          ? 'pointer-events-none grid-rows-[0fr] opacity-0'
          : 'grid-rows-[1fr] opacity-100'
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <section
          className={`rounded-2xl border border-teal-100 bg-teal-50/40 p-4 shadow-soft backdrop-blur sm:p-5 ${
            phase === 'out' ? 'animate-fadeOutSoft' : 'animate-fadeUp'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.16em] text-teal-800/70">
                Live Progress
              </p>
              <h2 className="font-display text-xl text-ink-900">검색 진행</h2>
              <p
                className="mt-0.5 h-5 truncate text-sm text-teal-900/80"
                title={view.message || undefined}
              >
                {view.message || '\u00A0'}
              </p>
            </div>
            <span className="shrink-0 font-display text-3xl tabular-nums leading-none text-teal-800">
              {view.percent}%
            </span>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/80">
            <div
              className="h-full rounded-full bg-teal-600 transition-all duration-500"
              style={{
                width: `${Math.max(0, Math.min(100, view.percent))}%`,
              }}
            />
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
              <dt className="text-xs text-ink-500">Status</dt>
              <dd className="mt-1 font-medium capitalize text-ink-900">
                {view.status}
              </dd>
            </div>
            <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
              <dt className="text-xs text-ink-500">Current Site</dt>
              <dd className="mt-1 truncate font-medium text-ink-900">
                {view.currentSite
                  ? siteLabel(view.currentSite)
                  : view.status === 'queued' || view.status === 'pending'
                    ? '대기중'
                    : '—'}
              </dd>
            </div>
            <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
              <dt className="text-xs text-ink-500">Progress</dt>
              <dd className="mt-1 font-display text-xl tabular-nums text-ink-900">
                {view.percent}
                <span className="ml-1 font-sans text-sm text-ink-500">%</span>
              </dd>
            </div>
            <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
              <dt className="text-xs text-ink-500">Result Count</dt>
              <dd className="mt-1 font-display text-xl tabular-nums text-ink-900">
                {view.resultCount}
                <span className="ml-1 font-sans text-sm text-ink-500">건</span>
              </dd>
            </div>
          </dl>

          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
              <dt className="text-xs text-ink-500">완료된 사이트</dt>
              <dd className="mt-1 min-h-5 truncate font-medium text-ink-900">
                {view.completedSites?.length
                  ? view.completedSites.map(siteLabel).join(' · ')
                  : '없음'}
              </dd>
            </div>
            <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
              <dt className="text-xs text-ink-500">남은 사이트</dt>
              <dd className="mt-1 min-h-5 truncate font-medium text-ink-900">
                {view.pendingSites?.length
                  ? view.pendingSites.map(siteLabel).join(' · ')
                  : '없음'}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
