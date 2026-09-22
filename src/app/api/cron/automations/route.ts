import { NextResponse, type NextRequest } from 'next/server';
import { all } from '@/lib/db';
import type { Business } from '@/lib/db/types';
import { sweep } from '@/lib/automations/engine';
import { expireOverdueQuotes } from '@/lib/queries/quotes';
import { purgeExpiredSessions } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Drains every tenant's automation queue.
 *
 * Optional: the queue is also drained whenever somebody opens the app, so a
 * single-operator business never needs this. Point a scheduler here when
 * follow-ups should go out on time even on days nobody signs in. Protect it with
 * `CRON_SECRET` if the deployment is publicly reachable.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get('authorization');
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  const businesses = all<Business>('SELECT * FROM businesses');
  let ran = 0;
  let cancelled = 0;
  let expired = 0;

  for (const business of businesses) {
    const result = sweep(business);
    ran += result.ran;
    cancelled += result.cancelled;
    expired += expireOverdueQuotes(business.id, business.timezone);
  }
  purgeExpiredSessions();

  return NextResponse.json({ businesses: businesses.length, ran, cancelled, expired });
}
