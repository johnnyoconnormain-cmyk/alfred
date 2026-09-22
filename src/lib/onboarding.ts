import 'server-only';
import { one, run, tx } from './db';
import type { Business, User } from './db/types';
import { hashPassword, normalizeEmail } from './auth';
import { id, slugify } from './ids';
import { isoNow } from './dates';
import { seedAutomations } from './automations/engine';
import { SERVICE_RATE_SEED } from './demo/data';

export interface ProvisionInput {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
  state?: string;
  timezone?: string;
}

export interface ProvisionResult {
  business: Business;
  user: User;
}

/**
 * Stands up a brand-new tenant: the business, its owner, a starting rate card,
 * the automation library and one crew. A business that signs up at 9am should be
 * able to send a real quote by 9:05, which means none of this can be left for
 * the owner to configure first.
 */
export function provisionBusiness(input: ProvisionInput): ProvisionResult {
  const businessId = id('biz');
  const userId = id('usr');
  const now = isoNow();
  const email = normalizeEmail(input.email);

  tx(() => {
    run(
      `INSERT INTO businesses (id, name, slug, trade, phone, city, state, timezone, plan, is_demo, created_at)
       VALUES (?, ?, ?, 'landscaping', ?, ?, ?, ?, 'starter', 0, ?)`,
      [
        businessId,
        input.businessName.trim(),
        uniqueSlug(input.businessName),
        input.phone?.trim() || null,
        input.city?.trim() || null,
        input.state?.trim() || null,
        input.timezone || 'America/New_York',
        now,
      ],
    );
    run(
      `INSERT INTO settings (business_id, updated_at) VALUES (?, ?)`,
      [businessId, now],
    );
    run(
      `INSERT INTO users (id, business_id, email, name, role, password_hash, active, created_at)
       VALUES (?, ?, ?, ?, 'owner', ?, 1, ?)`,
      [userId, businessId, email, input.ownerName.trim(), hashPassword(input.password), now],
    );
    run(
      `INSERT INTO crews (id, business_id, name, color, lead_user_id, active, created_at)
       VALUES (?, ?, 'Crew A', 'slot1', ?, 1, ?)`,
      [id('crew'), businessId, userId, now],
    );
    for (const rate of SERVICE_RATE_SEED) {
      run(
        `INSERT INTO service_rates (id, business_id, service_type, label, base_price, per_hour,
            typical_hours, material_est, min_price, spread_pct, active)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 1)`,
        [
          id('rate'),
          businessId,
          rate.service_type,
          rate.label,
          rate.per_hour,
          rate.typical_hours,
          rate.material_est,
          rate.min_price,
          rate.spread_pct,
        ],
      );
    }
    seedAutomations(businessId);
  });

  return {
    business: one<Business>('SELECT * FROM businesses WHERE id = ?', [businessId])!,
    user: one<User>('SELECT * FROM users WHERE id = ?', [userId])!,
  };
}

export function emailTaken(email: string): boolean {
  return !!one('SELECT 1 FROM users WHERE lower(email) = ?', [normalizeEmail(email)]);
}

function uniqueSlug(name: string): string {
  const base = slugify(name);
  let candidate = base;
  let n = 1;
  while (one('SELECT 1 FROM businesses WHERE slug = ?', [candidate])) {
    candidate = `${base}-${++n}`;
  }
  return candidate;
}
