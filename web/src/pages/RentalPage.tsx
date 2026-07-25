import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { siteLabel } from '../lib/format';
import {
  subscribeSearchJobProgress,
  type SearchJobProgressEvent,
} from '../lib/socket';

type RentalJobSummary = {
  jobId: string;
  orderNo: string;
  status: string;
  progress: number;
  currentSite: string | null;
  resultCount: number;
  searchHistoryId: string | null;
  keywords: string[];
  requestedAt: string;
  finishedAt: string | null;
  investigationCount: number;
};

type RentalOrderContext = {
  orderNo: string;
  contractNo: string | null;
  customerName: string | null;
  productNo: string;
  productName: string;
  brand: string | null;
  modelName: string | null;
  option: string | null;
  color: string | null;
  imageUrl: string | null;
};

type RentalSearchHistory = {
  searchHistoryId: string;
  jobId: string;
  keywords: string[];
  status: string;
  resultCount: number;
  requestedAt: string;
  finishedAt: string | null;
};

type RentalInvestigation = {
  id: string;
  caseNo: string;
  productName: string;
  listingTitle?: string | null;
  aiScorePercent: number;
  status: string;
  priority: string;
  siteCode: string;
  searchHistoryId?: string | null;
  searchJobId?: string | null;
  createdAt: string;
};

type JobLive = {
  status: string;
  progress: number;
  currentSite: string | null;
  resultCount: number;
};

const TERMINAL = new Set(['completed', 'failed']);

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function statusTone(status: string) {
  if (status === 'completed') return 'bg-teal-50 text-teal-800';
  if (status === 'failed') return 'bg-rose-50 text-rose-800';
  if (status === 'running' || status === 'queued')
    return 'bg-amber-50 text-amber-900';
  return 'bg-sand-100 text-ink-600';
}

export function RentalPage({
  onSelectSearch,
}: {
  onSelectSearch?: (searchHistoryId: string) => void;
}) {
  const [jobs, setJobs] = useState<RentalJobSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [order, setOrder] = useState<RentalOrderContext | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [histories, setHistories] = useState<RentalSearchHistory[]>([]);
  const [investigations, setInvestigations] = useState<RentalInvestigation[]>(
    [],
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [live, setLive] = useState<JobLive | null>(null);

  const loadJobs = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await api.listRentalJobs(40);
      setJobs(res.items);
      setSelectedJobId((prev) => prev ?? res.items[0]?.jobId ?? null);
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : 'Job 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!selectedJobId) {
      setOrder(null);
      setHistories([]);
      setInvestigations([]);
      setLive(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setDetailError(null);
    void api
      .getRentalJob(selectedJobId)
      .then((res) => {
        if (cancelled) return;
        setOrder(res.order);
        setOrderError(res.orderError);
        setHistories(res.searchHistories);
        setInvestigations(res.investigations);
        setLive({
          status: res.job.status,
          progress: res.job.progress,
          currentSite: res.job.currentSite,
          resultCount: res.job.resultCount,
        });
        setJobs((prev) =>
          prev.map((j) =>
            j.jobId === selectedJobId
              ? {
                  ...j,
                  status: res.job.status,
                  progress: res.job.progress,
                  currentSite: res.job.currentSite,
                  resultCount: res.job.resultCount,
                  investigationCount: res.investigationCount,
                }
              : j,
          ),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setDetailError(
            error instanceof Error
              ? error.message
              : 'Job 상세를 불러오지 못했습니다.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedJobId]);

  /** Job Status 실시간 (WebSocket) */
  useEffect(() => {
    if (!selectedJobId) return;
    const apply = (event: SearchJobProgressEvent) => {
      setLive({
        status: event.status,
        progress: event.progress,
        currentSite: event.currentSite,
        resultCount: event.resultCount,
      });
      setJobs((prev) =>
        prev.map((j) =>
          j.jobId === event.jobId
            ? {
                ...j,
                status: event.status,
                progress: event.progress,
                currentSite: event.currentSite,
                resultCount: event.resultCount,
              }
            : j,
        ),
      );
      if (TERMINAL.has(event.status)) {
        void api.getRentalJob(event.jobId).then((res) => {
          setInvestigations(res.investigations);
          setHistories(res.searchHistories);
          setOrder(res.order);
          setOrderError(res.orderError);
        }).catch(() => null);
      }
    };

    const unsub = subscribeSearchJobProgress(selectedJobId, apply);
    return () => unsub();
  }, [selectedJobId]);

  const selected = jobs.find((j) => j.jobId === selectedJobId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 animate-fadeUp">
      <section className="shrink-0 rounded-2xl border border-ink-100/80 bg-white/75 p-4 shadow-soft backdrop-blur sm:p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
          Rental · Search Service
        </p>
        <h2 className="font-display text-xl text-ink-900">Search Jobs</h2>
        <p className="mt-1 text-sm text-ink-500">
          BackOffice가 Master입니다. 주문정보는 Rental API로 조회하고, 여기서는
          Job Status를 실시간으로 표시합니다.
        </p>
      </section>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col rounded-2xl border border-ink-100/80 bg-white/75 shadow-soft backdrop-blur">
          <div className="shrink-0 border-b border-ink-100/80 px-4 py-3">
            <h3 className="text-sm font-medium text-ink-900">최근 Search Job</h3>
            <p className="text-xs text-ink-500">{jobs.length}건</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {loadingList ? (
              <p className="px-2 py-8 text-center text-sm text-ink-500">
                불러오는 중…
              </p>
            ) : listError ? (
              <p className="px-2 py-6 text-center text-sm text-rose-700">
                {listError}
              </p>
            ) : jobs.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-ink-500">
                아직 Search Job이 없습니다.
              </p>
            ) : (
              <ul className="space-y-1">
                {jobs.map((job) => {
                  const on = job.jobId === selectedJobId;
                  return (
                    <li key={job.jobId}>
                      <button
                        type="button"
                        onClick={() => setSelectedJobId(job.jobId)}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                          on
                            ? 'bg-ink-900 text-sand-50'
                            : 'text-ink-800 hover:bg-sand-100/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-sm font-medium">
                            {job.orderNo}
                          </span>
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] ${
                              on ? 'bg-sand-50/20 text-sand-100' : statusTone(job.status)
                            }`}
                          >
                            {job.status} {job.progress}%
                          </span>
                        </div>
                        <p
                          className={`mt-0.5 truncate text-xs ${
                            on ? 'text-sand-200' : 'text-ink-500'
                          }`}
                        >
                          {(job.keywords[0] || job.jobId.slice(0, 8)) +
                            (job.keywords.length > 1
                              ? ` · +${job.keywords.length - 1}`
                              : '')}
                        </p>
                        <p
                          className={`mt-1 text-[11px] ${
                            on ? 'text-sand-300' : 'text-ink-400'
                          }`}
                        >
                          Inv {job.investigationCount} ·{' '}
                          {formatWhen(job.requestedAt)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-ink-100/80 bg-white/75 p-4 shadow-soft backdrop-blur sm:p-5">
          {!selectedJobId ? (
            <p className="py-16 text-center text-sm text-ink-500">
              왼쪽에서 Job을 선택하세요.
            </p>
          ) : loadingDetail && !live ? (
            <p className="py-16 text-center text-sm text-ink-500">
              Job 상세를 불러오는 중…
            </p>
          ) : detailError ? (
            <p className="py-16 text-center text-sm text-rose-700">
              {detailError}
            </p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-ink-500">
                  Job Status
                </p>
                <h3 className="mt-1 font-mono text-lg text-ink-900">
                  {selected?.orderNo ?? '—'}
                </h3>
                <p className="mt-0.5 font-mono text-[11px] text-ink-400">
                  jobId={selectedJobId}
                </p>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-ink-500">
                    <span className={`rounded-md px-1.5 py-0.5 ${statusTone(live?.status || selected?.status || '')}`}>
                      {live?.status || selected?.status}
                    </span>
                    <span className="tabular-nums">
                      {live?.progress ?? selected?.progress ?? 0}% ·{' '}
                      {live?.resultCount ?? selected?.resultCount ?? 0}건
                      {live?.currentSite
                        ? ` · ${siteLabel(live.currentSite)}`
                        : ''}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                    <div
                      className="h-full rounded-full bg-teal-700 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, live?.progress ?? selected?.progress ?? 0)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-ink-500">
                  주문정보 (Rental API)
                </p>
                {orderError && !order ? (
                  <p className="mt-2 text-sm text-amber-800">
                    주문 API 조회 실패: {orderError}
                  </p>
                ) : order ? (
                  <>
                    <h4 className="mt-1 font-display text-lg text-ink-900">
                      {order.productName}
                    </h4>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <InfoRow label="주문번호" value={order.orderNo} mono />
                      <InfoRow label="계약번호" value={order.contractNo} mono />
                      <InfoRow label="고객명" value={order.customerName} />
                      <InfoRow label="상품번호" value={order.productNo} mono />
                      <InfoRow label="브랜드" value={order.brand} />
                      <InfoRow label="모델" value={order.modelName} />
                      <InfoRow label="옵션" value={order.option} />
                      <InfoRow label="색상" value={order.color} />
                    </dl>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-ink-500">
                    주문 컨텍스트를 불러오는 중…
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-ink-900">
                  Search History
                </h4>
                {histories.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-500">
                    연결된 검색 이력이 없습니다.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {histories.map((h) => (
                      <li
                        key={h.searchHistoryId}
                        className="rounded-xl border border-ink-100 bg-sand-50/50 px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {onSelectSearch ? (
                            <button
                              type="button"
                              onClick={() => onSelectSearch(h.searchHistoryId)}
                              className="text-left text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
                            >
                              {h.keywords.length
                                ? h.keywords.slice(0, 3).join(' · ')
                                : h.searchHistoryId.slice(0, 8)}
                            </button>
                          ) : (
                            <span className="text-sm font-medium text-ink-900">
                              {h.keywords.length
                                ? h.keywords.slice(0, 3).join(' · ')
                                : h.searchHistoryId.slice(0, 8)}
                            </span>
                          )}
                          <span className="text-[11px] tabular-nums text-ink-500">
                            {h.resultCount}건 · {h.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-ink-900">
                  Investigation (Job 연결)
                </h4>
                {investigations.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-500">
                    연결된 Investigation이 없습니다.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {investigations.map((inv) => (
                      <li
                        key={inv.id}
                        className="rounded-xl border border-ink-100 bg-sand-50/50 px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs text-ink-500">
                              {inv.caseNo}
                            </p>
                            <p className="text-sm text-ink-900">
                              {inv.listingTitle || inv.productName}
                            </p>
                          </div>
                          <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] tabular-nums text-teal-800">
                            AI {inv.aiScorePercent}%
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-ink-400">
                          {siteLabel(inv.siteCode)} · {inv.status} ·{' '}
                          {formatWhen(inv.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg bg-sand-50/70 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-ink-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-ink-900 ${mono ? 'font-mono text-sm' : 'text-sm'}`}
      >
        {value?.trim() || '—'}
      </dd>
    </div>
  );
}
