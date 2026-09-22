import Link from 'next/link';
import type { Insight, Opportunity } from '@/lib/queries/dashboard';
import { Card } from '@/components/ui';
import { money } from '@/lib/money';

/** Money that exists but has not landed yet, with the action that lands it. */
export function Opportunities({ items }: { items: Opportunity[] }) {
  return (
    <Card title="Revenue opportunities" bodyClassName="">
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted sm:px-5">
          Nothing outstanding — every quote is answered and every invoice is settled.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.key} className="px-4 py-3.5 sm:px-5">
              <p className="font-display text-2xl font-bold tabular tracking-[-0.02em] text-ink">
                {money(item.amount)}
              </p>
              <p className="mt-0.5 text-sm text-ink">{item.label}</p>
              <p className="mt-0.5 text-xs text-ink-faint">{item.detail}</p>
              <Link href={item.href} className="btn btn-secondary btn-sm mt-2.5">
                {item.actionLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Business insights.
 *
 * Each line is the output of a query with a threshold behind it. When the data
 * is too thin to say anything true, the panel says that instead of filling the
 * space — an invented trend is worse than an empty card.
 */
export function Insights({ items }: { items: Insight[] }) {
  return (
    <Card title="Business insights" bodyClassName="">
      {items.length === 0 ? (
        <p className="px-4 py-8 text-sm text-ink-muted sm:px-5">
          Not enough history yet to say anything useful. Insights appear once there are a few
          months of completed work to compare.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((insight) => (
            <li key={insight.text} className="px-4 py-3 text-sm leading-snug text-ink sm:px-5">
              {insight.text}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
