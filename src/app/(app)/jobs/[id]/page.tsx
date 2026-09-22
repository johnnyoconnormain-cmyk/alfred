import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/session';
import { checklist, getJob, jobPhotos } from '@/lib/queries/jobs';
import { invoiceForJob, reviewForJob } from '@/lib/queries/invoices';
import { threadForCustomer } from '@/lib/queries/messages';
import { activityFor } from '@/lib/queries/activity';
import { findAvailability, listCrews } from '@/lib/queries/schedule';
import { appUrl } from '@/lib/automations/engine';
import { Card, KeyValue, PageHeader, StatusBadge } from '@/components/ui';
import { BeforeAfter, PhotoGrid } from '@/components/PhotoGrid';
import { MessageThread } from '@/components/MessageThread';
import { JobChecklist } from '@/components/JobChecklist';
import { PhotoUpload } from '@/components/PhotoUpload';
import { CopyLink } from '@/components/CopyLink';
import { formatDate, formatDuration, formatTime, relativeTime } from '@/lib/dates';
import { money } from '@/lib/money';
import { serviceLabel } from '@/lib/ai/classify';
import { assignCrewAction, scheduleJobAction, setJobStatusAction } from '@/actions/jobs';
import { sendInvoiceAction } from '@/actions/payments';

export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { business, settings } = await requireOwner();
  const { id } = await params;
  const job = getJob(business.id, id);
  if (!job) notFound();

  const steps = checklist(job.id);
  const photos = jobPhotos(job.id);
  const invoice = invoiceForJob(business.id, job.id);
  const review = reviewForJob(job.id);
  const crews = listCrews(business.id).filter((c) => c.active);
  const thread = threadForCustomer(business.id, job.customer_id);
  const history = activityFor(business.id, 'job', job.id);

  const needsDate = !job.scheduled_start;
  const offers = needsDate
    ? findAvailability(business.id, settings, { durationMin: job.duration_min, maxDays: 4, maxPerDay: 3 })
    : [];

  const nextStatus: Record<string, { label: string; value: string; style: string } | null> = {
    unscheduled: null,
    scheduled: { label: 'Start this job', value: 'in_progress', style: 'btn-primary' },
    in_progress: { label: 'Mark complete', value: 'complete', style: 'btn-primary' },
    complete: null,
    paid: null,
    cancelled: null,
  };
  const advance = nextStatus[job.status];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={
          <Link href="/jobs" className="hover:underline">
            Jobs
          </Link>
        }
        title={job.title}
        description={`Job #${job.number} · ${job.customer_name}`}
        actions={
          <>
            {job.customer_phone ? (
              <a href={`tel:${job.customer_phone}`} className="btn btn-secondary btn-sm">
                Call
              </a>
            ) : null}
            {job.address ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                Directions
              </a>
            ) : null}
            {advance ? (
              <form action={setJobStatusAction}>
                <input type="hidden" name="jobId" value={job.id} />
                <input type="hidden" name="status" value={advance.value} />
                <button type="submit" className={`btn ${advance.style} btn-sm`}>
                  {advance.label}
                </button>
              </form>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {needsDate ? (
            <Card title="Get this on the calendar">
              <p className="mb-3 text-sm text-ink-muted">
                The customer has accepted and is waiting on a date. These are the openings your crews
                actually have, travel time included.
              </p>
              {offers.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  No openings in the next three weeks. Widen your working days in settings, or place
                  it by hand below.
                </p>
              ) : (
                <div className="space-y-3">
                  {offers.map((offer) => (
                    <div key={offer.date}>
                      <p className="eyebrow mb-1.5">{formatDate(offer.date)}</p>
                      <div className="flex flex-wrap gap-2">
                        {offer.slots.map((slot) => (
                          <form key={slot.start} action={scheduleJobAction}>
                            <input type="hidden" name="jobId" value={job.id} />
                            <input type="hidden" name="start" value={slot.start} />
                            <input type="hidden" name="crewId" value={slot.crewId} />
                            <button type="submit" className="btn btn-secondary btn-sm tabular">
                              {formatTime(slot.start)} · {slot.crewName}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form action={scheduleJobAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
                <input type="hidden" name="jobId" value={job.id} />
                <label className="block">
                  <span className="field-label">Or set it manually</span>
                  <input name="start" type="datetime-local" required className="input" />
                </label>
                <button type="submit" className="btn btn-secondary">
                  Schedule
                </button>
              </form>
            </Card>
          ) : null}

          <JobChecklist jobId={job.id} steps={steps} />

          <Card title="Job photos">
            <PhotoUpload jobId={job.id} />
            {photos.length ? (
              <div className="mt-4 space-y-4">
                {photos.some((p) => p.kind === 'before') || photos.some((p) => p.kind === 'after') ? (
                  <div>
                    <p className="eyebrow mb-2">Before and after</p>
                    <BeforeAfter
                      before={photos.filter((p) => p.kind === 'before')}
                      after={photos.filter((p) => p.kind === 'after')}
                    />
                  </div>
                ) : null}
                {photos.some((p) => p.kind === 'progress') ? (
                  <div>
                    <p className="eyebrow mb-2">Progress</p>
                    <PhotoGrid photos={photos.filter((p) => p.kind === 'progress')} />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-faint">
                Nothing uploaded yet. Before-and-after pairs are the easiest marketing this business
                will ever make.
              </p>
            )}
          </Card>

          <MessageThread
            messages={thread}
            customerId={job.customer_id}
            jobId={job.id}
            back={`/jobs/${job.id}`}
          />
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusBadge status={job.status} />
              {job.quote_id ? (
                <Link href={`/quotes/${job.quote_id}`} className="badge badge-neutral hover:underline">
                  From a quote
                </Link>
              ) : null}
            </div>
            <KeyValue
              items={[
                {
                  label: 'Customer',
                  value: (
                    <Link href={`/customers/${job.customer_id}`} className="text-field hover:underline">
                      {job.customer_name}
                    </Link>
                  ),
                },
                {
                  label: 'When',
                  value: job.scheduled_start
                    ? `${formatDate(job.scheduled_start.slice(0, 10), { weekday: false })}, ${formatTime(
                        job.scheduled_start,
                      )}`
                    : 'Not scheduled',
                },
                { label: 'On site', value: formatDuration(job.duration_min) },
                { label: 'Service', value: serviceLabel(job.service_type) },
                { label: 'Address', value: job.address ?? '—' },
                { label: 'Value', value: <span className="tabular font-semibold">{money(job.amount)}</span> },
              ]}
            />
            {job.notes ? (
              <p className="mt-3 rounded border border-line bg-paper-sunken/60 px-3 py-2 text-sm text-ink-muted">
                {job.notes}
              </p>
            ) : null}
          </Card>

          <Card title="Crew">
            <form action={assignCrewAction} className="flex gap-2">
              <input type="hidden" name="jobId" value={job.id} />
              <select name="crewId" className="input" defaultValue={job.crew_id ?? ''}>
                <option value="">Unassigned</option>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-secondary shrink-0">
                Save
              </button>
            </form>
          </Card>

          {job.status === 'complete' || job.status === 'paid' ? (
            <Card title="Invoice">
              {invoice ? (
                <>
                  <KeyValue
                    items={[
                      { label: 'Number', value: `#${invoice.number}` },
                      { label: 'Status', value: <StatusBadge status={invoice.status} /> },
                      { label: 'Amount', value: <span className="tabular">{money(invoice.amount)}</span> },
                      { label: 'Paid', value: <span className="tabular">{money(invoice.amount_paid)}</span> },
                    ]}
                  />
                  <div className="mt-3 space-y-2">
                    <Link href={`/payments/${invoice.id}`} className="btn btn-secondary btn-sm w-full">
                      Open invoice
                    </Link>
                    {invoice.status === 'draft' ? (
                      <form action={sendInvoiceAction}>
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <button type="submit" className="btn btn-primary btn-sm w-full">
                          Send it
                        </button>
                      </form>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  No invoice yet. Marking the job complete raises and sends one automatically.
                </p>
              )}
            </Card>
          ) : null}

          {job.status === 'complete' || job.status === 'paid' ? (
            <Card title="Review link">
              <CopyLink url={`${appUrl()}/review/${job.token}`} />
              {review ? (
                <p className="mt-2 text-sm text-ink">
                  <span className="text-status-warning">{'★'.repeat(review.rating)}</span>
                  {review.comment ? <span className="block text-xs text-ink-muted">“{review.comment}”</span> : null}
                </p>
              ) : (
                <p className="mt-2 text-xs text-ink-faint">
                  Sent automatically a day after the job is paid, if the review automation is on.
                </p>
              )}
            </Card>
          ) : null}

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
