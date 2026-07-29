import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { InvestigationCase, InvestigationStatus } from '../types';
import { INVESTIGATION_STATUSES } from '../types';
import { formatDateShort, siteLabel, siteTone } from '../../../lib/format';
import { StatusBadge } from './StatusBadge';
import { useInvestigation } from '../useInvestigation';
import { Card } from '../../../components/ui/card';

const SITE_OPTIONS = [
  { value: '', label: '전체 사이트' },
  { value: 'joonggonara', label: '중고나라' },
  { value: 'bungae', label: '번개장터' },
  { value: 'karrot', label: '당근' },
];

const DEFAULT_STATUS: InvestigationStatus = 'Open';

function isValidStatus(value: string | null): value is InvestigationStatus {
  return value != null && (INVESTIGATION_STATUSES as string[]).includes(value);
}

/**
 * Case List — 목록만 담당. Detail은 전역 CaseDrawer.
 */
export function CaseListPage() {
  const { cases, selectedId, openCase, loading, error, reload } =
    useInvestigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFromUrl = searchParams.get('status');
  const initialStatus = isValidStatus(statusFromUrl) ? statusFromUrl : DEFAULT_STATUS;

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvestigationStatus | ''>(
    initialStatus,
  );
  const [siteFilter, setSiteFilter] = useState('');
  const ignoreSelectUntil = useRef(0);

  useEffect(() => {
    const s = searchParams.get('status');
    if (isValidStatus(s)) {
      setStatusFilter(s);
      return;
    }
    setStatusFilter(DEFAULT_STATUS);
    setSearchParams({ status: DEFAULT_STATUS }, { replace: true });
  }, [searchParams, setSearchParams]);

  function onStatusChange(value: InvestigationStatus | '') {
    const next = value || DEFAULT_STATUS;
    setStatusFilter(next);
    setSearchParams({ status: next }, { replace: true });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (siteFilter && row.siteCode !== siteFilter) return false;
      if (!q) return true;
      return (
        row.caseNo.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        (row.assignee?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [cases, query, statusFilter, siteFilter]);

  function onOpen(row: InvestigationCase) {
    if (Date.now() < ignoreSelectUntil.current) return;
    openCase(row);
  }

  return (
    <div className="animate-fadeUp space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
          Investigation
        </p>
        <h2 className="font-display text-2xl text-ink-900">
          {statusFilter || 'All Cases'}
        </h2>
        <p className="mt-1 max-w-xl text-sm text-ink-500">
          Case Management — 목록에서 Case를 열고 Drawer에서 조사합니다.
        </p>
      </header>

      <Card className="rounded-2xl border-ink-100/80 bg-white/75 px-4 py-3 shadow-soft backdrop-blur sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Case No · 상품명 · 담당자"
              className="w-full rounded-xl border border-ink-100 bg-sand-50/80 py-2 pl-9 pr-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-teal-600"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) =>
                onStatusChange(e.target.value as InvestigationStatus | '')
              }
              className="rounded-xl border border-ink-100 bg-sand-50/80 px-3 py-2 text-sm text-ink-700 outline-none focus:border-teal-600"
            >
              <option value="">상태 전체</option>
              {INVESTIGATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'Review' ? 'Reviewing' : s}
                </option>
              ))}
            </select>

            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="rounded-xl border border-ink-100 bg-sand-50/80 px-3 py-2 text-sm text-ink-700 outline-none focus:border-teal-600"
            >
              {SITE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-ink-100/80 bg-white/75 shadow-soft backdrop-blur">
        <div className="flex items-baseline justify-between gap-3 border-b border-ink-100/80 px-4 py-3 sm:px-5">
          <p className="text-sm text-ink-500">
            <span className="font-medium text-ink-800">{filtered.length}</span>
            건
            {loading ? (
              <span className="ml-2 text-ink-400">불러오는 중…</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => reload()}
            className="rounded-lg px-2 py-1 text-xs font-medium text-teal-800 transition hover:bg-teal-50"
          >
            새로고침
          </button>
        </div>

        {error ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-5 py-12 text-center">
            <p className="text-sm text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => reload()}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-sand-50"
            >
              다시 시도
            </button>
          </div>
        ) : filtered.length === 0 && !loading ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-5 py-16 text-center">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-400">
              Cases
            </p>
            <p className="mt-2 font-display text-xl text-ink-800">
              No matching cases
            </p>
            <p className="mt-2 max-w-sm text-sm text-ink-500">
              검색어나 필터를 변경해 보세요. 서버에 자동 생성된 케이스가 없으면
              검색 후 다시 확인하세요.
            </p>
          </div>
        ) : filtered.length === 0 && loading ? (
          <div className="flex min-h-[200px] items-center justify-center px-5 py-12 text-sm text-ink-400">
            불러오는 중…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-sand-50/80 text-xs uppercase tracking-[0.08em] text-ink-500">
                  <th className="px-4 py-3 font-medium sm:px-5">Case No</th>
                  <th className="px-4 py-3 font-medium">상품명</th>
                  <th className="px-4 py-3 font-medium">AI Score</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">담당자</th>
                  <th className="px-4 py-3 font-medium">사이트</th>
                  <th className="px-4 py-3 font-medium sm:px-5">등록일</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const active = selectedId === row.id;
                  return (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpen(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpen(row);
                        }
                      }}
                      className={`cursor-pointer border-b border-ink-100/70 transition last:border-b-0 ${
                        active ? 'bg-teal-50/70' : 'hover:bg-sand-50/90'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium tabular-nums text-ink-800 sm:px-5">
                        {row.caseNo}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-ink-900">
                        {row.productName}
                      </td>
                      <td className="px-4 py-3 font-display text-base tabular-nums text-ink-900">
                        {Math.round(row.aiScore * 100)}%
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {row.assignee || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs ${siteTone(
                            row.siteCode,
                          )}`}
                        >
                          {siteLabel(row.siteCode)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-500 sm:px-5">
                        {formatDateShort(row.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** @deprecated use CaseListPage */
export const InvestigationPage = CaseListPage;
