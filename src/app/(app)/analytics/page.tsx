import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { buildAnalytics, RANGES, type Range } from '@/lib/queries/analytics';
import { Card, PageHeader, StatTile } from '@/components/ui';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { ServiceBars } from '@/components/charts/ServiceBars';
import { formatDate } from '@/lib/dates';
import { money } from '@/lib/money';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { business } = await requireOwner();
  const params = await searchParams;
  const range = (RANGES.some((r) => r.key === params.range) ? params.range : '30d') as Range;
  const data = buildAnalytics(business.id, business.timezone, range);

  const delta =
    data.revenuePrior > 0
      ? Math.round(((data.revenue - data.revenuePrior) / data.revenuePrior) * 100)
      : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="How the business is doing"
        title="Analytics"
        description={`${formatDate(data.from, { weekday: false })} – ${formatDate(data.to, {
          weekday: false,
        })}`}
        actions={
          <div className="flex gap-1">
            {RANGES.map((option) => (
              <Link
                key={option.key}
                href={`/analytics?range=${option.key}`}
                className={`rounded border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  range === option.key
                    ? 'border-field-deep bg-field text-white'
                    : 'border-line-strong bg-paper-raised text-ink-muted hover:bg-paper-sunken'
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatTile
          label="Revenue collected"
          value={money(data.revenue)}
          delta={delta}
          deltaLabel="vs previous period"
          detail={`Previous: ${money(data.revenuePrior)}`}
        />
        <StatTile label="New leads" value={String(data.newLeads)} detail="Requests received" />
        <StatTile label="Quotes sent" value={String(data.quotesSent)} detail="Priced and issued" />
        <StatTile label="Jobs booked" value={String(data.jobsBooked)} detail="Quotes accepted" />
        <StatTile
          label="Conversion rate"
          value={`${data.conversionRate}%`}
          detail="Accepted ÷ sent"
        />
        <StatTile label="Average job" value={money(data.averageJob)} detail="Completed work" />
        <StatTile label="Jobs completed" value={String(data.jobsCompleted)} detail="Finished on site" />
        <StatTile
          label="Outstanding"
          value={money(data.outstanding)}
          detail="Invoiced, not yet paid"
          href="/payments?status=outstanding"
          upIsGood={false}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Revenue collected" className="lg:col-span-2">
          <RevenueChart points={data.series} height={260} />
        </Card>

        <Card title="Revenue by service">
          <ServiceBars rows={data.byService} />
        </Card>

        <Card title="Where leads come from" bodyClassName="">
          {data.bySource.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">No leads in this range.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table min-w-0">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th className="text-right">Leads</th>
                    <th className="text-right">Won</th>
                    <th className="text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bySource.map((row) => (
                    <tr key={row.source}>
                      <td className="capitalize text-ink">{row.source}</td>
                      <td className="text-right tabular text-ink-muted">{row.leads}</td>
                      <td className="text-right tabular text-ink-muted">{row.won}</td>
                      <td className="text-right tabular font-semibold text-ink">
                        {row.leads ? Math.round((row.won / row.leads) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Top customers" className="lg:col-span-2" bodyClassName="">
          {data.topCustomers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">No payments in this range.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table min-w-0">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="text-right">Jobs</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCustomers.map((row) => (
                    <tr key={row.id} className="row-link">
                      <td>
                        <Link href={`/customers/${row.id}`} className="block text-ink">
                          {row.name}
                        </Link>
                      </td>
                      <td className="text-right tabular text-ink-muted">{row.jobs}</td>
                      <td className="text-right tabular font-semibold text-ink">{money(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
