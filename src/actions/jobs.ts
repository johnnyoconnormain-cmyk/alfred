'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import {
  assignCrew,
  checklist,
  createJob,
  getJob,
  jobPhotos,
  scheduleJob,
  setJobStatus,
  toggleChecklistItem,
  updateJob,
} from '@/lib/queries/jobs';
import { createInvoice, invoiceForJob, sendInvoice } from '@/lib/queries/invoices';
import { emit } from '@/lib/automations/engine';
import { storage } from '@/lib/storage';
import { run } from '@/lib/db';
import { id } from '@/lib/ids';
import { isoNow } from '@/lib/dates';
import { parseMoney } from '@/lib/money';
import type { JobStatus, PhotoKind } from '@/lib/db/types';

export async function createJobAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const customerId = String(formData.get('customerId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!customerId || !title) redirect('/jobs/new?error=missing');

  const start = String(formData.get('scheduledStart') ?? '') || null;
  const job = createJob({
    businessId: business.id,
    customerId,
    title,
    serviceType: String(formData.get('serviceType') ?? 'cleanup'),
    amount: parseMoney(String(formData.get('amount') ?? '')),
    address: String(formData.get('address') ?? '') || null,
    notes: String(formData.get('notes') ?? '') || null,
    durationMin: Number(formData.get('durationMin')) || 120,
    scheduledStart: start,
    crewId: String(formData.get('crewId') ?? '') || null,
    actor: user.name,
  });
  revalidatePath('/jobs');
  revalidatePath('/schedule');
  redirect(`/jobs/${job.id}`);
}

export async function scheduleJobAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const jobId = String(formData.get('jobId') ?? '');
  const start = String(formData.get('start') ?? '');
  if (!jobId || !start) return;

  scheduleJob(business.id, jobId, start, {
    durationMin: Number(formData.get('durationMin')) || undefined,
    crewId: formData.has('crewId') ? String(formData.get('crewId')) || null : undefined,
    actor: user.name,
  });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/schedule');
  revalidatePath('/dashboard');
}

export async function assignCrewAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const jobId = String(formData.get('jobId') ?? '');
  assignCrew(business.id, jobId, String(formData.get('crewId') ?? '') || null, user.name);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/schedule');
  revalidatePath('/dashboard');
}

export async function updateJobAction(formData: FormData): Promise<void> {
  const { business } = await requireSession();
  const jobId = String(formData.get('jobId') ?? '');
  updateJob(business.id, jobId, {
    title: String(formData.get('title') ?? '') || undefined,
    notes: String(formData.get('notes') ?? ''),
    address: String(formData.get('address') ?? ''),
    amount: formData.has('amount') ? parseMoney(String(formData.get('amount'))) : undefined,
    duration_min: formData.has('durationMin') ? Number(formData.get('durationMin')) : undefined,
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleChecklistAction(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  const jobId = String(formData.get('jobId') ?? '');
  toggleChecklistItem(
    jobId,
    String(formData.get('itemId') ?? ''),
    formData.get('done') === 'yes',
    user.name,
  );
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/crew');
}

export async function setJobStatusAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const jobId = String(formData.get('jobId') ?? '');
  const status = String(formData.get('status') ?? '') as JobStatus;
  setJobStatus(business.id, jobId, status, user.name);

  // Completion is the trigger that turns work into money: it raises the invoice
  // and starts the review clock. Doing it here rather than in the UI means it
  // happens whether the crew taps "complete" on a phone or the owner does it at
  // a desk.
  if (status === 'complete') {
    const job = getJob(business.id, jobId);
    if (job) {
      let invoice = invoiceForJob(business.id, jobId);
      if (!invoice) {
        const created = createInvoice(business.id, {
          jobId,
          customerId: job.customer_id,
          amount: job.amount,
          actor: user.name,
        });
        sendInvoice(business.id, created.id, user.name);
      }
      emit('job.completed', { business, jobId, customerId: job.customer_id });
    }
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/jobs');
  revalidatePath('/crew');
  revalidatePath('/payments');
  revalidatePath('/dashboard');
}

export async function uploadJobPhotosAction(formData: FormData): Promise<void> {
  const { business, user } = await requireSession();
  const jobId = String(formData.get('jobId') ?? '');
  const kind = (String(formData.get('kind') ?? 'after') as PhotoKind) || 'after';
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  const driver = storage();

  for (const file of files.slice(0, 12)) {
    const stored = await driver.put(file, business.id);
    run(
      `INSERT INTO photos (id, business_id, kind, job_id, url, caption, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id('pho'),
        business.id,
        kind,
        jobId,
        stored.url,
        String(formData.get('caption') ?? '') || null,
        user.name,
        isoNow(),
      ],
    );
  }

  // The photo count is worth an activity row — it is how the owner knows the
  // crew documented the job without opening it.
  if (files.length) {
    run(
      `INSERT INTO activity (id, business_id, kind, title, detail, entity_type, entity_id, actor, created_at)
       VALUES (?, ?, 'photo.uploaded', ?, ?, 'job', ?, ?, ?)`,
      [
        id('act'),
        business.id,
        `${user.name} uploaded ${files.length} ${kind} photo${files.length === 1 ? '' : 's'}`,
        null,
        jobId,
        user.name,
        isoNow(),
      ],
    );
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/crew');
}

export async function deletePhotoAction(formData: FormData): Promise<void> {
  const { business } = await requireSession();
  const jobId = String(formData.get('jobId') ?? '');
  run('DELETE FROM photos WHERE id = ? AND business_id = ?', [
    String(formData.get('photoId') ?? ''),
    business.id,
  ]);
  revalidatePath(`/jobs/${jobId}`);
}

export async function jobPhotoCounts(jobId: string): Promise<{ before: number; after: number }> {
  const photos = jobPhotos(jobId);
  return {
    before: photos.filter((p) => p.kind === 'before').length,
    after: photos.filter((p) => p.kind === 'after').length,
  };
}

export async function checklistFor(jobId: string) {
  return checklist(jobId);
}
