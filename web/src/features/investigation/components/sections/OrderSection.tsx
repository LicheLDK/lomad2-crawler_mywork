import { ExternalLink } from 'lucide-react';
import type { InvestigationCase } from '../../types';
import { buildOrderUrl } from '../../lib/orderUrl';
import { Card, CardContent } from '../../../../components/ui/card';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-800">{children}</dd>
    </div>
  );
}

/**
 * Drawer — 주문 참조 (BackOffice Master)
 * Search Server 는 orderNo 만 보관. 상세는 BackOffice 「주문으로 이동」.
 */
export function InvestigationOrderPanel({ row }: { row: InvestigationCase }) {
  const orderNo = row.orderNo?.trim() || null;
  const orderUrl = row.orderUrl || buildOrderUrl(orderNo);
  const listing = row.listingTitle?.trim() || row.productName?.trim() || null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
          주문 참조
        </h3>
        {orderUrl ? (
          <a
            href={orderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-700 hover:bg-sand-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            주문으로 이동
          </a>
        ) : null}
      </div>
      <Card>
        <CardContent className="p-4">
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Order No">
              <span className="font-medium tabular-nums text-ink-900">
                {orderNo || '—'}
              </span>
            </Field>
            <Field label="Search Job">
              <span className="font-mono text-xs">
                {row.searchJobId?.slice(0, 8) || '—'}
              </span>
            </Field>
            <Field label="Listing">
              <span className="font-medium text-ink-900">{listing || '—'}</span>
            </Field>
          </dl>
          <p className="mt-3 text-xs text-ink-500">
            계약·고객·상품 상세는 BackOffice(Master)에서 확인합니다. Search
            Server는 orderNo 참조만 보관합니다.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
