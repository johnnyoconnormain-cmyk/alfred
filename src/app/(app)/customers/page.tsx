import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { customerTotals, listCustomers } from '@/lib/queries/customers';
import { EmptyState, PageHeader } from '@/components/ui';
import { money } from '@/lib/money';

export const metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { business } = await requireOwner();
  const { q } = await searchParams;
  const customers = listCustomers(business.id, q ?? '');
  const totals = customerTotals(business.id);
  const lifetime = [...totals.values()].reduce((sum, t) => sum + t.paid, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Your book"
        title="Customers"
        description={`${customers.length} customer${customers.length === 1 ? '' : 's'} · ${money(
          lifetime,
        )} collected all time`}
        actions={
          <Link href="/customers/new" className="btn btn-primary btn-sm">
            Add customer
          </Link>
        }
      />

      <form className="mb-4">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name, address or phone"
          className="input max-w-md"
        />
      </form>

      <div className="card overflow-hidden">
        {customers.length === 0 ? (
          <EmptyState
            title={q ? `Nothing matches “${q}”` : 'No customers yet'}
            description={q ? undefined : 'Customers are created automatically from incoming leads.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th className="text-right">Jobs</th>
                  <th className="text-right">Lifetime value</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const total = totals.get(customer.id) ?? { paid: 0, jobs: 0 };
                  return (
                    <tr key={customer.id} className="row-link">
                      <td>
                        <Link href={`/customers/${customer.id}`} className="block font-semibold text-ink">
                          {customer.name}
                        </Link>
                      </td>
                      <td className="text-sm text-ink-muted">
                        <Link href={`/customers/${customer.id}`} className="block">
                          {customer.address ? `${customer.address}, ${customer.city ?? ''}` : '—'}
                        </Link>
                      </td>
                      <td className="text-sm tabular text-ink-muted">
                        <Link href={`/customers/${customer.id}`} className="block">
                          {customer.phone ?? '—'}
                        </Link>
                      </td>
                      <td className="text-right tabular text-ink-muted">
                        <Link href={`/customers/${customer.id}`} className="block">
                          {total.jobs}
                        </Link>
                      </td>
                      <td className="text-right">
                        <Link href={`/customers/${customer.id}`} className="block font-semibold tabular text-ink">
                          {money(total.paid)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
