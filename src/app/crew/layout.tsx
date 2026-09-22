import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { signOut } from '@/actions/auth';
import { StorageNoticeCompact } from '@/components/StorageNotice';

export const dynamic = 'force-dynamic';

export default async function CrewLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = await requireSession();

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-line bg-ink text-paper">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-[-0.01em]">{business.name}</p>
            <p className="truncate text-2xs text-paper/60">{user.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user.role !== 'crew' ? (
              <Link
                href="/dashboard"
                className="rounded border border-paper/25 px-2.5 py-1.5 text-2xs font-semibold text-paper/80"
              >
                Office
              </Link>
            ) : null}
            <form action={signOut}>
              <button
                type="submit"
                className="rounded border border-paper/25 px-2.5 py-1.5 text-2xs font-semibold text-paper/80"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-16 pt-4">
        <StorageNoticeCompact />
        {children}
      </main>
    </div>
  );
}
