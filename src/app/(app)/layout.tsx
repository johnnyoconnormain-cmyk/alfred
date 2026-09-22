import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { Wordmark } from '@/components/Wordmark';
import { CommandPalette } from '@/components/CommandPalette';
import { StorageNotice } from '@/components/StorageNotice';
import { MobileTabBar, NewMenu, SidebarNav, type NavItem } from '@/components/Nav';
import { signOut } from '@/actions/auth';
import { countOpenLeads } from '@/lib/queries/leads';
import { one } from '@/lib/db';
import { runHousekeeping } from '@/lib/housekeeping';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = await requireSession();
  // Crew members get the field app, not the office one.
  if (user.role === 'crew') redirect('/crew');

  // Drain any automation work that came due while nobody was looking, and expire
  // stale quotes. Checked before it runs, so a quiet account costs two counts.
  await runHousekeeping(business);

  const openLeads = countOpenLeads(business.id);
  const openQuotes =
    one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM quotes WHERE business_id = ? AND status IN ('sent','viewed')`,
      [business.id],
    )?.n ?? 0;

  const items: NavItem[] = [
    { href: '/dashboard', label: 'Command center', icon: 'hud' },
    { href: '/leads', label: 'Lead inbox', icon: 'inbox', badge: openLeads },
    { href: '/quotes', label: 'Quotes', icon: 'quote', badge: openQuotes },
    { href: '/schedule', label: 'Schedule', icon: 'calendar' },
    { href: '/jobs', label: 'Jobs', icon: 'job' },
    { href: '/customers', label: 'Customers', icon: 'people' },
    { href: '/payments', label: 'Payments', icon: 'money' },
    { href: '/analytics', label: 'Analytics', icon: 'chart' },
    { href: '/automations', label: 'Automations', icon: 'bolt' },
    { href: '/reviews', label: 'Reviews', icon: 'star' },
    { href: '/settings', label: 'Settings', icon: 'gear' },
  ];

  return (
    <div className="min-h-screen bg-paper">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-paper-raised lg:flex">
        <div className="border-b border-line px-4 py-4">
          <Wordmark href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-2.5 py-3">
          <SidebarNav items={items} />
        </div>
        <div className="border-t border-line p-3">
          <div className="mb-2 min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{business.name}</p>
            <p className="truncate text-xs text-ink-faint">
              {user.name} · {user.role}
            </p>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn btn-ghost btn-sm w-full justify-start">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
            <div className="lg:hidden">
              <Wordmark href="/dashboard" size="sm" />
            </div>
            <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:gap-3">
              <div className="hidden min-w-0 flex-1 justify-end sm:flex">
                <CommandPalette />
              </div>
              <Link href="/crew" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                Field view
              </Link>
              <NewMenu />
            </div>
          </div>
          <div className="px-4 pb-2.5 sm:hidden">
            <CommandPalette />
          </div>
        </header>

        <main className="px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:pb-10">
          <StorageNotice />
          {children}
        </main>
      </div>

      <MobileTabBar items={items} />
    </div>
  );
}
