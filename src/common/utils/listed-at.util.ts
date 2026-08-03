/**
 * 중고 플랫폼 등록시각 파싱.
 * - ISO / "YYYY-MM-DD HH:mm:ss" / "YYYY.MM.DD"
 * - 유닉스 초·밀리초
 * - 한국어 상대시각 ("3시간 전", "어제" …)
 */

const RELATIVE_RE =
  /^(?:방금(?:\s*전)?|어제|(\d+)\s*(초|분|시간|일|주|개월|달|년)\s*전)$/;

const DOT_DATE_RE = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/;
const COMPACT_MD_RE = /^(\d{1,2})[./-](\d{1,2})$/;

export function parseListedAt(
  value: unknown,
  now: Date = new Date(),
): Date | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return fromUnixEpoch(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return fromUnixEpoch(Number(raw));
  }

  const isoish = raw.includes('T')
    ? raw
    : raw.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/, '$1T$2');
  const parsed = Date.parse(isoish);
  if (Number.isFinite(parsed)) {
    // "YYYY-MM-DD HH:mm:ss" 는 KST로 해석 (사이트 표기 기준)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
      return fromKstWallClock(raw);
    }
    return new Date(parsed);
  }

  const relative = parseKoreanRelative(raw, now);
  if (relative) return relative;

  const dotted = raw.match(DOT_DATE_RE);
  if (dotted) {
    const y = Number(dotted[1]);
    const m = Number(dotted[2]);
    const d = Number(dotted[3]);
    return fromKstYmd(y, m, d);
  }

  const md = raw.match(COMPACT_MD_RE);
  if (md) {
    const m = Number(md[1]);
    const d = Number(md[2]);
    return fromKstYmd(now.getFullYear(), m, d);
  }

  return null;
}

function fromUnixEpoch(n: number): Date | null {
  // 초 단위(10자리 전후) vs 밀리초
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** "2026-01-26 19:19:02" → Asia/Seoul wall clock */
function fromKstWallClock(raw: string): Date | null {
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+09:00`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function fromKstYmd(y: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  const date = new Date(`${y}-${mm}-${dd}T00:00:00+09:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseKoreanRelative(raw: string, now: Date): Date | null {
  const normalized = raw.replace(/\s+/g, ' ').trim();
  const m = normalized.match(RELATIVE_RE);
  if (!m) return null;

  if (normalized.startsWith('방금')) {
    return new Date(now.getTime());
  }
  if (normalized === '어제') {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const amount = Number(m[1]);
  const unit = m[2];
  if (!Number.isFinite(amount) || amount < 0) return null;

  const msPerUnit: Record<string, number> = {
    초: 1000,
    분: 60_000,
    시간: 3_600_000,
    일: 86_400_000,
    주: 7 * 86_400_000,
    개월: 30 * 86_400_000,
    달: 30 * 86_400_000,
    년: 365 * 86_400_000,
  };
  const unitMs = msPerUnit[unit];
  if (!unitMs) return null;
  return new Date(now.getTime() - amount * unitMs);
}
