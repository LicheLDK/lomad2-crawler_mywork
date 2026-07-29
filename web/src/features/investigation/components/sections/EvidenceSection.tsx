import {
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Link2,
  Monitor,
  Trash2,
} from 'lucide-react';
import { resolveAssetUrl } from '../../../../api';
import { formatTime } from '../../../../lib/format';
import { EVIDENCE_KIND_LABEL } from '../../lib/evidence';
import { deleteInvestigationEvidence } from '../../lib/store';
import type {
  EvidenceKind,
  InvestigationCase,
  InvestigationEvidence,
} from '../../types';
import { toast } from '../../../../components/Toast';

const KIND_ICON: Record<EvidenceKind, typeof Link2> = {
  original_url: Link2,
  screenshot: Monitor,
  product_image: ImageIcon,
  ocr: FileText,
  html_snapshot: FileCode2,
};

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.click();
}

function handleDownload(item: InvestigationEvidence, caseNo: string) {
  const stamp = caseNo.replace(/[^\w-]/g, '_');
  const value = item.value?.trim();

  if (item.kind === 'original_url') {
    if (!value) {
      toast('원본 URL이 없습니다.');
      return;
    }
    downloadText(`${stamp}-url.txt`, value, 'text/plain;charset=utf-8');
    toast('원본 URL을 다운로드했습니다.');
    return;
  }

  if (item.kind === 'ocr') {
    if (!value) {
      toast('OCR 내용이 없습니다.');
      return;
    }
    downloadText(`${stamp}-ocr.txt`, value, 'text/plain;charset=utf-8');
    toast('OCR을 다운로드했습니다.');
    return;
  }

  if (item.kind === 'html_snapshot') {
    if (!value) {
      toast('HTML Snapshot이 없습니다.');
      return;
    }
    downloadText(`${stamp}-snapshot.html`, value, 'text/html;charset=utf-8');
    toast('HTML Snapshot을 다운로드했습니다.');
    return;
  }

  if (!value) {
    toast('이미지가 없습니다.');
    return;
  }
  const src = resolveAssetUrl(value) || value;
  downloadUrl(src, `${stamp}-${item.kind}.jpg`);
  toast('이미지를 다운로드했습니다.');
}

export function InvestigationEvidencePanel({
  row,
  readOnly = false,
}: {
  row: InvestigationCase;
  readOnly?: boolean;
}) {
  const items = row.evidence ?? [];

  function onDelete(item: InvestigationEvidence) {
    if (readOnly) return;
    deleteInvestigationEvidence(row.id, item.id);
    toast('Evidence를 삭제했습니다.');
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
        Evidence
      </h3>

      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-ink-200 bg-white px-4 py-6 text-center text-sm text-ink-400">
            저장된 Evidence가 없습니다.
          </li>
        ) : (
          items.map((item) => {
            const Icon = KIND_ICON[item.kind] ?? FileText;
            const label =
              EVIDENCE_KIND_LABEL[item.kind] ?? item.label ?? item.kind;
            const preview =
              item.kind === 'original_url' ||
              item.kind === 'ocr' ||
              item.kind === 'html_snapshot'
                ? item.value
                : resolveAssetUrl(item.value) || item.value;

            return (
              <li
                key={item.id}
                className="rounded-xl border border-ink-100 bg-white p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sand-100 text-ink-600">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink-900">{label}</p>
                      <span className="text-[11px] tabular-nums text-ink-400">
                        저장 · {formatTime(item.savedAt)}
                      </span>
                    </div>

                    {item.kind === 'original_url' && preview ? (
                      <a
                        href={preview}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-xs text-teal-700 underline-offset-2 hover:underline"
                      >
                        <span className="truncate">{preview}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : preview ? (
                      <p className="mt-1 line-clamp-2 break-all text-xs text-ink-500">
                        {item.kind === 'screenshot' ||
                        item.kind === 'product_image'
                          ? '저장된 이미지'
                          : preview}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-ink-400">내용 없음</p>
                    )}

                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(item, row.caseNo)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-sand-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        다운로드
                      </button>
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          삭제
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
