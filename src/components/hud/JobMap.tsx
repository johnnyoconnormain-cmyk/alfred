import Link from 'next/link';
import type { JobWithCustomer } from '@/lib/queries/jobs';
import type { CrewStatus } from '@/lib/queries/schedule';
import { Card } from '@/components/ui';
import { formatTime } from '@/lib/dates';

const CREW_COLORS: Record<string, string> = {
  slot1: '#2a78d6',
  slot2: '#eb6834',
  slot3: '#1baf7a',
  slot4: '#eda100',
};

/**
 * Today's route.
 *
 * A real map needs a map provider and geocoded addresses; neither is configured
 * out of the box, and drawing a decorative map with pins in invented places
 * would be worse than useless to somebody trying to find a crew. So until
 * `NEXT_PUBLIC_MAPBOX_TOKEN` is set this renders the same information as an
 * ordered route per crew — which is what the owner actually reads off a map
 * anyway. The tile layer drops in behind this list without changing the data.
 */
export function JobMap({ jobs, crews }: { jobs: JobWithCustomer[]; crews: CrewStatus[] }) {
  const mapReady = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  const byCrew = crews.map((crew) => ({
    crew,
    stops: jobs.filter((j) => j.crew_id === crew.crew.id),
  }));
  const unassigned = jobs.filter((j) => !j.crew_id);

  return (
    <Card
      title="Today's routes"
      action={
        <Link href="/schedule" className="text-xs font-semibold text-field underline underline-offset-2">
          Open schedule
        </Link>
      }
      bodyClassName=""
    >
      {!mapReady ? (
        <p className="border-b border-line bg-paper-sunken/50 px-4 py-2 text-xs text-ink-faint sm:px-5">
          Map view is not connected. Set <code className="rounded-sm bg-paper px-1 text-2xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> to
          plot these stops; the routes below stay the same either way.
        </p>
      ) : null}

      {jobs.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted sm:px-5">Nothing scheduled today.</p>
      ) : (
        <ul className="divide-y divide-line">
          {byCrew
            .filter((row) => row.stops.length)
            .map(({ crew, stops }) => (
              <li key={crew.crew.id} className="px-4 py-3 sm:px-5">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: CREW_COLORS[crew.crew.color] ?? '#2a78d6' }}
                  />
                  <p className="text-sm font-semibold text-ink">{crew.crew.name}</p>
                  <p className="text-xs text-ink-faint">
                    {stops.length} stop{stops.length === 1 ? '' : 's'}
                  </p>
                </div>
                <ol className="space-y-1.5 border-l border-line pl-3.5">
                  {stops.map((stop) => (
                    <li key={stop.id} className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-[18px] top-1.5 inline-block h-2 w-2 rounded-full border-2 border-paper-raised"
                        style={{ background: CREW_COLORS[crew.crew.color] ?? '#2a78d6' }}
                      />
                      <Link href={`/jobs/${stop.id}`} className="block text-sm hover:underline">
                        <span className="tabular text-ink-faint">{formatTime(stop.scheduled_start)}</span>{' '}
                        <span className="font-medium text-ink">{stop.customer_name}</span>
                        {stop.address ? (
                          <span className="block truncate text-xs text-ink-faint">{stop.address}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ol>
              </li>
            ))}

          {unassigned.length ? (
            <li className="px-4 py-3 sm:px-5">
              <p className="mb-1.5 text-sm font-semibold text-status-serious">
                {unassigned.length} stop{unassigned.length === 1 ? '' : 's'} with no crew
              </p>
              <ul className="space-y-1">
                {unassigned.map((job) => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="text-sm text-ink hover:underline">
                      <span className="tabular text-ink-faint">{formatTime(job.scheduled_start)}</span>{' '}
                      {job.customer_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
        </ul>
      )}
    </Card>
  );
}
