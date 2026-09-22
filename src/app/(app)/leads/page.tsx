import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { listLeads } from '@/lib/queries/leads';
import { PageHeader, StatusBadge, EmptyState } from '@/components/ui';
import { serviceLabel } from '@/lib/ai/classify';
import { formatDate, relativeTime } from '@/lib/dates';
import { money } from '@/lib/money';
import type { LeadStatus } from '@/lib/db/types';

export const metadata = { title: 'Lead inbox' };
export const dynamic = 'force-dynamic';

const FILTERS: { key: string; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'new', label: 'New' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'all', label: 'Everything' },
];

const URGENCY: Record<string, { label: string; className: string }> = {
  high: { label: 'Urgent', className: 'badge-critical' },
  normal: { label: '', className: '' },
  low: { label: 'No rush', className: 'badge-neutral' },
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { business } = await requireOwner();
  const params = await searchParams;
  const status = (params.status ?? 'open') as LeadStatus | 'open' | 'all';
  const leads = listLeads(business.id, { status });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Every request in one place"
        title="Lead inbox"
        description="Calls, web forms and social messages land here already sorted by what they are and how urgent they sound."
        actions={
          <>
            <Link href={`/book/${business.slug}`} className="btn btn-secondary btn-sm" target="_blank">
              View intake form
            </Link>
            <Link href="/leads/new" className="btn btn-primary btn-sm">
              Log a call
            </Link>
          </>
        }
      />

      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {FILTERS.map((filter) => {
          const active = (params.status ?? 'open') === filter.key;
          return (
            <Link
              key={filter.key}
              href={`/leads?status=${filter.key}`}
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

      {leads.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Nothing here"
            description="New requests appear the moment somebody submits your intake form or you log a call."
            action={
              <Link href="/leads/new" className="btn btn-secondary btn-sm">
                Log a call
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="space-y-2.5">
          {leads.map((lead) => {
            const urgency = URGENCY[lead.urgency];
            return (
              <li key={lead.id} className="card overflow-hidden">
                <Link href={`/leads/${lead.id}`} className="block p-4 transition-colors hover:bg-paper-sunken/50 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-bold text-ink">{lead.customer_name}</span>
                        <StatusBadge status={lead.status} />
                        {urgency.label ? <span className={`badge ${urgency.className}`}>{urgency.label}</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {lead.customer_address ?? 'No address given'} · {lead.customer_phone ?? 'no phone'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">{serviceLabel(lead.service_type)}</p>
                      {lead.est_low && lead.est_high ? (
                        <p className="text-xs tabular text-ink-muted">
                          Est. {money(lead.est_low)}–{money(lead.est_high)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                    “{lead.description}”
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                    <span className="capitalize">{lead.source}</span>
                    <span aria-hidden>·</span>
                    <span>{relativeTime(lead.created_at)}</span>
                    {lead.photo_count ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          {lead.photo_count} photo{lead.photo_count === 1 ? '' : 's'}
                        </span>
                      </>
                    ) : null}
                    {lead.preferred_date ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>Prefers {formatDate(lead.preferred_date, { weekday: false })}</span>
                      </>
                    ) : null}
                  </div>
                </Link>

                <div className="flex flex-wrap gap-2 border-t border-line bg-paper-sunken/40 px-4 py-2.5 sm:px-5">
                  <Link href={`/quotes/new?lead=${lead.id}`} className="btn btn-primary btn-sm">
                    Build quote
                  </Link>
                  <Link href={`/leads/${lead.id}`} className="btn btn-secondary btn-sm">
                    Open
                  </Link>
                  {lead.customer_phone ? (
                    <>
                      <a href={`tel:${lead.customer_phone}`} className="btn btn-ghost btn-sm">
                        Call
                      </a>
                      <a href={`sms:${lead.customer_phone}`} className="btn btn-ghost btn-sm">
                        Text
                      </a>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
