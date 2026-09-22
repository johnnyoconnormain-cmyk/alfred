import { money } from '@/lib/money';
import { serviceLabel } from '@/lib/ai/classify';

const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];

export interface ServiceRow {
  service_type: string;
  revenue: number;
  jobs: number;
}

/**
 * Revenue by service line.
 *
 * Horizontal bars because the categories are named things, not a time series.
 * Every bar carries its value as a direct label — which is also what discharges
 * the contrast relief the palette's lighter hues require.
 */
export function ServiceBars({ rows }: { rows: ServiceRow[] }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-ink-faint">No completed jobs in this range.</p>;
  }
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  const total = rows.reduce((sum, r) => sum + r.revenue, 0);

  return (
    <ul className="space-y-3">
      {rows.map((row, i) => (
        <li key={row.service_type}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: SERIES[i % SERIES.length] }}
              />
              <span className="truncate">{serviceLabel(row.service_type)}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular text-ink">
              {money(row.revenue)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 rounded-sm bg-paper-sunken">
              <div
                className="h-2.5 rounded-r-[4px]"
                style={{
                  width: `${Math.max(2, (row.revenue / max) * 100)}%`,
                  background: SERIES[i % SERIES.length],
                }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs tabular text-ink-faint">
              {row.jobs} job{row.jobs === 1 ? '' : 's'} · {Math.round((row.revenue / total) * 100)}%
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
