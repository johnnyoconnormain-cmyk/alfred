import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import type { Business, Settings } from '@/lib/db/types';
import { getQuoteByToken } from '@/lib/queries/quotes';
import { findAvailability } from '@/lib/queries/schedule';
import { PublicShell } from '@/components/PublicShell';
import { formatDate, formatTime } from '@/lib/dates';
import { bookSlotAction } from '@/actions/public';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Choose a time' };

export default async function PublicSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ booked?: string }>;
}) {
  const { token } = await params;
  const { booked } = await searchParams;
  const quote = getQuoteByToken(token);
  if (!quote) notFound();

  const business = one<Business>('SELECT * FROM businesses WHERE id = ?', [quote.business_id]);
  const settings = one<Settings>('SELECT * FROM settings WHERE business_id = ?', [quote.business_id]);
  if (!business || !settings) notFound();

  const job = one<{ id: string; duration_min: number; scheduled_start: string | null }>(
    'SELECT id, duration_min, scheduled_start FROM jobs WHERE quote_id = ? ORDER BY created_at DESC LIMIT 1',
    [quote.id],
  );

  if (booked || job?.scheduled_start) {
    const when = booked || job!.scheduled_start!;
    return (
      <PublicShell business={business}>
        <div className="card card-pad text-center">
          <p className="eyebrow">You are booked</p>
          <p className="h-display mt-2">{formatDate(when.slice(0, 10))}</p>
          <p className="mt-1 text-lg font-semibold tabular text-field">{formatTime(when)}</p>
          <p className="mt-4 text-sm text-ink-muted">
            {business.name} will confirm the day before. If you need to move it, just call.
          </p>
          {business.phone ? (
            <a href={`tel:${business.phone}`} className="btn btn-secondary mt-4 w-full">
              {business.phone}
            </a>
          ) : null}
        </div>
      </PublicShell>
    );
  }

  const offers = findAvailability(quote.business_id, settings, {
    durationMin: job?.duration_min ?? 120,
    days: 21,
    maxDays: 5,
    maxPerDay: 3,
  });

  return (
    <PublicShell
      business={business}
      footnote="Times shown are the openings your crew actually has, including travel time between jobs."
    >
      <p className="eyebrow">Almost done</p>
      <h1 className="h-display mt-1">Pick a time</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {quote.title} · roughly {Math.round((job?.duration_min ?? 120) / 60)} hours on site.
      </p>

      {offers.length === 0 ? (
        <div className="card card-pad mt-6 text-center">
          <p className="text-sm text-ink-muted">
            Nothing is open in the next three weeks. {business.name} will call you to find a date.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {offers.map((offer) => (
            <section key={offer.date} className="card overflow-hidden">
              <h2 className="border-b border-line px-4 py-2.5 font-display text-sm font-bold uppercase tracking-[0.08em] text-ink">
                {formatDate(offer.date)}
              </h2>
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
                {offer.slots.map((slot) => (
                  <form key={slot.start} action={bookSlotAction}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="start" value={slot.start} />
                    <input type="hidden" name="crewId" value={slot.crewId} />
                    <button type="submit" className="btn btn-secondary tap w-full text-base font-bold tabular">
                      {formatTime(slot.start)}
                    </button>
                  </form>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
