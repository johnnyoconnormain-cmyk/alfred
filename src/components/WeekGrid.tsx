import Link from 'next/link';
import { DAY_NAMES, dayOfWeek, formatDateShort, formatTime, minutesOfDay } from '@/lib/dates';
import { money } from '@/lib/money';

export interface GridJob {
  id: string;
  title: string;
  customer: string;
  start: string;
  durationMin: number;
  crewName: string | null;
  crewColor: string | null;
  amount: number;
  status: string;
}

const CREW_COLORS: Record<string, string> = {
  slot1: '#2a78d6',
  slot2: '#eb6834',
  slot3: '#1baf7a',
  slot4: '#eda100',
};

/**
 * Week grid.
 *
 * Time runs down, days run across, and each block is positioned by its real
 * start and duration so overruns and gaps are visible at a glance. Non-working
 * days are shaded rather than hidden — a Saturday job still needs to show up.
 */
export function WeekGrid({
  days,
  workDays,
  today,
  workStart,
  workEnd,
  jobs,
}: {
  days: string[];
  workDays: number[];
  today: string;
  workStart: string;
  workEnd: string;
  jobs: GridJob[];
}) {
  const startMin = Math.min(minutesOfDay(workStart), ...jobs.map((j) => minutesOfDay(j.start)));
  const endMin = Math.max(
    minutesOfDay(workEnd),
    ...jobs.map((j) => minutesOfDay(j.start) + j.durationMin),
  );
  const from = Math.floor(startMin / 60) * 60;
  const to = Math.ceil(endMin / 60) * 60;
  const hours = Array.from({ length: Math.max(1, (to - from) / 60) }, (_, i) => from + i * 60);
  const pxPerMin = 1.05;
  const height = (to - from) * pxPerMin;

  return (
    <div className="card overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="border-b border-r border-line bg-paper-sunken/40" />
        {days.map((day) => {
          const isToday = day === today;
          const off = !workDays.includes(dayOfWeek(day));
          return (
            <div
              key={day}
              className={`border-b border-r border-line px-2 py-2 text-center last:border-r-0 ${
                isToday ? 'bg-field-light' : off ? 'bg-paper-sunken/40' : ''
              }`}
            >
              <p className={`text-2xs font-semibold uppercase tracking-[0.08em] ${isToday ? 'text-field-deep' : 'text-ink-faint'}`}>
                {DAY_NAMES[dayOfWeek(day)].slice(0, 3)}
              </p>
              <p className={`text-sm font-bold tabular ${isToday ? 'text-field-deep' : 'text-ink'}`}>
                {formatDateShort(day).split(' ')[1]}
              </p>
            </div>
          );
        })}

        <div className="relative border-r border-line bg-paper-sunken/40" style={{ height }}>
          {hours.map((minute) => (
            <div
              key={minute}
              className="absolute right-1.5 -translate-y-1/2 text-2xs tabular text-ink-faint"
              style={{ top: (minute - from) * pxPerMin }}
            >
              {formatTime(`${String(Math.floor(minute / 60)).padStart(2, '0')}:00`).replace(':00', '')}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const off = !workDays.includes(dayOfWeek(day));
          const dayJobs = jobs.filter((job) => job.start.slice(0, 10) === day);
          return (
            <div
              key={day}
              className={`relative border-r border-line last:border-r-0 ${
                off ? 'bg-paper-sunken/40' : day === today ? 'bg-field-light/30' : ''
              }`}
              style={{ height }}
            >
              {hours.map((minute) => (
                <div
                  key={minute}
                  className="absolute inset-x-0 border-t border-line"
                  style={{ top: (minute - from) * pxPerMin }}
                />
              ))}

              {dayJobs.map((job) => {
                const top = (minutesOfDay(job.start) - from) * pxPerMin;
                const blockHeight = Math.max(30, job.durationMin * pxPerMin - 2);
                const color = CREW_COLORS[job.crewColor ?? ''] ?? '#5f6259';
                const settled = job.status === 'complete' || job.status === 'paid';
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="absolute inset-x-1 overflow-hidden rounded-sm border-l-[3px] bg-paper-raised px-1.5 py-1 shadow-card transition-shadow hover:shadow-raised"
                    style={{ top, height: blockHeight, borderLeftColor: color, opacity: settled ? 0.72 : 1 }}
                  >
                    <p className="truncate text-2xs font-bold tabular text-ink">{formatTime(job.start)}</p>
                    <p className="truncate text-xs font-semibold leading-tight text-ink">{job.customer}</p>
                    {blockHeight > 56 ? (
                      <p className="truncate text-2xs leading-tight text-ink-faint">{job.title}</p>
                    ) : null}
                    {blockHeight > 80 ? (
                      <p className="mt-0.5 truncate text-2xs tabular text-ink-muted">
                        {job.crewName ?? 'Unassigned'} · {money(job.amount)}
                      </p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
