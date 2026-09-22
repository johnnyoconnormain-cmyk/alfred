import Link from 'next/link';
import type { AttentionItem } from '@/lib/queries/dashboard';
import { Card } from '@/components/ui';
import { money } from '@/lib/money';

const TONE: Record<AttentionItem['severity'], { dot: string; label: string }> = {
  critical: { dot: 'bg-status-critical', label: 'Urgent' },
  serious: { dot: 'bg-status-serious', label: 'Soon' },
  warning: { dot: 'bg-status-warning', label: 'Watch' },
  good: { dot: 'bg-status-good', label: 'Upside' },
};

/**
 * Needs your attention.
 *
 * Every row is a condition the database is actually in, ordered by what it costs
 * to ignore, and every row carries the one action that clears it. When the list
 * is empty that is a real answer, not a blank panel.
 */
export function AttentionCenter({ items }: { items: AttentionItem[] }) {
  return (
    <Card
      title="Needs your attention"
      action={
        items.length ? (
          <span className="badge badge-neutral">{items.length}</span>
        ) : null
      }
      bodyClassName=""
    >
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted sm:px-5">
          Nothing is waiting on you. Quotes are followed up, jobs are assigned and invoices are
          current.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const tone = TONE[item.severity];
            return (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-ink">{item.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{item.detail}</p>
                  {item.amount ? (
                    <p className="mt-1 text-sm font-semibold tabular text-ink">
                      {money(item.amount)}
                      <span className="ml-1.5 text-xs font-normal text-ink-faint">
                        {item.severity === 'critical' ? 'potential revenue' : 'at stake'}
                      </span>
                    </p>
                  ) : null}
                </div>
                <Link href={item.href} className="btn btn-secondary btn-sm shrink-0">
                  {item.actionLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
