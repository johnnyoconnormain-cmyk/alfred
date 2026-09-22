import 'server-only';
import { all, run } from '../db';
import type { Activity } from '../db/types';
import { id } from '../ids';
import { isoNow } from '../dates';

export interface LogInput {
  businessId: string;
  kind: string;
  title: string;
  detail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  amount?: number | null;
  actor?: string | null;
}

/** The activity feed is the app's audit trail; every state change writes one row. */
export function logActivity(input: LogInput): void {
  run(
    `INSERT INTO activity (id, business_id, kind, title, detail, entity_type, entity_id, amount, actor, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id('act'),
      input.businessId,
      input.kind,
      input.title,
      input.detail ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      input.amount ?? null,
      input.actor ?? null,
      isoNow(),
    ],
  );
}

export function recentActivity(businessId: string, limit = 20): Activity[] {
  return all<Activity>(
    'SELECT * FROM activity WHERE business_id = ? ORDER BY created_at DESC LIMIT ?',
    [businessId, limit],
  );
}

export function activityFor(
  businessId: string,
  entityType: string,
  entityId: string,
): Activity[] {
  return all<Activity>(
    `SELECT * FROM activity
     WHERE business_id = ? AND entity_type = ? AND entity_id = ?
     ORDER BY created_at DESC LIMIT 50`,
    [businessId, entityType, entityId],
  );
}
