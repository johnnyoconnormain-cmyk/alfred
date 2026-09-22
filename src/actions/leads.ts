'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import {
  createLead,
  getLead,
  leadPhotos,
  setLeadStatus,
  updateLeadEstimate,
} from '@/lib/queries/leads';
import { createCustomer, findOrCreateCustomer } from '@/lib/queries/customers';
import { recordMessage } from '@/lib/queries/messages';
import { classify } from '@/lib/ai/classify';
import { estimate } from '@/lib/ai/estimator';
import { emit } from '@/lib/automations/engine';
import { storage, StorageUnavailable } from '@/lib/storage';
import { mutate, run } from '@/lib/db';
import { id } from '@/lib/ids';
import { isoNow } from '@/lib/dates';
import type { LeadStatus } from '@/lib/db/types';

/** Owner-side lead entry — the phone-call path. */
export async function createLeadAction(formData: FormData): Promise<void> {
  const { business, settings, user } = await requireSession();

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!name || !description) redirect('/leads/new?error=missing');

  const existingCustomerId = String(formData.get('customerId') ?? '');
  const hinted = String(formData.get('serviceType') ?? '') || null;
  const triage = classify(description, hinted);
  const source = String(formData.get('source') ?? 'phone');

  const lead = await mutate(() => {
    const customer = existingCustomerId
      ? { id: existingCustomerId }
      : findOrCreateCustomer(business.id, {
          name,
          phone: String(formData.get('phone') ?? ''),
          email: String(formData.get('email') ?? ''),
          address: String(formData.get('address') ?? ''),
          city: String(formData.get('city') ?? ''),
          state: String(formData.get('state') ?? ''),
          zip: String(formData.get('zip') ?? ''),
          source,
        });

    const priced = estimate({
      businessId: business.id,
      settings,
      serviceType: triage.serviceType,
      description,
      photoCount: 0,
    });

    const created = createLead({
      businessId: business.id,
      customerId: customer.id,
      source,
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

    emit('lead.created', { business, leadId: created.id, customerId: customer.id });
    return created;
  });

  revalidatePath('/leads');
  revalidatePath('/dashboard');
  redirect(`/leads/${lead.id}`);
}

export async function setLeadStatusAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const leadId = String(formData.get('leadId') ?? '');
  const status = String(formData.get('status') ?? '') as LeadStatus;
  await mutate(() =>
    setLeadStatus(business.id, leadId, status, {
      lostReason: String(formData.get('reason') ?? '') || undefined,
      actor: user.name,
    }),
  );
  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/dashboard');
}

/** Recompute the estimate after the owner edits the request or adds photos. */
export async function refreshEstimateAction(formData: FormData): Promise<void> {
  const { business, settings } = await requireSession();
  const leadId = String(formData.get('leadId') ?? '');
  const lead = getLead(business.id, leadId);
  if (!lead) return;

  await mutate(() => {
    const priced = estimate({
      businessId: business.id,
      settings,
      serviceType: lead.service_type,
      description: lead.description,
      photoCount: leadPhotos(leadId).length,
    });
    updateLeadEstimate(business.id, leadId, priced.low, priced.high, priced.basis);
  });
  revalidatePath(`/leads/${leadId}`);
}

export async function messageCustomerAction(formData: FormData): Promise<void> {
  const { business } = await requireSession();
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;

  await mutate(() =>
    recordMessage({
      businessId: business.id,
      customerId: String(formData.get('customerId') ?? '') || null,
      leadId: String(formData.get('leadId') ?? '') || null,
      quoteId: String(formData.get('quoteId') ?? '') || null,
      jobId: String(formData.get('jobId') ?? '') || null,
      channel: (String(formData.get('channel') ?? 'sms') as 'sms' | 'email' | 'note'),
      body,
    }),
  );
  revalidatePath('/leads');
  revalidatePath('/customers');
  const back = String(formData.get('back') ?? '');
  if (back) revalidatePath(back);
}

export async function uploadLeadPhotosAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const leadId = String(formData.get('leadId') ?? '');
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  const driver = storage();

  // Upload first, then record — the database work has to be one replayable unit.
  const urls: string[] = [];
  for (const file of files.slice(0, 8)) {
    try {
      const stored = await driver.put(file, business.id);
      urls.push(stored.url);
    } catch (err) {
      if (!(err instanceof StorageUnavailable)) throw err;
    }
  }

  if (urls.length) {
    await mutate(() => {
      for (const url of urls) {
        run(
          `INSERT INTO photos (id, business_id, kind, lead_id, url, caption, uploaded_by, created_at)
           VALUES (?, ?, 'lead', ?, ?, NULL, ?, ?)`,
          [id('pho'), business.id, leadId, url, user.name, isoNow()],
        );
      }
    });
  }
  revalidatePath(`/leads/${leadId}`);
}

export async function createCustomerAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/customers/new?error=missing');

  const customer = await mutate(() =>
    createCustomer(
      business.id,
      {
        name,
        email: String(formData.get('email') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        address: String(formData.get('address') ?? ''),
        city: String(formData.get('city') ?? ''),
        state: String(formData.get('state') ?? ''),
        zip: String(formData.get('zip') ?? ''),
        source: String(formData.get('source') ?? ''),
        notes: String(formData.get('notes') ?? ''),
      },
      user.name,
    ),
  );
  revalidatePath('/customers');
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomerNotesAction(formData: FormData): Promise<void> {
  const { business } = await requireSession();
  const customerId = String(formData.get('customerId') ?? '');
  await mutate(() =>
    run('UPDATE customers SET notes = ? WHERE business_id = ? AND id = ?', [
      String(formData.get('notes') ?? ''),
      business.id,
      customerId,
    ]),
  );
  revalidatePath(`/customers/${customerId}`);
}
