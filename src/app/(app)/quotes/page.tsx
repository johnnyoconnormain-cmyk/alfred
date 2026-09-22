import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { listQuotes } from '@/lib/queries/quotes';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import { formatDateShort, relativeTime } from '@/lib/dates';
import { money } from '@/lib/money';
import type { QuoteStatus } from '@/lib/db/types';

export const metadata = { title: 'Quotes' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Awaiting reply' },
  { key: 'draft', label: 'Drafts' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
  { key: 'expired', label: 'Expired' },
];

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { business } = await requireOwner();
  const params = await searchParams;
  const status = (params.status ?? 'all') as QuoteStatus | 'open' | 'all';
  const quotes = listQuotes(business.id, { status });

  const open = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed');
  const openValue = open.reduce((sum, q) => sum + q.total, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Priced work"
        title="Quotes"
        description={
          open.length
            ? `${open.length} quote${open.length === 1 ? '' : 's'} worth ${money(openValue)} waiting on an answer.`
            : 'Every quote you have sent, and what happened to it.'
        }
        actions={
          <Link href="/quotes/new" className="btn btn-primary btn-sm">
            New quote
          </Link>
        }
      />

      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {FILTERS.map((filter) => {
          const active = (params.status ?? 'all') === filter.key;
          return (
            <Link
              key={filter.key}
              href={`/quotes?status=${filter.key}`}
              className={`shrink-0 rounded border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'border-field-deep bg-field text-white'
                  : 'border-line-strong bg-paper-raised text-ink-muted hover:bg-paper-sunken'
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        {quotes.length === 0 ? (
          <EmptyState
            title="No quotes here"
            description="Build one from a lead and it shows up in this list the moment it is drafted."
            action={
              <Link href="/quotes/new" className="btn btn-secondary btn-sm">
                New quote
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} className="row-link">
                    <td>
                      <Link href={`/quotes/${quote.id}`} className="block">
                        <span className="font-semibold text-ink">#{quote.number}</span>
                        <span className="mt-0.5 block max-w-xs truncate text-xs text-ink-faint">
                          {quote.title}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/quotes/${quote.id}`} className="block text-ink">
                        {quote.customer_name}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/quotes/${quote.id}`} className="block">
                        <StatusBadge status={quote.status} />
                        {quote.follow_up_stage > 0 && (quote.status === 'sent' || quote.status === 'viewed') ? (
                          <span className="mt-1 block text-2xs text-ink-faint">
                            {quote.follow_up_stage} follow-up{quote.follow_up_stage === 1 ? '' : 's'} sent
                          </span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="text-sm text-ink-muted">
                      <Link href={`/quotes/${quote.id}`} className="block">
                        {quote.sent_at ? relativeTime(quote.sent_at) : 'Not sent'}
                        {quote.expires_at && (quote.status === 'sent' || quote.status === 'viewed') ? (
                          <span className="mt-0.5 block text-2xs text-ink-faint">
                            Expires {formatDateShort(quote.expires_at)}
                          </span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="text-right">
                      <Link href={`/quotes/${quote.id}`} className="block font-semibold tabular text-ink">
                        {money(quote.total)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
