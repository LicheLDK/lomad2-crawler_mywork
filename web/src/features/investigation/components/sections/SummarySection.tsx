import type { InvestigationCase } from '../../types';

/**
 * Drawer — Investigation Summary
 * AI Recommendation 과 분리
 */
export function InvestigationSummaryPanel({
  row,
}: {
  row: InvestigationCase;
}) {
  const summary = row.investigationSummary?.trim();
  const reasons = row.judgmentReasons?.filter(Boolean) ?? [];

  if (!summary && reasons.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
        Investigation Summary
      </h3>
      <div className="rounded-xl border border-ink-100 bg-white p-4">
        {summary ? (
          <p className="text-sm font-medium leading-snug text-ink-900">
            {summary}
          </p>
        ) : null}
        {reasons.length > 0 ? (
          <div className={summary ? 'mt-3' : undefined}>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-400">
              판단 근거
            </p>
            <ul className="mt-2 space-y-1.5">
              {reasons.map((r) => (
                <li key={r} className="text-sm leading-snug text-ink-700">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
