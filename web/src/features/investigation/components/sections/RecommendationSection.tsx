import type { InvestigationCase } from '../../types';
import { resolveAiRecommendation } from '../../lib/ai';
import { Card, CardContent } from '../../../../components/ui/card';

/**
 * Drawer — AI Recommendation
 * Investigation Summary 와 분리된 추천 액션 패널
 */
export function InvestigationRecommendationPanel({
  row,
}: {
  row: InvestigationCase;
}) {
  const rec = resolveAiRecommendation(row);

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
        AI Recommendation
      </h3>

      <Card>
        <CardContent className="space-y-4 p-4">
          {!rec ? (
            <p className="text-sm text-ink-500">
              서버에 저장된 AI 추천이 없습니다.
            </p>
          ) : (
            <>
              <div>
                <p
                  className="font-display text-xl tracking-wide text-amber-600"
                  aria-label={`별점 ${rec.stars}점`}
                >
                  {'★'.repeat(rec.stars)}
                  <span className="text-ink-200">
                    {'★'.repeat(Math.max(0, 5 - rec.stars))}
                  </span>
                </p>
                <p className="mt-2 text-sm font-medium leading-snug text-ink-900">
                  {rec.headline}
                </p>
              </div>

              {rec.actions.length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-400">
                    추천
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {rec.actions.map((action) => (
                      <li
                        key={action}
                        className="rounded-lg bg-teal-50/80 px-3 py-2 text-sm text-teal-900"
                      >
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {rec.reasons.length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-400">
                    추천 이유
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {rec.reasons.map((reason) => (
                      <li
                        key={reason}
                        className="text-sm leading-snug text-ink-700"
                      >
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
