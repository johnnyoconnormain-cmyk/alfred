import type { Message } from '@/lib/db/types';
import { Card } from '@/components/ui';
import { relativeTime } from '@/lib/dates';
import { messageCustomerAction } from '@/actions/leads';

/**
 * One conversation per customer, whatever it was about.
 *
 * Outbound messages are recorded and shown as queued: no SMS carrier is wired up
 * yet, and the thread says so rather than implying a text was delivered.
 */
export function MessageThread({
  messages,
  customerId,
  leadId,
  quoteId,
  jobId,
  back,
}: {
  messages: Message[];
  customerId: string;
  leadId?: string;
  quoteId?: string;
  jobId?: string;
  back: string;
}) {
  return (
    <Card title="Conversation" bodyClassName="">
      {messages.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">Nothing sent yet.</p>
      ) : (
        <ul className="max-h-80 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {messages
            .slice()
            .reverse()
            .map((message) => {
              const inbound = message.direction === 'in';
              return (
                <li key={message.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] ${inbound ? '' : 'text-right'}`}>
                    <div
                      className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        inbound
                          ? 'bg-paper-sunken text-ink'
                          : 'bg-field-light text-ink'
                      }`}
                    >
                      {message.body}
                    </div>
                    <p className="mt-1 text-2xs text-ink-faint">
                      {inbound ? 'Customer' : message.automated ? 'Automation' : 'You'} ·{' '}
                      {relativeTime(message.created_at)}
                      {!inbound ? ' · queued' : ''}
                    </p>
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      <form action={messageCustomerAction} className="border-t border-line p-3 sm:p-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId ? <input type="hidden" name="leadId" value={leadId} /> : null}
        {quoteId ? <input type="hidden" name="quoteId" value={quoteId} /> : null}
        {jobId ? <input type="hidden" name="jobId" value={jobId} /> : null}
        <input type="hidden" name="back" value={back} />
        <textarea
          name="body"
          required
          rows={2}
          placeholder="Write a message…"
          className="input min-h-0"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <select name="channel" className="input w-auto py-1.5 text-xs" defaultValue="sms">
            <option value="sms">Text message</option>
            <option value="email">Email</option>
            <option value="note">Internal note</option>
          </select>
          <button type="submit" className="btn btn-secondary btn-sm">
            Add to thread
          </button>
        </div>
        <p className="mt-2 text-2xs text-ink-faint">
          Messages are recorded on the customer record. Connect a messaging provider to send them
          automatically.
        </p>
      </form>
    </Card>
  );
}
