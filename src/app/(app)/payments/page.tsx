import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { listInvoices, outstandingTotal, overdueInvoices } from '@/lib/queries/invoices';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/dates';
import { money } from '@/lib/money';
import { isTestMode, paymentProvider } from '@/lib/payments';
import { sendPaymentRemindersAction } from '@/actions/payments';

export const metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'paid', label: 'Paid' },
  { key: 'draft', label: 'Drafts' },
];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { business } = await requireOwner();
  const params = await searchParams;
  const invoices = listInvoices(business.id, {
    status: (params.status ?? 'all') as 'all' | 'outstanding' | 'paid' | 'draft',
  });
  const outstanding = outstandingTotal(business.id);
  const overdue = overdueInvoices(business.id, business.timezone);
  const provider = paymentProvider();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Getting paid"
        title="Payments"
        description={`${money(outstanding.amount)} outstanding across ${outstanding.count} invoice${
          outstanding.count === 1 ? '' : 's'
        }${overdue.length ? ` · ${overdue.length} overdue` : ''}`}
        actions={
          <>
            {outstanding.count ? (
              <form action={sendPaymentRemindersAction}>
                <button type="submit" className="btn btn-secondary btn-sm">
                  Remind everyone
                </button>
              </form>
            ) : null}
            <Link href="/payments/new" className="btn btn-primary btn-sm">
              New invoice
            </Link>
          </>
        }
      />

      <div className="card mb-4 p-4">
        <p className="text-sm text-ink">
          <span className="font-semibold">Card payments: </span>
          {provider.enabled ? (
            <>
              Connected through Stripe{isTestMode() ? ' in test mode' : ''}. Customers pay from the
              link on their invoice, and the payment lands here automatically.
            </>
          ) : (
            <>
              Not connected. Invoices still send and you can record cash, cheque and card payments by
              hand — add <code className="rounded-sm bg-paper-sunken px-1 text-2xs">STRIPE_SECRET_KEY</code> to
              turn on the pay-now button.
            </>
          )}
        </p>
      </div>

      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {FILTERS.map((filter) => {
          const active = (params.status ?? 'all') === filter.key;
          return (
            <Link
              key={filter.key}
              href={`/payments?status=${filter.key}`}
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
        {invoices.length === 0 ? (
          <EmptyState
            title="Nothing invoiced"
            description="Invoices are raised automatically when a job is marked complete."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const balance = invoice.amount - invoice.amount_paid;
                  const isOverdue =
                    invoice.status === 'sent' && overdue.some((o) => o.id === invoice.id);
                  return (
                    <tr key={invoice.id} className="row-link">
                      <td>
                        <Link href={`/payments/${invoice.id}`} className="block">
                          <span className="font-semibold text-ink">#{invoice.number}</span>
                          <span className="mt-0.5 block max-w-xs truncate text-xs text-ink-faint">
                            {invoice.job_title ?? 'Manual invoice'}
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Link href={`/payments/${invoice.id}`} className="block text-ink">
                          {invoice.customer_name}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/payments/${invoice.id}`} className="block">
                          <StatusBadge status={invoice.status} />
                          {isOverdue ? (
                            <span className="mt-1 block text-2xs font-semibold text-status-critical">
                              Overdue
                            </span>
                          ) : null}
                        </Link>
                      </td>
                      <td className="text-sm text-ink-muted">
                        <Link href={`/payments/${invoice.id}`} className="block">
                          {invoice.status === 'paid'
                            ? `Paid ${relativeTime(invoice.paid_at)}`
                            : invoice.due_date
                              ? formatDate(invoice.due_date, { weekday: false })
                              : '—'}
                        </Link>
                      </td>
                      <td className="text-right tabular text-ink-muted">
                        <Link href={`/payments/${invoice.id}`} className="block">
                          {money(invoice.amount)}
                        </Link>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/payments/${invoice.id}`}
                          className={`block font-semibold tabular ${
                            balance > 0 ? 'text-status-serious' : 'text-ink-faint'
                          }`}
                        >
                          {money(balance)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
