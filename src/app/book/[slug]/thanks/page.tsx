import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import type { Business } from '@/lib/db/types';
import { PublicShell } from '@/components/PublicShell';
import { money } from '@/lib/money';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Request received' };

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ low?: string; high?: string; photos?: string }>;
}) {
  const { slug } = await params;
  const { low, high, photos } = await searchParams;
  const business = one<Business>('SELECT * FROM businesses WHERE slug = ?', [slug]);
  if (!business) notFound();

  const lowCents = Number(low) || 0;
  const highCents = Number(high) || 0;
  const photoCount = Number(photos) || 0;

  return (
    <PublicShell business={business}>
      <div className="card card-pad text-center">
        <p className="eyebrow">Request received</p>
        <h1 className="h-display mt-2">Thanks — we have it</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {business.name} has your request and will be in touch shortly.
        </p>

        {lowCents && highCents ? (
          <div className="mt-6 border-t border-line pt-6">
            <p className="eyebrow">Estimated range</p>
            <p className="figure-hero mt-1.5 tabular">
              {money(lowCents)}
              <span className="text-ink-faint">–</span>
              {money(highCents)}
            </p>
            <p className="mt-2 text-sm text-ink-muted">Final price confirmed after inspection.</p>
            <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-ink-faint">
              This range comes from {business.name}&rsquo;s own pricing and what you described
              {photoCount ? `, plus the ${photoCount} photo${photoCount === 1 ? '' : 's'} you sent` : ''}.
              Nobody has been out to look yet, so treat it as a ballpark — the quote you get back is
              the real number.
            </p>
          </div>
        ) : null}
      </div>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Need it sooner?{' '}
        {business.phone ? (
          <a href={`tel:${business.phone}`} className="font-semibold text-field underline underline-offset-2">
            Call {business.phone}
          </a>
        ) : (
          'Give us a call.'
        )}
      </p>
    </PublicShell>
  );
}
