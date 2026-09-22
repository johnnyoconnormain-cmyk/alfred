'use client';

import { useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { money } from '@/lib/money';
import { SERVICE_TYPES } from '@/lib/ai/classify';

export interface BuilderLine {
  kind: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number; // cents
}

export interface BuilderCustomer {
  id: string;
  name: string;
  address: string | null;
}

const KINDS = [
  { key: 'labor', label: 'Labor' },
  { key: 'material', label: 'Materials' },
  { key: 'disposal', label: 'Disposal' },
  { key: 'travel', label: 'Travel' },
  { key: 'other', label: 'Other' },
];

function Submit({ label, variant = 'primary' }: { label: string; variant?: 'primary' | 'secondary' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={variant === 'primary' ? 'send' : undefined}
      value={variant === 'primary' ? 'yes' : undefined}
      className={`btn btn-${variant}`}
      disabled={pending}
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

/**
 * The quote builder.
 *
 * Line items are editable rows posted as parallel arrays, so the whole quote
 * saves in one form submission with no client-side state to lose. Totals recompute
 * as you type because the owner is usually negotiating while looking at them.
 */
export function QuoteBuilder({
  action,
  customers,
  customerId,
  leadId,
  quoteId,
  title,
  serviceType,
  notes,
  initialLines,
  taxRate,
  estimateHint,
  submitLabel = 'Save and send',
  secondaryLabel = 'Save as draft',
}: {
  action: (formData: FormData) => void | Promise<void>;
  customers: BuilderCustomer[];
  customerId?: string;
  leadId?: string | null;
  quoteId?: string;
  title?: string;
  serviceType?: string;
  notes?: string | null;
  initialLines: BuilderLine[];
  taxRate: number;
  estimateHint?: { low: number; high: number; basis: string; confidence: string } | null;
  submitLabel?: string;
  secondaryLabel?: string;
}) {
  const [lines, setLines] = useState<BuilderLine[]>(
    initialLines.length ? initialLines : [{ kind: 'labor', description: '', quantity: 1, unit: 'ea', unitPrice: 0 }],
  );

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice), 0);
    const tax = Math.round(subtotal * (taxRate / 100));
    return { subtotal, tax, total: subtotal + tax };
  }, [lines, taxRate]);

  const update = (index: number, patch: Partial<BuilderLine>) =>
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  return (
    <form action={action} className="space-y-4">
      {leadId ? <input type="hidden" name="leadId" value={leadId} /> : null}
      {quoteId ? <input type="hidden" name="quoteId" value={quoteId} /> : null}

      <div className="card card-pad space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Customer</span>
            {customerId ? (
              <>
                <input type="hidden" name="customerId" value={customerId} />
                <p className="rounded border border-line bg-paper-sunken px-3 py-2 text-sm text-ink">
                  {customers.find((c) => c.id === customerId)?.name ?? 'Selected customer'}
                </p>
              </>
            ) : (
              <select name="customerId" required className="input" defaultValue="">
                <option value="" disabled>
                  Choose a customer
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.address ? ` — ${customer.address}` : ''}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block">
            <span className="field-label">Service</span>
            <select name="serviceType" className="input" defaultValue={serviceType ?? 'cleanup'}>
              {SERVICE_TYPES.map((service) => (
                <option key={service.key} value={service.key}>
                  {service.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="field-label">Quote title</span>
          <input
            name="title"
            required
            defaultValue={title}
            className="input"
            placeholder="Backyard cleanup and mulch — 412 Hunters Ridge Dr"
          />
        </label>
      </div>

      {estimateHint ? (
        <div className="card border-dashed p-4">
          <p className="eyebrow">Starting point</p>
          <p className="mt-1 text-sm text-ink">
            Priced at{' '}
            <span className="font-semibold tabular">
              {money(estimateHint.low)}–{money(estimateHint.high)}
            </span>{' '}
            from your rate card ·{' '}
            <span className="capitalize">{estimateHint.confidence} confidence</span>
          </p>
          <p className="mt-1 text-xs text-ink-faint">{estimateHint.basis}</p>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="card-head">
          <h2 className="h-section">Line items</h2>
          <button
            type="button"
            onClick={() =>
              setLines((prev) => [...prev, { kind: 'labor', description: '', quantity: 1, unit: 'ea', unitPrice: 0 }])
            }
            className="text-xs font-semibold text-field underline underline-offset-2"
          >
            Add line
          </button>
        </div>

        <ul className="divide-y divide-line">
          {lines.map((line, index) => (
            <li key={index} className="grid grid-cols-12 gap-2 p-3 sm:p-4">
              <div className="col-span-5 sm:col-span-2">
                <span className="field-label sm:sr-only">Type</span>
                <select
                  name="itemKind"
                  value={line.kind}
                  onChange={(e) => update(index, { kind: e.target.value })}
                  className="input py-1.5 text-xs"
                >
                  {KINDS.map((kind) => (
                    <option key={kind.key} value={kind.key}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-7 sm:col-span-5">
                <span className="field-label sm:sr-only">Description</span>
                <input
                  name="itemDescription"
                  value={line.description}
                  onChange={(e) => update(index, { description: e.target.value })}
                  placeholder="Labor — 4 hrs × 2 crew"
                  className="input py-1.5 text-sm"
                />
              </div>

              <div className="col-span-3 sm:col-span-1">
                <span className="field-label sm:sr-only">Qty</span>
                <input
                  name="itemQuantity"
                  type="number"
                  step="0.25"
                  min="0"
                  value={line.quantity}
                  onChange={(e) => update(index, { quantity: Number(e.target.value) })}
                  className="input py-1.5 text-sm tabular"
                />
              </div>

              <div className="col-span-3 sm:col-span-1">
                <span className="field-label sm:sr-only">Unit</span>
                <input
                  name="itemUnit"
                  value={line.unit}
                  onChange={(e) => update(index, { unit: e.target.value })}
                  className="input py-1.5 text-sm"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <span className="field-label sm:sr-only">Price</span>
                <input
                  name="itemPrice"
                  inputMode="decimal"
                  value={line.unitPrice ? (line.unitPrice / 100).toFixed(2) : ''}
                  onChange={(e) =>
                    update(index, { unitPrice: Math.round((Number(e.target.value.replace(/[^0-9.]/g, '')) || 0) * 100) })
                  }
                  placeholder="0.00"
                  className="input py-1.5 text-sm tabular"
                />
              </div>

              <div className="col-span-2 flex items-end justify-end gap-1 sm:col-span-1">
                <span className="mr-auto text-sm font-semibold tabular text-ink sm:hidden">
                  {money(Math.round(line.quantity * line.unitPrice))}
                </span>
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  className="tap rounded p-1.5 text-ink-faint hover:bg-paper-sunken hover:text-status-critical"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-line bg-paper-sunken/40 px-4 py-3 sm:px-5">
          <dl className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="tabular font-medium">{money(totals.subtotal, { cents: true })}</dd>
            </div>
            {taxRate > 0 ? (
              <div className="flex justify-between">
                <dt className="text-ink-muted">Tax ({taxRate}%)</dt>
                <dd className="tabular font-medium">{money(totals.tax, { cents: true })}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-1.5">
              <dt className="font-display font-bold uppercase tracking-[0.08em]">Total</dt>
              <dd className="font-display text-xl font-bold tabular">{money(totals.total, { cents: true })}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card card-pad">
        <label className="block">
          <span className="field-label">Note to the customer</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={notes ?? ''}
            className="input"
            placeholder="Price holds for 30 days. Anything we find once we are on site gets approved by you before we touch it."
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Submit label={submitLabel} variant="primary" />
        <Submit label={secondaryLabel} variant="secondary" />
      </div>
    </form>
  );
}
