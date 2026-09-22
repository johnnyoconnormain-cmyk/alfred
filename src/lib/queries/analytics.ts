import 'server-only';
import { all, one } from '../db';
import { addDays, todayIn } from '../dates';
import { revenueSeries, type RevenuePoint } from './dashboard';

export type Range = '7d' | '30d' | '90d' | 'ytd';

export const RANGES: { key: Range; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'ytd', label: 'YTD' },
];

export function rangeBounds(range: Range, tz: string): { from: string; to: string; priorFrom: string; priorTo: string } {
  const to = todayIn(tz);
  const from =
    range === 'ytd' ? `${to.slice(0, 4)}-01-01` : addDays(to, -(range === '7d' ? 6 : range === '30d' ? 29 : 89));
  const span = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1);
  return { from, to, priorFrom: addDays(from, -span), priorTo: addDays(from, -1) };
}

export interface ServiceRevenue {
  service_type: string;
  revenue: number;
  jobs: number;
}

export interface AnalyticsSummary {
  range: Range;
  from: string;
  to: string;
  revenue: number;
  revenuePrior: number;
  newLeads: number;
  quotesSent: number;
  jobsBooked: number;
  jobsCompleted: number;
  conversionRate: number;
  averageJob: number;
  outstanding: number;
  series: RevenuePoint[];
  byService: ServiceRevenue[];
  bySource: { source: string; leads: number; won: number }[];
  topCustomers: { id: string; name: string; revenue: number; jobs: number }[];
}

function scalar(sql: string, params: unknown[]): number {
  return one<{ v: number | null }>(sql, params)?.v ?? 0;
}

export function buildAnalytics(businessId: string, tz: string, range: Range): AnalyticsSummary {
  const { from, to, priorFrom, priorTo } = rangeBounds(range, tz);

  const revenue = scalar(
    `SELECT SUM(amount) AS v FROM payments WHERE business_id = ? AND substr(created_at,1,10) BETWEEN ? AND ?`,
    [businessId, from, to],
  );
  const revenuePrior = scalar(
    `SELECT SUM(amount) AS v FROM payments WHERE business_id = ? AND substr(created_at,1,10) BETWEEN ? AND ?`,
    [businessId, priorFrom, priorTo],
  );
  const newLeads = scalar(
    `SELECT COUNT(*) AS v FROM leads WHERE business_id = ? AND substr(created_at,1,10) BETWEEN ? AND ?`,
    [businessId, from, to],
  );
  const quotesSent = scalar(
    `SELECT COUNT(*) AS v FROM quotes WHERE business_id = ? AND substr(sent_at,1,10) BETWEEN ? AND ?`,
    [businessId, from, to],
  );
  const jobsBooked = scalar(
    `SELECT COUNT(*) AS v FROM quotes WHERE business_id = ? AND substr(accepted_at,1,10) BETWEEN ? AND ?`,
    [businessId, from, to],
  );
  const jobsCompleted = scalar(
    `SELECT COUNT(*) AS v FROM jobs WHERE business_id = ? AND substr(completed_at,1,10) BETWEEN ? AND ?`,
    [businessId, from, to],
  );
  const averageJob =
    jobsCompleted > 0
      ? Math.round(
          scalar(
            `SELECT SUM(amount) AS v FROM jobs WHERE business_id = ? AND substr(completed_at,1,10) BETWEEN ? AND ?`,
            [businessId, from, to],
          ) / jobsCompleted,
        )
      : 0;
  const outstanding = scalar(
    `SELECT SUM(amount - amount_paid) AS v FROM invoices WHERE business_id = ? AND status = 'sent'`,
    [businessId],
  );

  const byService = all<ServiceRevenue>(
    `SELECT service_type, SUM(amount) AS revenue, COUNT(*) AS jobs FROM jobs
     WHERE business_id = ? AND completed_at IS NOT NULL AND substr(completed_at,1,10) BETWEEN ? AND ?
     GROUP BY service_type ORDER BY revenue DESC`,
    [businessId, from, to],
  );

  const bySource = all<{ source: string; leads: number; won: number }>(
    `SELECT source, COUNT(*) AS leads, SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won
     FROM leads WHERE business_id = ? AND substr(created_at,1,10) BETWEEN ? AND ?
     GROUP BY source ORDER BY leads DESC`,
    [businessId, from, to],
  );

  const topCustomers = all<{ id: string; name: string; revenue: number; jobs: number }>(
    `SELECT c.id, c.name, SUM(p.amount) AS revenue, COUNT(DISTINCT i.job_id) AS jobs
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     JOIN customers c ON c.id = i.customer_id
     WHERE p.business_id = ? AND substr(p.created_at,1,10) BETWEEN ? AND ?
     GROUP BY c.id ORDER BY revenue DESC LIMIT 6`,
    [businessId, from, to],
  );

  return {
    range,
    from,
    to,
    revenue,
    revenuePrior,
    newLeads,
    quotesSent,
    jobsBooked,
    jobsCompleted,
    conversionRate: quotesSent ? Math.round((jobsBooked / quotesSent) * 100) : 0,
    averageJob,
    outstanding,
    series: revenueSeries(businessId, from, to),
    byService,
    bySource,
    topCustomers,
  };
}
