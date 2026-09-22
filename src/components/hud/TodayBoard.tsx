import Link from 'next/link';
import type { JobWithCustomer } from '@/lib/queries/jobs';
import { Card, StatusBadge } from '@/components/ui';
import { formatTime, minutesOfDay } from '@/lib/dates';
import { money } from '@/lib/money';

/**
 * Today, as a running order.
 *
 * The crew column matters as much as the time — most of the owner's morning
 * questions are "who is where", not "what is booked". The current job is marked
 * against the actual clock rather than a status someone remembered to set.
 */
export function TodayBoard({ jobs, nowWall }: { jobs: JobWithCustomer[]; nowWall: string }) {
  const nowMin = minutesOfDay(nowWall);
  const revenue = jobs.reduce((sum, j) => sum + j.amount, 0);

  return (
    <Card
      title="Today"
      action={
        <span className="text-xs tabular text-ink-faint">
          {jobs.length} job{jobs.length === 1 ? '' : 's'} · {money(revenue)}
        </span>
      }
      bodyClassName=""
    >
      {jobs.length === 0 ? (
        <div className="px-4 py-10 text-center sm:px-5">
          <p className="text-sm text-ink-muted">Nothing is on the calendar for today.</p>
          <Link href="/jobs?status=unscheduled" className="btn btn-secondary btn-sm mt-3">
            Schedule accepted work
          </Link>
        </div>
      ) : (
        <ol className="divide-y divide-line">
          {jobs.map((job) => {
            const start = minutesOfDay(job.scheduled_start ?? '00:00');
            const end = minutesOfDay(job.scheduled_end ?? job.scheduled_start ?? '00:00');
            const live = job.status === 'in_progress' || (start <= nowMin && end > nowMin);
            const done = job.status === 'complete' || job.status === 'paid';

            return (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-paper-sunken/60 sm:gap-4 sm:px-5"
                >
                  <div className="w-16 shrink-0 sm:w-20">
                    <p className={`text-sm font-bold tabular ${done ? 'text-ink-faint' : 'text-ink'}`}>
                      {formatTime(job.scheduled_start)}
                    </p>
                    <p className="text-2xs text-ink-faint">
                      {Math.round(job.duration_min / 60)}h{job.duration_min % 60 ? ` ${job.duration_min % 60}m` : ''}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span className="truncate">{job.customer_name}</span>
                      {live ? (
                        <span className="inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-[0.06em] text-status-warning">
                          <span className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full bg-status-warning" />
                          On site
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-ink-muted">{job.title}</p>
                    {job.address ? (
                      <p className="mt-0.5 truncate text-xs text-ink-faint">{job.address}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="badge badge-neutral">
                        {job.crew_name ?? 'Unassigned'}
                      </span>
                      <StatusBadge status={job.status} />
                      {job.checklist_total ? (
                        <span className="text-2xs tabular text-ink-faint">
                          {job.checklist_done}/{job.checklist_total} steps
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="shrink-0 text-sm font-bold tabular text-ink">{money(job.amount)}</p>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
