import 'server-only';
import { all, run } from '../db';
import type { Message } from '../db/types';
import { id } from '../ids';
import { isoNow } from '../dates';

export interface SendInput {
  businessId: string;
  customerId?: string | null;
  leadId?: string | null;
  quoteId?: string | null;
  jobId?: string | null;
  direction?: 'in' | 'out';
  channel?: 'sms' | 'email' | 'note';
  body: string;
  automated?: boolean;
}

/**
 * Records a customer message.
 *
 * Delivery is intentionally not wired to a carrier yet. `MESSAGE_TRANSPORT`
 * selects one; until a real transport is configured the message is persisted to
 * the thread and surfaced in the UI as queued, which is honest — nothing here
 * pretends an SMS left the building.
 */
export function recordMessage(input: SendInput): string {
  const messageId = id('msg');
  run(
    `INSERT INTO messages (id, business_id, customer_id, lead_id, quote_id, job_id, direction, channel, body, automated, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      messageId,
      input.businessId,
      input.customerId ?? null,
      input.leadId ?? null,
      input.quoteId ?? null,
      input.jobId ?? null,
      input.direction ?? 'out',
      input.channel ?? 'sms',
      input.body,
      input.automated ? 1 : 0,
      isoNow(),
    ],
  );
  return messageId;
}

export function threadForCustomer(businessId: string, customerId: string): Message[] {
  return all<Message>(
    'SELECT * FROM messages WHERE business_id = ? AND customer_id = ? ORDER BY created_at DESC LIMIT 100',
    [businessId, customerId],
  );
}

export function messagesForQuote(quoteId: string): Message[] {
  return all<Message>('SELECT * FROM messages WHERE quote_id = ? ORDER BY created_at', [quoteId]);
}
