import type { AiReportDocument } from '../ai.types';

/**
 * Investigation Report HTML Template
 * - Prompt 와 분리된 렌더 전용 Template
 * - PDF 생성(Puppeteer / Playwright printToPDF / wkhtmltopdf)을 고려한 설계
 *   · @page A4, print 미디어
 *   · 외부 CSS/JS 없음 (인라인)
 *   · page-break 친화적 섹션
 */
export function renderReportHtml(doc: AiReportDocument): string {
  const metaRows = [
    ['주문번호', doc.meta.orderNo],
    ['조사번호', doc.meta.investigationCaseNo],
    ['사이트', doc.meta.siteCode],
    ['상품명', doc.meta.productName],
    ['매물 제목', doc.meta.listingTitle],
    ['생성일시', formatDateTime(doc.generatedAt)],
  ]
    .filter(([, v]) => Boolean(v))
    .map(
      ([k, v]) =>
        `<tr><th>${escapeHtml(k as string)}</th><td>${escapeHtml(String(v))}</td></tr>`,
    )
    .join('');

  const evidenceHtml =
    doc.evidence.length === 0
      ? `<p class="empty">등록된 Evidence가 없습니다.</p>`
      : `<ol class="evidence-list">${doc.evidence
          .map((item) => {
            const detail = item.detail
              ? `<div class="detail">${escapeHtml(item.detail)}</div>`
              : '';
            const url = item.url
              ? `<div class="url"><a href="${escapeAttr(item.url)}">${escapeHtml(item.url)}</a></div>`
              : '';
            const kind = item.kind
              ? `<span class="chip">${escapeHtml(item.kind)}</span>`
              : '';
            return `<li><div class="item-title">${escapeHtml(item.title)} ${kind}</div>${detail}${url}</li>`;
          })
          .join('')}</ol>`;

  const timelineHtml =
    doc.timeline.length === 0
      ? `<p class="empty">Timeline 이벤트가 없습니다.</p>`
      : `<ul class="timeline-list">${doc.timeline
          .map((item) => {
            const detail = item.detail
              ? `<div class="detail">${escapeHtml(item.detail)}</div>`
              : '';
            const kind = item.kind
              ? `<span class="chip">${escapeHtml(item.kind)}</span>`
              : '';
            return `<li>
              <div class="time">${escapeHtml(formatDateTime(item.at))}</div>
              <div class="item-title">${escapeHtml(item.title)} ${kind}</div>
              ${detail}
            </li>`;
          })
          .join('')}</ul>`;

  const actions =
    doc.recommendation.actions.length > 0
      ? `<ul>${doc.recommendation.actions
          .map((a) => `<li>${escapeHtml(a)}</li>`)
          .join('')}</ul>`
      : '';
  const reasons =
    doc.recommendation.reasons.length > 0
      ? `<ul class="reasons">${doc.recommendation.reasons
          .map((r) => `<li>${escapeHtml(r)}</li>`)
          .join('')}</ul>`
      : '';
  const stars =
    doc.recommendation.stars != null
      ? `<div class="stars">${'★'.repeat(doc.recommendation.stars)}${'☆'.repeat(Math.max(0, 5 - doc.recommendation.stars))}</div>`
      : '';

  const scoreClass =
    doc.aiScore >= 80 ? 'high' : doc.aiScore >= 50 ? 'mid' : 'low';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(doc.title)}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #1a1a1a;
      background: #fff;
    }
    .report {
      max-width: 210mm;
      margin: 0 auto;
      padding: 8mm 4mm;
    }
    header.report-header {
      border-bottom: 2px solid #1f3a3a;
      padding-bottom: 10px;
      margin-bottom: 18px;
    }
    header.report-header .brand {
      font-size: 10pt;
      letter-spacing: 0.08em;
      color: #3d6b6b;
      text-transform: uppercase;
      margin: 0 0 4px;
    }
    h1 {
      font-size: 18pt;
      margin: 0 0 6px;
      color: #122;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 0;
      font-size: 10pt;
    }
    .meta-table th {
      text-align: left;
      width: 28%;
      color: #555;
      padding: 3px 8px 3px 0;
      font-weight: 600;
      vertical-align: top;
    }
    .meta-table td {
      padding: 3px 0;
      word-break: break-all;
    }
    section {
      margin: 0 0 16px;
      page-break-inside: avoid;
    }
    section h2 {
      font-size: 12pt;
      margin: 0 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #d9e2e2;
      color: #1f3a3a;
    }
    .score-box {
      display: inline-block;
      min-width: 72px;
      padding: 10px 16px;
      border-radius: 4px;
      font-size: 22pt;
      font-weight: 700;
      text-align: center;
    }
    .score-box.high { background: #fde8e8; color: #a11; }
    .score-box.mid { background: #fff4d6; color: #8a6200; }
    .score-box.low { background: #e8f5ee; color: #1b6b3a; }
    .score-sub {
      margin-top: 6px;
      font-size: 10pt;
      color: #555;
    }
    .evidence-list, .timeline-list, ul {
      margin: 0;
      padding-left: 1.2em;
    }
    .timeline-list { list-style: none; padding-left: 0; }
    .timeline-list li {
      border-left: 2px solid #c5d4d4;
      padding: 0 0 10px 12px;
      margin: 0 0 2px;
    }
    .timeline-list .time {
      font-size: 9pt;
      color: #666;
    }
    .item-title { font-weight: 600; }
    .detail { color: #333; margin-top: 2px; }
    .url { font-size: 9pt; margin-top: 2px; word-break: break-all; }
    .url a { color: #1f5f5f; }
    .chip {
      display: inline-block;
      font-size: 8pt;
      padding: 1px 6px;
      border: 1px solid #c5d4d4;
      border-radius: 3px;
      color: #456;
      font-weight: 500;
      vertical-align: middle;
    }
    .stars { letter-spacing: 1px; color: #b8860b; margin-bottom: 4px; }
    .decision-box {
      border: 1px solid #c5d4d4;
      background: #f7fafA;
      padding: 10px 12px;
      border-radius: 4px;
    }
    .decision-box .label {
      font-size: 13pt;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .empty { color: #888; font-style: italic; }
    footer.report-footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #888;
    }
    @media print {
      body { background: #fff; }
      .report { padding: 0; max-width: none; }
      a { text-decoration: none; color: inherit; }
    }
  </style>
</head>
<body>
  <article class="report" data-report-version="1">
    <header class="report-header">
      <p class="brand">Lomad Investigation Report</p>
      <h1>${escapeHtml(doc.title)}</h1>
      <table class="meta-table">${metaRows}</table>
    </header>

    <section id="summary" data-section="summary">
      <h2>Summary</h2>
      <p>${escapeHtml(doc.summary)}</p>
    </section>

    <section id="ai-score" data-section="aiScore">
      <h2>AI Score</h2>
      <div class="score-box ${scoreClass}">${escapeHtml(String(doc.aiScore))}</div>
      ${
        doc.matchingScore != null
          ? `<div class="score-sub">Matching Score: ${escapeHtml(String(doc.matchingScore))}</div>`
          : ''
      }
    </section>

    <section id="evidence" data-section="evidence">
      <h2>Evidence</h2>
      ${evidenceHtml}
    </section>

    <section id="timeline" data-section="timeline">
      <h2>Timeline</h2>
      ${timelineHtml}
    </section>

    <section id="recommendation" data-section="recommendation">
      <h2>Recommendation</h2>
      ${stars}
      <p><strong>${escapeHtml(doc.recommendation.headline || '-')}</strong></p>
      ${actions}
      ${reasons}
    </section>

    <section id="suggested-decision" data-section="suggestedDecision">
      <h2>AI Suggested Decision</h2>
      <div class="decision-box">
        <div class="label">${escapeHtml(doc.suggestedDecision.label)}</div>
        <div class="code">code: ${escapeHtml(String(doc.suggestedDecision.code))}</div>
        <p>${escapeHtml(doc.suggestedDecision.rationale || '-')}</p>
        <p class="empty">※ AI 제안입니다. 최종 판정은 담당자가 확정합니다.</p>
      </div>
    </section>

    ${
      doc.humanFinalDecision
        ? `<section id="final-decision" data-section="humanFinalDecision">
      <h2>Final Decision (Human)</h2>
      <div class="decision-box">
        <div class="label">${escapeHtml(doc.humanFinalDecision.label)}</div>
        <div class="code">code: ${escapeHtml(String(doc.humanFinalDecision.code))}</div>
        <p>${escapeHtml(doc.humanFinalDecision.rationale || '-')}</p>
      </div>
    </section>`
        : `<section id="final-decision" data-section="humanFinalDecision">
      <h2>Final Decision (Human)</h2>
      <p class="empty">아직 사람 확정 판정이 없습니다.</p>
    </section>`
    }

    <footer class="report-footer">
      Generated for PDF export · Do not edit HTML manually · Source: AI Report JSON
    </footer>
  </article>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}
