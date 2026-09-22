import 'server-only';
import { all, one } from '../db';
import type { Business, Settings } from '../db/types';
import { addDays, startOfWeek, todayIn } from '../dates';
import { crewStatuses, type CrewStatus } from './schedule';
import { type JobWithCustomer, jobsOnDate } from './jobs';
import { nowIn } from '../dates';

export interface PulseMetric {
  key: string;
  label: string;
  /** null means "not enough data to answer" — rendered as a dash, never as zero. */
  value: number | null;
  format: 'money' | 'count' | 'percent';
  delta: number | null;       // percentage change vs the previous period
  deltaLabel: string | null;
  href: string;
  detail: string;
}

export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  value: number;
  urgent: number;
  href: string;
}

export interface AttentionItem {
  id: string;
  severity: 'critical' | 'serious' | 'warning' | 'good';
  title: string;
  detail: string;
  amount: number | null;
  actionLabel: string;
  href: string;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  jobs: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  href: string;
}

export interface Insight {
  text: string;
  emphasis: string | null;
}

export interface Opportunity {
  key: string;
  amount: number;
  label: string;
  detail: string;
  actionLabel: string;
  href: string;
}

export interface Hud {
  today: string;
  nowWall: string;
  pulse: PulseMetric[];
  pipeline: PipelineStage[];
  todaysJobs: JobWithCustomer[];
  attention: AttentionItem[];
  revenue: RevenuePoint[];
  funnel: FunnelStage[];
  crews: CrewStatus[];
  insights: Insight[];
  opportunities: Opportunity[];
  unscheduledCount: number;
}

function sum(rows: { v: number | null }[]): number {
  return rows.reduce((acc, r) => acc + (r.v ?? 0), 0);
}

function scalar(sql: string, params: unknown[]): number {
  return one<{ v: number | null }>(sql, params)?.v ?? 0;
}

function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Revenue actually collected in a date window (payments, not invoices). */
function collected(businessId: string, from: string, to: string): number {
  return scalar(
    `SELECT SUM(amount) AS v FROM payments
     WHERE business_id = ? AND substr(created_at, 1, 10) BETWEEN ? AND ? AND status = 'succeeded'`,
    [businessId, from, to],
  );
}

export function buildHud(business: Business, settings: Settings): Hud {
  const bid = business.id;
  const tz = business.timezone;
  const today = todayIn(tz);
  const nowWall = nowIn(tz);
  const weekStart = startOfWeek(today);
  const prevWeekStart = addDays(weekStart, -7);
  const monthStart = `${today.slice(0, 7)}-01`;

  /* ------------------------------- business pulse ------------------------------ */

  const revenueWeek = collected(bid, weekStart, today);
  const revenuePrevWeek = collected(bid, prevWeekStart, addDays(weekStart, -1));

  const activeJobs = scalar(
    `SELECT COUNT(*) AS v FROM jobs WHERE business_id = ? AND status IN ('unscheduled','scheduled','in_progress')`,
    [bid],
  );
  const newLeads = scalar(
    `SELECT COUNT(*) AS v FROM leads WHERE business_id = ? AND status IN ('new','qualified')`,
    [bid],
  );
  const openQuotes = one<{ n: number; v: number | null }>(
    `SELECT COUNT(*) AS n, SUM(total) AS v FROM quotes WHERE business_id = ? AND status IN ('sent','viewed')`,
    [bid],
  );

  const onTime = one<{ done: number; ontime: number }>(
    `SELECT COUNT(*) AS done,
            SUM(CASE WHEN substr(completed_at, 1, 10) <= substr(coalesce(scheduled_end, completed_at), 1, 10)
                     THEN 1 ELSE 0 END) AS ontime
     FROM jobs
     WHERE business_id = ? AND completed_at IS NOT NULL AND substr(completed_at, 1, 10) >= ?`,
    [bid, addDays(today, -60)],
  );
  // With no completed jobs there is no on-time rate. Showing 0% would read as a
  // failing business rather than a new one.
  const onTimePct = onTime && onTime.done ? Math.round((onTime.ontime / onTime.done) * 100) : null;

  const pulse: PulseMetric[] = [
    {
      key: 'revenue',
      label: 'Revenue this week',
      value: revenueWeek,
      format: 'money',
      delta: change(revenueWeek, revenuePrevWeek),
      deltaLabel: 'vs last week',
      href: '/analytics',
      detail: 'Since Sunday',
    },
    {
      key: 'jobs',
      label: 'Active jobs',
      value: activeJobs,
      format: 'count',
      delta: null,
      deltaLabel: null,
      href: '/jobs',
      detail: 'Booked, unscheduled or in progress',
    },
    {
      key: 'leads',
      label: 'Open leads',
      value: newLeads,
      format: 'count',
      delta: null,
      deltaLabel: null,
      href: '/leads',
      detail: 'Not yet quoted',
    },
    {
      key: 'quotes',
      label: 'Quotes awaiting reply',
      value: openQuotes?.n ?? 0,
      format: 'count',
      delta: null,
      deltaLabel: null,
      href: '/quotes?status=open',
      detail: `${((openQuotes?.v ?? 0) / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      })} in play`,
    },
    {
      key: 'ontime',
      label: 'Jobs completed on time',
      value: onTimePct,
      format: 'percent',
      delta: null,
      deltaLabel: null,
      href: '/jobs?status=complete',
      detail: onTime?.done ? `Last 60 days · ${onTime.done} jobs` : 'No completed jobs yet',
    },
  ];

  /* --------------------------------- pipeline --------------------------------- */

  const leadRow = one<{ n: number; urgent: number }>(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN urgency = 'high' THEN 1 ELSE 0 END) AS urgent
     FROM leads WHERE business_id = ? AND status IN ('new','qualified')`,
    [bid],
  );
  const quotedRow = one<{ n: number; v: number | null; urgent: number }>(
    `SELECT COUNT(*) AS n, SUM(total) AS v,
            SUM(CASE WHEN sent_at <= ? THEN 1 ELSE 0 END) AS urgent
     FROM quotes WHERE business_id = ? AND status IN ('sent','viewed')`,
    [`${addDays(today, -3)}T23:59`, bid],
  );
  const bookedRow = one<{ n: number; v: number | null; urgent: number }>(
    `SELECT COUNT(*) AS n, SUM(amount) AS v,
            SUM(CASE WHEN crew_id IS NULL THEN 1 ELSE 0 END) AS urgent
     FROM jobs WHERE business_id = ? AND status IN ('unscheduled','scheduled')`,
    [bid],
  );
  const todayRow = one<{ n: number; v: number | null }>(
    `SELECT COUNT(*) AS n, SUM(amount) AS v FROM jobs
     WHERE business_id = ? AND substr(scheduled_start, 1, 10) = ? AND status != 'cancelled'`,
    [bid, today],
  );
  const completeRow = one<{ n: number; v: number | null }>(
    `SELECT COUNT(*) AS n, SUM(amount) AS v FROM jobs
     WHERE business_id = ? AND status = 'complete'`,
    [bid],
  );
  const paidRow = one<{ n: number; v: number | null }>(
    `SELECT COUNT(*) AS n, SUM(amount) AS v FROM payments
     WHERE business_id = ? AND substr(created_at, 1, 10) >= ?`,
    [bid, weekStart],
  );

  const pipeline: PipelineStage[] = [
    { key: 'leads', label: 'Leads', count: leadRow?.n ?? 0, value: 0, urgent: leadRow?.urgent ?? 0, href: '/leads' },
    { key: 'quoted', label: 'Quoted', count: quotedRow?.n ?? 0, value: quotedRow?.v ?? 0, urgent: quotedRow?.urgent ?? 0, href: '/quotes?status=open' },
    { key: 'booked', label: 'Booked', count: bookedRow?.n ?? 0, value: bookedRow?.v ?? 0, urgent: bookedRow?.urgent ?? 0, href: '/jobs?status=active' },
    { key: 'today', label: 'Today', count: todayRow?.n ?? 0, value: todayRow?.v ?? 0, urgent: 0, href: '/schedule' },
    { key: 'complete', label: 'Complete', count: completeRow?.n ?? 0, value: completeRow?.v ?? 0, urgent: 0, href: '/jobs?status=complete' },
    { key: 'paid', label: 'Paid this week', count: paidRow?.n ?? 0, value: paidRow?.v ?? 0, urgent: 0, href: '/payments' },
  ];

  /* ----------------------------- attention centre ----------------------------- */

  const attention: AttentionItem[] = [];

  const staleQuoteRow = one<{ n: number; v: number | null }>(
    `SELECT COUNT(*) AS n, SUM(total) AS v FROM quotes
     WHERE business_id = ? AND status IN ('sent','viewed') AND sent_at <= ?`,
    [bid, `${addDays(today, -2)}T23:59`],
  );
  if ((staleQuoteRow?.n ?? 0) > 0) {
    attention.push({
      id: 'stale-quotes',
      severity: 'critical',
      title: `${staleQuoteRow!.n} quote${staleQuoteRow!.n === 1 ? '' : 's'} still unanswered`,
      detail: 'Sent more than two days ago. Follow-ups are queued, but a call closes more of these.',
      amount: staleQuoteRow!.v ?? 0,
      actionLabel: 'Follow up',
      href: '/quotes?status=open',
    });
  }

  const unassigned = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM jobs
     WHERE business_id = ? AND crew_id IS NULL AND status IN ('scheduled','unscheduled')
       AND coalesce(substr(scheduled_start, 1, 10), ?) <= ?`,
    [bid, today, addDays(today, 2)],
  );
  if ((unassigned?.n ?? 0) > 0) {
    attention.push({
      id: 'unassigned',
      severity: 'serious',
      title: `${unassigned!.n} job${unassigned!.n === 1 ? '' : 's'} without a crew`,
      detail: 'Starting within the next two days.',
      amount: null,
      actionLabel: 'Assign crew',
      href: '/jobs?status=active',
    });
  }

  const unscheduled = scalar(
    `SELECT COUNT(*) AS v FROM jobs WHERE business_id = ? AND status = 'unscheduled'`,
    [bid],
  );
  if (unscheduled > 0) {
    attention.push({
      id: 'unscheduled',
      severity: 'serious',
      title: `${unscheduled} accepted job${unscheduled === 1 ? '' : 's'} not on the calendar`,
      detail: 'The customer has said yes and is waiting on a date.',
      amount: null,
      actionLabel: 'Schedule',
      href: '/jobs?status=unscheduled',
    });
  }

  const outstanding = one<{ n: number; v: number | null }>(
    `SELECT COUNT(*) AS n, SUM(amount - amount_paid) AS v FROM invoices
     WHERE business_id = ? AND status = 'sent'`,
    [bid],
  );
  if ((outstanding?.n ?? 0) > 0) {
    attention.push({
      id: 'outstanding',
      severity: 'warning',
      title: `${outstanding!.n} invoice${outstanding!.n === 1 ? '' : 's'} outstanding`,
      detail: 'Sent and not yet paid.',
      amount: outstanding!.v ?? 0,
      actionLabel: 'Send reminder',
      href: '/payments',
    });
  }

  const reviewReady = scalar(
    `SELECT COUNT(*) AS v FROM jobs j
     WHERE j.business_id = ? AND j.status = 'paid'
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id)
       AND substr(j.completed_at, 1, 10) >= ?`,
    [bid, addDays(today, -30)],
  );
  if (reviewReady > 0) {
    attention.push({
      id: 'reviews',
      severity: 'good',
      title: `${reviewReady} customer${reviewReady === 1 ? '' : 's'} ready for a review request`,
      detail: 'Paid in the last 30 days with no review yet.',
      amount: null,
      actionLabel: 'Request reviews',
      href: '/reviews',
    });
  }

  /* ------------------------------ revenue series ------------------------------ */

  const revenue = revenueSeries(bid, addDays(today, -29), today);

  /* --------------------------------- funnel ---------------------------------- */

  const funnel: FunnelStage[] = [
    {
      key: 'leads',
      label: 'Leads',
      count: scalar(`SELECT COUNT(*) AS v FROM leads WHERE business_id = ? AND created_at >= ?`, [bid, monthStart]),
      href: '/leads?status=all',
    },
    {
      key: 'qualified',
      label: 'Qualified',
      count: scalar(
        `SELECT COUNT(*) AS v FROM leads WHERE business_id = ? AND created_at >= ? AND status != 'new'`,
        [bid, monthStart],
      ),
      href: '/leads?status=qualified',
    },
    {
      key: 'quoted',
      label: 'Quoted',
      count: scalar(`SELECT COUNT(*) AS v FROM quotes WHERE business_id = ? AND sent_at >= ?`, [bid, monthStart]),
      href: '/quotes',
    },
    {
      key: 'accepted',
      label: 'Accepted',
      count: scalar(`SELECT COUNT(*) AS v FROM quotes WHERE business_id = ? AND accepted_at >= ?`, [bid, monthStart]),
      href: '/quotes?status=accepted',
    },
    {
      key: 'completed',
      label: 'Completed',
      count: scalar(
        `SELECT COUNT(*) AS v FROM jobs WHERE business_id = ? AND completed_at >= ?`,
        [bid, monthStart],
      ),
      href: '/jobs?status=complete',
    },
    {
      key: 'paid',
      label: 'Paid',
      count: scalar(
        `SELECT COUNT(*) AS v FROM invoices WHERE business_id = ? AND paid_at >= ?`,
        [bid, monthStart],
      ),
      href: '/payments',
    },
  ];

  /* ------------------------------- opportunities ------------------------------ */

  const opportunities: Opportunity[] = [];
  if ((openQuotes?.v ?? 0) > 0) {
    opportunities.push({
      key: 'open-quotes',
      amount: openQuotes!.v ?? 0,
      label: 'Sitting in open quotes',
      detail: `${openQuotes!.n} customer${openQuotes!.n === 1 ? '' : 's'} yet to answer`,
      actionLabel: 'View quotes',
      href: '/quotes?status=open',
    });
  }
  if ((outstanding?.v ?? 0) > 0) {
    opportunities.push({
      key: 'outstanding',
      amount: outstanding!.v ?? 0,
      label: 'Outstanding invoices',
      detail: `${outstanding!.n} customer${outstanding!.n === 1 ? '' : 's'}`,
      actionLabel: 'Collect payments',
      href: '/payments',
    });
  }
  const repeat = one<{ n: number; v: number | null }>(
    `SELECT COUNT(*) AS n, SUM(avg_amount) AS v FROM (
       SELECT c.id, AVG(j.amount) AS avg_amount
       FROM customers c JOIN jobs j ON j.customer_id = c.id
       WHERE c.business_id = ? AND j.status = 'paid'
       GROUP BY c.id
       HAVING MAX(substr(j.completed_at, 1, 10)) < ?
     )`,
    [bid, addDays(today, -60)],
  );
  if ((repeat?.n ?? 0) > 0) {
    opportunities.push({
      key: 'repeat',
      amount: Math.round(repeat!.v ?? 0),
      label: 'Dormant customers worth re-contacting',
      detail: `${repeat!.n} customers with no job in 60 days, valued at their average ticket`,
      actionLabel: 'View customers',
      href: '/customers',
    });
  }

  return {
    today,
    nowWall,
    pulse,
    pipeline,
    todaysJobs: jobsOnDate(bid, today),
    attention,
    revenue,
    funnel,
    crews: crewStatuses(bid, tz, nowWall),
    insights: buildInsights(bid, today),
    opportunities,
    unscheduledCount: unscheduled,
  };
}

/** Daily collected revenue and completed-job counts across a window. */
export function revenueSeries(businessId: string, from: string, to: string): RevenuePoint[] {
  const payments = all<{ d: string; v: number }>(
    `SELECT substr(created_at, 1, 10) AS d, SUM(amount) AS v FROM payments
     WHERE business_id = ? AND substr(created_at, 1, 10) BETWEEN ? AND ?
     GROUP BY d`,
    [businessId, from, to],
  );
  const jobs = all<{ d: string; n: number }>(
    `SELECT substr(completed_at, 1, 10) AS d, COUNT(*) AS n FROM jobs
     WHERE business_id = ? AND completed_at IS NOT NULL AND substr(completed_at, 1, 10) BETWEEN ? AND ?
     GROUP BY d`,
    [businessId, from, to],
  );
  const revMap = new Map(payments.map((p) => [p.d, p.v]));
  const jobMap = new Map(jobs.map((j) => [j.d, j.n]));

  const out: RevenuePoint[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard++ < 400) {
    out.push({ date: cursor, revenue: revMap.get(cursor) ?? 0, jobs: jobMap.get(cursor) ?? 0 });
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * Insights are derived, never invented. Each one is a query with a threshold; if
 * the data does not clear the threshold the insight is simply not shown. There is
 * no language model in this path and no generated prose.
 */
export function buildInsights(businessId: string, today: string): Insight[] {
  const out: Insight[] = [];
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = addDays(monthStart, -1);
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`;

  // Fastest-growing service line, month over month.
  const services = all<{ service_type: string; current: number; previous: number }>(
    `SELECT service_type,
            SUM(CASE WHEN substr(completed_at,1,10) >= ? THEN amount ELSE 0 END) AS current,
            SUM(CASE WHEN substr(completed_at,1,10) BETWEEN ? AND ? THEN amount ELSE 0 END) AS previous
     FROM jobs WHERE business_id = ? AND completed_at IS NOT NULL
     GROUP BY service_type`,
    [monthStart, lastMonthStart, lastMonthEnd, businessId],
  );
  const grower = services
    .filter((s) => s.previous > 0 && s.current > 0)
    .map((s) => ({ ...s, growth: Math.round(((s.current - s.previous) / s.previous) * 100) }))
    .sort((a, b) => b.growth - a.growth)[0];
  if (grower && Math.abs(grower.growth) >= 10) {
    out.push({
      text: `${titleCase(grower.service_type)} revenue is ${grower.growth > 0 ? 'up' : 'down'} ${Math.abs(
        grower.growth,
      )}% this month.`,
      emphasis: `${grower.growth > 0 ? '+' : ''}${grower.growth}%`,
    });
  }

  // Best day of the week by collected revenue.
  const byDay = all<{ dow: string; v: number }>(
    `SELECT strftime('%w', created_at) AS dow, SUM(amount) AS v FROM payments
     WHERE business_id = ? AND substr(created_at,1,10) >= ?
     GROUP BY dow ORDER BY v DESC`,
    [businessId, addDays(today, -90)],
  );
  if (byDay.length >= 3 && byDay[0].v > 0) {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    out.push({
      text: `${names[Number(byDay[0].dow)]} is your highest-revenue day over the last 90 days.`,
      emphasis: names[Number(byDay[0].dow)],
    });
  }

  // Money parked in unanswered quotes.
  const openQuotes = one<{ n: number; v: number | null }>(
    `SELECT COUNT(*) AS n, SUM(total) AS v FROM quotes WHERE business_id = ? AND status IN ('sent','viewed')`,
    [businessId],
  );
  if ((openQuotes?.n ?? 0) >= 3) {
    out.push({
      text: `${openQuotes!.n} quotes worth ${fmt(openQuotes!.v ?? 0)} have not been accepted yet.`,
      emphasis: fmt(openQuotes!.v ?? 0),
    });
  }

  // Average ticket movement.
  const ticket = one<{ current: number | null; previous: number | null }>(
    `SELECT AVG(CASE WHEN substr(completed_at,1,10) >= ? THEN amount END) AS current,
            AVG(CASE WHEN substr(completed_at,1,10) BETWEEN ? AND ? THEN amount END) AS previous
     FROM jobs WHERE business_id = ? AND completed_at IS NOT NULL`,
    [monthStart, lastMonthStart, lastMonthEnd, businessId],
  );
  if (ticket?.current && ticket?.previous) {
    const diff = Math.round(ticket.current - ticket.previous);
    if (Math.abs(diff) >= 2000) {
      out.push({
        text: `Your average job value ${diff > 0 ? 'increased' : 'fell'} ${fmt(Math.abs(diff))} this month.`,
        emphasis: `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}`,
      });
    }
  }

  // Quote win rate, when there is enough volume to mean anything.
  const win = one<{ sent: number; accepted: number }>(
    `SELECT COUNT(*) AS sent, SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted
     FROM quotes WHERE business_id = ? AND sent_at >= ?`,
    [businessId, addDays(today, -90)],
  );
  if (win && win.sent >= 10) {
    out.push({
      text: `You are winning ${Math.round((win.accepted / win.sent) * 100)}% of quotes sent in the last 90 days.`,
      emphasis: `${Math.round((win.accepted / win.sent) * 100)}%`,
    });
  }

  return out.slice(0, 4);
}

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function titleCase(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export { sum };
