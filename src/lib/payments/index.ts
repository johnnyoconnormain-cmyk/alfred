import 'server-only';

/**
 * Payment boundary.
 *
 * Nothing above this file knows whether money moved through Stripe or was
 * marked paid by the owner at the truck. `recordPayment` in the invoice module
 * is the single write path in both cases, so the ledger is consistent regardless
 * of provider.
 *
 * Stripe is used in test mode when `STRIPE_SECRET_KEY` is present. With no key
 * configured the checkout route returns `unavailable` and the UI offers manual
 * recording instead — it does not pretend a card was charged.
 */

export interface CheckoutRequest {
  invoiceId: string;
  invoiceNumber: number;
  amount: number; // cents
  customerEmail: string | null;
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export type CheckoutResult =
  | { status: 'redirect'; url: string; reference: string }
  | { status: 'unavailable'; reason: string };

export interface PaymentProvider {
  readonly name: string;
  readonly enabled: boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
}

class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly enabled = true;

  constructor(private readonly secretKey: string) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    // Imported lazily so a deployment without Stripe configured never loads it.
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(this.secretKey);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: req.customerEmail ?? undefined,
        client_reference_id: req.invoiceId,
        metadata: { invoice_id: req.invoiceId },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: req.amount,
              product_data: {
                name: `Invoice #${req.invoiceNumber}`,
                description: req.description.slice(0, 250),
              },
            },
          },
        ],
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
      });
      if (!session.url) return { status: 'unavailable', reason: 'Stripe returned no checkout URL.' };
      return { status: 'redirect', url: session.url, reference: session.id };
    } catch (err) {
      return {
        status: 'unavailable',
        reason: err instanceof Error ? err.message : 'Stripe checkout could not be created.',
      };
    }
  }
}

class UnconfiguredProvider implements PaymentProvider {
  readonly name = 'manual';
  readonly enabled = false;
  async createCheckout(): Promise<CheckoutResult> {
    return {
      status: 'unavailable',
      reason: 'Card payments are not connected yet. Add STRIPE_SECRET_KEY to enable checkout.',
    };
  }
}

export function paymentProvider(): PaymentProvider {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new StripeProvider(key) : new UnconfiguredProvider();
}

export function isTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_');
}
