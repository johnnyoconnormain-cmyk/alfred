import type { ReactNode } from 'react';
import type { Business } from '@/lib/db/types';

/**
 * The frame every customer-facing page sits in.
 *
 * This is the only part of the product most customers ever see, so it carries
 * the contractor's name rather than ours, and stays legible on a phone in a
 * driveway.
 */
export function PublicShell({
  business,
  children,
  footnote,
}: {
  business: Pick<Business, 'name' | 'phone' | 'email' | 'city' | 'state'>;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-paper-raised">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold tracking-[-0.02em] text-ink">
              {business.name}
            </p>
            {business.city ? (
              <p className="text-xs text-ink-faint">
                {business.city}
                {business.state ? `, ${business.state}` : ''}
              </p>
            ) : null}
          </div>
          {business.phone ? (
            <a href={`tel:${business.phone}`} className="btn btn-secondary btn-sm shrink-0">
              Call us
            </a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6 sm:py-10">{children}</main>

      <footer className="mx-auto max-w-2xl px-5 pb-10 text-center">
        {footnote ? <div className="mb-3 text-xs text-ink-faint">{footnote}</div> : null}
        <p className="text-2xs text-ink-faint">
          {business.name}
          {business.phone ? ` · ${business.phone}` : ''}
          {business.email ? ` · ${business.email}` : ''}
        </p>
      </footer>
    </div>
  );
}
