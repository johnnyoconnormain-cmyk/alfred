import Link from 'next/link';
import type { PulseMetric } from '@/lib/queries/dashboard';
import { money, moneyCompact } from '@/lib/money';

function render(metric: PulseMetric): string {
  if (metric.value === null) return '—';
  if (metric.format === 'money') {
    return metric.value >= 1_000_000 ? moneyCompact(metric.value) : money(metric.value);
  }
  if (metric.format === 'percent') return `${metric.value}%`;
  return metric.value.toLocaleString('en-US');
}

/**
 * Business pulse.
 *
 * Five numbers that answer "is today going well". Each one is a link into the
 * records behind it — the panel exists to start work, not to be admired.
 */
export function Pulse({ metrics }: { metrics: PulseMetric[] }) {
  return (
    <section aria-label="Business pulse">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
        {metrics.map((metric, i) => (
          <Link
            key={metric.key}
            href={metric.href}
            className={`card group block px-3.5 py-3 transition-shadow duration-150 hover:shadow-raised sm:px-4 sm:py-4 ${
              i === 0 ? 'col-span-2 lg:col-span-1' : ''
            }`}
          >
            <p className="eyebrow leading-tight">{metric.label}</p>
            <p className={`mt-1.5 font-display font-bold tracking-[-0.025em] text-ink ${i === 0 ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>
              {render(metric)}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              {metric.delta != null ? (
                <span
                  className={`text-xs font-semibold tabular ${
                    metric.delta >= 0 ? 'text-status-good' : 'text-status-serious'
                  }`}
                >
                  {metric.delta >= 0 ? '↑' : '↓'} {Math.abs(metric.delta)}%
                </span>
              ) : null}
              <span className="truncate text-xs text-ink-faint">
                {metric.delta != null && metric.deltaLabel ? metric.deltaLabel : metric.detail}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
