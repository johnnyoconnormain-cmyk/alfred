import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { checklist, getJob, jobPhotos } from '@/lib/queries/jobs';
import { invoiceForJob } from '@/lib/queries/invoices';
import { StatusBadge } from '@/components/ui';
import { JobChecklist } from '@/components/JobChecklist';
import { PhotoUpload } from '@/components/PhotoUpload';
import { photoStorageStatus } from '@/lib/storage';
import { BeforeAfter } from '@/components/PhotoGrid';
import { formatDate, formatDuration, formatTime } from '@/lib/dates';
import { money } from '@/lib/money';
import { setJobStatusAction } from '@/actions/jobs';

export const dynamic = 'force-dynamic';

export default async function CrewJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireSession();
  const { id } = await params;
  const job = getJob(business.id, id);
  if (!job) notFound();

  const steps = checklist(job.id);
  const photos = jobPhotos(job.id);
  const invoice = invoiceForJob(business.id, job.id);
  const allDone = steps.length > 0 && steps.every((s) => s.done);

  return (
    <div className="pb-6">
      <Link href="/crew" className="text-sm font-semibold text-field">
        ← Today
      </Link>

      <header className="mt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="h-display">{job.customer_name}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">{job.title}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>
        <p className="mt-2 text-sm tabular text-ink">
          {job.scheduled_start ? (
            <>
              {formatDate(job.scheduled_start.slice(0, 10), { weekday: false })} ·{' '}
              {formatTime(job.scheduled_start)} · {formatDuration(job.duration_min)}
            </>
          ) : (
            'Not scheduled'
          )}
        </p>
        {job.address ? <p className="mt-1 text-sm text-ink-muted">{job.address}</p> : null}
      </header>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {job.customer_phone ? (
          <>
            <a href={`tel:${job.customer_phone}`} className="btn btn-secondary tap">
              Call
            </a>
            <a href={`sms:${job.customer_phone}`} className="btn btn-secondary tap">
              Text
            </a>
          </>
        ) : null}
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(job.address ?? job.customer_name)}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary tap"
        >
          Drive
        </a>
      </div>

      {job.notes ? (
        <p className="mt-4 rounded border border-status-warning/30 bg-[#fdf4e3] px-3 py-2.5 text-sm text-ink">
          <span className="font-semibold">Note: </span>
          {job.notes}
        </p>
      ) : null}

      {job.status === 'scheduled' ? (
        <form action={setJobStatusAction} className="mt-4">
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="status" value="in_progress" />
          <button type="submit" className="btn btn-primary btn-lg tap w-full">
            Start job
          </button>
        </form>
      ) : null}

      <div className="mt-4 space-y-4">
        <JobChecklist jobId={job.id} steps={steps} />

        <section className="card card-pad">
          <h2 className="h-section mb-3">Photos</h2>
          <PhotoUpload jobId={job.id} storage={photoStorageStatus()} />
          {photos.length ? (
            <div className="mt-4">
              <BeforeAfter
                before={photos.filter((p) => p.kind === 'before')}
                after={photos.filter((p) => p.kind === 'after')}
              />
            </div>
          ) : null}
        </section>
      </div>

      {job.status === 'in_progress' ? (
        <form action={setJobStatusAction} className="mt-5">
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="status" value="complete" />
          <button type="submit" className="btn btn-primary btn-lg tap w-full">
            Mark job complete
          </button>
          <p className="mt-2 text-center text-xs text-ink-faint">
            {allDone
              ? 'This raises the invoice and sends it to the customer.'
              : `${steps.filter((s) => !s.done).length} step${
                  steps.filter((s) => !s.done).length === 1 ? '' : 's'
                } still open — you can still finish up.`}
          </p>
        </form>
      ) : null}

      {(job.status === 'complete' || job.status === 'paid') && invoice ? (
        <section className="card card-pad mt-5 text-center">
          <p className="eyebrow">Invoice #{invoice.number}</p>
          <p className="figure mt-1 tabular">{money(invoice.amount)}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {invoice.status === 'paid' ? 'Paid in full.' : 'Sent to the customer.'}
          </p>
          {invoice.status !== 'paid' ? (
            <a href={`/pay/${invoice.token}`} target="_blank" rel="noreferrer" className="btn btn-secondary mt-3 w-full">
              Open payment page
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
