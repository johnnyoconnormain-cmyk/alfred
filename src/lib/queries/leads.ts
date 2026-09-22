import 'server-only';
import { all, one, run } from '../db';
import type { Customer, Lead, LeadStatus, Photo } from '../db/types';
import { id } from '../ids';
import { isoNow } from '../dates';
import { logActivity } from './activity';

export interface LeadWithCustomer extends Lead {
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  photo_count: number;
}

const LEAD_SELECT = `
  SELECT l.*, c.name AS customer_name, c.phone AS customer_phone,
         c.email AS customer_email, c.address AS customer_address,
         (SELECT COUNT(*) FROM photos p WHERE p.lead_id = l.id) AS photo_count
  FROM leads l JOIN customers c ON c.id = l.customer_id
`;

export function listLeads(
  businessId: string,
  opts: { status?: LeadStatus | 'open' | 'all'; limit?: number } = {},
): LeadWithCustomer[] {
  const status = opts.status ?? 'open';
  const limit = opts.limit ?? 200;
  if (status === 'all') {
    return all<LeadWithCustomer>(
      `${LEAD_SELECT} WHERE l.business_id = ? ORDER BY l.created_at DESC LIMIT ?`,
      [businessId, limit],
    );
  }
  if (status === 'open') {
    return all<LeadWithCustomer>(
      `${LEAD_SELECT} WHERE l.business_id = ? AND l.status IN ('new','qualified')
       ORDER BY CASE l.urgency WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, l.created_at DESC
       LIMIT ?`,
      [businessId, limit],
    );
  }
  return all<LeadWithCustomer>(
    `${LEAD_SELECT} WHERE l.business_id = ? AND l.status = ? ORDER BY l.created_at DESC LIMIT ?`,
    [businessId, status, limit],
  );
}

export function getLead(businessId: string, leadId: string): LeadWithCustomer | null {
  return one<LeadWithCustomer>(`${LEAD_SELECT} WHERE l.business_id = ? AND l.id = ?`, [
    businessId,
    leadId,
  ]);
}

export function leadPhotos(leadId: string): Photo[] {
  return all<Photo>('SELECT * FROM photos WHERE lead_id = ? ORDER BY created_at', [leadId]);
}

export interface CreateLeadInput {
  businessId: string;
  customerId: string;
  source?: string;
  serviceType: string;
  description: string;
  summary?: string | null;
  urgency?: 'low' | 'normal' | 'high';
  preferredDate?: string | null;
  preferredTime?: string | null;
  estLow?: number | null;
  estHigh?: number | null;
  estBasis?: string | null;
}

export function createLead(input: CreateLeadInput): Lead {
  const leadId = id('lead');
  const now = isoNow();
  run(
    `INSERT INTO leads (id, business_id, customer_id, source, service_type, description, summary,
        urgency, preferred_date, preferred_time, status, est_low, est_high, est_basis, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)`,
    [
      leadId,
      input.businessId,
      input.customerId,
      input.source ?? 'website',
      input.serviceType,
      input.description,
      input.summary ?? null,
      input.urgency ?? 'normal',
      input.preferredDate ?? null,
      input.preferredTime ?? null,
      input.estLow ?? null,
      input.estHigh ?? null,
      input.estBasis ?? null,
      now,
      now,
    ],
  );
  return one<Lead>('SELECT * FROM leads WHERE id = ?', [leadId])!;
}

export function setLeadStatus(
  businessId: string,
  leadId: string,
  status: LeadStatus,
  opts: { lostReason?: string; actor?: string } = {},
): void {
  run(
    `UPDATE leads SET status = ?, lost_reason = ?, updated_at = ?
     WHERE business_id = ? AND id = ?`,
    [status, opts.lostReason ?? null, isoNow(), businessId, leadId],
  );
  const lead = getLead(businessId, leadId);
  if (!lead) return;
  logActivity({
    businessId,
    kind: `lead.${status}`,
    title: `Lead from ${lead.customer_name} marked ${status}`,
    detail: opts.lostReason ?? null,
    entityType: 'lead',
    entityId: leadId,
    actor: opts.actor,
  });
}

export function updateLeadEstimate(
  businessId: string,
  leadId: string,
  low: number,
  high: number,
  basis: string,
): void {
  run(
    'UPDATE leads SET est_low = ?, est_high = ?, est_basis = ?, updated_at = ? WHERE business_id = ? AND id = ?',
    [low, high, basis, isoNow(), businessId, leadId],
  );
}

export function leadCustomer(businessId: string, leadId: string): Customer | null {
  return one<Customer>(
    `SELECT c.* FROM customers c JOIN leads l ON l.customer_id = c.id
     WHERE l.id = ? AND c.business_id = ?`,
    [leadId, businessId],
  );
}

export function countOpenLeads(businessId: string): number {
  return (
    one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM leads WHERE business_id = ? AND status IN ('new','qualified')`,
      [businessId],
    )?.n ?? 0
  );
}
