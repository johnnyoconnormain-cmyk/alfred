import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import type { Business } from '@/lib/db/types';
import { getQuoteByToken, markQuoteViewed, quoteItems } from '@/lib/queries/quotes';
import { PublicShell } from '@/components/PublicShell';
import { money } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import {
  acceptQuotePublicAction,
  askQuestionPublicAction,
  declineQuotePublicAction,
} from '@/actions/public';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = getQuoteByToken(token);
  return { title: quote ? `Your quote from ${quote.customer_name}` : 'Quote' };
}

export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ asked?: string; declined?: string }>;
}) {
  const { token } = await params;
  const flags = await searchParams;
  const quote = getQuoteByToken(token);
  if (!quote) notFound();

  const business = one<Business>('SELECT * FROM businesses WHERE id = ?', [quote.business_id]);
  if (!business) notFound();

  // Opening the link is the signal the office is waiting for.
  markQuoteViewed(quote.id);
  const items = quoteItems(quote.id);
  const settled = quote.status === 'accepted' || quote.status === 'declined';

  return (
    <PublicShell
      business={business}
      footnote={`Quote #${quote.number}${
        quote.expires_at ? ` · valid until ${formatDate(quote.expires_at, { weekday: false })}` : ''
      }`}
    >
      {flags.asked ? (
        <div className="mb-5 rounded border border-field/25 bg-field-light px-4 py-3 text-sm text-field-deep">
          Thanks — your question is with {business.name}. They will get back to you shortly.
        </div>
      ) : null}

      <p className="eyebrow">Your quote</p>
      <h1 className="h-display mt-1">{quote.title}</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Prepared for {quote.customer_name}</p>

      <section className="card mt-6 overflow-hidden">
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-4 px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <p className="text-sm text-ink">{item.description}</p>
                {item.quantity !== 1 ? (
                  <p className="text-xs tabular text-ink-faint">
                    {item.quantity} {item.unit} × {money(item.unit_price, { cents: true })}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-semibold tabular text-ink">{money(item.total)}</p>
            </li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between gap-4 border-t border-line bg-paper-sunken/50 px-4 py-4 sm:px-5">
          <p className="font-display text-sm font-bold uppercase tracking-[0.1em] text-ink">Total</p>
          <p className="figure-hero tabular">{money(quote.total)}</p>
        </div>
      </section>

      {quote.notes ? (
        <p className="mt-4 rounded border border-line bg-paper-raised px-4 py-3 text-sm leading-relaxed text-ink-muted">
          {quote.notes}
        </p>
      ) : null}

      {quote.status === 'accepted' ? (
        <div className="mt-6 rounded-lg border border-field/25 bg-field-light p-5 text-center">
          <p className="font-display text-lg font-bold text-field-deep">Accepted — thank you</p>
          <p className="mt-1 text-sm text-ink-muted">
            {business.name} has this on the books. Pick a time that works for you.
          </p>
          <a href={`/q/${token}/schedule`} className="btn btn-primary btn-lg mt-4 w-full">
            Choose an appointment
          </a>
        </div>
      ) : quote.status === 'declined' ? (
        <div className="mt-6 rounded-lg border border-line bg-paper-raised p-5 text-center">
          <p className="font-semibold text-ink">This quote was closed out.</p>
          <p className="mt-1 text-sm text-ink-muted">
            If that was a mistake, give {business.name} a call and they will reopen it.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <form action={acceptQuotePublicAction}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn btn-primary btn-lg w-full">
              Accept quote
            </button>
          </form>

          <details className="card overflow-hidden">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink">
              Ask a question
            </summary>
            <form action={askQuestionPublicAction} className="border-t border-line p-4">
              <input type="hidden" name="token" value={token} />
              <textarea
                name="body"
                required
                rows={3}
                className="input"
                placeholder="Is the haul-away included in that price?"
              />
              <button type="submit" className="btn btn-secondary mt-2 w-full">
                Send question
              </button>
            </form>
          </details>

          <details className="card overflow-hidden">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm text-ink-muted">
              Not going ahead
            </summary>
            <form action={declineQuotePublicAction} className="border-t border-line p-4">
              <input type="hidden" name="token" value={token} />
              <input
                name="reason"
                className="input"
                placeholder="Optional — it helps them price better next time"
              />
              <button type="submit" className="btn btn-secondary mt-2 w-full">
                Decline this quote
              </button>
            </form>
          </details>
        </div>
      )}

      {!settled ? (
        <p className="mt-5 text-center text-xs text-ink-faint">
          Accepting does not charge you. You pay once the work is done.
        </p>
      ) : null}
    </PublicShell>
  );
}
