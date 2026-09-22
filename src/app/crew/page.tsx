import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { crewQueue, listJobs } from '@/lib/queries/jobs';
import { crewIdsForUser } from '@/lib/queries/settings';
import { StatusBadge } from '@/components/ui';
import { DAY_NAMES, dayOfWeek, formatDate, formatDateShort, formatTime, todayIn } from '@/lib/dates';
import { money } from '@/lib/money';

export const metadata = { title: 'Today' };
export const dynamic = 'force-dynamic';

/**
 * The field view.
 *
 * Built for one hand and a work glove: today at the top, one tap to the job, and
 * the phone number and directions always within reach. An owner sees every job;
 * a crew member sees their own.
 */
export default async function CrewPage() {
  const { user, business } = await requireSession();
  const today = todayIn(business.timezone);
  const crewIds = crewIdsForUser(user.id);

  const jobs =
    user.role === 'crew'
      ? crewQueue(business.id, business.timezone, crewIds)
      : listJobs(business.id, { from: today, to: todayIn(business.timezone), status: 'all' }).concat(
          listJobs(business.id, { from: today, status: 'scheduled' }).filter(
            (job) => job.scheduled_start && job.scheduled_start.slice(0, 10) > today,
          ),
        );

  const todays = jobs.filter((job) => job.scheduled_start?.slice(0, 10) === today);
  const later = jobs.filter((job) => (job.scheduled_start?.slice(0, 10) ?? '') > today);
  const revenue = todays.reduce((sum, job) => sum + job.amount, 0);

  return (
    <div>
      <p className="eyebrow">{DAY_NAMES[dayOfWeek(today)]}</p>
      <h1 className="h-display mt-0.5">{formatDate(today, { weekday: false })}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {todays.length} job{todays.length === 1 ? '' : 's'} · {money(revenue)}
      </p>

      {todays.length === 0 ? (
        <div className="card card-pad mt-5 text-center">
          <p className="text-sm text-ink-muted">Nothing on your board today.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {todays.map((job) => (
            <li key={job.id} className="card overflow-hidden">
              <Link href={`/crew/${job.id}`} className="block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-2xl font-bold tabular tracking-[-0.02em] text-ink">
                      {formatTime(job.scheduled_start)}
                    </p>
                    <p className="mt-0.5 text-base font-semibold text-ink">{job.customer_name}</p>
                    <p className="text-sm text-ink-muted">{job.title}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                {job.address ? <p className="mt-2 text-sm text-ink-faint">{job.address}</p> : null}
                <p className="mt-2 text-xs tabular text-ink-faint">
                  {job.checklist_done}/{job.checklist_total} steps done
                </p>
              </Link>

              <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
                {job.customer_phone ? (
                  <>
                    <a href={`tel:${job.customer_phone}`} className="tap flex items-center justify-center py-3 text-sm font-semibold text-ink">
                      Call
                    </a>
                    <a href={`sms:${job.customer_phone}`} className="tap flex items-center justify-center py-3 text-sm font-semibold text-ink">
                      Text
                    </a>
                  </>
                ) : (
                  <span className="col-span-2 flex items-center justify-center py-3 text-sm text-ink-faint">
                    No phone on file
                  </span>
                )}
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(job.address ?? job.customer_name)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tap flex items-center justify-center py-3 text-sm font-semibold text-field"
                >
                  Drive
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {later.length ? (
        <section className="mt-8">
          <h2 className="h-section mb-2.5">Coming up</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {later.slice(0, 8).map((job) => (
              <li key={job.id}>
                <Link href={`/crew/${job.id}`} className="flex items-center gap-3 p-3.5">
                  <span className="w-20 shrink-0">
                    <span className="block text-2xs font-semibold uppercase tracking-[0.06em] text-ink-faint">
                      {formatDateShort(job.scheduled_start!.slice(0, 10))}
                    </span>
                    <span className="block whitespace-nowrap text-sm font-bold tabular text-ink">
                      {formatTime(job.scheduled_start)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{job.customer_name}</span>
                    <span className="block truncate text-xs text-ink-muted">{job.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
