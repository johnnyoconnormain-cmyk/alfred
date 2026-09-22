'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import {
  createInvoice,
  getInvoice,
  listInvoices,
  recordPayment,
  sendInvoice,
} from '@/lib/queries/invoices';
import { recordMessage } from '@/lib/queries/messages';
import { emit, appUrl } from '@/lib/automations/engine';
import { parseMoney, money } from '@/lib/money';
import type { Payment } from '@/lib/db/types';

export async function createInvoiceAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const customerId = String(formData.get('customerId') ?? '');
  const amount = parseMoney(String(formData.get('amount') ?? ''));
  if (!customerId || !amount) redirect('/payments/new?error=missing');

  const invoice = createInvoice(business.id, {
    customerId,
    jobId: String(formData.get('jobId') ?? '') || null,
    amount,
    dueInDays: Number(formData.get('dueInDays')) || 14,
    actor: user.name,
  });
  if (formData.get('send') === 'yes') sendInvoice(business.id, invoice.id, user.name);

  revalidatePath('/payments');
  redirect(`/payments/${invoice.id}`);
}

export async function sendInvoiceAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const invoiceId = String(formData.get('invoiceId') ?? '');
  sendInvoice(business.id, invoiceId, user.name);

  const invoice = getInvoice(business.id, invoiceId);
  if (invoice) {
    recordMessage({
      businessId: business.id,
      customerId: invoice.customer_id,
      jobId: invoice.job_id,
      channel: 'sms',
      automated: true,
      body: `Hi ${invoice.customer_name.split(' ')[0]}, your invoice from ${
        business.name
      } for ${money(invoice.amount)} is ready: ${appUrl()}/pay/${invoice.token}`,
    });
  }
  revalidatePath(`/payments/${invoiceId}`);
  revalidatePath('/payments');
  revalidatePath('/dashboard');
}

/** Cash, cheque or card taken at the truck — the owner records it by hand. */
export async function recordPaymentAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const invoiceId = String(formData.get('invoiceId') ?? '');
  const invoice = getInvoice(business.id, invoiceId);
  if (!invoice) return;

  const amount = formData.get('amount')
    ? parseMoney(String(formData.get('amount')))
    : invoice.amount - invoice.amount_paid;

  recordPayment({
    businessId: business.id,
    invoiceId,
    amount,
    method: (String(formData.get('method') ?? 'card') as Payment['method']),
    provider: 'manual',
    actor: user.name,
  });
  emit('invoice.paid', { business, invoiceId, customerId: invoice.customer_id });

  revalidatePath(`/payments/${invoiceId}`);
  revalidatePath('/payments');
  revalidatePath('/dashboard');
}

export async function sendPaymentRemindersAction(): Promise<void> {
  const { business } = await requireSession();
  const outstanding = listInvoices(business.id, { status: 'outstanding' });

  for (const invoice of outstanding) {
    recordMessage({
      businessId: business.id,
      customerId: invoice.customer_id,
      jobId: invoice.job_id,
      channel: 'sms',
      automated: true,
      body: `Hi ${invoice.customer_name.split(' ')[0]}, a friendly reminder that invoice #${
        invoice.number
      } for ${money(invoice.amount - invoice.amount_paid)} is still open. You can pay here: ${appUrl()}/pay/${
        invoice.token
      }`,
    });
  }
  revalidatePath('/payments');
  revalidatePath('/dashboard');
}
