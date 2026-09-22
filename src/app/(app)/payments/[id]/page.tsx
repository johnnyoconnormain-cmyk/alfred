import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/session';
import { getInvoice, paymentsFor } from '@/lib/queries/invoices';
import { appUrl } from '@/lib/automations/engine';
import { Card, Field, KeyValue, PageHeader, StatusBadge } from '@/components/ui';
import { CopyLink } from '@/components/CopyLink';
import { formatDate, relativeTime } from '@/lib/dates';
import { money } from '@/lib/money';
import { recordPaymentAction, sendInvoiceAction } from '@/actions/payments';

export const dynamic = 'force-dynamic';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireOwner();
  const { id } = await params;
  const invoice = getInvoice(business.id, id);
  if (!invoice) notFound();

  const payments = paymentsFor(invoice.id);
  const balance = invoice.amount - invoice.amount_paid;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={
          <Link href="/payments" className="hover:underline">
            Payments
          </Link>
        }
        title={`Invoice #${invoice.number}`}
        description={`${invoice.customer_name}${invoice.job_title ? ` · ${invoice.job_title}` : ''}`}
        actions={
          <>
            <a href={`/pay/${invoice.token}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              Customer view
            </a>
            {invoice.status === 'draft' ? (
              <form action={sendInvoiceAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button type="submit" className="btn btn-primary btn-sm">
                  Send invoice
                </button>
              </form>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <div className="mb-3">
            <StatusBadge status={invoice.status} />
          </div>
          <KeyValue
            items={[
              {
                label: 'Customer',
                value: (
                  <Link href={`/customers/${invoice.customer_id}`} className="text-field hover:underline">
                    {invoice.customer_name}
                  </Link>
                ),
              },
              {
                label: 'Job',
                value: invoice.job_id ? (
                  <Link href={`/jobs/${invoice.job_id}`} className="text-field hover:underline">
                    {invoice.job_title}
                  </Link>
                ) : (
                  '—'
                ),
              },
              { label: 'Raised', value: formatDate(invoice.created_at.slice(0, 10), { weekday: false }) },
              { label: 'Sent', value: invoice.sent_at ? relativeTime(invoice.sent_at) : 'Not sent' },
              { label: 'Due', value: invoice.due_date ? formatDate(invoice.due_date, { weekday: false }) : '—' },
              { label: 'Amount', value: <span className="tabular">{money(invoice.amount, { cents: true })}</span> },
              { label: 'Paid', value: <span className="tabular">{money(invoice.amount_paid, { cents: true })}</span> },
            ]}
          />
        </Card>

        <div className="space-y-4">
          <div className="card card-pad text-center">
            <p className="eyebrow">Balance</p>
            <p className={`figure-hero mt-1 tabular ${balance > 0 ? 'text-status-serious' : 'text-status-good'}`}>
              {money(balance)}
            </p>
          </div>

          {balance > 0 ? (
            <Card title="Record a payment">
              <form action={recordPaymentAction} className="space-y-3">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <Field label="Amount" hint="Leave blank to settle the balance in full.">
                  <input
                    name="amount"
                    inputMode="decimal"
                    className="input tabular"
                    placeholder={(balance / 100).toFixed(2)}
                  />
                </Field>
                <Field label="How did they pay?">
                  <select name="method" className="input" defaultValue="card">
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="ach">Bank transfer</option>
                  </select>
                </Field>
                <button type="submit" className="btn btn-primary w-full">
                  Record payment
                </button>
              </form>
            </Card>
          ) : null}

          <Card title="Payment link">
            <CopyLink url={`${appUrl()}/pay/${invoice.token}`} />
          </Card>
        </div>
      </div>

      {payments.length ? (
        <Card title="Payment history" className="mt-4" bodyClassName="">
          <ul className="divide-y divide-line">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div>
                  <p className="text-sm capitalize text-ink">
                    {payment.method} · {payment.provider}
                  </p>
                  <p className="text-xs text-ink-faint">{relativeTime(payment.created_at)}</p>
                </div>
                <p className="text-sm font-semibold tabular text-ink">{money(payment.amount, { cents: true })}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
