import type { Activity } from '@/lib/db/types';
import { Card } from '@/components/ui';
import { relativeTime } from '@/lib/dates';
import { money } from '@/lib/money';

const TONE: Record<string, string> = {
  'payment.received': 'bg-status-good',
  'quote.accepted': 'bg-status-good',
  'review.received': 'bg-status-good',
  'quote.declined': 'bg-ink-faint',
  'lead.created': 'bg-series-1',
  'quote.sent': 'bg-series-1',
  'invoice.sent': 'bg-series-1',
  'job.complete': 'bg-status-good',
  'automation.follow_up': 'bg-status-warning',
  'automation.review_request': 'bg-status-warning',
  'automation.error': 'bg-status-critical',
};

export function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <Card title="Recent activity" bodyClassName="">
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted sm:px-5">
          Activity appears here as leads arrive and work moves.
        </p>
      ) : (
        <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
              <span
                aria-hidden
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE[item.kind] ?? 'bg-line-strong'}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-ink">{item.title}</p>
                {item.detail ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-faint">{item.detail}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                {item.amount ? (
                  <p className="text-xs font-semibold tabular text-ink">{money(item.amount)}</p>
                ) : null}
                <p className="text-2xs text-ink-faint">{relativeTime(item.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
