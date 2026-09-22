'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import {
  acceptQuote,
  createQuote,
  declineQuote,
  getQuote,
  quoteItems,
  replaceQuoteItems,
  sendQuote,
  type QuoteItemInput,
} from '@/lib/queries/quotes';
import { getLead, leadPhotos } from '@/lib/queries/leads';
import { estimate, estimateToQuoteLines } from '@/lib/ai/estimator';
import { serviceLabel } from '@/lib/ai/classify';
import { emit } from '@/lib/automations/engine';
import { parseMoney } from '@/lib/money';
import { run } from '@/lib/db';
import { isoNow } from '@/lib/dates';

/** Reads the repeating line-item rows out of the quote builder form. */
function itemsFromForm(formData: FormData): QuoteItemInput[] {
  const kinds = formData.getAll('itemKind').map(String);
  const descriptions = formData.getAll('itemDescription').map(String);
  const quantities = formData.getAll('itemQuantity').map(String);
  const units = formData.getAll('itemUnit').map(String);
  const prices = formData.getAll('itemPrice').map(String);

  const items: QuoteItemInput[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i]?.trim();
    const unitPrice = parseMoney(prices[i]);
    if (!description || (!unitPrice && !Number(quantities[i]))) continue;
    items.push({
      kind: (kinds[i] as QuoteItemInput['kind']) || 'labor',
      description,
      quantity: Number(quantities[i]) || 1,
      unit: units[i] || 'ea',
      unitPrice,
    });
  }
  return items;
}

export async function createQuoteAction(formData: FormData): Promise<void> {
  const { business, settings, user } = await requireSession();
  const customerId = String(formData.get('customerId') ?? '');
  const leadId = String(formData.get('leadId') ?? '') || null;
  const title = String(formData.get('title') ?? '').trim();
  const serviceType = String(formData.get('serviceType') ?? 'cleanup');
  const items = itemsFromForm(formData);

  if (!customerId || !title || !items.length) {
    redirect(`/quotes/new?error=missing${leadId ? `&lead=${leadId}` : ''}`);
  }

  const quote = createQuote({
    businessId: business.id,
    customerId,
    leadId,
    title,
    serviceType,
    items,
    notes: String(formData.get('notes') ?? '') || null,
    taxRate: settings.tax_rate,
    validDays: settings.quote_valid_days,
    actor: user.name,
  });

  if (formData.get('send') === 'yes') {
    sendQuote(business.id, quote.id, user.name);
    emit('quote.sent', { business, quoteId: quote.id, customerId });
  }

  revalidatePath('/quotes');
  revalidatePath('/dashboard');
  redirect(`/quotes/${quote.id}`);
}

export async function updateQuoteAction(formData: FormData): Promise<void> {
  const { business, settings } = await requireSession();
  const quoteId = String(formData.get('quoteId') ?? '');
  const quote = getQuote(business.id, quoteId);
  if (!quote) return;

  const items = itemsFromForm(formData);
  if (items.length) replaceQuoteItems(business.id, quoteId, items, settings.tax_rate);

  run('UPDATE quotes SET title = ?, notes = ?, updated_at = ? WHERE business_id = ? AND id = ?', [
    String(formData.get('title') ?? quote.title),
    String(formData.get('notes') ?? '') || null,
    isoNow(),
    business.id,
    quoteId,
  ]);
  revalidatePath(`/quotes/${quoteId}`);
}

export async function sendQuoteAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const quoteId = String(formData.get('quoteId') ?? '');
  const quote = sendQuote(business.id, quoteId, user.name);
  if (quote) emit('quote.sent', { business, quoteId, customerId: quote.customer_id });
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath('/quotes');
  revalidatePath('/dashboard');
}

/** Owner marking an acceptance taken over the phone. */
export async function acceptQuoteAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const quoteId = String(formData.get('quoteId') ?? '');
  const result = acceptQuote(business.id, quoteId, { actor: user.name });
  if (result) {
    emit('quote.accepted', { business, quoteId, jobId: result.jobId, customerId: result.quote.customer_id });
    revalidatePath('/quotes');
    revalidatePath('/jobs');
    revalidatePath('/dashboard');
    redirect(`/jobs/${result.jobId}`);
  }
  revalidatePath(`/quotes/${quoteId}`);
}

export async function declineQuoteAction(formData: FormData): Promise<void> {
  const { business } = await requireSession();
  const quoteId = String(formData.get('quoteId') ?? '');
  declineQuote(business.id, quoteId, String(formData.get('reason') ?? '') || undefined);
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath('/quotes');
  revalidatePath('/dashboard');
}

export interface QuoteDraft {
  title: string;
  serviceType: string;
  lines: { kind: string; description: string; quantity: number; unit: string; unitPrice: number }[];
  low: number;
  high: number;
  basis: string;
  confidence: string;
}

/**
 * Starting point for the quote builder, priced off the owner's own rate card.
 * Returned as a draft the owner edits — nothing is saved until they say so.
 */
export async function draftFromLeadAction(leadId: string): Promise<QuoteDraft | null> {
  const { business, settings } = await requireSession();
  const lead = getLead(business.id, leadId);
  if (!lead) return null;

  const priced = estimate({
    businessId: business.id,
    settings,
    serviceType: lead.service_type,
    description: lead.description,
    photoCount: leadPhotos(leadId).length,
  });

  return {
    title: `${serviceLabel(lead.service_type)} — ${lead.customer_address ?? lead.customer_name}`,
    serviceType: lead.service_type,
    lines: estimateToQuoteLines(priced),
    low: priced.low,
    high: priced.high,
    basis: priced.basis,
    confidence: priced.confidence,
  };
}

export async function duplicateQuoteAction(formData: FormData): Promise<void> {
  const { business, settings, user } = await requireSession();
  const quoteId = String(formData.get('quoteId') ?? '');
  const source = getQuote(business.id, quoteId);
  if (!source) return;

  const items = quoteItems(quoteId).map<QuoteItemInput>((item) => ({
    kind: item.kind,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unit_price,
  }));

  const copy = createQuote({
    businessId: business.id,
    customerId: source.customer_id,
    leadId: source.lead_id,
    title: `${source.title} (copy)`,
    serviceType: source.service_type,
    items,
    notes: source.notes,
    taxRate: settings.tax_rate,
    validDays: settings.quote_valid_days,
    actor: user.name,
  });
  redirect(`/quotes/${copy.id}`);
}
