import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { Card, Field, PageHeader } from '@/components/ui';
import { createCustomerAction } from '@/actions/leads';

export const metadata = { title: 'Add customer' };
export const dynamic = 'force-dynamic';

export default async function NewCustomerPage() {
  await requireOwner();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={
          <Link href="/customers" className="hover:underline">
            Customers
          </Link>
        }
        title="Add a customer"
      />
      <Card>
        <form action={createCustomerAction} className="space-y-4">
          <Field label="Name">
            <input name="name" required className="input" placeholder="Sarah Miller" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <input name="phone" type="tel" className="input" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" className="input" />
            </Field>
          </div>
          <Field label="Address">
            <input name="address" className="input" />
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
          <Field label="Notes" hint="Gate codes, dogs, where to park — whatever the crew needs to know.">
            <textarea name="notes" rows={3} className="input" />
          </Field>
          <div className="flex gap-2 border-t border-line pt-4">
            <button type="submit" className="btn btn-primary">
              Add customer
            </button>
            <Link href="/customers" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
