import 'server-only';
import { all } from '../db';

export interface SearchHit {
  type: 'customer' | 'lead' | 'quote' | 'job' | 'invoice';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  amount: number | null;
}

/** Global search across every record type. Powers ⌘K and the header search. */
export function search(businessId: string, term: string, limit = 6): SearchHit[] {
  const q = `%${term.trim().toLowerCase()}%`;
  if (term.trim().length < 2) return [];

  const customers = all<{ id: string; name: string; address: string | null; revenue: number; jobs: number }>(
    `SELECT c.id, c.name, c.address,
            coalesce((SELECT SUM(amount_paid) FROM invoices i WHERE i.customer_id = c.id), 0) AS revenue,
            (SELECT COUNT(*) FROM jobs j WHERE j.customer_id = c.id) AS jobs
     FROM customers c
     WHERE c.business_id = ? AND (lower(c.name) LIKE ? OR lower(coalesce(c.address,'')) LIKE ? OR coalesce(c.phone,'') LIKE ?)
     ORDER BY revenue DESC LIMIT ?`,
    [businessId, q, q, q, limit],
  );

  const jobs = all<{ id: string; title: string; name: string; status: string; amount: number; number: number }>(
    `SELECT j.id, j.title, c.name, j.status, j.amount, j.number FROM jobs j
     JOIN customers c ON c.id = j.customer_id
     WHERE j.business_id = ? AND (lower(j.title) LIKE ? OR lower(c.name) LIKE ? OR CAST(j.number AS TEXT) LIKE ?)
     ORDER BY j.created_at DESC LIMIT ?`,
    [businessId, q, q, q, limit],
  );

  const quotes = all<{ id: string; number: number; title: string; name: string; status: string; total: number }>(
    `SELECT q.id, q.number, q.title, c.name, q.status, q.total FROM quotes q
     JOIN customers c ON c.id = q.customer_id
     WHERE q.business_id = ? AND (lower(q.title) LIKE ? OR lower(c.name) LIKE ? OR CAST(q.number AS TEXT) LIKE ?)
     ORDER BY q.created_at DESC LIMIT ?`,
    [businessId, q, q, q, limit],
  );

  const leads = all<{ id: string; service_type: string; name: string; status: string }>(
    `SELECT l.id, l.service_type, c.name, l.status FROM leads l
     JOIN customers c ON c.id = l.customer_id
     WHERE l.business_id = ? AND (lower(l.description) LIKE ? OR lower(c.name) LIKE ? OR lower(l.service_type) LIKE ?)
     ORDER BY l.created_at DESC LIMIT ?`,
    [businessId, q, q, q, limit],
  );

  const invoices = all<{ id: string; number: number; name: string; status: string; amount: number }>(
    `SELECT i.id, i.number, c.name, i.status, i.amount FROM invoices i
     JOIN customers c ON c.id = i.customer_id
     WHERE i.business_id = ? AND (lower(c.name) LIKE ? OR CAST(i.number AS TEXT) LIKE ?)
     ORDER BY i.created_at DESC LIMIT ?`,
    [businessId, q, q, limit],
  );

  return [
    ...customers.map<SearchHit>((c) => ({
      type: 'customer',
      id: c.id,
      title: c.name,
      subtitle: `${c.jobs} job${c.jobs === 1 ? '' : 's'}${c.address ? ` · ${c.address}` : ''}`,
      href: `/customers/${c.id}`,
      amount: c.revenue,
    })),
    ...jobs.map<SearchHit>((j) => ({
      type: 'job',
      id: j.id,
      title: `${j.title}`,
      subtitle: `Job #${j.number} · ${j.name} · ${j.status.replace('_', ' ')}`,
      href: `/jobs/${j.id}`,
      amount: j.amount,
    })),
    ...quotes.map<SearchHit>((qt) => ({
      type: 'quote',
      id: qt.id,
      title: `Quote #${qt.number}`,
      subtitle: `${qt.name} · ${qt.status}`,
      href: `/quotes/${qt.id}`,
      amount: qt.total,
    })),
    ...leads.map<SearchHit>((l) => ({
      type: 'lead',
      id: l.id,
      title: `${l.name}`,
      subtitle: `Lead · ${l.service_type.replace(/[-_]/g, ' ')} · ${l.status}`,
      href: `/leads/${l.id}`,
      amount: null,
    })),
    ...invoices.map<SearchHit>((i) => ({
      type: 'invoice',
      id: i.id,
      title: `Invoice #${i.number}`,
      subtitle: `${i.name} · ${i.status}`,
      href: `/payments/${i.id}`,
      amount: i.amount,
    })),
  ];
}
