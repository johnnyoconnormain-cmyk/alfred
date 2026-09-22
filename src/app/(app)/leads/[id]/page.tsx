import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/session';
import { getLead, leadPhotos } from '@/lib/queries/leads';
import { threadForCustomer } from '@/lib/queries/messages';
import { activityFor } from '@/lib/queries/activity';
import { getCustomer } from '@/lib/queries/customers';
import { Card, KeyValue, PageHeader, StatusBadge } from '@/components/ui';
import { PhotoGrid } from '@/components/PhotoGrid';
import { MessageThread } from '@/components/MessageThread';
import { serviceLabel } from '@/lib/ai/classify';
import { formatDate, relativeTime } from '@/lib/dates';
import { money } from '@/lib/money';
import { refreshEstimateAction, setLeadStatusAction } from '@/actions/leads';

export const dynamic = 'force-dynamic';

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireOwner();
  const { id } = await params;
  const lead = getLead(business.id, id);
  if (!lead) notFound();

  const photos = leadPhotos(lead.id);
  const customer = getCustomer(business.id, lead.customer_id);
  const thread = threadForCustomer(business.id, lead.customer_id);
  const history = activityFor(business.id, 'lead', lead.id);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={
          <Link href="/leads" className="hover:underline">
            Lead inbox
          </Link>
        }
        title={lead.customer_name}
        description={`${serviceLabel(lead.service_type)} · received ${relativeTime(lead.created_at)} from ${lead.source}`}
        actions={
          <>
            {lead.customer_phone ? (
              <a href={`tel:${lead.customer_phone}`} className="btn btn-secondary btn-sm">
                Call
              </a>
            ) : null}
            <Link href={`/quotes/new?lead=${lead.id}`} className="btn btn-primary btn-sm">
              Build quote
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="The request">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} />
              {lead.urgency === 'high' ? <span className="badge badge-critical">Urgent</span> : null}
              {lead.urgency === 'low' ? <span className="badge badge-neutral">No rush</span> : null}
            </div>
            <blockquote className="border-l-2 border-line-strong pl-3.5 text-sm leading-relaxed text-ink">
              {lead.description}
            </blockquote>
            {lead.preferred_date || lead.preferred_time ? (
              <p className="mt-3 text-xs text-ink-faint">
                Customer prefers{' '}
                {lead.preferred_date ? formatDate(lead.preferred_date) : 'any day'}
                {lead.preferred_time ? `, ${lead.preferred_time.toLowerCase()}` : ''}.
              </p>
            ) : null}
          </Card>

          <Card
            title="Estimate range"
            action={
              <form action={refreshEstimateAction}>
                <input type="hidden" name="leadId" value={lead.id} />
                <button type="submit" className="text-xs font-semibold text-field underline underline-offset-2">
                  Recalculate
                </button>
              </form>
            }
          >
            {lead.est_low && lead.est_high ? (
              <>
                <p className="figure-hero tabular">
                  {money(lead.est_low)}<span className="text-ink-faint">–</span>{money(lead.est_high)}
                </p>
                <p className="mt-1.5 text-sm text-ink-muted">
                  Final price confirmed after inspection.
                </p>
                {lead.est_basis ? (
                  <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
                    Based on {lead.est_basis}. Priced from your rate card — every number is editable
                    in the quote builder.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                No estimate yet. Recalculate to price this request against your rate card.
              </p>
            )}
          </Card>

          {photos.length ? (
            <Card title={`Photos from the customer (${photos.length})`}>
              <PhotoGrid photos={photos} />
            </Card>
          ) : null}

          <MessageThread
            messages={thread}
            customerId={lead.customer_id}
            leadId={lead.id}
            back={`/leads/${lead.id}`}
          />
        </div>

        <div className="space-y-4">
          <Card title="Customer">
            <KeyValue
              items={[
                {
                  label: 'Name',
                  value: (
                    <Link href={`/customers/${lead.customer_id}`} className="text-field hover:underline">
                      {lead.customer_name}
                    </Link>
                  ),
                },
                { label: 'Phone', value: lead.customer_phone ?? '—' },
                { label: 'Email', value: lead.customer_email ?? '—' },
                { label: 'Address', value: customer?.address ?? '—' },
                { label: 'Source', value: <span className="capitalize">{lead.source}</span> },
              ]}
            />
          </Card>

          <Card title="Move this lead">
            <div className="space-y-2">
              {[
                { status: 'qualified', label: 'Mark qualified', style: 'btn-secondary' },
                { status: 'lost', label: 'Mark lost', style: 'btn-danger' },
              ].map((option) => (
                <form key={option.status} action={setLeadStatusAction}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <input type="hidden" name="status" value={option.status} />
                  <button type="submit" className={`btn ${option.style} w-full`}>
                    {option.label}
                  </button>
                </form>
              ))}
              <Link href={`/quotes/new?lead=${lead.id}`} className="btn btn-primary w-full">
                Build a quote
              </Link>
            </div>
          </Card>

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
