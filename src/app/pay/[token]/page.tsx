import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import type { Business } from '@/lib/db/types';
import { getInvoiceByToken, paymentsFor } from '@/lib/queries/invoices';
import { jobPhotos } from '@/lib/queries/jobs';
import { PublicShell } from '@/components/PublicShell';
import { BeforeAfter } from '@/components/PhotoGrid';
import { paymentProvider, isTestMode } from '@/lib/payments';
import { money } from '@/lib/money';
import { formatDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pay your invoice' };

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string; reason?: string }>;
}) {
  const { token } = await params;
  const flags = await searchParams;
  const invoice = getInvoiceByToken(token);
  if (!invoice) notFound();

  const business = one<Business>('SELECT * FROM businesses WHERE id = ?', [invoice.business_id]);
  if (!business) notFound();

  const balance = invoice.amount - invoice.amount_paid;
  const paid = invoice.status === 'paid' || balance <= 0;
  const payments = paymentsFor(invoice.id);
  const photos = invoice.job_id ? jobPhotos(invoice.job_id) : [];
  const provider = paymentProvider();

  return (
    <PublicShell business={business} footnote={`Invoice #${invoice.number}`}>
      {paid ? (
        <div className="card card-pad text-center">
          <p className="eyebrow">Paid in full</p>
          <p className="figure-hero mt-2 tabular">{money(invoice.amount)}</p>
          <p className="mt-2 text-sm text-ink-muted">
            Received {invoice.paid_at ? formatDate(invoice.paid_at.slice(0, 10), { weekday: false }) : ''}. Thanks
            for your business.
          </p>
        </div>
      ) : (
        <>
          <p className="eyebrow">Your project is complete</p>
          <h1 className="h-display mt-1">{invoice.job_title ?? 'Work completed'}</h1>

          <div className="card card-pad mt-6 text-center">
            <p className="eyebrow">Amount due</p>
            <p className="figure-hero mt-1.5 tabular">{money(balance)}</p>
            {invoice.due_date ? (
              <p className="mt-1 text-sm text-ink-muted">
                Due {formatDate(invoice.due_date, { weekday: false })}
              </p>
            ) : null}

            {provider.enabled ? (
              <>
                <form action={`/api/checkout/${token}`} method="post" className="mt-5">
                  <button type="submit" className="btn btn-primary btn-lg w-full">
                    Pay now
                  </button>
                </form>
                {isTestMode() ? (
                  <p className="mt-2 text-2xs text-ink-faint">
                    Stripe test mode — use card 4242 4242 4242 4242 with any future expiry.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-5 rounded border border-line bg-paper-sunken px-4 py-3 text-left">
                <p className="text-sm font-semibold text-ink">Online card payment is not switched on.</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Call {business.name}
                  {business.phone ? ` on ${business.phone}` : ''} to settle this invoice, or pay the crew
                  directly. Nothing is charged through this page.
                </p>
              </div>
            )}

            {flags.status === 'cancelled' ? (
              <p className="mt-3 text-sm text-status-serious">
                Payment was cancelled. Nothing has been charged.
              </p>
            ) : null}
            {flags.reason ? <p className="mt-3 text-sm text-status-critical">{flags.reason}</p> : null}
          </div>
        </>
      )}

      {payments.length ? (
        <section className="card mt-4 overflow-hidden">
          <h2 className="border-b border-line px-4 py-2.5 font-display text-sm font-bold uppercase tracking-[0.08em]">
            Payments received
          </h2>
          <ul className="divide-y divide-line">
            {payments.map((payment) => (
              <li key={payment.id} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="capitalize text-ink-muted">
                  {payment.method} · {formatDate(payment.created_at.slice(0, 10), { weekday: false })}
                </span>
                <span className="tabular font-semibold">{money(payment.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {photos.length ? (
        <section className="mt-6">
          <h2 className="h-section mb-2.5">How it went</h2>
          <BeforeAfter
            before={photos.filter((p) => p.kind === 'before')}
            after={photos.filter((p) => p.kind === 'after')}
          />
        </section>
      ) : null}
    </PublicShell>
  );
}
