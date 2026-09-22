import 'server-only';
import { aiProvider } from './provider';

export interface FollowUpContext {
  customerName: string;
  businessName: string;
  serviceLabel: string;
  amount: string;
  daysSinceSent: number;
  stage: number;
  ownerName: string;
}

/**
 * Follow-up copy.
 *
 * Templates are the source of truth: they are what the owner edits in Automations
 * and what actually goes out. When a model is configured it is used to *warm up*
 * a draft the owner is about to edit by hand — never to send unreviewed text.
 */
export const FOLLOW_UP_TEMPLATES: Record<number, string> = {
  1: 'Hi {{first_name}}, just checking in on the {{service}} quote we sent yesterday — {{amount}}. Happy to answer any questions or get you on the schedule.',
  2: 'Hi {{first_name}}, following up on your {{service}} quote from {{business}}. We still have openings this month if you would like to lock in a date.',
  3: 'Hi {{first_name}}, last note from us on the {{service}} quote — it expires soon. If the timing is not right, no problem at all; just let us know and we will close it out.',
};

export function renderTemplate(template: string, ctx: FollowUpContext): string {
  const firstName = ctx.customerName.split(' ')[0];
  return template
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{customer\}\}/g, ctx.customerName)
    .replace(/\{\{business\}\}/g, ctx.businessName)
    .replace(/\{\{service\}\}/g, ctx.serviceLabel.toLowerCase())
    .replace(/\{\{amount\}\}/g, ctx.amount)
    .replace(/\{\{owner\}\}/g, ctx.ownerName)
    .replace(/\{\{days\}\}/g, String(ctx.daysSinceSent));
}

export function followUpBody(ctx: FollowUpContext, custom?: string | null): string {
  const template = custom || FOLLOW_UP_TEMPLATES[ctx.stage] || FOLLOW_UP_TEMPLATES[3];
  return renderTemplate(template, ctx);
}

/**
 * Optional model-assisted draft for the owner's message composer. Returns null
 * when no model is configured, and the caller falls back to the template — the
 * composer is never empty and never blocks.
 */
export async function draftMessage(intent: string, context: string): Promise<string | null> {
  const provider = aiProvider();
  if (!provider.enabled) return null;
  return provider.complete({
    system:
      'You write short, plain text messages on behalf of a small home-service contractor. ' +
      'Two or three sentences, warm but businesslike, no emoji, no marketing language, ' +
      'no sign-off block. Return only the message body.',
    prompt: `Intent: ${intent}\n\nContext:\n${context}`,
    maxTokens: 250,
  });
}

/** Plain-language recap of a finished job, for the customer-facing completion note. */
export function jobSummary(opts: {
  title: string;
  serviceLabel: string;
  checklistDone: string[];
  photoCount: number;
}): string {
  const parts = [`${opts.serviceLabel} completed.`];
  if (opts.checklistDone.length) {
    parts.push(`Crew signed off on ${opts.checklistDone.length} of the job steps.`);
  }
  if (opts.photoCount) {
    parts.push(`${opts.photoCount} photo${opts.photoCount === 1 ? '' : 's'} on file.`);
  }
  return parts.join(' ');
}
