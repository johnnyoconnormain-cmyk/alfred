import 'server-only';
import { all, one, run } from '../db';
import type { Customer, Invoice, Job, Photo, Quote } from '../db/types';
import { id } from '../ids';
import { isoNow } from '../dates';
import { logActivity } from './activity';

export interface CustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  source?: string | null;
  notes?: string | null;
  tags?: string | null;
}

export function listCustomers(businessId: string, search = ''): Customer[] {
  if (search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    return all<Customer>(
      `SELECT * FROM customers
       WHERE business_id = ?
         AND (lower(name) LIKE ? OR lower(coalesce(address,'')) LIKE ?
              OR coalesce(phone,'') LIKE ? OR lower(coalesce(email,'')) LIKE ?)
       ORDER BY name`,
      [businessId, q, q, q, q],
    );
  }
  return all<Customer>('SELECT * FROM customers WHERE business_id = ? ORDER BY name', [businessId]);
}

export function getCustomer(businessId: string, customerId: string): Customer | null {
  return one<Customer>('SELECT * FROM customers WHERE business_id = ? AND id = ?', [
    businessId,
    customerId,
  ]);
}

export function createCustomer(businessId: string, input: CustomerInput, actor?: string): Customer {
  const customerId = id('cus');
  run(
    `INSERT INTO customers (id, business_id, name, email, phone, address, city, state, zip, source, notes, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      businessId,
      input.name.trim(),
      input.email?.trim() || null,
      input.phone?.trim() || null,
      input.address?.trim() || null,
      input.city?.trim() || null,
      input.state?.trim() || null,
      input.zip?.trim() || null,
      input.source || null,
      input.notes || null,
      input.tags || null,
      isoNow(),
    ],
  );
  logActivity({
    businessId,
    kind: 'customer.created',
    title: `${input.name} added to customers`,
    entityType: 'customer',
    entityId: customerId,
    actor,
  });
  return getCustomer(businessId, customerId)!;
}

export function updateCustomer(
  businessId: string,
  customerId: string,
  input: Partial<CustomerInput>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: (keyof CustomerInput)[] = [
    'name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'source', 'notes', 'tags',
  ];
  for (const key of allowed) {
    if (input[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(input[key] === '' ? null : input[key]);
    }
  }
  if (!fields.length) return;
  values.push(businessId, customerId);
  run(`UPDATE customers SET ${fields.join(', ')} WHERE business_id = ? AND id = ?`, values);
}

/**
 * Finds an existing customer by phone or email before creating one. Intake forms
 * are filled by people who do not remember whether they are already in the
 * system; duplicate customer records are the fastest way to make a CRM useless.
 */
export function findOrCreateCustomer(businessId: string, input: CustomerInput): Customer {
  const phone = input.phone?.replace(/\D/g, '') || '';
  const email = input.email?.trim().toLowerCase() || '';
  if (phone.length >= 10) {
    const match = one<Customer>(
      `SELECT * FROM customers WHERE business_id = ?
        AND replace(replace(replace(replace(coalesce(phone,''), '-', ''), ' ', ''), '(', ''), ')', '') LIKE ?`,
      [businessId, `%${phone.slice(-10)}`],
    );
    if (match) return match;
  }
  if (email) {
    const match = one<Customer>(
      `SELECT * FROM customers WHERE business_id = ? AND lower(coalesce(email, '')) = ?`,
      [businessId, email],
    );
    if (match) return match;
  }
  return createCustomer(businessId, input);
}

export interface CustomerProfile {
  customer: Customer;
  jobs: Job[];
  quotes: Quote[];
  invoices: Invoice[];
  photos: Photo[];
  lifetimeValue: number;
  outstanding: number;
}

export function customerProfile(businessId: string, customerId: string): CustomerProfile | null {
  const customer = getCustomer(businessId, customerId);
  if (!customer) return null;

  const jobs = all<Job>(
    'SELECT * FROM jobs WHERE business_id = ? AND customer_id = ? ORDER BY coalesce(scheduled_start, created_at) DESC',
    [businessId, customerId],
  );
  const quotes = all<Quote>(
    'SELECT * FROM quotes WHERE business_id = ? AND customer_id = ? ORDER BY created_at DESC',
    [businessId, customerId],
  );
  const invoices = all<Invoice>(
    'SELECT * FROM invoices WHERE business_id = ? AND customer_id = ? ORDER BY created_at DESC',
    [businessId, customerId],
  );
  const photos = all<Photo>(
    `SELECT p.* FROM photos p
     LEFT JOIN jobs j ON j.id = p.job_id
     WHERE p.business_id = ? AND (j.customer_id = ? OR p.lead_id IN (
       SELECT id FROM leads WHERE customer_id = ?))
     ORDER BY p.created_at DESC LIMIT 24`,
    [businessId, customerId, customerId],
  );

  const lifetimeValue = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const outstanding = invoices
    .filter((inv) => inv.status === 'sent')
    .reduce((sum, inv) => sum + (inv.amount - inv.amount_paid), 0);

  return { customer, jobs, quotes, invoices, photos, lifetimeValue, outstanding };
}

/** Lifetime revenue per customer, for the directory list. */
export function customerTotals(businessId: string): Map<string, { paid: number; jobs: number }> {
  const rows = all<{ customer_id: string; paid: number; jobs: number }>(
    `SELECT c.id AS customer_id,
            coalesce((SELECT SUM(amount_paid) FROM invoices i WHERE i.customer_id = c.id), 0) AS paid,
            (SELECT COUNT(*) FROM jobs j WHERE j.customer_id = c.id) AS jobs
     FROM customers c WHERE c.business_id = ?`,
    [businessId],
  );
  return new Map(rows.map((r) => [r.customer_id, { paid: r.paid, jobs: r.jobs }]));
}
