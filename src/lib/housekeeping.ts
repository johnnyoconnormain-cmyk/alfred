import 'server-only';
import { mutate, one } from './db';
import type { Business } from './db/types';
import { sweep } from './automations/engine';
import { expireOverdueQuotes } from './queries/quotes';
import { isoNow, todayIn } from './dates';

/**
 * The small amount of work that has to happen "at some point" rather than in
 * response to anything: sending follow-ups that came due while nobody was
 * looking, and expiring quotes that have run out.
 *
 * Deliberately checked before it is run. Both operations write, and on a
 * serverless deployment a write means pushing a snapshot — so doing this
 * unconditionally would upload the database on every page view. Two indexed
 * counts are cheap; an upload is not.
 */
export async function runHousekeeping(business: Business): Promise<void> {
  const due = pendingWork(business);
  if (!due) return;
  await mutate(() => {
    sweep(business);
    expireOverdueQuotes(business.id, business.timezone);
  });
}

function pendingWork(business: Business): boolean {
  const tasks = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM automation_tasks
     WHERE business_id = ? AND status = 'pending' AND run_at <= ?`,
    [business.id, isoNow()],
  );
  if ((tasks?.n ?? 0) > 0) return true;

  const quotes = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM quotes
     WHERE business_id = ? AND status IN ('sent','viewed') AND expires_at < ?`,
    [business.id, todayIn(business.timezone)],
  );
  return (quotes?.n ?? 0) > 0;
}
