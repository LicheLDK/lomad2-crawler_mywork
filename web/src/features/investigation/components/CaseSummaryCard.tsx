import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useInvestigation } from '../useInvestigation';
import type { InvestigationStatus } from '../types';

const SUMMARY_STATUSES: InvestigationStatus[] = [
  'Open',
  'Investigating',
  'Review',
  'Completed',
];

/**
 * Dashboard Investigation Summary Card
 * — 서버 케이스 건수/상태를 Provider에서 반영
 */
export function InvestigationSummaryCard() {
  const { cases, loading, error } = useInvestigation();

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      Open: 0,
      Investigating: 0,
      Review: 0,
      Completed: 0,
    };
    for (const row of cases) {
      if (row.status in map) map[row.status] += 1;
    }
    return map;
  }, [cases]);

  return (
    <section className="rounded-2xl border border-ink-100/80 bg-white/75 shadow-soft backdrop-blur">
      <div className="flex items-start justify-between gap-3 px-5 py-3.5">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
            Investigation
          </p>
          <h2 className="font-display text-xl text-ink-900">Summary</h2>
        </div>
        <Link
          to="/investigation"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-teal-800 transition hover:bg-teal-50"
        >
          목록
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="border-t border-ink-100/80 px-5 pb-5 pt-4">
        {error ? (
          <p className="mb-3 text-xs text-rose-700">{error}</p>
        ) : null}
        {loading && cases.length === 0 ? (
          <p className="text-sm text-ink-400">불러오는 중…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SUMMARY_STATUSES.map((status) => (
              <div
                key={status}
                className="rounded-xl border border-ink-100/70 bg-sand-50/80 px-3 py-3"
              >
                <div className="text-xs text-ink-500">{status}</div>
                <div className="mt-1 font-display text-2xl tabular-nums text-ink-900">
                  {counts[status] ?? 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export const CaseSummaryCard = InvestigationSummaryCard;
