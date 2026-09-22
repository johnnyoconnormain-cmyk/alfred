import 'server-only';
import { all, one, run, nextNumber, tx } from '../db';
import type { Invoice, Payment, Review } from '../db/types';
import { id, token as makeToken } from '../ids';
import { addDays, isoNow, todayIn } from '../dates';
import { logActivity } from './activity';

export interface InvoiceWithContext extends Invoice {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  job_title: string | null;
  business_name: string;
  days_outstanding: number | null;
}

const INVOICE_SELECT = `
  SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
         j.title AS job_title, b.name AS business_name,
         CAST(julianday('now') - julianday(i.sent_at) AS INTEGER) AS days_outstanding
  FROM invoices i
  JOIN customers c ON c.id = i.customer_id
  JOIN businesses b ON b.id = i.business_id
  LEFT JOIN jobs j ON j.id = i.job_id
`;

export function createInvoice(
  businessId: string,
  input: { jobId?: string | null; customerId: string; amount: number; dueInDays?: number; actor?: string },
): Invoice {
  const invoiceId = id('inv');
  const now = isoNow();
  const number = nextNumber('invoices', businessId);
  run(
    `INSERT INTO invoices (id, business_id, number, job_id, customer_id, amount, amount_paid,
        status, due_date, token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'draft', ?, ?, ?, ?)`,
    [
      invoiceId,
      businessId,
      number,
      input.jobId ?? null,
      input.customerId,
      input.amount,
      addDays(now.slice(0, 10), input.dueInDays ?? 14),
      makeToken(),
      now,
      now,
    ],
  );
  logActivity({
    businessId,
    kind: 'invoice.created',
    title: `Invoice #${number} created`,
    entityType: 'invoice',
    entityId: invoiceId,
    amount: input.amount,
    actor: input.actor,
  });
  return one<Invoice>('SELECT * FROM invoices WHERE id = ?', [invoiceId])!;
}

export function sendInvoice(businessId: string, invoiceId: string, actor?: string): void {
  const invoice = getInvoice(businessId, invoiceId);
  if (!invoice) return;
  run(
    `UPDATE invoices SET status = 'sent', sent_at = coalesce(sent_at, ?), updated_at = ?
     WHERE business_id = ? AND id = ? AND status = 'draft'`,
    [isoNow(), isoNow(), businessId, invoiceId],
  );
  logActivity({
    businessId,
    kind: 'invoice.sent',
    title: `Invoice #${invoice.number} sent to ${invoice.customer_name}`,
    entityType: 'invoice',
    entityId: invoiceId,
    amount: invoice.amount,
    actor,
  });
}

export function getInvoice(businessId: string, invoiceId: string): InvoiceWithContext | null {
  return one<InvoiceWithContext>(`${INVOICE_SELECT} WHERE i.business_id = ? AND i.id = ?`, [
    businessId,
    invoiceId,
  ]);
}

export function getInvoiceByToken(tokenValue: string): InvoiceWithContext | null {
  return one<InvoiceWithContext>(`${INVOICE_SELECT} WHERE i.token = ?`, [tokenValue]);
}

export function invoiceForJob(businessId: string, jobId: string): InvoiceWithContext | null {
  return one<InvoiceWithContext>(
    `${INVOICE_SELECT} WHERE i.business_id = ? AND i.job_id = ? ORDER BY i.created_at DESC LIMIT 1`,
    [businessId, jobId],
  );
}

export function listInvoices(
  businessId: string,
  opts: { status?: Invoice['status'] | 'outstanding' | 'all' } = {},
): InvoiceWithContext[] {
  const status = opts.status ?? 'all';
  if (status === 'outstanding') {
    return all<InvoiceWithContext>(
      `${INVOICE_SELECT} WHERE i.business_id = ? AND i.status = 'sent' ORDER BY i.due_date`,
      [businessId],
    );
  }
  if (status === 'all') {
    return all<InvoiceWithContext>(
      `${INVOICE_SELECT} WHERE i.business_id = ? ORDER BY i.created_at DESC LIMIT 300`,
      [businessId],
    );
  }
  return all<InvoiceWithContext>(
    `${INVOICE_SELECT} WHERE i.business_id = ? AND i.status = ? ORDER BY i.created_at DESC LIMIT 300`,
    [businessId, status],
  );
}

export interface RecordPaymentInput {
  businessId: string;
  invoiceId: string;
  amount: number;
  method?: Payment['method'];
  provider?: string;
  providerRef?: string | null;
  actor?: string;
}

/**
 * Records a payment against an invoice and settles the invoice and its job when
 * the balance clears. Payments are append-only: a correction is another row, not
 * an edit, so the ledger always reconstructs from history.
 */
export function recordPayment(input: RecordPaymentInput): Payment | null {
  const invoice = getInvoice(input.businessId, input.invoiceId);
  if (!invoice) return null;

  const paymentId = id('pay');
  tx(() => {
    run(
      `INSERT INTO payments (id, business_id, invoice_id, amount, method, provider, provider_ref, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'succeeded', ?)`,
      [
        paymentId,
        input.businessId,
        input.invoiceId,
        input.amount,
        input.method ?? 'card',
        input.provider ?? 'manual',
        input.providerRef ?? null,
        isoNow(),
      ],
    );
    const paid = invoice.amount_paid + input.amount;
    const settled = paid >= invoice.amount;
    run(
      `UPDATE invoices SET amount_paid = ?, status = ?, paid_at = ?, updated_at = ?
       WHERE business_id = ? AND id = ?`,
      [
        paid,
        settled ? 'paid' : invoice.status === 'draft' ? 'sent' : invoice.status,
        settled ? isoNow() : null,
        isoNow(),
        input.businessId,
        input.invoiceId,
      ],
    );
    if (settled && invoice.job_id) {
      run(`UPDATE jobs SET status = 'paid', updated_at = ? WHERE id = ? AND status = 'complete'`, [
        isoNow(),
        invoice.job_id,
      ]);
    }
  });

  logActivity({
    businessId: input.businessId,
    kind: 'payment.received',
    title: `${invoice.customer_name} paid invoice #${invoice.number}`,
    entityType: 'invoice',
    entityId: input.invoiceId,
    amount: input.amount,
    actor: input.actor ?? 'customer',
  });
  return one<Payment>('SELECT * FROM payments WHERE id = ?', [paymentId]);
}

export function paymentsFor(invoiceId: string): Payment[] {
  return all<Payment>('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at', [invoiceId]);
}

export function outstandingTotal(businessId: string): { amount: number; count: number } {
  const row = one<{ amount: number | null; count: number }>(
    `SELECT SUM(amount - amount_paid) AS amount, COUNT(*) AS count
     FROM invoices WHERE business_id = ? AND status = 'sent'`,
    [businessId],
  );
  return { amount: row?.amount ?? 0, count: row?.count ?? 0 };
}

export function overdueInvoices(businessId: string, tz: string): InvoiceWithContext[] {
  return all<InvoiceWithContext>(
    `${INVOICE_SELECT} WHERE i.business_id = ? AND i.status = 'sent' AND i.due_date < ?
     ORDER BY i.due_date`,
    [businessId, todayIn(tz)],
  );
}

/* ---------------------------------- reviews --------------------------------- */

export function recordReview(input: {
  businessId: string;
  jobId: string | null;
  customerId: string;
  rating: number;
  comment?: string | null;
}): Review {
  const reviewId = id('rev');
  // 4-5 stars get pointed at the public profile; 1-3 stay private so the owner
  // hears it first. Nothing is ever posted on the customer's behalf.
  const routed = input.rating >= 4 ? 'public' : 'private';
  run(
    `INSERT INTO reviews (id, business_id, job_id, customer_id, rating, comment, routed_to, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reviewId,
      input.businessId,
      input.jobId,
      input.customerId,
      input.rating,
      input.comment ?? null,
      routed,
      isoNow(),
    ],
  );
  logActivity({
    businessId: input.businessId,
    kind: 'review.received',
    title: `${input.rating}-star review received`,
    detail: input.comment ?? null,
    entityType: 'review',
    entityId: reviewId,
    actor: 'customer',
  });
  return one<Review>('SELECT * FROM reviews WHERE id = ?', [reviewId])!;
}

export function listReviews(businessId: string): (Review & { customer_name: string })[] {
  return all<Review & { customer_name: string }>(
    `SELECT r.*, c.name AS customer_name FROM reviews r
     JOIN customers c ON c.id = r.customer_id
     WHERE r.business_id = ? ORDER BY r.created_at DESC LIMIT 100`,
    [businessId],
  );
}

export function reviewForJob(jobId: string): Review | null {
  return one<Review>('SELECT * FROM reviews WHERE job_id = ? ORDER BY created_at DESC LIMIT 1', [
    jobId,
  ]);
}
