import 'server-only';
import { all, one, run } from '../db';
import type { Business, Crew, ServiceRate, Settings, User } from '../db/types';
import { id } from '../ids';
import { isoNow } from '../dates';

export function getSettings(businessId: string): Settings {
  return one<Settings>('SELECT * FROM settings WHERE business_id = ?', [businessId])!;
}

export function updateSettings(businessId: string, input: Partial<Settings>): void {
  const allowed: (keyof Settings)[] = [
    'min_job_price', 'hourly_rate', 'material_markup', 'travel_fee', 'min_sqft', 'tax_rate',
    'deposit_pct', 'work_days', 'work_start', 'work_end', 'travel_buffer_min', 'service_area',
    'quote_valid_days',
  ];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (input[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(input[key]);
    }
  }
  if (!fields.length) return;
  fields.push('updated_at = ?');
  values.push(isoNow(), businessId);
  run(`UPDATE settings SET ${fields.join(', ')} WHERE business_id = ?`, values);
}

export function updateBusiness(businessId: string, input: Partial<Business>): void {
  const allowed: (keyof Business)[] = [
    'name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'timezone', 'review_url',
  ];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (input[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(input[key]);
    }
  }
  if (!fields.length) return;
  values.push(businessId);
  run(`UPDATE businesses SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function serviceRates(businessId: string): ServiceRate[] {
  return all<ServiceRate>(
    'SELECT * FROM service_rates WHERE business_id = ? ORDER BY active DESC, label',
    [businessId],
  );
}

export function upsertServiceRate(businessId: string, input: Partial<ServiceRate> & { service_type: string; label: string }): void {
  const existing = one<ServiceRate>(
    'SELECT * FROM service_rates WHERE business_id = ? AND service_type = ?',
    [businessId, input.service_type],
  );
  if (existing) {
    run(
      `UPDATE service_rates SET label = ?, base_price = ?, per_hour = ?, typical_hours = ?,
         material_est = ?, min_price = ?, spread_pct = ?, active = ?
       WHERE id = ?`,
      [
        input.label,
        input.base_price ?? existing.base_price,
        input.per_hour ?? existing.per_hour,
        input.typical_hours ?? existing.typical_hours,
        input.material_est ?? existing.material_est,
        input.min_price ?? existing.min_price,
        input.spread_pct ?? existing.spread_pct,
        input.active ?? existing.active,
        existing.id,
      ],
    );
    return;
  }
  run(
    `INSERT INTO service_rates (id, business_id, service_type, label, base_price, per_hour,
        typical_hours, material_est, min_price, spread_pct, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id('rate'),
      businessId,
      input.service_type,
      input.label,
      input.base_price ?? 0,
      input.per_hour ?? 0,
      input.typical_hours ?? 2,
      input.material_est ?? 0,
      input.min_price ?? 0,
      input.spread_pct ?? 18,
      input.active ?? 1,
    ],
  );
}

export function createCrew(businessId: string, name: string, color: string): Crew {
  const crewId = id('crew');
  run('INSERT INTO crews (id, business_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)', [
    crewId,
    businessId,
    name,
    color,
    isoNow(),
  ]);
  return one<Crew>('SELECT * FROM crews WHERE id = ?', [crewId])!;
}

export function crewsWithMembers(businessId: string): (Crew & { members: User[] })[] {
  const crews = all<Crew>('SELECT * FROM crews WHERE business_id = ? ORDER BY name', [businessId]);
  return crews.map((crew) => ({
    ...crew,
    members: all<User>(
      `SELECT u.* FROM users u JOIN crew_members m ON m.user_id = u.id WHERE m.crew_id = ?`,
      [crew.id],
    ),
  }));
}

export function crewIdsForUser(userId: string): string[] {
  return all<{ crew_id: string }>('SELECT crew_id FROM crew_members WHERE user_id = ?', [userId]).map(
    (r) => r.crew_id,
  );
}
