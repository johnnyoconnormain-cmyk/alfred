import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { listCustomers } from '@/lib/queries/customers';
import { listCrews } from '@/lib/queries/schedule';
import { Card, Field, PageHeader } from '@/components/ui';
import { SERVICE_TYPES } from '@/lib/ai/classify';
import { createJobAction } from '@/actions/jobs';

export const metadata = { title: 'New job' };
export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
  const { business } = await requireOwner();
  const customers = listCustomers(business.id);
  const crews = listCrews(business.id).filter((c) => c.active);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={
          <Link href="/jobs" className="hover:underline">
            Jobs
          </Link>
        }
        title="New job"
        description="For work that never went through a quote — a repeat mow, a warranty visit, a favour for a good customer."
      />

      <Card>
        <form action={createJobAction} className="space-y-4">
          <Field label="Customer">
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
          </Field>

          <Field label="What is the work?">
            <input name="title" required className="input" placeholder="Lawn maintenance — weekly" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service">
              <select name="serviceType" className="input" defaultValue="lawn">
                {SERVICE_TYPES.map((service) => (
                  <option key={service.key} value={service.key}>
                    {service.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price">
              <input name="amount" inputMode="decimal" className="input tabular" placeholder="180.00" />
            </Field>
          </div>

          <Field label="Address">
            <input name="address" className="input" placeholder="Leave blank to use the customer address" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date and time">
              <input name="scheduledStart" type="datetime-local" className="input" />
            </Field>
            <Field label="Minutes on site">
              <input name="durationMin" type="number" min="30" step="30" defaultValue={120} className="input tabular" />
            </Field>
            <Field label="Crew">
              <select name="crewId" className="input" defaultValue="">
                <option value="">Assign later</option>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes for the crew">
            <textarea name="notes" rows={3} className="input" placeholder="Park on the street — driveway is tight." />
          </Field>

          <div className="flex gap-2 border-t border-line pt-4">
            <button type="submit" className="btn btn-primary">
              Create job
            </button>
            <Link href="/jobs" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
