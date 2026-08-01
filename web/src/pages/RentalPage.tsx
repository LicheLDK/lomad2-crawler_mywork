import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useInvestigation } from '../features/investigation';
import { siteLabel } from '../lib/format';
import {
  subscribeSearchJobProgress,
  type SearchJobProgressEvent,
} from '../lib/socket';
import type { KeywordHistoryItem } from '../types';

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
  callbackSentAt: string | null;
  callbackError: string | null;
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
  watchlisted?: boolean;
  createdAt: string;
};

type JobLive = {
  status: string;
  progress: number;
  currentSite: string | null;
  resultCount: number;
};

const TERMINAL = new Set(['completed', 'failed', 'partial']);

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
  if (status === 'partial') return 'bg-amber-50 text-amber-900';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab =
    tabParam === 'auto' || tabParam === 'investigations'
      ? tabParam
      : 'contracts';

  const [jobs, setJobs] = useState<RentalJobSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [order, setOrder] = useState<RentalOrderContext | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [histories, setHistories] = useState<RentalSearchHistory[]>([]);
  const [keywordHistories, setKeywordHistories] = useState<
    KeywordHistoryItem[]
  >([]);
  const [investigations, setInvestigations] = useState<RentalInvestigation[]>(
    [],
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [live, setLive] = useState<JobLive | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [callbackSentAt, setCallbackSentAt] = useState<string | null>(null);
  const [resendingCallback, setResendingCallback] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const { openCase } = useInvestigation();

  function setTab(next: 'contracts' | 'auto' | 'investigations') {
    setSearchParams({ tab: next }, { replace: true });
  }

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
      setKeywordHistories([]);
      setInvestigations([]);
      setLive(null);
      setCallbackError(null);
      setCallbackSentAt(null);
      setResendMessage(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setDetailError(null);
    setResendMessage(null);
    void api
      .getRentalJob(selectedJobId)
      .then((res) => {
        if (cancelled) return;
        setOrder(res.order);
        setOrderError(res.orderError);
        setHistories(res.searchHistories);
        setKeywordHistories(res.job.keywordHistories ?? []);
        setInvestigations(res.investigations);
        setCallbackError(res.job.callbackError ?? null);
        setCallbackSentAt(res.job.callbackSentAt ?? null);
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
                  callbackSentAt: res.job.callbackSentAt ?? null,
                  callbackError: res.job.callbackError ?? null,
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
        void api
          .getRentalJob(event.jobId)
          .then((res) => {
            setInvestigations(res.investigations);
            setHistories(res.searchHistories);
            setKeywordHistories(res.job.keywordHistories ?? []);
            setOrder(res.order);
            setOrderError(res.orderError);
            setLive({
              status: res.job.status,
              progress: res.job.progress,
              currentSite: res.job.currentSite,
              resultCount: res.job.resultCount,
            });
          })
          .catch(() => null);
      }
    };

    const unsub = subscribeSearchJobProgress(selectedJobId, apply);
    return () => unsub();
  }, [selectedJobId]);

  const selected = jobs.find((j) => j.jobId === selectedJobId) ?? null;
  const jobResultCount = live?.resultCount ?? selected?.resultCount ?? 0;
  const keywordSum = useMemo(
    () => keywordHistories.reduce((sum, h) => sum + (h.resultCount ?? 0), 0),
    [keywordHistories],
  );
  const countsDiffer =
    keywordHistories.length > 0 && keywordSum !== jobResultCount;

  const jobStatus = live?.status || selected?.status || '';
  const canResendCallback =
    !!selectedJobId &&
    (jobStatus === 'completed' || jobStatus === 'partial') &&
    !(callbackSentAt && !callbackError);

  async function handleResendCallback() {
    if (!selectedJobId || resendingCallback) return;
    setResendingCallback(true);
    setResendMessage(null);
    try {
      const res = await api.resendSearchJobCallback(selectedJobId);
      setCallbackSentAt(res.callbackSentAt);
      setCallbackError(null);
      setResendMessage('BackOffice callback을 재전송했습니다.');
      setJobs((prev) =>
        prev.map((j) =>
          j.jobId === selectedJobId
            ? {
                ...j,
                callbackSentAt: res.callbackSentAt,
                callbackError: null,
              }
            : j,
        ),
      );
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Callback 재전송에 실패했습니다.';
      setResendMessage(msg);
      // 실패 시 서버가 callbackError를 재기록했을 수 있으므로 상세 재조회
      try {
        const detail = await api.getRentalJob(selectedJobId);
        setCallbackError(detail.job.callbackError ?? null);
        setCallbackSentAt(detail.job.callbackSentAt ?? null);
        setJobs((prev) =>
          prev.map((j) =>
            j.jobId === selectedJobId
              ? {
                  ...j,
                  callbackSentAt: detail.job.callbackSentAt ?? null,
                  callbackError: detail.job.callbackError ?? null,
                }
              : j,
          ),
        );
      } catch {
        /* ignore refresh failure */
      }
    } finally {
      setResendingCallback(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 animate-fadeUp">
      <section className="shrink-0 rounded-2xl border border-ink-100/80 bg-white/75 p-4 shadow-soft backdrop-blur sm:p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-500">
          주문 연동 · 읽기 전용
        </p>
        <h2 className="font-display text-xl text-ink-900">
          {tab === 'contracts'
            ? '주문 작업'
            : tab === 'auto'
              ? '자동 검색'
              : '연결 조사'}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          백오피스가 요청한 검색 Job의 진행·결과·콜백을 추적합니다. 계약 수정은
          로마드 백오피스에서 합니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ['contracts', '주문 작업'],
              ['auto', '자동 검색'],
              ['investigations', '연결 조사'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                tab === id
                  ? 'bg-ink-900 text-sand-50'
                  : 'bg-sand-100 text-ink-700 hover:bg-sand-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col rounded-2xl border border-ink-100/80 bg-white/75 shadow-soft backdrop-blur">
          <div className="shrink-0 border-b border-ink-100/80 px-4 py-3">
            <h3 className="text-sm font-medium text-ink-900">
              {tab === 'auto'
                ? '자동 검색 Job'
                : tab === 'investigations'
                  ? 'Job 선택'
                  : '최근 주문 작업'}
            </h3>
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
                <br />
                백오피스에서 주문 검색을 요청하면 여기에 나타납니다.
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
                              on
                                ? 'bg-sand-50/20 text-sand-100'
                                : statusTone(job.status)
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
                          {job.callbackError ? (
                            <span
                              className={
                                on
                                  ? ' ml-1 text-rose-200'
                                  : ' ml-1 text-rose-700'
                              }
                            >
                              · callback 실패
                            </span>
                          ) : null}
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
          {tab === 'investigations' ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-ink-900">
                  연결 조사
                </h3>
                <p className="mt-1 text-[11px] text-ink-400">
                  이 Job에 자동 생성된 Investigation만 표시합니다. 조사·판정은
                  Investigation 메뉴에서 진행하세요.
                </p>
              </div>
              {!selectedJobId ? (
                <p className="py-8 text-sm text-ink-500">
                  왼쪽에서 Job을 선택하세요.
                </p>
              ) : investigations.length === 0 ? (
                <p className="text-sm text-ink-500">
                  연결된 Investigation이 없습니다.
                  <br />
                  검색 완료 후 임계값 이상 매물만 자동 생성됩니다.
                </p>
              ) : (
                <ul className="space-y-2">
                  {investigations.map((inv) => (
                    <InvestigationRow
                      key={inv.id}
                      inv={inv}
                      onOpen={() => openCase(inv.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          ) : !selectedJobId ? (
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
              {(tab === 'contracts' || tab === 'auto') && (
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
                      <span
                        className={`rounded-md px-1.5 py-0.5 ${statusTone(live?.status || selected?.status || '')}`}
                      >
                        {live?.status || selected?.status}
                      </span>
                      <span className="tabular-nums">
                        {live?.progress ?? selected?.progress ?? 0}% ·{' '}
                        {jobResultCount}건
                        <span className="ml-1 text-ink-400">
                          (고유 매물 기준)
                        </span>
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
                    {countsDiffer ? (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
                        Job 결과 {jobResultCount}건은 고유 매물 기준입니다.
                        키워드별 합계({keywordSum}건)와 다를 수 있으며 오류가
                        아닙니다.
                      </p>
                    ) : null}
                    {(callbackError ||
                      callbackSentAt ||
                      canResendCallback) && (
                      <div className="mt-3 rounded-xl border border-ink-100 bg-sand-50/60 px-3 py-2.5">
                        <p className="text-xs font-medium text-ink-800">
                          BackOffice Callback
                        </p>
                        {callbackError ? (
                          <p className="mt-1 text-sm leading-relaxed text-rose-800">
                            {callbackError}
                          </p>
                        ) : callbackSentAt ? (
                          <p className="mt-1 text-sm text-teal-800">
                            전송 완료 · {formatWhen(callbackSentAt)}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-ink-500">
                            아직 전송되지 않았습니다.
                          </p>
                        )}
                        {canResendCallback ? (
                          <button
                            type="button"
                            onClick={() => void handleResendCallback()}
                            disabled={resendingCallback}
                            className="mt-2 rounded-lg bg-ink-900 px-3 py-1.5 text-xs text-sand-50 transition hover:bg-ink-800 disabled:opacity-50"
                          >
                            {resendingCallback
                              ? '재전송 중…'
                              : 'Callback 재전송'}
                          </button>
                        ) : null}
                        {resendMessage ? (
                          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-600">
                            {resendMessage}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'contracts' && (
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-ink-500">
                    주문 요약 · 백오피스 조회 · 읽기 전용
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
                        <InfoRow
                          label="계약번호"
                          value={order.contractNo}
                          mono
                        />
                        <InfoRow label="고객명" value={order.customerName} />
                        <InfoRow
                          label="상품번호"
                          value={order.productNo}
                          mono
                        />
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
              )}

              {tab === 'auto' && (
                <div>
                  <h4 className="text-sm font-medium text-ink-900">
                    키워드별 결과
                  </h4>
                  <p className="mt-1 text-[11px] text-ink-400">
                    이 Job이 생성한 키워드별 검색 결과입니다. 클릭하면 Search
                    이력으로 이동합니다. Job 합계({jobResultCount}건)는 고유
                    매물 기준이라 키워드 합계와 다를 수 있습니다.
                  </p>
                  {keywordHistories.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-500">
                      아직 키워드별 검색 내역이 없습니다.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {keywordHistories.map((h) => (
                        <li
                          key={h.searchHistoryId}
                          className="rounded-xl border border-ink-100 bg-sand-50/50 px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {onSelectSearch ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onSelectSearch(h.searchHistoryId)
                                }
                                className="text-left text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
                              >
                                {h.keyword?.trim() ||
                                  h.searchHistoryId.slice(0, 8)}
                              </button>
                            ) : (
                              <span className="text-sm font-medium text-ink-900">
                                {h.keyword?.trim() ||
                                  h.searchHistoryId.slice(0, 8)}
                              </span>
                            )}
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${statusTone(h.status)}`}
                            >
                              {h.resultCount}건 · {h.status}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {histories.length > 0 ? (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-ink-900">
                        Search History
                      </h4>
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
                                  onClick={() =>
                                    onSelectSearch(h.searchHistoryId)
                                  }
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
                    </div>
                  ) : null}
                </div>
              )}

              {tab === 'contracts' && (
                <div>
                  <h4 className="text-sm font-medium text-ink-900">
                    연결 조사
                  </h4>
                  {investigations.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-500">
                      연결된 Investigation이 없습니다.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {investigations.map((inv) => (
                        <InvestigationRow
                          key={inv.id}
                          inv={inv}
                          onOpen={() => openCase(inv.id)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InvestigationRow({
  inv,
  onOpen,
}: {
  inv: RentalInvestigation;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-xl border border-ink-100 bg-sand-50/50 px-3 py-2.5 text-left transition hover:border-teal-600/40 hover:bg-teal-50/40"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-ink-500">{inv.caseNo}</p>
            <p className="text-sm text-ink-900">
              {inv.listingTitle || inv.productName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {inv.watchlisted ? (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
                관찰
              </span>
            ) : null}
            <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] tabular-nums text-teal-800">
              AI {inv.aiScorePercent}%
            </span>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-ink-400">
          {siteLabel(inv.siteCode)} · {inv.status} · {formatWhen(inv.createdAt)}
        </p>
      </button>
    </li>
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
