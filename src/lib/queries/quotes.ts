import 'server-only';
import { all, one, run, nextNumber, tx } from '../db';
import type { Quote, QuoteItem, QuoteStatus, Settings } from '../db/types';
import { id, token as makeToken } from '../ids';
import { addDays, isoNow, todayIn } from '../dates';
import { logActivity } from './activity';
import { createJob } from './jobs';

export interface QuoteWithCustomer extends Quote {
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  item_count: number;
}

const QUOTE_SELECT = `
  SELECT q.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
         c.address AS customer_address,
         (SELECT COUNT(*) FROM quote_items qi WHERE qi.quote_id = q.id) AS item_count
  FROM quotes q JOIN customers c ON c.id = q.customer_id
`;

export interface QuoteItemInput {
  kind: QuoteItem['kind'];
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface CreateQuoteInput {
  businessId: string;
  customerId: string;
  leadId?: string | null;
  title: string;
  serviceType: string;
  items: QuoteItemInput[];
  notes?: string | null;
  taxRate?: number;
  validDays?: number;
  actor?: string;
}

function totalsFor(items: QuoteItemInput[], taxRate: number) {
  const subtotal = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice),
    0,
  );
  const tax = Math.round(subtotal * (taxRate / 100));
  return { subtotal, tax, total: subtotal + tax };
}

export function createQuote(input: CreateQuoteInput): Quote {
  const quoteId = id('qte');
  const now = isoNow();
  const taxRate = input.taxRate ?? 0;
  const { subtotal, tax, total } = totalsFor(input.items, taxRate);
  const number = nextNumber('quotes', input.businessId);

  tx(() => {
    run(
      `INSERT INTO quotes (id, business_id, number, customer_id, lead_id, title, service_type, status,
          subtotal, tax, total, notes, token, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quoteId,
        input.businessId,
        number,
        input.customerId,
        input.leadId ?? null,
        input.title,
        input.serviceType,
        subtotal,
        tax,
        total,
        input.notes ?? null,
        makeToken(),
        addDays(now.slice(0, 10), input.validDays ?? 30),
        now,
        now,
      ],
    );
    input.items.forEach((item, i) => insertItem(quoteId, item, i));
  });

  logActivity({
    businessId: input.businessId,
    kind: 'quote.created',
    title: `Quote #${number} drafted — ${input.title}`,
    entityType: 'quote',
    entityId: quoteId,
    amount: total,
    actor: input.actor,
  });
  return one<Quote>('SELECT * FROM quotes WHERE id = ?', [quoteId])!;
}

function insertItem(quoteId: string, item: QuoteItemInput, sort: number): void {
  run(
    `INSERT INTO quote_items (id, quote_id, kind, description, quantity, unit, unit_price, total, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id('qi'),
      quoteId,
      item.kind,
      item.description,
      item.quantity,
      item.unit,
      item.unitPrice,
      Math.round(item.quantity * item.unitPrice),
      sort,
    ],
  );
}

export function replaceQuoteItems(
  businessId: string,
  quoteId: string,
  items: QuoteItemInput[],
  taxRate: number,
): void {
  const { subtotal, tax, total } = totalsFor(items, taxRate);
  tx(() => {
    run('DELETE FROM quote_items WHERE quote_id = ?', [quoteId]);
    items.forEach((item, i) => insertItem(quoteId, item, i));
    run(
      'UPDATE quotes SET subtotal = ?, tax = ?, total = ?, updated_at = ? WHERE business_id = ? AND id = ?',
      [subtotal, tax, total, isoNow(), businessId, quoteId],
    );
  });
}

export function getQuote(businessId: string, quoteId: string): QuoteWithCustomer | null {
  return one<QuoteWithCustomer>(`${QUOTE_SELECT} WHERE q.business_id = ? AND q.id = ?`, [
    businessId,
    quoteId,
  ]);
}

/** Public quote page lookup — the token is the only credential a customer has. */
export function getQuoteByToken(tokenValue: string): QuoteWithCustomer | null {
  return one<QuoteWithCustomer>(`${QUOTE_SELECT} WHERE q.token = ?`, [tokenValue]);
}

export function quoteItems(quoteId: string): QuoteItem[] {
  return all<QuoteItem>('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort', [quoteId]);
}

export function listQuotes(
  businessId: string,
  opts: { status?: QuoteStatus | 'open' | 'all'; limit?: number } = {},
): QuoteWithCustomer[] {
  const status = opts.status ?? 'all';
  const limit = opts.limit ?? 200;
  if (status === 'open') {
    return all<QuoteWithCustomer>(
      `${QUOTE_SELECT} WHERE q.business_id = ? AND q.status IN ('sent','viewed')
       ORDER BY q.sent_at DESC LIMIT ?`,
      [businessId, limit],
    );
  }
  if (status === 'all') {
    return all<QuoteWithCustomer>(
      `${QUOTE_SELECT} WHERE q.business_id = ? ORDER BY q.created_at DESC LIMIT ?`,
      [businessId, limit],
    );
  }
  return all<QuoteWithCustomer>(
    `${QUOTE_SELECT} WHERE q.business_id = ? AND q.status = ? ORDER BY q.created_at DESC LIMIT ?`,
    [businessId, status, limit],
  );
}

export function sendQuote(businessId: string, quoteId: string, actor?: string): QuoteWithCustomer | null {
  const quote = getQuote(businessId, quoteId);
  if (!quote) return null;
  run(
    `UPDATE quotes SET status = 'sent', sent_at = coalesce(sent_at, ?), follow_up_stage = 0, updated_at = ?
     WHERE business_id = ? AND id = ?`,
    [isoNow(), isoNow(), businessId, quoteId],
  );
  if (quote.lead_id) {
    run(`UPDATE leads SET status = 'quoted', updated_at = ? WHERE id = ?`, [isoNow(), quote.lead_id]);
  }
  logActivity({
    businessId,
    kind: 'quote.sent',
    title: `Quote #${quote.number} sent to ${quote.customer_name}`,
    entityType: 'quote',
    entityId: quoteId,
    amount: quote.total,
    actor,
  });
  return getQuote(businessId, quoteId);
}

export function markQuoteViewed(quoteId: string): void {
  run(
    `UPDATE quotes SET status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
        viewed_at = coalesce(viewed_at, ?), updated_at = ?
     WHERE id = ? AND status IN ('sent','viewed')`,
    [isoNow(), isoNow(), quoteId],
  );
}

export interface AcceptResult {
  jobId: string;
  quote: QuoteWithCustomer;
}

/**
 * Accepting a quote is the hinge of the whole product: it closes the quote,
 * marks the originating lead won, cancels any follow-ups still queued for it,
 * and opens the job that scheduling and invoicing hang off. All of it in one
 * transaction — a half-accepted quote would strand revenue.
 */
export function acceptQuote(
  businessId: string,
  quoteId: string,
  opts: { actor?: string; durationMin?: number } = {},
): AcceptResult | null {
  const quote = getQuote(businessId, quoteId);
  if (!quote || quote.status === 'accepted') return null;

  let jobId = '';
  tx(() => {
    run(
      `UPDATE quotes SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE business_id = ? AND id = ?`,
      [isoNow(), isoNow(), businessId, quoteId],
    );
    if (quote.lead_id) {
      run(`UPDATE leads SET status = 'won', updated_at = ? WHERE id = ?`, [isoNow(), quote.lead_id]);
    }
    run(
      `UPDATE automation_tasks SET status = 'cancelled', ran_at = ?
       WHERE entity_type = 'quote' AND entity_id = ? AND status = 'pending'`,
      [isoNow(), quoteId],
    );
    const job = createJob({
      businessId,
      customerId: quote.customer_id,
      quoteId,
      title: quote.title,
      serviceType: quote.service_type,
      amount: quote.total,
      address: quote.customer_address,
      durationMin: opts.durationMin ?? estimateDuration(quote.total),
      actor: opts.actor,
    });
    jobId = job.id;
  });

  logActivity({
    businessId,
    kind: 'quote.accepted',
    title: `${quote.customer_name} accepted quote #${quote.number}`,
    entityType: 'quote',
    entityId: quoteId,
    amount: quote.total,
    actor: opts.actor,
  });
  return { jobId, quote: getQuote(businessId, quoteId)! };
}

export function declineQuote(businessId: string, quoteId: string, reason?: string): void {
  const quote = getQuote(businessId, quoteId);
  if (!quote) return;
  run(
    `UPDATE quotes SET status = 'declined', declined_at = ?, updated_at = ? WHERE business_id = ? AND id = ?`,
    [isoNow(), isoNow(), businessId, quoteId],
  );
  if (quote.lead_id) {
    run(`UPDATE leads SET status = 'lost', lost_reason = ?, updated_at = ? WHERE id = ?`, [
      reason ?? 'Quote declined',
      isoNow(),
      quote.lead_id,
    ]);
  }
  run(
    `UPDATE automation_tasks SET status = 'cancelled', ran_at = ?
     WHERE entity_type = 'quote' AND entity_id = ? AND status = 'pending'`,
    [isoNow(), quoteId],
  );
  logActivity({
    businessId,
    kind: 'quote.declined',
    title: `Quote #${quote.number} declined`,
    detail: reason ?? null,
    entityType: 'quote',
    entityId: quoteId,
    actor: 'customer',
  });
}

/** Rough on-site duration from job value — the owner can override per job. */
export function estimateDuration(totalCents: number): number {
  const hours = Math.max(1.5, Math.min(8, totalCents / 100 / 90));
  return Math.round((hours * 60) / 30) * 30;
}

/** Quotes that have sat unanswered — drives the attention centre and follow-ups. */
export function staleQuotes(businessId: string, tz: string, minDays = 1): QuoteWithCustomer[] {
  const cutoff = `${addDays(todayIn(tz), -minDays)}T23:59`;
  return all<QuoteWithCustomer>(
    `${QUOTE_SELECT} WHERE q.business_id = ? AND q.status IN ('sent','viewed') AND q.sent_at <= ?
     ORDER BY q.sent_at`,
    [businessId, cutoff],
  );
}

export function expireOverdueQuotes(businessId: string, tz: string): number {
  const today = todayIn(tz);
  const rows = all<{ id: string }>(
    `SELECT id FROM quotes WHERE business_id = ? AND status IN ('sent','viewed') AND expires_at < ?`,
    [businessId, today],
  );
  for (const row of rows) {
    run(`UPDATE quotes SET status = 'expired', updated_at = ? WHERE id = ?`, [isoNow(), row.id]);
  }
  return rows.length;
}

export function settingsTaxRate(settings: Settings): number {
  return settings.tax_rate;
}
