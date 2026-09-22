import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { listCustomers } from '@/lib/queries/customers';
import { Card, Field, PageHeader } from '@/components/ui';
import { SERVICE_TYPES } from '@/lib/ai/classify';
import { createLeadAction } from '@/actions/leads';

export const metadata = { title: 'Log a lead' };
export const dynamic = 'force-dynamic';

export default async function NewLeadPage() {
  const { business } = await requireOwner();
  const customers = listCustomers(business.id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={
          <Link href="/leads" className="hover:underline">
            Lead inbox
          </Link>
        }
        title="Log a lead"
        description="For the ones that come in by phone. Everything else arrives through your intake form on its own."
      />

      <Card>
        <form action={createLeadAction} className="space-y-4">
          <Field label="Existing customer" hint="Leave blank to create a new one from the details below.">
            <select name="customerId" className="input" defaultValue="">
              <option value="">New customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.address ? ` — ${customer.address}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input name="name" required className="input" placeholder="Sarah Miller" />
            </Field>
            <Field label="Phone">
              <input name="phone" type="tel" className="input" placeholder="(724) 555-0148" />
            </Field>
          </div>

          <Field label="Address">
            <input name="address" className="input" placeholder="412 Hunters Ridge Dr" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City">
              <input name="city" className="input" />
            </Field>
            <Field label="State">
              <input name="state" maxLength={2} className="input" />
            </Field>
            <Field label="ZIP">
              <input name="zip" className="input" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service" hint="Leave on auto and it is worked out from the request.">
              <select name="serviceType" className="input" defaultValue="">
                <option value="">Work it out for me</option>
                {SERVICE_TYPES.map((service) => (
                  <option key={service.key} value={service.key}>
                    {service.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Where did it come from?">
              <select name="source" className="input" defaultValue="phone">
                {['phone', 'website', 'google', 'referral', 'facebook', 'instagram', 'repeat'].map((source) => (
                  <option key={source} value={source}>
                    {source[0].toUpperCase() + source.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="What do they want?" hint="Write it the way they said it — the estimate reads this text.">
            <textarea
              name="description"
              required
              rows={5}
              className="input"
              placeholder="Backyard is overgrown, wants it cleaned up and mulch put down in the beds along the fence…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred date">
              <input name="preferredDate" type="date" className="input" />
            </Field>
            <Field label="Preferred time">
              <select name="preferredTime" className="input" defaultValue="">
                <option value="">No preference</option>
                <option>Morning</option>
                <option>Afternoon</option>
                <option>Flexible</option>
              </select>
            </Field>
          </div>

          <div className="flex gap-2 border-t border-line pt-4">
            <button type="submit" className="btn btn-primary">
              Create lead
            </button>
            <Link href="/leads" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
