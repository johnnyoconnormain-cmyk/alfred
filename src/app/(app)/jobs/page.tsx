import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { listJobs } from '@/lib/queries/jobs';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import { formatDate, formatTime } from '@/lib/dates';
import { money } from '@/lib/money';
import type { JobStatus } from '@/lib/db/types';

export const metadata = { title: 'Jobs' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'unscheduled', label: 'Needs a date' },
  { key: 'scheduled', label: 'Booked' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'complete', label: 'Complete' },
  { key: 'paid', label: 'Paid' },
  { key: 'all', label: 'All' },
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { business } = await requireOwner();
  const params = await searchParams;
  const status = (params.status ?? 'active') as JobStatus | 'active' | 'all';
  const jobs = listJobs(business.id, { status });
  const value = jobs.reduce((sum, job) => sum + job.amount, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Work on the books"
        title="Jobs"
        description={`${jobs.length} job${jobs.length === 1 ? '' : 's'} · ${money(value)}`}
        actions={
          <Link href="/jobs/new" className="btn btn-primary btn-sm">
            New job
          </Link>
        }
      />

      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {FILTERS.map((filter) => {
          const active = (params.status ?? 'active') === filter.key;
          return (
            <Link
              key={filter.key}
              href={`/jobs?status=${filter.key}`}
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

      <div className="card overflow-hidden">
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs here"
            description="Jobs are created automatically when a customer accepts a quote."
            action={
              <Link href="/quotes" className="btn btn-secondary btn-sm">
                Go to quotes
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Customer</th>
                  <th>When</th>
                  <th>Crew</th>
                  <th>Status</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="row-link">
                    <td>
                      <Link href={`/jobs/${job.id}`} className="block">
                        <span className="font-semibold text-ink">#{job.number}</span>
                        <span className="mt-0.5 block max-w-xs truncate text-xs text-ink-faint">{job.title}</span>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/jobs/${job.id}`} className="block text-ink">
                        {job.customer_name}
                      </Link>
                    </td>
                    <td className="text-sm">
                      <Link href={`/jobs/${job.id}`} className="block">
                        {job.scheduled_start ? (
                          <>
                            <span className="text-ink">
                              {formatDate(job.scheduled_start.slice(0, 10), { weekday: false })}
                            </span>
                            <span className="mt-0.5 block text-2xs tabular text-ink-faint">
                              {formatTime(job.scheduled_start)}
                            </span>
                          </>
                        ) : (
                          <span className="text-status-serious">Not scheduled</span>
                        )}
                      </Link>
                    </td>
                    <td className="text-sm text-ink-muted">
                      <Link href={`/jobs/${job.id}`} className="block">
                        {job.crew_name ?? <span className="text-status-serious">Unassigned</span>}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/jobs/${job.id}`} className="block">
                        <StatusBadge status={job.status} />
                      </Link>
                    </td>
                    <td className="text-right">
                      <Link href={`/jobs/${job.id}`} className="block font-semibold tabular text-ink">
                        {money(job.amount)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
