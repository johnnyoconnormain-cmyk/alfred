import { NextResponse, type NextRequest } from 'next/server';
import { getInvoiceByToken } from '@/lib/queries/invoices';
import { paymentProvider } from '@/lib/payments';
import { appUrl } from '@/lib/automations/engine';

export const dynamic = 'force-dynamic';

/**
 * Starts a checkout for one invoice.
 *
 * The invoice token is the only credential; the amount is read from the database
 * rather than the request, so nothing about the price can be tampered with from
 * the browser.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const invoice = getInvoiceByToken(token);
  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });

  const balance = invoice.amount - invoice.amount_paid;
  if (balance <= 0) return NextResponse.redirect(`${appUrl()}/pay/${token}`, 303);

  const provider = paymentProvider();
  const result = await provider.createCheckout({
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    amount: balance,
    customerEmail: invoice.customer_email,
    description: invoice.job_title ?? `Work completed by ${invoice.business_name}`,
    successUrl: `${appUrl()}/pay/${token}?status=complete`,
    cancelUrl: `${appUrl()}/pay/${token}?status=cancelled`,
  });

  if (result.status === 'redirect') return NextResponse.redirect(result.url, 303);
  return NextResponse.redirect(
    `${appUrl()}/pay/${token}?reason=${encodeURIComponent(result.reason)}`,
    303,
  );
}
