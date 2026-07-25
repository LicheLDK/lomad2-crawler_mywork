import { siteLabel } from '../lib/format';

const TERMINAL = new Set(['completed', 'partial', 'failed', 'cached']);

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
  if (!progress) return null;
  if (TERMINAL.has(progress.status)) return null;

  return (
    <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4 shadow-soft backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-teal-800/70">
            Live Progress
          </p>
          <h2 className="font-display text-xl text-ink-900">검색 진행</h2>
          {progress.message ? (
            <p className="mt-0.5 text-sm text-teal-900/80">{progress.message}</p>
          ) : null}
        </div>
        <span className="font-display text-3xl tabular-nums text-teal-800">
          {progress.percent}%
        </span>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/80">
        <div
          className="h-full rounded-full bg-teal-600 transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
        />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
          <dt className="text-xs text-ink-500">Status</dt>
          <dd className="mt-1 font-medium capitalize text-ink-900">
            {progress.status}
          </dd>
        </div>
        <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
          <dt className="text-xs text-ink-500">Current Site</dt>
          <dd className="mt-1 font-medium text-ink-900">
            {progress.currentSite
              ? siteLabel(progress.currentSite)
              : progress.status === 'queued' || progress.status === 'pending'
                ? '대기중'
                : '—'}
          </dd>
        </div>
        <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
          <dt className="text-xs text-ink-500">Progress</dt>
          <dd className="mt-1 font-display text-xl tabular-nums text-ink-900">
            {progress.percent}
            <span className="ml-1 font-sans text-sm text-ink-500">%</span>
          </dd>
        </div>
        <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
          <dt className="text-xs text-ink-500">Result Count</dt>
          <dd className="mt-1 font-display text-xl tabular-nums text-ink-900">
            {progress.resultCount}
            <span className="ml-1 font-sans text-sm text-ink-500">건</span>
          </dd>
        </div>
      </dl>

      {progress.completedSites?.length || progress.pendingSites?.length ? (
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
            <dt className="text-xs text-ink-500">완료된 사이트</dt>
            <dd className="mt-1 font-medium text-ink-900">
              {progress.completedSites?.length
                ? progress.completedSites.map(siteLabel).join(' · ')
                : '없음'}
            </dd>
          </div>
          <div className="rounded-xl border border-teal-100/80 bg-white/70 px-3 py-2.5">
            <dt className="text-xs text-ink-500">남은 사이트</dt>
            <dd className="mt-1 font-medium text-ink-900">
              {progress.pendingSites?.length
                ? progress.pendingSites.map(siteLabel).join(' · ')
                : '없음'}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
