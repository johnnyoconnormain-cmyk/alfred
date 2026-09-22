import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { listCustomers } from '@/lib/queries/customers';
import { listJobs } from '@/lib/queries/jobs';
import { Card, Field, PageHeader } from '@/components/ui';
import { createInvoiceAction } from '@/actions/payments';

export const metadata = { title: 'New invoice' };
export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const { business } = await requireOwner();
  const customers = listCustomers(business.id);
  const jobs = listJobs(business.id, { status: 'complete' });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={
          <Link href="/payments" className="hover:underline">
            Payments
          </Link>
        }
        title="New invoice"
        description="Completed jobs invoice themselves. This is for anything else."
      />
      <Card>
        <form action={createInvoiceAction} className="space-y-4">
          <Field label="Customer">
            <select name="customerId" required className="input" defaultValue="">
              <option value="" disabled>
                Choose a customer
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Link to a job" hint="Optional.">
            <select name="jobId" className="input" defaultValue="">
              <option value="">No job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  #{job.number} · {job.customer_name} · {job.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount">
              <input name="amount" inputMode="decimal" required className="input tabular" placeholder="575.00" />
            </Field>
            <Field label="Due in (days)">
              <input name="dueInDays" type="number" min="0" defaultValue={14} className="input tabular" />
            </Field>
          </div>
          <div className="flex gap-2 border-t border-line pt-4">
            <button type="submit" name="send" value="yes" className="btn btn-primary">
              Create and send
            </button>
            <button type="submit" className="btn btn-secondary">
              Save as draft
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
