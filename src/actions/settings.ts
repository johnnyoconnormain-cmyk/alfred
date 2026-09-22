'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/session';
import { createCrew, updateBusiness, updateSettings, upsertServiceRate } from '@/lib/queries/settings';
import { setAutomationEnabled, updateAutomationConfig } from '@/lib/automations/engine';
import { parseMoney } from '@/lib/money';
import { run } from '@/lib/db';
import { hashPassword, isValidEmail, normalizeEmail, validatePassword } from '@/lib/auth';
import { emailTaken } from '@/lib/onboarding';
import { id } from '@/lib/ids';
import { isoNow } from '@/lib/dates';

export async function updateBusinessAction(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  updateBusiness(business.id, {
    name: String(formData.get('name') ?? business.name),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    address: String(formData.get('address') ?? ''),
    city: String(formData.get('city') ?? ''),
    state: String(formData.get('state') ?? ''),
    zip: String(formData.get('zip') ?? ''),
    timezone: String(formData.get('timezone') ?? business.timezone),
    review_url: String(formData.get('reviewUrl') ?? ''),
  });
  revalidatePath('/settings');
}

export async function updatePricingAction(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  updateSettings(business.id, {
    min_job_price: parseMoney(String(formData.get('minJobPrice') ?? '')),
    hourly_rate: parseMoney(String(formData.get('hourlyRate') ?? '')),
    material_markup: Number(formData.get('materialMarkup')) || 0,
    travel_fee: parseMoney(String(formData.get('travelFee') ?? '')),
    min_sqft: Number(formData.get('minSqft')) || 0,
    tax_rate: Number(formData.get('taxRate')) || 0,
    quote_valid_days: Number(formData.get('quoteValidDays')) || 30,
  });
  revalidatePath('/settings');
}

export async function updateScheduleSettingsAction(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  const days = formData.getAll('workDays').map((d) => Number(d)).filter((d) => !Number.isNaN(d));
  updateSettings(business.id, {
    work_days: JSON.stringify(days.length ? days : [1, 2, 3, 4, 5]),
    work_start: String(formData.get('workStart') ?? '07:00'),
    work_end: String(formData.get('workEnd') ?? '17:00'),
    travel_buffer_min: Number(formData.get('travelBuffer')) || 30,
    service_area: String(formData.get('serviceArea') ?? ''),
  });
  revalidatePath('/settings');
  revalidatePath('/schedule');
}

export async function updateRateAction(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  upsertServiceRate(business.id, {
    service_type: String(formData.get('serviceType') ?? ''),
    label: String(formData.get('label') ?? ''),
    per_hour: parseMoney(String(formData.get('perHour') ?? '')),
    typical_hours: Number(formData.get('typicalHours')) || 2,
    material_est: parseMoney(String(formData.get('materialEst') ?? '')),
    min_price: parseMoney(String(formData.get('minPrice') ?? '')),
    spread_pct: Number(formData.get('spread')) || 18,
    active: formData.get('active') === 'yes' ? 1 : 0,
  });
  revalidatePath('/settings');
}

export async function addCrewAction(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  createCrew(business.id, name, String(formData.get('color') ?? 'slot1'));
  revalidatePath('/settings');
  revalidatePath('/schedule');
}

export async function addTeamMemberAction(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  const email = String(formData.get('email') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!name || !isValidEmail(email) || validatePassword(password) || emailTaken(email)) return;

  const userId = id('usr');
  run(
    `INSERT INTO users (id, business_id, email, name, phone, role, password_hash, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      userId,
      business.id,
      normalizeEmail(email),
      name,
      String(formData.get('phone') ?? '') || null,
      String(formData.get('role') ?? 'crew'),
      hashPassword(password),
      isoNow(),
    ],
  );
  const crewId = String(formData.get('crewId') ?? '');
  if (crewId) {
    run('INSERT OR IGNORE INTO crew_members (crew_id, user_id) VALUES (?, ?)', [crewId, userId]);
  }
  revalidatePath('/settings');
}

export async function toggleAutomationAction(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  setAutomationEnabled(
    business.id,
    String(formData.get('key') ?? ''),
    formData.get('enabled') === 'yes',
  );
  revalidatePath('/automations');
  revalidatePath('/dashboard');
}

export async function updateFollowUpAction(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  const stages = [1, 2, 3].map((n) => ({
    day: Number(formData.get(`day${n}`)) || n * 2,
    enabled: formData.get(`enabled${n}`) === 'yes',
    template: String(formData.get(`template${n}`) ?? '').trim() || null,
  }));
  updateAutomationConfig(business.id, 'quote_follow_up', { stages });
  revalidatePath('/automations');
}

export async function updateAutomationOptionsAction(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  const key = String(formData.get('key') ?? '');

  if (key === 'new_lead') {
    updateAutomationConfig(business.id, key, {
      notifyOwner: formData.get('notifyOwner') === 'yes',
      confirmCustomer: formData.get('confirmCustomer') === 'yes',
      confirmTemplate: String(formData.get('confirmTemplate') ?? ''),
    });
  } else if (key === 'job_completed') {
    updateAutomationConfig(business.id, key, {
      autoInvoice: formData.get('autoInvoice') === 'yes',
      dueInDays: Number(formData.get('dueInDays')) || 14,
      requestReview: formData.get('requestReview') === 'yes',
      reviewDelayDays: Number(formData.get('reviewDelayDays')) || 1,
    });
  } else if (key === 'quote_accepted') {
    updateAutomationConfig(business.id, key, {
      offerTimes: formData.get('offerTimes') === 'yes',
      confirmBooking: formData.get('confirmBooking') === 'yes',
    });
  }
  revalidatePath('/automations');
}

export async function cancelTaskAction(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  run(
    `UPDATE automation_tasks SET status = 'cancelled', ran_at = ?, result = 'Cancelled by owner'
     WHERE id = ? AND business_id = ? AND status = 'pending'`,
    [isoNow(), String(formData.get('taskId') ?? ''), business.id],
  );
  revalidatePath('/automations');
}
