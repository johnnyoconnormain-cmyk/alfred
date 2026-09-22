import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { listJobs } from '@/lib/queries/jobs';
import { listCrews, safeParse } from '@/lib/queries/schedule';
import { PageHeader, Card } from '@/components/ui';
import { WeekGrid } from '@/components/WeekGrid';
import { addDays, DAY_SHORT, dayOfWeek, formatDate, formatDateShort, formatTime, startOfWeek, todayIn } from '@/lib/dates';
import { money } from '@/lib/money';

export const metadata = { title: 'Schedule' };
export const dynamic = 'force-dynamic';

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; crew?: string }>;
}) {
  const { business, settings } = await requireOwner();
  const params = await searchParams;

  const today = todayIn(business.timezone);
  const weekStart = params.week ? startOfWeek(params.week) : startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const crews = listCrews(business.id).filter((c) => c.active);

  const jobs = listJobs(business.id, {
    from: weekStart,
    to: weekEnd,
    status: 'all',
    crewId: params.crew,
  }).filter((job) => job.status !== 'cancelled');

  const unscheduled = listJobs(business.id, { status: 'unscheduled' });
  const workDays: number[] = safeParse(settings.work_days, [1, 2, 3, 4, 5]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekValue = jobs.reduce((sum, job) => sum + job.amount, 0);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow="Who is where"
        title="Schedule"
        description={`${formatDate(weekStart, { weekday: false })} – ${formatDate(weekEnd, {
          weekday: false,
        })} · ${jobs.length} job${jobs.length === 1 ? '' : 's'} · ${money(weekValue)}`}
        actions={
          <>
            <Link
              href={`/schedule?week=${addDays(weekStart, -7)}${params.crew ? `&crew=${params.crew}` : ''}`}
              className="btn btn-secondary btn-sm"
            >
              ← Previous
            </Link>
            <Link href="/schedule" className="btn btn-secondary btn-sm">
              This week
            </Link>
            <Link
              href={`/schedule?week=${addDays(weekStart, 7)}${params.crew ? `&crew=${params.crew}` : ''}`}
              className="btn btn-secondary btn-sm"
            >
              Next →
            </Link>
          </>
        }
      />

      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        <Link
          href={`/schedule?week=${weekStart}`}
          className={`shrink-0 rounded border px-2.5 py-1.5 text-xs font-semibold ${
            !params.crew
              ? 'border-field-deep bg-field text-white'
              : 'border-line-strong bg-paper-raised text-ink-muted hover:bg-paper-sunken'
          }`}
        >
          All crews
        </Link>
        {crews.map((crew) => (
          <Link
            key={crew.id}
            href={`/schedule?week=${weekStart}&crew=${crew.id}`}
            className={`shrink-0 rounded border px-2.5 py-1.5 text-xs font-semibold ${
              params.crew === crew.id
                ? 'border-field-deep bg-field text-white'
                : 'border-line-strong bg-paper-raised text-ink-muted hover:bg-paper-sunken'
            }`}
          >
            {crew.name}
          </Link>
        ))}
      </div>

      {unscheduled.length ? (
        <div className="card mb-4 border-status-serious/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                {unscheduled.length} accepted job{unscheduled.length === 1 ? '' : 's'} with no date
              </p>
              <p className="text-xs text-ink-muted">
                {unscheduled.map((job) => job.customer_name).join(', ')}
              </p>
            </div>
            <Link href="/jobs?status=unscheduled" className="btn btn-secondary btn-sm">
              Schedule them
            </Link>
          </div>
        </div>
      ) : null}

      {/* Desktop: a real week grid. Mobile: the same jobs as a day-by-day list. */}
      <div className="hidden lg:block">
        <WeekGrid
          days={days}
          workDays={workDays}
          today={today}
          workStart={settings.work_start}
          workEnd={settings.work_end}
          jobs={jobs.map((job) => ({
            id: job.id,
            title: job.title,
            customer: job.customer_name,
            start: job.scheduled_start!,
            durationMin: job.duration_min,
            crewName: job.crew_name,
            crewColor: job.crew_color,
            amount: job.amount,
            status: job.status,
          }))}
        />
      </div>

      <div className="space-y-3 lg:hidden">
        {days.map((day) => {
          const dayJobs = jobs.filter((job) => job.scheduled_start?.slice(0, 10) === day);
          const off = !workDays.includes(dayOfWeek(day));
          if (off && !dayJobs.length) return null;
          return (
            <Card key={day} bodyClassName="">
              <div
                className={`flex items-baseline justify-between border-b border-line px-4 py-2.5 ${
                  day === today ? 'bg-field-light' : ''
                }`}
              >
                <p className="font-display text-sm font-bold uppercase tracking-[0.08em] text-ink">
                  {DAY_SHORT[dayOfWeek(day)]} {formatDateShort(day)}
                  {day === today ? <span className="ml-2 text-field">Today</span> : null}
                </p>
                <p className="text-xs tabular text-ink-faint">
                  {dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}
                </p>
              </div>
              {dayJobs.length === 0 ? (
                <p className="px-4 py-3 text-sm text-ink-faint">Nothing booked.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {dayJobs.map((job) => (
                    <li key={job.id}>
                      <Link href={`/jobs/${job.id}`} className="flex items-start gap-3 px-4 py-3">
                        <span className="w-16 shrink-0 text-sm font-bold tabular text-ink">
                          {formatTime(job.scheduled_start)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {job.customer_name}
                          </span>
                          <span className="block truncate text-xs text-ink-muted">{job.title}</span>
                          <span className="mt-1 block text-2xs text-ink-faint">
                            {job.crew_name ?? 'Unassigned'}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular text-ink">
                          {money(job.amount)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
