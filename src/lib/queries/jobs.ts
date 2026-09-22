import 'server-only';
import { all, one, run, nextNumber } from '../db';
import type { ChecklistItem, Job, JobStatus, Photo } from '../db/types';
import { id, token as makeToken } from '../ids';
import { addMinutes, isoNow, todayIn } from '../dates';
import { logActivity } from './activity';

export interface JobWithCustomer extends Job {
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  crew_name: string | null;
  crew_color: string | null;
  invoice_status: string | null;
  checklist_done: number;
  checklist_total: number;
}

const JOB_SELECT = `
  SELECT j.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
         cr.name AS crew_name, cr.color AS crew_color,
         (SELECT status FROM invoices i WHERE i.job_id = j.id ORDER BY created_at DESC LIMIT 1) AS invoice_status,
         (SELECT COUNT(*) FROM job_checklist k WHERE k.job_id = j.id AND k.done = 1) AS checklist_done,
         (SELECT COUNT(*) FROM job_checklist k WHERE k.job_id = j.id) AS checklist_total
  FROM jobs j
  JOIN customers c ON c.id = j.customer_id
  LEFT JOIN crews cr ON cr.id = j.crew_id
`;

export const DEFAULT_CHECKLIST = [
  'Arrived on site',
  'Work started',
  'Materials delivered',
  'Work completed',
  'Photos uploaded',
  'Customer walkthrough approved',
];

export interface CreateJobInput {
  businessId: string;
  customerId: string;
  quoteId?: string | null;
  title: string;
  serviceType: string;
  amount: number;
  address?: string | null;
  notes?: string | null;
  durationMin?: number;
  scheduledStart?: string | null;
  crewId?: string | null;
  actor?: string;
}

export function createJob(input: CreateJobInput): Job {
  const jobId = id('job');
  const now = isoNow();
  const number = nextNumber('jobs', input.businessId);
  const start = input.scheduledStart ?? null;
  const duration = input.durationMin ?? 120;
  run(
    `INSERT INTO jobs (id, business_id, number, customer_id, quote_id, crew_id, title, service_type,
        status, scheduled_start, scheduled_end, duration_min, amount, address, notes, token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      jobId,
      input.businessId,
      number,
      input.customerId,
      input.quoteId ?? null,
      input.crewId ?? null,
      input.title,
      input.serviceType,
      start ? 'scheduled' : 'unscheduled',
      start,
      start ? addMinutes(start, duration) : null,
      duration,
      input.amount,
      input.address ?? null,
      input.notes ?? null,
      makeToken(),
      now,
      now,
    ],
  );
  DEFAULT_CHECKLIST.forEach((label, i) => {
    run('INSERT INTO job_checklist (id, job_id, label, sort) VALUES (?, ?, ?, ?)', [
      id('chk'),
      jobId,
      label,
      i,
    ]);
  });
  logActivity({
    businessId: input.businessId,
    kind: 'job.created',
    title: `Job #${number} created — ${input.title}`,
    entityType: 'job',
    entityId: jobId,
    amount: input.amount,
    actor: input.actor,
  });
  return one<Job>('SELECT * FROM jobs WHERE id = ?', [jobId])!;
}

export function getJob(businessId: string, jobId: string): JobWithCustomer | null {
  return one<JobWithCustomer>(`${JOB_SELECT} WHERE j.business_id = ? AND j.id = ?`, [
    businessId,
    jobId,
  ]);
}

export function getJobByToken(tokenValue: string): JobWithCustomer | null {
  return one<JobWithCustomer>(`${JOB_SELECT} WHERE j.token = ?`, [tokenValue]);
}

export function listJobs(
  businessId: string,
  opts: { status?: JobStatus | 'active' | 'all'; crewId?: string; from?: string; to?: string; limit?: number } = {},
): JobWithCustomer[] {
  const clauses = ['j.business_id = ?'];
  const params: unknown[] = [businessId];

  if (opts.status && opts.status !== 'all') {
    if (opts.status === 'active') {
      clauses.push(`j.status IN ('unscheduled','scheduled','in_progress')`);
    } else {
      clauses.push('j.status = ?');
      params.push(opts.status);
    }
  }
  if (opts.crewId) {
    clauses.push('j.crew_id = ?');
    params.push(opts.crewId);
  }
  if (opts.from) {
    clauses.push('j.scheduled_start >= ?');
    params.push(opts.from);
  }
  if (opts.to) {
    clauses.push('j.scheduled_start <= ?');
    params.push(`${opts.to}T23:59`);
  }
  params.push(opts.limit ?? 300);
  return all<JobWithCustomer>(
    `${JOB_SELECT} WHERE ${clauses.join(' AND ')}
     ORDER BY j.scheduled_start IS NULL, j.scheduled_start LIMIT ?`,
    params,
  );
}

export function jobsOnDate(businessId: string, date: string): JobWithCustomer[] {
  return all<JobWithCustomer>(
    `${JOB_SELECT} WHERE j.business_id = ? AND substr(j.scheduled_start, 1, 10) = ?
     ORDER BY j.scheduled_start`,
    [businessId, date],
  );
}

export function todaysJobs(businessId: string, tz: string): JobWithCustomer[] {
  return jobsOnDate(businessId, todayIn(tz));
}

export function checklist(jobId: string): ChecklistItem[] {
  return all<ChecklistItem>('SELECT * FROM job_checklist WHERE job_id = ? ORDER BY sort', [jobId]);
}

export function toggleChecklistItem(jobId: string, itemId: string, done: boolean, actor?: string): void {
  run('UPDATE job_checklist SET done = ?, done_at = ?, done_by = ? WHERE id = ? AND job_id = ?', [
    done ? 1 : 0,
    done ? isoNow() : null,
    done ? actor ?? null : null,
    itemId,
    jobId,
  ]);
}

export function jobPhotos(jobId: string): Photo[] {
  return all<Photo>('SELECT * FROM photos WHERE job_id = ? ORDER BY created_at', [jobId]);
}

export function scheduleJob(
  businessId: string,
  jobId: string,
  start: string,
  opts: { durationMin?: number; crewId?: string | null; actor?: string } = {},
): void {
  const job = getJob(businessId, jobId);
  if (!job) return;
  const duration = opts.durationMin ?? job.duration_min;
  run(
    `UPDATE jobs SET scheduled_start = ?, scheduled_end = ?, duration_min = ?, crew_id = ?,
       status = CASE WHEN status IN ('unscheduled') THEN 'scheduled' ELSE status END, updated_at = ?
     WHERE business_id = ? AND id = ?`,
    [
      start,
      addMinutes(start, duration),
      duration,
      opts.crewId === undefined ? job.crew_id : opts.crewId,
      isoNow(),
      businessId,
      jobId,
    ],
  );
  logActivity({
    businessId,
    kind: 'job.scheduled',
    title: `${job.title} scheduled for ${start.slice(0, 10)}`,
    entityType: 'job',
    entityId: jobId,
    actor: opts.actor,
  });
}

export function assignCrew(businessId: string, jobId: string, crewId: string | null, actor?: string): void {
  run('UPDATE jobs SET crew_id = ?, updated_at = ? WHERE business_id = ? AND id = ?', [
    crewId,
    isoNow(),
    businessId,
    jobId,
  ]);
  const job = getJob(businessId, jobId);
  if (job) {
    logActivity({
      businessId,
      kind: 'job.assigned',
      title: `${job.title} assigned to ${job.crew_name ?? 'nobody'}`,
      entityType: 'job',
      entityId: jobId,
      actor,
    });
  }
}

export function setJobStatus(
  businessId: string,
  jobId: string,
  status: JobStatus,
  actor?: string,
): void {
  const stamps: string[] = [];
  const params: unknown[] = [status];
  if (status === 'in_progress') {
    stamps.push('started_at = coalesce(started_at, ?)');
    params.push(isoNow());
  }
  if (status === 'complete') {
    stamps.push('completed_at = coalesce(completed_at, ?)');
    params.push(isoNow());
  }
  params.push(isoNow(), businessId, jobId);
  run(
    `UPDATE jobs SET status = ?${stamps.length ? `, ${stamps.join(', ')}` : ''}, updated_at = ?
     WHERE business_id = ? AND id = ?`,
    params,
  );
  const job = getJob(businessId, jobId);
  if (job) {
    logActivity({
      businessId,
      kind: `job.${status}`,
      title: `${job.title} — ${status.replace('_', ' ')}`,
      entityType: 'job',
      entityId: jobId,
      amount: status === 'complete' ? job.amount : null,
      actor,
    });
  }
}

export function updateJob(
  businessId: string,
  jobId: string,
  input: Partial<Pick<Job, 'title' | 'notes' | 'address' | 'amount' | 'duration_min' | 'service_type'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  if (!fields.length) return;
  fields.push('updated_at = ?');
  values.push(isoNow(), businessId, jobId);
  run(`UPDATE jobs SET ${fields.join(', ')} WHERE business_id = ? AND id = ?`, values);
}

/** Jobs a crew member sees on their phone: today first, then the rest of the week. */
export function crewQueue(businessId: string, tz: string, crewIds: string[]): JobWithCustomer[] {
  if (!crewIds.length) return [];
  const placeholders = crewIds.map(() => '?').join(',');
  return all<JobWithCustomer>(
    `${JOB_SELECT} WHERE j.business_id = ? AND j.crew_id IN (${placeholders})
       AND j.status IN ('scheduled','in_progress','complete')
       AND substr(j.scheduled_start, 1, 10) >= ?
     ORDER BY j.scheduled_start LIMIT 40`,
    [businessId, ...crewIds, todayIn(tz)],
  );
}
