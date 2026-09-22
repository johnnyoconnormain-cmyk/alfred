'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { one, run } from '@/lib/db';
import type { Business, Settings } from '@/lib/db/types';
import { acceptQuote, declineQuote, getQuoteByToken } from '@/lib/queries/quotes';
import { getJobByToken, scheduleJob } from '@/lib/queries/jobs';
import { getInvoiceByToken, recordReview } from '@/lib/queries/invoices';
import { findOrCreateCustomer } from '@/lib/queries/customers';
import { createLead } from '@/lib/queries/leads';
import { recordMessage } from '@/lib/queries/messages';
import { logActivity } from '@/lib/queries/activity';
import { classify } from '@/lib/ai/classify';
import { estimate } from '@/lib/ai/estimator';
import { emit } from '@/lib/automations/engine';
import { storage } from '@/lib/storage';
import { id } from '@/lib/ids';
import { isoNow } from '@/lib/dates';

/**
 * These actions are reached with a token, not a session — they are the
 * customer's side of the product. Each one re-reads its record by token and
 * derives the tenant from it, so a link can only ever touch its own business's
 * data.
 */

function businessFor(businessId: string): { business: Business; settings: Settings } | null {
  const business = one<Business>('SELECT * FROM businesses WHERE id = ?', [businessId]);
  const settings = one<Settings>('SELECT * FROM settings WHERE business_id = ?', [businessId]);
  if (!business || !settings) return null;
  return { business, settings };
}

/* --------------------------------- intake --------------------------------- */

export async function submitIntakeAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const business = one<Business>('SELECT * FROM businesses WHERE slug = ?', [slug]);
  if (!business) redirect('/');
  const ctx = businessFor(business.id)!;

  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!name || !phone || !description) redirect(`/book/${slug}?error=missing`);

  const customer = findOrCreateCustomer(business.id, {
    name,
    phone,
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
    city: String(formData.get('city') ?? ''),
    state: String(formData.get('state') ?? ''),
    zip: String(formData.get('zip') ?? ''),
    source: 'website',
  });

  const triage = classify(description, String(formData.get('serviceType') ?? '') || null);

  // Photos first, so the estimate can take them into account.
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  const driver = storage();
  const urls: string[] = [];
  for (const file of files.slice(0, 6)) {
    try {
      const stored = await driver.put(file, business.id);
      urls.push(stored.url);
    } catch {
      // A rejected photo must never cost us the lead.
    }
  }

  const priced = estimate({
    businessId: business.id,
    settings: ctx.settings,
    serviceType: triage.serviceType,
    description,
    photoCount: urls.length,
  });

  const lead = createLead({
    businessId: business.id,
    customerId: customer.id,
    source: 'website',
    serviceType: triage.serviceType,
    description,
    summary: triage.summary,
    urgency: triage.urgency,
    preferredDate: String(formData.get('preferredDate') ?? '') || null,
    preferredTime: String(formData.get('preferredTime') ?? '') || null,
    estLow: priced.low,
    estHigh: priced.high,
    estBasis: priced.basis,
  });

  for (const url of urls) {
    run(
      `INSERT INTO photos (id, business_id, kind, lead_id, url, caption, uploaded_by, created_at)
       VALUES (?, ?, 'lead', ?, ?, NULL, 'customer', ?)`,
      [id('pho'), business.id, lead.id, url, isoNow()],
    );
  }

  emit('lead.created', { business, leadId: lead.id, customerId: customer.id });
  revalidatePath('/leads');
  revalidatePath('/dashboard');
  redirect(`/book/${slug}/thanks?low=${priced.low}&high=${priced.high}&photos=${urls.length}`);
}

/* ---------------------------------- quote --------------------------------- */

export async function acceptQuotePublicAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const quote = getQuoteByToken(token);
  if (!quote) redirect('/');
  const ctx = businessFor(quote.business_id);
  if (!ctx) redirect('/');

  const result = acceptQuote(quote.business_id, quote.id, { actor: 'customer' });
  if (result) {
    emit('quote.accepted', {
      business: ctx.business,
      quoteId: quote.id,
      jobId: result.jobId,
      customerId: quote.customer_id,
    });
  }
  revalidatePath('/dashboard');
  revalidatePath('/jobs');
  redirect(`/q/${token}/schedule`);
}

export async function askQuestionPublicAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  const quote = getQuoteByToken(token);
  if (!quote || !body) redirect(`/q/${token}`);

  recordMessage({
    businessId: quote.business_id,
    customerId: quote.customer_id,
    quoteId: quote.id,
    direction: 'in',
    channel: 'sms',
    body,
  });
  logActivity({
    businessId: quote.business_id,
    kind: 'quote.question',
    title: `${quote.customer_name} asked a question on quote #${quote.number}`,
    detail: body,
    entityType: 'quote',
    entityId: quote.id,
    actor: 'customer',
  });
  revalidatePath('/dashboard');
  redirect(`/q/${token}?asked=1`);
}

export async function declineQuotePublicAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const quote = getQuoteByToken(token);
  if (!quote) redirect('/');
  declineQuote(quote.business_id, quote.id, String(formData.get('reason') ?? '') || 'Declined by customer');
  revalidatePath('/dashboard');
  redirect(`/q/${token}?declined=1`);
}

/* -------------------------------- scheduling ------------------------------- */

export async function bookSlotAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const start = String(formData.get('start') ?? '');
  const crewId = String(formData.get('crewId') ?? '') || null;
  const quote = getQuoteByToken(token);
  if (!quote || !start) redirect(`/q/${token}`);

  const job = one<{ id: string }>('SELECT id FROM jobs WHERE quote_id = ? ORDER BY created_at DESC LIMIT 1', [
    quote.id,
  ]);
  if (!job) redirect(`/q/${token}`);

  scheduleJob(quote.business_id, job.id, start, { crewId, actor: 'customer' });
  logActivity({
    businessId: quote.business_id,
    kind: 'job.booked',
    title: `${quote.customer_name} booked ${start.slice(0, 10)} at ${start.slice(11)}`,
    entityType: 'job',
    entityId: job.id,
    actor: 'customer',
  });
  revalidatePath('/schedule');
  revalidatePath('/dashboard');
  redirect(`/q/${token}/schedule?booked=${encodeURIComponent(start)}`);
}

/* ---------------------------------- review --------------------------------- */

export async function submitReviewAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const job = getJobByToken(token);
  if (!job) redirect('/');

  const rating = Math.max(1, Math.min(5, Number(formData.get('rating')) || 0));
  if (!rating) redirect(`/review/${token}`);

  recordReview({
    businessId: job.business_id,
    jobId: job.id,
    customerId: job.customer_id,
    rating,
    comment: String(formData.get('comment') ?? '') || null,
  });
  revalidatePath('/reviews');
  revalidatePath('/dashboard');
  redirect(`/review/${token}?done=${rating}`);
}

/* ---------------------------------- payment -------------------------------- */

export async function markPaidByLinkAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const invoice = getInvoiceByToken(token);
  if (!invoice) redirect('/');
  redirect(`/pay/${token}`);
}
