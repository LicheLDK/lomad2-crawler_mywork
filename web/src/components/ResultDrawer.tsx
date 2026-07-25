import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, ExternalLink, ShieldAlert, X } from 'lucide-react';
import type { SearchResult } from '../types';
import { resolveAssetUrl } from '../api';
import { ImageCompare } from './ImageCompare';
import {
  formatPrice,
  formatRelative,
  formatTime,
  siteLabel,
  siteTone,
  suspicionLabel,
} from '../lib/format';
import { useStartInvestigation } from '../features/investigation';

/**
 * 검색 결과 상세 Drawer
 * - body Portal 렌더 (부모 backdrop-blur 때문에 fixed가 깨지는 문제 방지)
 * - flex 패널(relative) + absolute 배경 — nested fixed 히트테스트 버그 방지
 * - 닫을 때 클릭-스루로 카드가 다시 열리는 것 방지
 */
export function ResultDrawer({
  row,
  keyword,
  referenceImageUrl,
  onClose,
  onStartInvestigation,
}: {
  row: SearchResult | null;
  keyword?: string;
  referenceImageUrl?: string | null;
  onClose: () => void;
  onStartInvestigation?: (row: SearchResult, e?: React.SyntheticEvent) => void;
}) {
  const open = Boolean(row);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const startInvestigationFromResult = useStartInvestigation();

  function handleClose(e?: React.SyntheticEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    // 오버레이 제거 직후 같은 클릭이 아래 카드로 전달되는 것 방지
    window.setTimeout(() => onCloseRef.current(), 0);
  }

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, row]);

  const analysis = useMemo(
    () => (row ? buildAiAnalysis(row, keyword) : null),
    [row, keyword],
  );

  if (!row || typeof document === 'undefined') return null;

  const imageSrc = resolveAssetUrl(row.imageUrl) || row.imageUrl;
  const rentalSrc =
    resolveAssetUrl(referenceImageUrl) || referenceImageUrl || null;
  const resultSrc =
    resolveAssetUrl(row.imageUrl) ||
    resolveAssetUrl(row.screenshotUrl) ||
    row.imageUrl ||
    null;

  function openOriginalInNewTab() {
    window.open(row!.url, '_blank', 'noopener,noreferrer');
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(row!.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function startInvestigation(e?: React.SyntheticEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (!row) return;
    if (onStartInvestigation) {
      onStartInvestigation(row, e);
      return;
    }
    startInvestigationFromResult(row);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="상품 상세"
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink-950/25"
        aria-label="닫기"
        onClick={handleClose}
      />

      <aside
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-ink-100 bg-[#fbfaf7] shadow-2xl sm:max-w-lg"
        style={{ maxHeight: '100dvh' }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <header className="relative z-20 flex shrink-0 items-start justify-between gap-3 border-b border-ink-100 bg-[#fbfaf7] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
              Detail
            </p>
            <h2 className="mt-1 font-display text-xl text-ink-900">상품 상세</h2>
            {keyword ? (
              <p className="mt-1 truncate text-xs text-ink-500">
                검색어 · {keyword}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg p-2 text-ink-500 transition hover:bg-sand-100 hover:text-ink-900"
            aria-label="Drawer 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pt-5 [-webkit-overflow-scrolling:touch]"
          style={{ paddingBottom: '1.25rem' }}
        >
          <div className="space-y-5 pb-4">
          {/* 요약 헤더: 이미지 + 유사도 핵심 */}
          <section>
            <div className="overflow-hidden rounded-xl bg-sand-100 ring-1 ring-ink-100">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt=""
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center text-sm text-ink-300">
                  이미지 없음
                </div>
              )}
            </div>
            <div className="mt-3">
              <span
                className={`inline-flex rounded-md px-2 py-0.5 text-xs ${siteTone(
                  row.siteCode,
                )}`}
              >
                {siteLabel(row.siteCode)}
              </span>
              <h4 className="mt-2 text-base font-medium leading-snug text-ink-900">
                {row.title}
              </h4>
              <p className="mt-1 font-display text-xl tabular-nums text-ink-900">
                {formatPrice(row.price)}
              </p>
            </div>
          </section>

          {/* AI 분석 — Drawer 내 최우선 판단 근거 */}
          {analysis ? (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
                AI 분석
              </h3>
              <div className="rounded-xl border border-ink-100 bg-white p-4">
                <ul className="space-y-4">
                  {analysis.items.map((item) => (
                    <li key={item.label}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-ink-800">
                          {item.label}
                        </span>
                        <span
                          className={`text-sm tabular-nums font-medium ${barText(
                            item.score,
                          )}`}
                        >
                          {item.measured ? `${item.pct}%` : '미측정'}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barFill(
                            item.score,
                          )}`}
                          style={{
                            width: `${item.measured ? item.pct : 0}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                        {item.evidence}
                      </p>
                    </li>
                  ))}
                </ul>

                <div
                  className={`mt-5 rounded-xl px-4 py-4 ring-1 ${finalTone(
                    analysis.finalScore,
                  )}`}
                >
                  <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-80">
                    최종 AI 판단
                  </p>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <p className="text-sm leading-snug">
                      {suspicionLabel(analysis.finalScore)}
                    </p>
                    <p className="font-display text-4xl leading-none tabular-nums">
                      {analysis.finalPct}%
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
              이미지 비교
            </h3>
            <ImageCompare rentalSrc={rentalSrc} resultSrc={resultSrc} />
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
              상품 상세 정보
            </h3>
            <div className="rounded-xl border border-ink-100 bg-white p-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-400">판매 사이트</dt>
                  <dd className="mt-0.5 text-ink-800">
                    {siteLabel(row.siteCode)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-400">등록일</dt>
                  <dd className="mt-0.5 text-ink-800">
                    {row.createdAt
                      ? `${formatRelative(row.createdAt)} (${formatTime(row.createdAt)})`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-400">판매 지역</dt>
                  <dd className="mt-0.5 text-ink-800">{row.region || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-400">판매자 정보</dt>
                  <dd className="mt-0.5 text-ink-800">{row.seller || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-400">상품 설명</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap leading-relaxed text-ink-800">
                    {row.description?.trim() || '—'}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
              원본 URL
            </h3>
            <div className="rounded-xl border border-ink-100 bg-white p-3">
              <p className="break-all text-xs leading-relaxed text-ink-600">
                {row.url}
              </p>
            </div>
          </section>
          </div>
        </div>

        <footer className="relative z-20 shrink-0 border-t border-ink-100 bg-[#fbfaf7] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="space-y-2">
          <button
            type="button"
            onClick={startInvestigation}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
          >
            <ShieldAlert className="h-4 w-4" />
            조사 시작
          </button>
          <button
            type="button"
            onClick={openOriginalInNewTab}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink-100 bg-sand-50 px-3 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-sand-100"
          >
            원본 게시글 보기
            <ExternalLink className="h-4 w-4" />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyUrl}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-100 bg-sand-50 px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-sand-100"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? '복사됨' : 'URL 복사'}
            </button>
            <button
              type="button"
              onClick={openOriginalInNewTab}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-100 bg-sand-50 px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-sand-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              새창 열기
            </button>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex w-full items-center justify-center rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-sand-50"
          >
            닫기
          </button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

type AnalysisItem = {
  label: string;
  score: number;
  pct: number;
  measured: boolean;
  evidence: string;
};

function toPct(score: number) {
  return Math.round(clamp01(score) * 100);
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s/-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function brandTokens(keyword: string) {
  const known = [
    '시몬스',
    '에이스',
    '한샘',
    '리바트',
    '일룸',
    '이케아',
    'ikea',
    'usm',
    '까사미아',
    '자코모',
    '템퍼',
    '씰리',
    '시디즈',
    '허먼밀러',
  ];
  const tokens = tokenize(keyword);
  const hit = known.filter((b) =>
    tokens.some((t) => t.includes(b) || b.includes(t)),
  );
  if (hit.length) return hit;
  // 검색어 앞쪽 토큰을 브랜드 후보로
  return tokens.slice(0, 2);
}

function modelTokens(keyword: string) {
  return tokenize(keyword).filter(
    (t) => /\d/.test(t) || /^[a-z]{1,4}\d+/i.test(t) || t.length >= 4,
  );
}

function overlapScore(needles: string[], haystack: string) {
  if (!needles.length) return { score: 0, measured: false, matched: [] as string[] };
  const title = haystack.toLowerCase();
  const matched = needles.filter((n) => title.includes(n.toLowerCase()));
  return {
    score: matched.length / needles.length,
    measured: true,
    matched,
  };
}

function buildAiAnalysis(row: SearchResult, keyword?: string) {
  const kw = keyword?.trim() || '';
  const titleScore =
    row.titleSimilarity != null && Number.isFinite(row.titleSimilarity)
      ? clamp01(row.titleSimilarity)
      : null;

  const imageScore =
    row.imageSimilarity != null && Number.isFinite(row.imageSimilarity)
      ? clamp01(row.imageSimilarity)
      : null;

  const brands = brandTokens(kw || row.title);
  const brand = overlapScore(brands, row.title);

  const models = modelTokens(kw || row.title).filter(
    (t) => !brands.includes(t),
  );
  const model = overlapScore(
    models.length ? models : tokenize(kw).slice(-2),
    row.title,
  );

  // 렌탈 원가 대비 데이터가 없으므로: 가격 존재 + 상품명 유사도를 약하게 반영
  let priceScore: number | null = null;
  let priceEvidence = '비교할 기준 가격이 없어 미측정입니다.';
  if (row.price != null && row.price !== '' && titleScore != null) {
    priceScore = clamp01(titleScore * 0.85 + 0.1);
    priceEvidence = `매물가 ${formatPrice(row.price)} · 상품명 유사도와 연동한 추정치입니다.`;
  } else if (row.price != null && row.price !== '') {
    priceScore = 0.45;
    priceEvidence = `매물가 ${formatPrice(row.price)} 확인 · 기준가 없어 중간 추정입니다.`;
  }

  const items: AnalysisItem[] = [
    {
      label: '이미지 유사도',
      score: imageScore ?? 0,
      pct: toPct(imageScore ?? 0),
      measured: imageScore != null,
      evidence:
        imageScore != null
          ? `이미지 해시 유사도 ${(imageScore * 100).toFixed(0)}%`
          : row.imageUrl
            ? '이미지는 있으나 해시 유사도 점수가 없습니다.'
            : '비교할 이미지가 없습니다.',
    },
    {
      label: '상품명 유사도',
      score: titleScore ?? 0,
      pct: toPct(titleScore ?? 0),
      measured: titleScore != null,
      evidence:
        titleScore != null
          ? `검색어와 제목 문자열 유사도 ${(titleScore * 100).toFixed(0)}%`
          : '제목 유사도 점수가 없습니다.',
    },
    {
      label: '브랜드 일치',
      score: brand.score,
      pct: toPct(brand.score),
      measured: brand.measured && brands.length > 0,
      evidence: brand.matched.length
        ? `일치: ${brand.matched.join(', ')}`
        : brands.length
          ? `후보(${brands.join(', ')})가 제목에 없습니다.`
          : '브랜드 후보를 추출하지 못했습니다.',
    },
    {
      label: '모델명 일치',
      score: model.score,
      pct: toPct(model.score),
      measured: model.measured,
      evidence: model.matched.length
        ? `일치: ${model.matched.join(', ')}`
        : '모델·스펙 토큰이 제목에서 확인되지 않았습니다.',
    },
    {
      label: '가격 유사도',
      score: priceScore ?? 0,
      pct: toPct(priceScore ?? 0),
      measured: priceScore != null,
      evidence: priceEvidence,
    },
  ];

  const weights = [
    { score: imageScore, w: 0.25 },
    { score: titleScore, w: 0.35 },
    { score: brand.measured ? brand.score : null, w: 0.15 },
    { score: model.measured ? model.score : null, w: 0.15 },
    { score: priceScore, w: 0.1 },
  ];
  let wSum = 0;
  let sSum = 0;
  for (const part of weights) {
    if (part.score == null) continue;
    wSum += part.w;
    sSum += part.score * part.w;
  }
  const finalScore = wSum > 0 ? sSum / wSum : titleScore ?? 0;

  return {
    items,
    finalScore,
    finalPct: toPct(finalScore),
  };
}

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
