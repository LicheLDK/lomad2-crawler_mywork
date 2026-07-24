const SITE_LABEL: Record<string, string> = {
  joonggonara: '중고나라',
  bungae: '번개장터',
  karrot: '당근',
};

const SITE_TONE: Record<string, string> = {
  joonggonara: 'bg-slate-200 text-ink-900',
  bungae: 'bg-amber-100 text-amber-900',
  karrot: 'bg-orange-100 text-orange-900',
};

const STATUS_TONE: Record<string, string> = {
  queued: 'bg-ink-100 text-ink-700',
  running: 'bg-teal-50 text-teal-700',
  completed: 'bg-emerald-50 text-emerald-800',
  partial: 'bg-amber-50 text-amber-800',
  failed: 'bg-rose-50 text-rose-800',
  cached: 'bg-sky-50 text-sky-800',
  pending: 'bg-ink-100 text-ink-700',
};

export function siteLabel(code: string) {
  return SITE_LABEL[code] || code;
}

export function siteTone(code: string) {
  return SITE_TONE[code] || 'bg-ink-100 text-ink-700';
}

export function statusTone(status: string) {
  return STATUS_TONE[status] || 'bg-ink-100 text-ink-700';
}

export function formatPrice(value: string | number | null | undefined) {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return String(value);
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

export function formatTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function formatDateShort(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

export function formatRelative(value?: string | null) {
  if (!value) return '—';
  try {
    const d = new Date(value).getTime();
    const diff = Date.now() - d;
    if (!Number.isFinite(diff) || diff < 0) return formatTime(value);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간전`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}일전`;
    return formatDateShort(value);
  } catch {
    return value;
  }
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    queued: '대기',
    running: '진행중',
    completed: '완료',
    partial: '부분완료',
    failed: '실패',
    cached: '캐시',
    pending: '대기',
  };
  return map[status] || status;
}

/** 0~1 → 1~5 별 개수 */
export function similarityStars(score?: number | null) {
  if (score == null || !Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(5, Math.round(score * 5)));
}

export function similarityPct(score?: number | null) {
  if (score == null || !Number.isFinite(score)) return null;
  return Math.round(score * 100);
}

export function suspicionLabel(score?: number | null) {
  if (score == null || !Number.isFinite(score)) return '유사도 미측정';
  if (score >= 0.9) return '재판매 가능성 매우 높음';
  if (score >= 0.75) return '재판매 가능성 높음';
  if (score >= 0.5) return '유사 상품 가능성';
  return '유사도 낮음';
}
