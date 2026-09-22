import 'server-only';
import { all, one, run } from '../db';
import type { Automation, AutomationTask, Business } from '../db/types';
import { id } from '../ids';
import { isoNow } from '../dates';
import { money } from '../money';
import { logActivity } from '../queries/activity';
import { recordMessage } from '../queries/messages';
import { followUpBody } from '../ai/drafts';
import { serviceLabel } from '../ai/classify';

/**
 * The automation engine.
 *
 * Automations are rows, not code branches: `emit()` looks up the enabled
 * automations for an event and either acts immediately or writes a row into
 * `automation_tasks` with a `run_at`. `runDueTasks()` drains that queue. That
 * split is what makes "wait 3 days, then follow up" survive a server restart,
 * and what lets the owner see exactly what is queued and cancel it.
 *
 * Draining happens on request (see `sweep`) and can additionally be driven by a
 * cron hitting `/api/cron/automations`. Both paths are idempotent.
 */

export type TriggerEvent =
  | 'lead.created'
  | 'quote.sent'
  | 'quote.accepted'
  | 'job.completed'
  | 'invoice.paid';

export interface AutomationDefinition {
  key: string;
  name: string;
  description: string;
  trigger: TriggerEvent;
  steps: string[];
  defaultConfig: Record<string, unknown>;
}

/** The shipped automation library. Seeded per business, editable per business. */
export const AUTOMATION_LIBRARY: AutomationDefinition[] = [
  {
    key: 'new_lead',
    name: 'New lead intake',
    description: 'Acknowledge the customer and put the request in front of you within seconds.',
    trigger: 'lead.created',
    steps: ['Customer submits a request', 'Create the lead', 'Notify the owner', 'Send the customer a confirmation'],
    defaultConfig: {
      notifyOwner: true,
      confirmCustomer: true,
      confirmTemplate:
        'Thanks {{first_name}} — we got your {{service}} request. {{business}} will be back to you with a quote shortly.',
    },
  },
  {
    key: 'quote_follow_up',
    name: 'Quote follow-up sequence',
    description: 'Three nudges on an unanswered quote, then it stops. Cancels the moment they reply.',
    trigger: 'quote.sent',
    steps: ['Quote sent', 'Wait 1 day', 'Follow up', 'Wait 2 days', 'Follow up', 'Wait 4 days', 'Final follow-up'],
    defaultConfig: {
      stages: [
        { day: 1, enabled: true, template: null },
        { day: 3, enabled: true, template: null },
        { day: 7, enabled: true, template: null },
      ],
    },
  },
  {
    key: 'quote_accepted',
    name: 'Quote accepted → booking',
    description: 'Turn an acceptance into a job and get a date on the calendar without a phone call.',
    trigger: 'quote.accepted',
    steps: ['Quote accepted', 'Create the job', 'Offer available appointment times', 'Confirm the booking'],
    defaultConfig: { offerTimes: true, confirmBooking: true },
  },
  {
    key: 'job_completed',
    name: 'Job completed → paid',
    description: 'Invoice on completion, then ask for the review once the money lands.',
    trigger: 'job.completed',
    steps: ['Job marked complete', 'Send the invoice', 'Request payment', 'Request a review'],
    defaultConfig: { autoInvoice: true, dueInDays: 14, requestReview: true, reviewDelayDays: 1 },
  },
];

export function seedAutomations(businessId: string): void {
  for (const def of AUTOMATION_LIBRARY) {
    const existing = one<Automation>('SELECT * FROM automations WHERE business_id = ? AND key = ?', [
      businessId,
      def.key,
    ]);
    if (existing) continue;
    run(
      `INSERT INTO automations (id, business_id, key, name, description, trigger_event, enabled, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id('auto'),
        businessId,
        def.key,
        def.name,
        def.description,
        def.trigger,
        JSON.stringify(def.defaultConfig),
        isoNow(),
        isoNow(),
      ],
    );
  }
}

export function listAutomations(businessId: string): (Automation & { definition: AutomationDefinition | undefined; pending: number })[] {
  return all<Automation>('SELECT * FROM automations WHERE business_id = ? ORDER BY name', [
    businessId,
  ]).map((a) => ({
    ...a,
    definition: AUTOMATION_LIBRARY.find((d) => d.key === a.key),
    pending:
      one<{ n: number }>(
        `SELECT COUNT(*) AS n FROM automation_tasks WHERE automation_id = ? AND status = 'pending'`,
        [a.id],
      )?.n ?? 0,
  }));
}

export function setAutomationEnabled(businessId: string, key: string, enabled: boolean): void {
  run('UPDATE automations SET enabled = ?, updated_at = ? WHERE business_id = ? AND key = ?', [
    enabled ? 1 : 0,
    isoNow(),
    businessId,
    key,
  ]);
  if (!enabled) {
    run(
      `UPDATE automation_tasks SET status = 'cancelled', ran_at = ?
       WHERE status = 'pending' AND automation_id IN (SELECT id FROM automations WHERE business_id = ? AND key = ?)`,
      [isoNow(), businessId, key],
    );
  }
}

export function updateAutomationConfig(businessId: string, key: string, config: unknown): void {
  run('UPDATE automations SET config = ?, updated_at = ? WHERE business_id = ? AND key = ?', [
    JSON.stringify(config),
    isoNow(),
    businessId,
    key,
  ]);
}

function automationFor(businessId: string, key: string): (Automation & { parsed: Record<string, unknown> }) | null {
  const row = one<Automation>(
    'SELECT * FROM automations WHERE business_id = ? AND key = ? AND enabled = 1',
    [businessId, key],
  );
  if (!row) return null;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(row.config) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  return { ...row, parsed };
}

function queue(input: {
  businessId: string;
  automationId: string;
  kind: string;
  runAt: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}): void {
  run(
    `INSERT INTO automation_tasks (id, business_id, automation_id, kind, run_at, status, entity_type, entity_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    [
      id('task'),
      input.businessId,
      input.automationId,
      input.kind,
      input.runAt,
      input.entityType,
      input.entityId,
      JSON.stringify(input.payload ?? {}),
      isoNow(),
    ],
  );
}

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/* ---------------------------------- events ---------------------------------- */

export interface EmitContext {
  business: Business;
  leadId?: string;
  quoteId?: string;
  jobId?: string;
  invoiceId?: string;
  customerId?: string;
}

/** Fired by the mutation that caused the state change. Never throws into the caller. */
export function emit(event: TriggerEvent, ctx: EmitContext): void {
  try {
    switch (event) {
      case 'lead.created':
        onLeadCreated(ctx);
        break;
      case 'quote.sent':
        onQuoteSent(ctx);
        break;
      case 'quote.accepted':
        onQuoteAccepted(ctx);
        break;
      case 'job.completed':
        onJobCompleted(ctx);
        break;
      case 'invoice.paid':
        onInvoicePaid(ctx);
        break;
    }
  } catch (err) {
    logActivity({
      businessId: ctx.business.id,
      kind: 'automation.error',
      title: `Automation for ${event} could not run`,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

function onLeadCreated(ctx: EmitContext): void {
  const automation = automationFor(ctx.business.id, 'new_lead');
  if (!automation || !ctx.leadId) return;
  const lead = one<{ customer_id: string; service_type: string; customer_name: string }>(
    `SELECT l.customer_id, l.service_type, c.name AS customer_name
     FROM leads l JOIN customers c ON c.id = l.customer_id WHERE l.id = ?`,
    [ctx.leadId],
  );
  if (!lead) return;

  if (automation.parsed.confirmCustomer !== false) {
    const template =
      (automation.parsed.confirmTemplate as string) ||
      'Thanks {{first_name}} — we got your {{service}} request.';
    recordMessage({
      businessId: ctx.business.id,
      customerId: lead.customer_id,
      leadId: ctx.leadId,
      channel: 'sms',
      automated: true,
      body: followUpBody(
        {
          customerName: lead.customer_name,
          businessName: ctx.business.name,
          serviceLabel: serviceLabel(lead.service_type),
          amount: '',
          daysSinceSent: 0,
          stage: 1,
          ownerName: ctx.business.name,
        },
        template,
      ),
    });
  }
  if (automation.parsed.notifyOwner !== false) {
    logActivity({
      businessId: ctx.business.id,
      kind: 'lead.created',
      title: `New lead — ${lead.customer_name}`,
      detail: serviceLabel(lead.service_type),
      entityType: 'lead',
      entityId: ctx.leadId,
    });
  }
  run('UPDATE automations SET run_count = run_count + 1 WHERE id = ?', [automation.id]);
}

function onQuoteSent(ctx: EmitContext): void {
  const automation = automationFor(ctx.business.id, 'quote_follow_up');
  if (!automation || !ctx.quoteId) return;

  const stages = (automation.parsed.stages as { day: number; enabled: boolean; template: string | null }[]) ?? [];
  // Re-sending a quote replaces the queue rather than stacking a second sequence.
  run(
    `UPDATE automation_tasks SET status = 'cancelled', ran_at = ?
     WHERE entity_type = 'quote' AND entity_id = ? AND status = 'pending'`,
    [isoNow(), ctx.quoteId],
  );
  stages
    .filter((s) => s.enabled !== false)
    .forEach((stage, index) => {
      queue({
        businessId: ctx.business.id,
        automationId: automation.id,
        kind: 'quote_follow_up',
        runAt: inDays(stage.day),
        entityType: 'quote',
        entityId: ctx.quoteId!,
        payload: { stage: index + 1, template: stage.template, day: stage.day },
      });
    });
  run('UPDATE automations SET run_count = run_count + 1 WHERE id = ?', [automation.id]);
}

function onQuoteAccepted(ctx: EmitContext): void {
  const automation = automationFor(ctx.business.id, 'quote_accepted');
  if (!automation || !ctx.jobId) return;
  run('UPDATE automations SET run_count = run_count + 1 WHERE id = ?', [automation.id]);
  logActivity({
    businessId: ctx.business.id,
    kind: 'automation.booking',
    title: 'Booking times offered to customer',
    entityType: 'job',
    entityId: ctx.jobId,
  });
}

function onJobCompleted(ctx: EmitContext): void {
  const automation = automationFor(ctx.business.id, 'job_completed');
  if (!automation || !ctx.jobId) return;
  if (automation.parsed.requestReview !== false) {
    queue({
      businessId: ctx.business.id,
      automationId: automation.id,
      kind: 'review_request',
      runAt: inDays(Number(automation.parsed.reviewDelayDays ?? 1)),
      entityType: 'job',
      entityId: ctx.jobId,
    });
  }
  run('UPDATE automations SET run_count = run_count + 1 WHERE id = ?', [automation.id]);
}

function onInvoicePaid(ctx: EmitContext): void {
  if (!ctx.invoiceId) return;
  logActivity({
    businessId: ctx.business.id,
    kind: 'invoice.paid',
    title: 'Invoice settled',
    entityType: 'invoice',
    entityId: ctx.invoiceId,
  });
}

/* ------------------------------- task draining ------------------------------ */

export interface SweepResult {
  ran: number;
  cancelled: number;
}

/**
 * Runs every pending task whose time has come for one business.
 *
 * Called at the top of the dashboard render, so an owner who opens the app after
 * the weekend sees the follow-ups that were due while they were away already
 * sent. Cheap when there is nothing to do: one indexed count.
 */
export function sweep(business: Business): SweepResult {
  const due = all<AutomationTask>(
    `SELECT * FROM automation_tasks WHERE business_id = ? AND status = 'pending' AND run_at <= ?
     ORDER BY run_at LIMIT 50`,
    [business.id, isoNow()],
  );
  let ran = 0;
  let cancelled = 0;

  for (const task of due) {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(task.payload) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    const outcome =
      task.kind === 'quote_follow_up'
        ? runQuoteFollowUp(business, task, payload)
        : task.kind === 'review_request'
          ? runReviewRequest(business, task)
          : { status: 'cancelled' as const, note: `Unknown task kind ${task.kind}` };

    run(`UPDATE automation_tasks SET status = ?, ran_at = ?, result = ? WHERE id = ?`, [
      outcome.status,
      isoNow(),
      outcome.note,
      task.id,
    ]);
    if (outcome.status === 'done') ran++;
    else cancelled++;
  }
  return { ran, cancelled };
}

type Outcome = { status: 'done' | 'cancelled' | 'failed'; note: string };

function runQuoteFollowUp(
  business: Business,
  task: AutomationTask,
  payload: Record<string, unknown>,
): Outcome {
  const quote = one<{
    id: string;
    number: number;
    status: string;
    total: number;
    service_type: string;
    sent_at: string | null;
    customer_id: string;
    customer_name: string;
    follow_up_stage: number;
  }>(
    `SELECT q.id, q.number, q.status, q.total, q.service_type, q.sent_at, q.customer_id,
            c.name AS customer_name, q.follow_up_stage
     FROM quotes q JOIN customers c ON c.id = q.customer_id WHERE q.id = ?`,
    [task.entity_id],
  );
  if (!quote) return { status: 'cancelled', note: 'Quote no longer exists.' };
  if (!['sent', 'viewed'].includes(quote.status)) {
    return { status: 'cancelled', note: `Quote is ${quote.status}; follow-up not needed.` };
  }

  const stage = Number(payload.stage ?? 1);
  const days = Number(payload.day ?? stage);
  const body = followUpBody(
    {
      customerName: quote.customer_name,
      businessName: business.name,
      serviceLabel: serviceLabel(quote.service_type),
      amount: money(quote.total),
      daysSinceSent: days,
      stage,
      ownerName: business.name,
    },
    (payload.template as string) ?? null,
  );

  recordMessage({
    businessId: business.id,
    customerId: quote.customer_id,
    quoteId: quote.id,
    channel: 'sms',
    automated: true,
    body,
  });
  run('UPDATE quotes SET follow_up_stage = ? WHERE id = ?', [stage, quote.id]);
  logActivity({
    businessId: business.id,
    kind: 'automation.follow_up',
    title: `Follow-up ${stage} sent on quote #${quote.number}`,
    detail: body,
    entityType: 'quote',
    entityId: quote.id,
    actor: 'automation',
  });
  return { status: 'done', note: `Follow-up ${stage} sent.` };
}

function runReviewRequest(business: Business, task: AutomationTask): Outcome {
  const job = one<{
    id: string;
    token: string;
    status: string;
    customer_id: string;
    customer_name: string;
    title: string;
  }>(
    `SELECT j.id, j.token, j.status, j.customer_id, c.name AS customer_name, j.title
     FROM jobs j JOIN customers c ON c.id = j.customer_id WHERE j.id = ?`,
    [task.entity_id],
  );
  if (!job) return { status: 'cancelled', note: 'Job no longer exists.' };
  if (!['complete', 'paid'].includes(job.status)) {
    return { status: 'cancelled', note: `Job is ${job.status}; review request skipped.` };
  }
  const existing = one<{ n: number }>('SELECT COUNT(*) AS n FROM reviews WHERE job_id = ?', [job.id]);
  if ((existing?.n ?? 0) > 0) return { status: 'cancelled', note: 'Customer already reviewed.' };

  const first = job.customer_name.split(' ')[0];
  recordMessage({
    businessId: business.id,
    customerId: job.customer_id,
    jobId: job.id,
    channel: 'sms',
    automated: true,
    body: `Hi ${first}, thanks for choosing ${business.name}. How did we do? ${appUrl()}/review/${job.token}`,
  });
  logActivity({
    businessId: business.id,
    kind: 'automation.review_request',
    title: `Review requested from ${job.customer_name}`,
    entityType: 'job',
    entityId: job.id,
    actor: 'automation',
  });
  return { status: 'done', note: 'Review request sent.' };
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

export function pendingTasks(businessId: string, limit = 25): (AutomationTask & { customer_name: string | null })[] {
  return all<AutomationTask & { customer_name: string | null }>(
    `SELECT t.*, c.name AS customer_name FROM automation_tasks t
     LEFT JOIN quotes q ON q.id = t.entity_id AND t.entity_type = 'quote'
     LEFT JOIN jobs j ON j.id = t.entity_id AND t.entity_type = 'job'
     LEFT JOIN customers c ON c.id = coalesce(q.customer_id, j.customer_id)
     WHERE t.business_id = ? AND t.status = 'pending'
     ORDER BY t.run_at LIMIT ?`,
    [businessId, limit],
  );
}

export function recentTaskRuns(businessId: string, limit = 25): AutomationTask[] {
  return all<AutomationTask>(
    `SELECT * FROM automation_tasks WHERE business_id = ? AND status != 'pending'
     ORDER BY ran_at DESC LIMIT ?`,
    [businessId, limit],
  );
}
