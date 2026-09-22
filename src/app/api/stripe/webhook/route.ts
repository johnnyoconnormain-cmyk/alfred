import { NextResponse, type NextRequest } from 'next/server';
import { ensureReady, mutate, one } from '@/lib/db';
import type { Business } from '@/lib/db/types';
import { getInvoice, recordPayment } from '@/lib/queries/invoices';
import { emit } from '@/lib/automations/engine';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook.
 *
 * The signature is verified before anything is written — an unsigned request can
 * not mark an invoice paid. Handling is idempotent: Stripe retries, and a
 * duplicate `checkout.session.completed` must not double-credit the ledger.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureReady();

  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 501 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });

  const body = await req.text();
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(secret);

  let event: import('stripe').Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid signature.' },
      { status: 400 },
    );
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as import('stripe').Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id ?? session.client_reference_id;
    const amount = session.amount_total ?? 0;
    if (!invoiceId || !amount) return NextResponse.json({ received: true });

    const existing = one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM payments WHERE provider = ? AND provider_ref = ?',
      ['stripe', session.id],
    );
    if ((existing?.n ?? 0) > 0) return NextResponse.json({ received: true, duplicate: true });

    const invoice = one<{ business_id: string }>('SELECT business_id FROM invoices WHERE id = ?', [
      invoiceId,
    ]);
    if (!invoice) return NextResponse.json({ received: true });

    await mutate(() => {
      recordPayment({
        businessId: invoice.business_id,
        invoiceId,
        amount,
        method: 'card',
        provider: 'stripe',
        providerRef: session.id,
        actor: 'stripe',
      });

      const business = one<Business>('SELECT * FROM businesses WHERE id = ?', [invoice.business_id]);
      const full = getInvoice(invoice.business_id, invoiceId);
      if (business && full) {
        emit('invoice.paid', { business, invoiceId, customerId: full.customer_id });
      }
    });
  }

  return NextResponse.json({ received: true });
}
