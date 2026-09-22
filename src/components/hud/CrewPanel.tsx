import Link from 'next/link';
import type { CrewStatus } from '@/lib/queries/schedule';
import { Card } from '@/components/ui';
import { formatTime } from '@/lib/dates';
import { money } from '@/lib/money';

const STATE: Record<CrewStatus['state'], { label: string; dot: string; text: string }> = {
  working: { label: 'Working', dot: 'bg-status-good', text: 'text-status-good' },
  traveling: { label: 'Traveling', dot: 'bg-status-warning', text: 'text-status-warning' },
  available: { label: 'Available', dot: 'bg-ink-faint', text: 'text-ink-faint' },
  done: { label: 'Day complete', dot: 'bg-ink-faint', text: 'text-ink-faint' },
};

/**
 * Crew status, derived from today's schedule against the clock. Nobody has to
 * remember to punch a status for this panel to be right.
 */
export function CrewPanel({ crews }: { crews: CrewStatus[] }) {
  if (!crews.length) {
    return (
      <Card title="Crews">
        <p className="text-sm text-ink-muted">No crews set up yet.</p>
        <Link href="/settings" className="btn btn-secondary btn-sm mt-3">
          Add a crew
        </Link>
      </Card>
    );
  }

  return (
    <Card title="Crews" bodyClassName="">
      <ul className="divide-y divide-line">
        {crews.map(({ crew, state, current, next, jobsToday, revenueToday }) => {
          const tone = STATE[state];
          return (
            <li key={crew.id}>
              <Link
                href={`/schedule?crew=${crew.id}`}
                className="block px-4 py-3 transition-colors hover:bg-paper-sunken/60 sm:px-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{crew.name}</p>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${tone.text}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                </div>

                {current ? (
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {current.customer} · {formatTime(current.start)}–{formatTime(current.end)}
                  </p>
                ) : next ? (
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    Next: {next.customer} at {formatTime(next.start)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-ink-faint">Nothing scheduled today</p>
                )}

                <p className="mt-1 text-2xs tabular text-ink-faint">
                  {jobsToday} job{jobsToday === 1 ? '' : 's'} today · {money(revenueToday)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
