import type {
  InvestigationAiAnalysis,
  InvestigationCase,
} from '../../types';
import {
  aiJudgmentLabel,
  clampScore,
  resolveAiAnalysis,
  toPct,
} from '../../lib/ai';

function barFill(score: number) {
  const pct = toPct(score);
  if (pct >= 90) return 'bg-emerald-600';
  if (pct >= 70) return 'bg-orange-500';
  return 'bg-ink-400';
}

function barText(score: number) {
  const pct = toPct(score);
  if (pct >= 90) return 'text-emerald-800';
  if (pct >= 70) return 'text-orange-800';
  return 'text-ink-600';
}

function finalTone(score: number) {
  const pct = toPct(score);
  if (pct >= 90) return 'bg-emerald-50 text-emerald-900 ring-emerald-200/80';
  if (pct >= 70) return 'bg-orange-50 text-orange-900 ring-orange-200/80';
  return 'bg-sand-50 text-ink-800 ring-ink-100';
}

const METRICS: {
  key: keyof InvestigationAiAnalysis;
  label: string;
}[] = [
  { key: 'imageSimilarity', label: '이미지 유사도' },
  { key: 'titleSimilarity', label: '제목 유사도' },
  { key: 'brandMatch', label: '브랜드 일치' },
  { key: 'modelMatch', label: '모델 일치' },
  { key: 'priceSimilarity', label: '가격 유사도' },
  { key: 'ocrMatch', label: 'OCR 일치' },
];

export function InvestigationAiPanel({ row }: { row: InvestigationCase }) {
  // D6: 서버 aiAnalysis 우선, 없을 때만 deriveAi* fallback
  const analysis = resolveAiAnalysis(row);
  const finalScore = clampScore(row.aiScore);
  const finalPct = toPct(finalScore);

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
        AI Analysis
      </h3>

      <div className="rounded-xl border border-ink-100 bg-white p-4">
        <ul className="space-y-4">
          {METRICS.map(({ key, label }) => {
            const score = analysis[key];
            const pct = toPct(score);
            return (
              <li key={key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink-800">
                    {label}
                  </span>
                  <span
                    className={`text-sm font-medium tabular-nums ${barText(score)}`}
                  >
                    {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barFill(score)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <div
          className={`mt-5 rounded-xl px-4 py-4 ring-1 ${finalTone(finalScore)}`}
        >
          <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-80">
            최종 점수
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-500">AI Score</p>
              <p className="mt-2 text-xs text-ink-500">AI 판단</p>
              <p className="mt-0.5 text-sm font-medium leading-snug">
                {aiJudgmentLabel(finalScore)}
              </p>
            </div>
            <p className="shrink-0 font-display text-5xl leading-none tabular-nums">
              {finalPct}%
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
