import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { buildHud } from '@/lib/queries/dashboard';
import { recentActivity } from '@/lib/queries/activity';
import { listJobs } from '@/lib/queries/jobs';
import { expireOverdueQuotes } from '@/lib/queries/quotes';
import { addDays, formatDate, greeting } from '@/lib/dates';
import { Card } from '@/components/ui';
import { Pulse } from '@/components/hud/Pulse';
import { PipelineBar } from '@/components/hud/PipelineBar';
import { AttentionCenter } from '@/components/hud/AttentionCenter';
import { TodayBoard } from '@/components/hud/TodayBoard';
import { CrewPanel } from '@/components/hud/CrewPanel';
import { ActivityFeed } from '@/components/hud/ActivityFeed';
import { Insights, Opportunities } from '@/components/hud/Opportunities';
import { JobMap } from '@/components/hud/JobMap';
import { WeatherPanel } from '@/components/hud/WeatherPanel';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { Funnel } from '@/components/charts/Funnel';

export const metadata = { title: 'Command center' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { user, business, settings } = await requireOwner();

  // Housekeeping that belongs to reading the board, not to a background worker.
  expireOverdueQuotes(business.id, business.timezone);

  const hud = buildHud(business, settings);
  const activity = recentActivity(business.id, 18);
  const tomorrow = addDays(hud.today, 1);
  const tomorrowJobs = listJobs(business.id, { from: tomorrow, to: tomorrow });

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
        <div>
          <h1 className="h-display">
            {greeting(business.timezone)}, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {formatDate(hud.today)} · {business.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads" className="btn btn-secondary btn-sm sm:text-sm">
            Lead inbox
          </Link>
          <Link href="/quotes/new" className="btn btn-primary btn-sm sm:text-sm">
            Build a quote
          </Link>
        </div>
      </header>

      <div className="space-y-4">
        <Pulse metrics={hud.pulse} />
        <PipelineBar stages={hud.pipeline} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="order-1 lg:order-2 lg:col-span-4">
            <AttentionCenter items={hud.attention} />
          </div>

          <div className="order-2 lg:order-1 lg:col-span-8">
            <TodayBoard jobs={hud.todaysJobs} nowWall={hud.nowWall} />
          </div>

          <div className="order-3 lg:col-span-8">
            <Card
              title="Revenue collected"
              action={
                <Link
                  href="/analytics"
                  className="text-xs font-semibold text-field underline underline-offset-2"
                >
                  Full analytics
                </Link>
              }
            >
              <p className="mb-3 text-xs text-ink-faint">
                Last 30 days · payments received, by the day they landed.
              </p>
              <RevenueChart points={hud.revenue} />
            </Card>
          </div>

          <div className="order-4 space-y-4 lg:col-span-4">
            <CrewPanel crews={hud.crews} />
          </div>

          <div className="order-5 lg:col-span-4">
            <Opportunities items={hud.opportunities} />
          </div>

          <div className="order-6 lg:col-span-4">
            <Card
              title="Lead funnel"
              action={<span className="text-xs text-ink-faint">This month</span>}
            >
              <Funnel rows={hud.funnel} />
            </Card>
          </div>

          <div className="order-7 lg:col-span-4">
            <Insights items={hud.insights} />
          </div>

          <div className="order-9 lg:order-8 lg:col-span-8">
            <JobMap jobs={hud.todaysJobs} crews={hud.crews} />
          </div>

          <div className="order-8 lg:order-9 lg:col-span-4">
            <WeatherPanel zip={business.zip} outdoorJobsTomorrow={tomorrowJobs.length} />
          </div>

          <div className="order-10 lg:col-span-12">
            <ActivityFeed items={activity} />
          </div>
        </div>
      </div>
    </div>
  );
}
