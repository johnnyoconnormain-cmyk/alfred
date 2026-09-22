import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/session';
import { getQuote, quoteItems } from '@/lib/queries/quotes';
import { listCustomers } from '@/lib/queries/customers';
import { messagesForQuote } from '@/lib/queries/messages';
import { activityFor } from '@/lib/queries/activity';
import { pendingTasks, appUrl } from '@/lib/automations/engine';
import { one } from '@/lib/db';
import { Card, KeyValue, PageHeader, StatusBadge } from '@/components/ui';
import { QuoteBuilder } from '@/components/QuoteBuilder';
import { MessageThread } from '@/components/MessageThread';
import { CopyLink } from '@/components/CopyLink';
import { formatDate, relativeTime } from '@/lib/dates';
import { money } from '@/lib/money';
import { serviceLabel } from '@/lib/ai/classify';
import {
  acceptQuoteAction,
  declineQuoteAction,
  duplicateQuoteAction,
  sendQuoteAction,
  updateQuoteAction,
} from '@/actions/quotes';

export const dynamic = 'force-dynamic';

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { business, settings } = await requireOwner();
  const { id } = await params;
  const quote = getQuote(business.id, id);
  if (!quote) notFound();

  const items = quoteItems(quote.id);
  const messages = messagesForQuote(quote.id);
  const history = activityFor(business.id, 'quote', quote.id);
  const queued = pendingTasks(business.id, 50).filter((t) => t.entity_id === quote.id);
  const job = one<{ id: string }>('SELECT id FROM jobs WHERE quote_id = ? LIMIT 1', [quote.id]);
  const publicUrl = `${appUrl()}/q/${quote.token}`;
  const editable = quote.status === 'draft';

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={
          <Link href="/quotes" className="hover:underline">
            Quotes
          </Link>
        }
        title={`Quote #${quote.number}`}
        description={`${quote.title} · ${quote.customer_name}`}
        actions={
          <>
            <a href={`/q/${quote.token}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              Preview customer page
            </a>
            {quote.status === 'draft' ? (
              <form action={sendQuoteAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <button type="submit" className="btn btn-primary btn-sm">
                  Send to customer
                </button>
              </form>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {editable ? (
            <QuoteBuilder
              action={updateQuoteAction}
              customers={listCustomers(business.id).map((c) => ({ id: c.id, name: c.name, address: c.address }))}
              customerId={quote.customer_id}
              quoteId={quote.id}
              title={quote.title}
              serviceType={quote.service_type}
              notes={quote.notes}
              taxRate={settings.tax_rate}
              initialLines={items.map((item) => ({
                kind: item.kind,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unit_price,
              }))}
              submitLabel="Save changes"
              secondaryLabel="Save"
            />
          ) : (
            <Card title="Line items" bodyClassName="">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className="block text-ink">{item.description}</span>
                          <span className="text-2xs uppercase tracking-[0.06em] text-ink-faint">{item.kind}</span>
                        </td>
                        <td className="text-right tabular text-ink-muted">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="text-right tabular text-ink-muted">{money(item.unit_price, { cents: true })}</td>
                        <td className="text-right tabular font-semibold text-ink">
                          {money(item.total, { cents: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-line bg-paper-sunken/40 px-4 py-3 sm:px-5">
                <dl className="ml-auto max-w-xs space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Subtotal</dt>
                    <dd className="tabular">{money(quote.subtotal, { cents: true })}</dd>
                  </div>
                  {quote.tax > 0 ? (
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">Tax</dt>
                      <dd className="tabular">{money(quote.tax, { cents: true })}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-line pt-1.5">
                    <dt className="font-display font-bold uppercase tracking-[0.08em]">Total</dt>
                    <dd className="font-display text-xl font-bold tabular">{money(quote.total, { cents: true })}</dd>
                  </div>
                </dl>
              </div>
              {quote.notes ? (
                <p className="border-t border-line px-4 py-3 text-sm text-ink-muted sm:px-5">{quote.notes}</p>
              ) : null}
            </Card>
          )}

          <MessageThread
            messages={messages}
            customerId={quote.customer_id}
            quoteId={quote.id}
            back={`/quotes/${quote.id}`}
          />
        </div>

        <div className="space-y-4">
          <Card title="Status">
            <div className="mb-3">
              <StatusBadge status={quote.status} />
            </div>
            <KeyValue
              items={[
                { label: 'Customer', value: <Link href={`/customers/${quote.customer_id}`} className="text-field hover:underline">{quote.customer_name}</Link> },
                { label: 'Service', value: serviceLabel(quote.service_type) },
                { label: 'Sent', value: quote.sent_at ? relativeTime(quote.sent_at) : 'Not yet' },
                { label: 'Opened', value: quote.viewed_at ? relativeTime(quote.viewed_at) : 'Not yet' },
                { label: 'Valid until', value: quote.expires_at ? formatDate(quote.expires_at, { weekday: false }) : '—' },
                { label: 'Total', value: <span className="tabular">{money(quote.total)}</span> },
              ]}
            />
          </Card>

          <Card title="Customer link">
            <CopyLink url={publicUrl} />
            <p className="mt-2 text-xs text-ink-faint">
              Anyone with this link can accept the quote. It is unguessable and unique to this quote.
            </p>
          </Card>

          {quote.status !== 'accepted' && quote.status !== 'declined' ? (
            <Card title="Record an answer" bodyClassName="card-pad space-y-2">
              <p className="text-xs text-ink-faint">
                Use these when the customer answers by phone rather than through the link.
              </p>
              <form action={acceptQuoteAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <button type="submit" className="btn btn-primary w-full">
                  They accepted
                </button>
              </form>
              <form action={declineQuoteAction} className="space-y-2">
                <input type="hidden" name="quoteId" value={quote.id} />
                <input name="reason" className="input py-1.5 text-sm" placeholder="Reason (optional)" />
                <button type="submit" className="btn btn-danger w-full">
                  They passed
                </button>
              </form>
            </Card>
          ) : null}

          {job ? (
            <Card title="Job">
              <p className="text-sm text-ink-muted">This quote was accepted and became a job.</p>
              <Link href={`/jobs/${job.id}`} className="btn btn-secondary btn-sm mt-2.5 w-full">
                Open the job
              </Link>
            </Card>
          ) : null}

          {queued.length ? (
            <Card title="Queued follow-ups" bodyClassName="">
              <ul className="divide-y divide-line">
                {queued.map((task) => (
                  <li key={task.id} className="px-4 py-2.5 text-sm sm:px-5">
                    <p className="text-ink">Follow-up {JSON.parse(task.payload).stage ?? ''}</p>
                    <p className="text-2xs text-ink-faint">
                      Sends {formatDate(task.run_at.slice(0, 10), { weekday: false })}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line px-4 py-2 text-2xs text-ink-faint sm:px-5">
                These cancel automatically the moment the quote is answered.
              </p>
            </Card>
          ) : null}

          <form action={duplicateQuoteAction}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <button type="submit" className="btn btn-secondary btn-sm w-full">
              Duplicate this quote
            </button>
          </form>

          {history.length ? (
            <Card title="History" bodyClassName="">
              <ul className="divide-y divide-line">
                {history.map((item) => (
                  <li key={item.id} className="px-4 py-2.5 sm:px-5">
                    <p className="text-sm text-ink">{item.title}</p>
                    <p className="text-2xs text-ink-faint">{relativeTime(item.created_at)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
