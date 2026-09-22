import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/session';
import { customerProfile } from '@/lib/queries/customers';
import { threadForCustomer } from '@/lib/queries/messages';
import { Card, KeyValue, PageHeader, StatusBadge } from '@/components/ui';
import { PhotoGrid } from '@/components/PhotoGrid';
import { MessageThread } from '@/components/MessageThread';
import { formatDate, formatDateShort } from '@/lib/dates';
import { money } from '@/lib/money';
import { updateCustomerNotesAction } from '@/actions/leads';

export const dynamic = 'force-dynamic';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireOwner();
  const { id } = await params;
  const profile = customerProfile(business.id, id);
  if (!profile) notFound();

  const { customer, jobs, quotes, invoices, photos, lifetimeValue, outstanding } = profile;
  const thread = threadForCustomer(business.id, customer.id);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={
          <Link href="/customers" className="hover:underline">
            Customers
          </Link>
        }
        title={customer.name}
        description={customer.address ? `${customer.address}, ${customer.city ?? ''} ${customer.zip ?? ''}` : undefined}
        actions={
          <>
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="btn btn-secondary btn-sm">
                Call
              </a>
            ) : null}
            <Link href={`/quotes/new?customer=${customer.id}`} className="btn btn-primary btn-sm">
              New quote
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="card card-pad">
          <p className="eyebrow">Lifetime value</p>
          <p className="figure mt-1 tabular">{money(lifetimeValue)}</p>
        </div>
        <div className="card card-pad">
          <p className="eyebrow">Jobs</p>
          <p className="figure mt-1 tabular">{jobs.length}</p>
        </div>
        <div className="card card-pad">
          <p className="eyebrow">Quotes</p>
          <p className="figure mt-1 tabular">{quotes.length}</p>
        </div>
        <div className="card card-pad">
          <p className="eyebrow">Outstanding</p>
          <p className={`figure mt-1 tabular ${outstanding ? 'text-status-serious' : ''}`}>
            {money(outstanding)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Jobs" bodyClassName="">
            {jobs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">No jobs yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper-sunken/60 sm:px-5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{job.title}</span>
                        <span className="block text-xs text-ink-faint">
                          {job.scheduled_start ? formatDate(job.scheduled_start.slice(0, 10), { weekday: false }) : 'Not scheduled'}
                        </span>
                      </span>
                      <StatusBadge status={job.status} />
                      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular text-ink">
                        {money(job.amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Quotes" bodyClassName="">
            {quotes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">No quotes yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {quotes.map((quote) => (
                  <li key={quote.id}>
                    <Link href={`/quotes/${quote.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper-sunken/60 sm:px-5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">#{quote.number} · {quote.title}</span>
                        <span className="block text-xs text-ink-faint">
                          {quote.sent_at ? formatDateShort(quote.sent_at.slice(0, 10)) : 'Draft'}
                        </span>
                      </span>
                      <StatusBadge status={quote.status} />
                      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular text-ink">
                        {money(quote.total)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {photos.length ? (
            <Card title="Photos">
              <PhotoGrid photos={photos} />
            </Card>
          ) : null}

          <MessageThread messages={thread} customerId={customer.id} back={`/customers/${customer.id}`} />
        </div>

        <div className="space-y-4">
          <Card title="Contact">
            <KeyValue
              items={[
                { label: 'Phone', value: customer.phone ?? '—' },
                { label: 'Email', value: customer.email ?? '—' },
                { label: 'Address', value: customer.address ?? '—' },
                { label: 'City', value: customer.city ? `${customer.city}, ${customer.state ?? ''}` : '—' },
                { label: 'Source', value: <span className="capitalize">{customer.source ?? '—'}</span> },
                { label: 'Customer since', value: formatDateShort(customer.created_at.slice(0, 10)) },
              ]}
            />
          </Card>

          <Card title="Notes">
            <form action={updateCustomerNotesAction}>
              <input type="hidden" name="customerId" value={customer.id} />
              <textarea
                name="notes"
                rows={5}
                defaultValue={customer.notes ?? ''}
                className="input"
                placeholder="Gate code, where to park, the dog's name…"
              />
              <button type="submit" className="btn btn-secondary btn-sm mt-2 w-full">
                Save notes
              </button>
            </form>
          </Card>

          <Card title="Invoices" bodyClassName="">
            {invoices.length === 0 ? (
              <p className="px-4 py-5 text-sm text-ink-muted sm:px-5">Nothing invoiced yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {invoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link href={`/payments/${invoice.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-paper-sunken/60 sm:px-5">
                      <span className="text-sm text-ink">#{invoice.number}</span>
                      <StatusBadge status={invoice.status} />
                      <span className="text-sm font-semibold tabular text-ink">{money(invoice.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
