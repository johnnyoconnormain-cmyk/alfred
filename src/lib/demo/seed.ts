import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, run, one } from '../db';
import { hashPassword } from '../auth';
import { id, token as makeToken, slugify } from '../ids';
import { addDays, addMinutes, isoNow, todayIn, dayOfWeek } from '../dates';
import { roundToNearest } from '../money';
import { seedAutomations } from '../automations/engine';
import { serviceLabel } from '../ai/classify';
import {
  DEMO_BUSINESS,
  DEMO_CUSTOMERS,
  DEMO_MESSAGES_IN,
  DEMO_REQUESTS,
  DEMO_REVIEWS,
  DEMO_TEAM,
  SERVICE_RATE_SEED,
} from './data';
import { yardScene } from './photos';
import { DEFAULT_CHECKLIST } from '../queries/jobs';

export const DEMO_EMAIL = 'mike@ridgelinelandscape.com';
export const DEMO_PASSWORD = 'ridgeline2026';

/** Deterministic PRNG so the demo tenant looks identical on every rebuild. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const LEAD_SOURCES = ['website', 'google', 'referral', 'facebook', 'instagram', 'phone', 'repeat'];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function isoAt(date: string, hour: number, minute = 0): string {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`).toISOString();
}

function writePhoto(businessId: string, seed: number, phase: 'before' | 'after'): string {
  const dir = path.join(process.cwd(), 'public', 'uploads', 'demo');
  fs.mkdirSync(dir, { recursive: true });
  const name = `${phase}-${seed}.svg`;
  fs.writeFileSync(path.join(dir, name), yardScene({ seed, phase }), 'utf8');
  return `/uploads/demo/${name}`;
}

export interface SeedResult {
  businessId: string;
  email: string;
  password: string;
  counts: Record<string, number>;
}

export function demoBusinessId(): string | null {
  return one<{ id: string }>('SELECT id FROM businesses WHERE is_demo = 1 LIMIT 1')?.id ?? null;
}

/**
 * Builds the demo tenant: a landscaping company mid-season with 90 days of
 * history behind it and a real day ahead of it. Everything written here goes
 * through the same tables the live product uses — there is no separate "demo
 * mode" code path in the app, only this data.
 */
export function seedDemo(opts: { force?: boolean } = {}): SeedResult {
  const db = getDb();
  const existing = demoBusinessId();
  if (existing && !opts.force) {
    return {
      businessId: existing,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      counts: { skipped: 1 },
    };
  }
  if (existing) db.prepare('DELETE FROM businesses WHERE id = ?').run(existing);

  const rand = rng(20260922);
  const businessId = id('biz');
  const tz = DEMO_BUSINESS.timezone;
  const today = todayIn(tz);
  const counts: Record<string, number> = {};

  db.transaction(() => {
    /* ------------------------------- business ------------------------------- */
    run(
      `INSERT INTO businesses (id, name, slug, trade, phone, email, address, city, state, zip, timezone, plan, review_url, is_demo, created_at)
       VALUES (?, ?, ?, 'landscaping', ?, ?, ?, ?, ?, ?, ?, 'pro', ?, 1, ?)`,
      [
        businessId,
        DEMO_BUSINESS.name,
        slugify(DEMO_BUSINESS.slug),
        DEMO_BUSINESS.phone,
        DEMO_BUSINESS.email,
        DEMO_BUSINESS.address,
        DEMO_BUSINESS.city,
        DEMO_BUSINESS.state,
        DEMO_BUSINESS.zip,
        tz,
        DEMO_BUSINESS.reviewUrl,
        isoAt(addDays(today, -400), 9),
      ],
    );
    run(
      `INSERT INTO settings (business_id, min_job_price, hourly_rate, material_markup, travel_fee, min_sqft,
          tax_rate, deposit_pct, work_days, work_start, work_end, travel_buffer_min, service_area, quote_valid_days, updated_at)
       VALUES (?, 15000, 7500, 22, 3500, 200, 0, 0, '[1,2,3,4,5,6]', '07:00', '17:00', 30, ?, 30, ?)`,
      [businessId, 'Wexford, Cranberry, Sewickley, Gibsonia, Mars — 20 mile radius', isoNow()],
    );
    for (const rate of SERVICE_RATE_SEED) {
      run(
        `INSERT INTO service_rates (id, business_id, service_type, label, base_price, per_hour, typical_hours, material_est, min_price, spread_pct, active)
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

    /* --------------------------------- team --------------------------------- */
    const passwordHash = hashPassword(DEMO_PASSWORD);
    const userIds: string[] = [];
    for (const member of DEMO_TEAM) {
      const userId = id('usr');
      userIds.push(userId);
      run(
        `INSERT INTO users (id, business_id, email, name, phone, role, password_hash, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [userId, businessId, member.email, member.name, member.phone, member.role, passwordHash, isoAt(addDays(today, -380), 9)],
      );
    }
    counts.users = userIds.length;

    const crewDefs = [
      { name: 'Crew A', color: 'slot1', members: [userIds[2], userIds[3]] },
      { name: 'Crew B', color: 'slot3', members: [userIds[4], userIds[5]] },
      { name: 'Crew C', color: 'slot4', members: [userIds[6]] },
    ];
    const crewIds: string[] = [];
    for (const crew of crewDefs) {
      const crewId = id('crew');
      crewIds.push(crewId);
      run('INSERT INTO crews (id, business_id, name, color, lead_user_id, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)', [
        crewId,
        businessId,
        crew.name,
        crew.color,
        crew.members[0],
        isoAt(addDays(today, -370), 9),
      ]);
      for (const member of crew.members) {
        run('INSERT INTO crew_members (crew_id, user_id) VALUES (?, ?)', [crewId, member]);
      }
    }
    counts.crews = crewIds.length;

    /* ------------------------------- customers ------------------------------ */
    const customerIds: string[] = [];
    DEMO_CUSTOMERS.forEach((c, i) => {
      const customerId = id('cus');
      customerIds.push(customerId);
      const handle = c.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
      run(
        `INSERT INTO customers (id, business_id, name, email, phone, address, city, state, zip, source, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PA', ?, ?, ?, ?)`,
        [
          customerId,
          businessId,
          c.name,
          `${handle.slice(0, 24)}@example.com`,
          `(724) 555-0${String(200 + i).slice(-3)}`,
          c.street,
          c.city,
          c.zip,
          pick(rand, LEAD_SOURCES),
          i % 6 === 0 ? 'Gate code 4412. Dog in the back yard — friendly.' : null,
          isoAt(addDays(today, -300 + i * 6), 10),
        ],
      );
    });
    counts.customers = customerIds.length;

    /* --------------------------------- leads -------------------------------- */
    // 40 leads across the last 90 days. The oldest convert; the newest are still open.
    const leads: { id: string; customerId: string; service: string; createdDay: number; status: string }[] = [];
    for (let i = 0; i < 40; i++) {
      const request = DEMO_REQUESTS[i % DEMO_REQUESTS.length];
      const customerId = customerIds[i % customerIds.length];
      // Requests are denser in recent weeks, the way an inbox actually looks:
      // a long tail of resolved work behind, a busy fortnight in front.
      const daysAgo = Math.round(88 * Math.pow(1 - i / 39, 2.2));
      const createdDate = addDays(today, -Math.max(0, daysAgo));
      const leadId = id('lead');
      // Older leads have resolved; the tail of the list is the live inbox.
      // Outcome follows age, not list position: old requests have resolved, the
      // last fortnight is still in play, and the newest few are untouched. That
      // keeps quotes, jobs and payments landing right up to today.
      const status =
        daysAgo > 30
          ? i % 6 === 0
            ? 'lost'
            : 'won'
          : daysAgo > 10
            ? i % 4 === 0
              ? 'quoted'
              : i % 4 === 1
                ? 'lost'
                : 'won'
            : daysAgo > 3
              ? i % 4 === 3
                ? 'won'
                : i % 4 === 2
                  ? 'qualified'
                  : 'quoted'
              : i % 3 === 2
                ? 'qualified'
                : 'new';
      const urgency = request.urgency ?? (rand() > 0.85 ? 'high' : 'normal');

      run(
        `INSERT INTO leads (id, business_id, customer_id, source, service_type, description, summary, urgency,
            preferred_date, preferred_time, status, est_low, est_high, est_basis, lost_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          leadId,
          businessId,
          customerId,
          pick(rand, LEAD_SOURCES),
          request.service,
          request.text,
          request.text.slice(0, 118),
          urgency,
          rand() > 0.5 ? addDays(createdDate, 7 + Math.floor(rand() * 10)) : null,
          pick(rand, ['Morning', 'Afternoon', 'Flexible']),
          status,
          null,
          null,
          null,
          status === 'lost' ? pick(rand, ['Went with another contractor', 'Price too high', 'Postponed to next season']) : null,
          isoAt(createdDate, 8 + Math.floor(rand() * 9), Math.floor(rand() * 59)),
          isoAt(createdDate, 12),
        ],
      );
      leads.push({ id: leadId, customerId, service: request.service, createdDay: -Math.max(0, daysAgo), status });

      // Photos on roughly half the inbound requests.
      if (i % 2 === 0) {
        for (let k = 0; k < 1 + Math.floor(rand() * 2); k++) {
          run(
            `INSERT INTO photos (id, business_id, kind, lead_id, url, caption, uploaded_by, created_at)
             VALUES (?, ?, 'lead', ?, ?, ?, 'customer', ?)`,
            [
              id('pho'),
              businessId,
              leadId,
              writePhoto(businessId, i * 7 + k, 'before'),
              'Submitted with the request',
              isoAt(createdDate, 9),
            ],
          );
        }
      }
    }
    counts.leads = leads.length;

    /* --------------------------------- quotes ------------------------------- */
    const quotes: {
      id: string;
      customerId: string;
      service: string;
      total: number;
      status: string;
      day: number;
      title: string;
    }[] = [];
    let quoteNumber = 1000;

    // Every lead that got past triage was quoted; take the most recent 30 so the
    // quote book reaches today rather than stopping a month back.
    const quotable = leads
      .filter((l) => l.status !== 'new' && l.status !== 'qualified')
      .slice(-30);
    quotable.forEach((lead, i) => {
      const rate = SERVICE_RATE_SEED.find((r) => r.service_type === lead.service)!;
      const hours = rate.typical_hours * (0.8 + rand() * 0.7);
      const labor = roundToNearest(Math.round(hours * 2 * rate.per_hour));
      const materials = rate.material_est ? roundToNearest(Math.round(rate.material_est * (0.7 + rand() * 0.9))) : 0;
      const disposal = lead.service === 'cleanup' ? roundToNearest(Math.round(5000 + rand() * 12000)) : 0;
      const travel = 3500;
      const subtotal = Math.max(labor + materials + disposal + travel, rate.min_price);
      const sentDay = Math.min(0, lead.createdDay + 1 + Math.floor(rand() * 2));
      const sentDate = addDays(today, sentDay);

      const status =
        lead.status === 'won'
          ? 'accepted'
          : lead.status === 'lost'
            ? 'declined'
            : i % 5 === 0
              ? 'viewed'
              : 'sent';

      const quoteId = id('qte');
      quoteNumber += 1;
      const title = `${serviceLabel(lead.service)} — ${DEMO_CUSTOMERS[i % DEMO_CUSTOMERS.length].street.split(' ').slice(1).join(' ')}`;
      run(
        `INSERT INTO quotes (id, business_id, number, customer_id, lead_id, title, service_type, status,
            subtotal, tax, total, notes, token, sent_at, viewed_at, accepted_at, declined_at, expires_at, follow_up_stage, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quoteId,
          businessId,
          quoteNumber,
          lead.customerId,
          lead.id,
          title,
          lead.service,
          status,
          subtotal,
          subtotal,
          'Price holds for 30 days. Anything we find once we are on site gets approved by you before we touch it.',
          makeToken(),
          isoAt(sentDate, 16),
          status === 'sent' ? null : isoAt(addDays(sentDate, 1), 8),
          status === 'accepted' ? isoAt(addDays(sentDate, 1 + Math.floor(rand() * 3)), 19) : null,
          status === 'declined' ? isoAt(addDays(sentDate, 4), 11) : null,
          addDays(sentDate, 30),
          status === 'sent' || status === 'viewed' ? Math.floor(rand() * 2) : 0,
          isoAt(sentDate, 15),
          isoAt(sentDate, 16),
        ],
      );

      const lines: [string, string, number][] = [
        ['labor', `Labor — ${hours.toFixed(1)} hrs × 2 crew`, labor],
        ...(materials ? ([['material', 'Materials delivered', materials]] as [string, string, number][]) : []),
        ...(disposal ? ([['disposal', 'Debris haul-away and dump fees', disposal]] as [string, string, number][]) : []),
        ['travel', 'Travel and equipment', travel],
      ];
      lines.forEach(([kind, description, amount], sort) => {
        run(
          `INSERT INTO quote_items (id, quote_id, kind, description, quantity, unit, unit_price, total, sort)
           VALUES (?, ?, ?, ?, 1, 'ea', ?, ?, ?)`,
          [id('qi'), quoteId, kind, description, amount, amount, sort],
        );
      });

      quotes.push({ id: quoteId, customerId: lead.customerId, service: lead.service, total: subtotal, status, day: sentDay, title });
    });
    counts.quotes = quotes.length;

    /* ---------------------------------- jobs -------------------------------- */
    const accepted = quotes.filter((q) => q.status === 'accepted');
    let jobNumber = 1000;
    let invoiceNumber = 1000;
    const jobs: { id: string; customerId: string; amount: number; status: string; day: number }[] = [];

    accepted.forEach((quote, i) => {
      jobNumber += 1;
      const jobId = id('job');
      const workDay = nextWorkday(addDays(today, quote.day + 4 + Math.floor(rand() * 6)));
      const isPast = workDay < today;
      const hour = 8 + (i % 3) * 3;
      const duration = 90 + Math.floor(rand() * 5) * 30;
      const crewId = crewIds[i % crewIds.length];
      const customer = DEMO_CUSTOMERS[i % DEMO_CUSTOMERS.length];

      // Past work is finished and mostly paid; a slice stays unpaid so the
      // outstanding-payments panel has something real in it.
      const status = isPast ? (i % 6 === 0 ? 'complete' : 'paid') : 'scheduled';

      run(
        `INSERT INTO jobs (id, business_id, number, customer_id, quote_id, crew_id, title, service_type, status,
            scheduled_start, scheduled_end, duration_min, amount, address, notes, token, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          jobId,
          businessId,
          jobNumber,
          quote.customerId,
          quote.id,
          crewId,
          quote.title,
          quote.service,
          status,
          `${workDay}T${String(hour).padStart(2, '0')}:00`,
          addMinutes(`${workDay}T${String(hour).padStart(2, '0')}:00`, duration),
          duration,
          quote.total,
          `${customer.street}, ${customer.city}, PA ${customer.zip}`,
          i % 4 === 0 ? 'Park on the street — driveway is tight. Gate is on the left side of the house.' : null,
          makeToken(),
          isPast ? isoAt(workDay, hour) : null,
          isPast ? isoAt(workDay, hour + Math.ceil(duration / 60)) : null,
          isoAt(addDays(workDay, -3), 12),
          isoAt(workDay, 17),
        ],
      );

      DEFAULT_CHECKLIST.forEach((label, sort) => {
        const done = isPast || (sort < 2 && rand() > 0.7);
        run(
          'INSERT INTO job_checklist (id, job_id, label, done, done_at, done_by, sort) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id('chk'), jobId, label, done ? 1 : 0, done ? isoAt(workDay, hour + sort) : null, done ? 'Crew' : null, sort],
        );
      });

      if (isPast) {
        run(
          `INSERT INTO photos (id, business_id, kind, job_id, url, caption, uploaded_by, created_at)
           VALUES (?, ?, 'before', ?, ?, 'Before work started', 'Crew', ?)`,
          [id('pho'), businessId, jobId, writePhoto(businessId, 400 + i, 'before'), isoAt(workDay, hour)],
        );
        run(
          `INSERT INTO photos (id, business_id, kind, job_id, url, caption, uploaded_by, created_at)
           VALUES (?, ?, 'after', ?, ?, 'Completed', 'Crew', ?)`,
          [id('pho'), businessId, jobId, writePhoto(businessId, 400 + i, 'after'), isoAt(workDay, hour + 3)],
        );

        invoiceNumber += 1;
        const invoiceId = id('inv');
        const paid = status === 'paid';
        run(
          `INSERT INTO invoices (id, business_id, number, job_id, customer_id, amount, amount_paid, status, due_date, token, sent_at, paid_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            businessId,
            invoiceNumber,
            jobId,
            quote.customerId,
            quote.total,
            paid ? quote.total : 0,
            paid ? 'paid' : 'sent',
            addDays(workDay, 14),
            makeToken(),
            isoAt(workDay, 18),
            paid ? isoAt(addDays(workDay, 1 + Math.floor(rand() * 5)), 14) : null,
            isoAt(workDay, 18),
            isoAt(workDay, 18),
          ],
        );
        if (paid) {
          run(
            `INSERT INTO payments (id, business_id, invoice_id, amount, method, provider, provider_ref, status, created_at)
             VALUES (?, ?, ?, ?, ?, 'manual', NULL, 'succeeded', ?)`,
            [
              id('pay'),
              businessId,
              invoiceId,
              quote.total,
              pick(rand, ['card', 'check', 'cash', 'ach']),
              isoAt(addDays(workDay, 1 + Math.floor(rand() * 5)), 14),
            ],
          );
        }
      }
      jobs.push({ id: jobId, customerId: quote.customerId, amount: quote.total, status, day: quote.day });
    });

    /* ----------------------------- today's board ---------------------------- */
    // The demo must open onto a real working day, so today gets its own jobs
    // laid out across the crews.
    const todayPlan = [
      { hour: 9, minute: 0, service: 'cleanup', title: 'Full yard cleanup', amount: 64000, crew: 0, status: 'in_progress' },
      { hour: 11, minute: 30, service: 'lawn', title: 'Lawn maintenance — weekly', amount: 18000, crew: 1, status: 'scheduled' },
      { hour: 13, minute: 0, service: 'irrigation', title: 'Irrigation zone repair', amount: 29500, crew: 2, status: 'scheduled' },
      { hour: 14, minute: 0, service: 'mulch', title: 'Mulch installation — 9 yards', amount: 92000, crew: 0, status: 'scheduled' },
      { hour: 15, minute: 30, service: 'lawn', title: 'Lawn maintenance — biweekly', amount: 16500, crew: 1, status: 'scheduled' },
    ];
    todayPlan.forEach((plan, i) => {
      jobNumber += 1;
      const jobId = id('job');
      const customer = DEMO_CUSTOMERS[(i + 7) % DEMO_CUSTOMERS.length];
      const customerId = customerIds[(i + 7) % customerIds.length];
      const start = `${today}T${String(plan.hour).padStart(2, '0')}:${String(plan.minute).padStart(2, '0')}`;
      const duration = plan.service === 'lawn' ? 60 : 150;
      run(
        `INSERT INTO jobs (id, business_id, number, customer_id, quote_id, crew_id, title, service_type, status,
            scheduled_start, scheduled_end, duration_min, amount, address, notes, token, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          jobId,
          businessId,
          jobNumber,
          customerId,
          crewIds[plan.crew],
          plan.title,
          plan.service,
          plan.status,
          start,
          addMinutes(start, duration),
          duration,
          plan.amount,
          `${customer.street}, ${customer.city}, PA ${customer.zip}`,
          null,
          makeToken(),
          plan.status === 'in_progress' ? isoAt(today, plan.hour) : null,
          isoAt(addDays(today, -2), 10),
          isoNow(),
        ],
      );
      DEFAULT_CHECKLIST.forEach((label, sort) => {
        const done = plan.status === 'in_progress' && sort < 2;
        run('INSERT INTO job_checklist (id, job_id, label, done, done_at, done_by, sort) VALUES (?, ?, ?, ?, ?, ?, ?)', [
          id('chk'),
          jobId,
          label,
          done ? 1 : 0,
          done ? isoAt(today, plan.hour) : null,
          done ? 'Crew' : null,
          sort,
        ]);
      });
      jobs.push({ id: jobId, customerId, amount: plan.amount, status: plan.status, day: 0 });
    });

    // The week ahead. A landscaping calendar is never empty in September, and a
    // schedule view with nothing on it tells the owner nothing about the product.
    const upcoming: { offset: number; hour: number; service: string; title: string; amount: number; crew: number }[] = [
      { offset: 1, hour: 8, service: 'mulch', title: 'Mulch refresh — front and island beds', amount: 74000, crew: 0 },
      { offset: 1, hour: 13, service: 'lawn', title: 'Lawn maintenance — weekly', amount: 17500, crew: 1 },
      { offset: 2, hour: 9, service: 'cleanup', title: 'Fall cleanup — half acre', amount: 58500, crew: 0 },
      { offset: 2, hour: 14, service: 'irrigation', title: 'Backflow test and winterization', amount: 22000, crew: 2 },
      { offset: 3, hour: 8, service: 'landscaping', title: 'Foundation planting and sod repair', amount: 196000, crew: 1 },
      { offset: 4, hour: 9, service: 'lawn', title: 'Lawn maintenance — biweekly', amount: 16500, crew: 2 },
      { offset: 7, hour: 8, service: 'cleanup', title: 'Storm debris clearing and hauling', amount: 88000, crew: 0 },
      { offset: 8, hour: 10, service: 'mulch', title: 'Mulch installation — 6 yards', amount: 61000, crew: 1 },
      { offset: 9, hour: 13, service: 'lawn', title: 'Aeration and overseeding', amount: 42000, crew: 2 },
    ];
    upcoming.forEach((plan, i) => {
      jobNumber += 1;
      const jobId = id('job');
      const customerIndex = (i + 12) % customerIds.length;
      const customer = DEMO_CUSTOMERS[customerIndex];
      const workDay = nextWorkday(addDays(today, plan.offset));
      const start = `${workDay}T${String(plan.hour).padStart(2, '0')}:00`;
      const duration = plan.service === 'lawn' ? 60 : plan.service === 'landscaping' ? 420 : 180;
      run(
        `INSERT INTO jobs (id, business_id, number, customer_id, quote_id, crew_id, title, service_type, status,
            scheduled_start, scheduled_end, duration_min, amount, address, notes, token, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          jobId,
          businessId,
          jobNumber,
          customerIds[customerIndex],
          crewIds[plan.crew],
          plan.title,
          plan.service,
          start,
          addMinutes(start, duration),
          duration,
          plan.amount,
          `${customer.street}, ${customer.city}, PA ${customer.zip}`,
          makeToken(),
          isoAt(addDays(today, -1), 11),
          isoNow(),
        ],
      );
      DEFAULT_CHECKLIST.forEach((label, sort) => {
        run('INSERT INTO job_checklist (id, job_id, label, done, done_at, done_by, sort) VALUES (?, ?, ?, 0, NULL, NULL, ?)', [
          id('chk'),
          jobId,
          label,
          sort,
        ]);
      });
      jobs.push({ id: jobId, customerId: customerIds[customerIndex], amount: plan.amount, status: 'scheduled', day: plan.offset });
    });

    // Two accepted jobs deliberately left off the calendar, so the attention
    // centre has something genuine to point at.
    [0, 1].forEach((offset) => {
      jobNumber += 1;
      const customer = DEMO_CUSTOMERS[(offset + 15) % DEMO_CUSTOMERS.length];
      run(
        `INSERT INTO jobs (id, business_id, number, customer_id, quote_id, crew_id, title, service_type, status,
            scheduled_start, scheduled_end, duration_min, amount, address, notes, token, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, 'unscheduled', NULL, NULL, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          id('job'),
          businessId,
          jobNumber,
          customerIds[(offset + 15) % customerIds.length],
          offset === 0 ? 'Landscape install — front beds and walkway' : 'Fall cleanup and gutter clearing',
          offset === 0 ? 'landscaping' : 'cleanup',
          offset === 0 ? 300 : 180,
          offset === 0 ? 284000 : 51000,
          `${customer.street}, ${customer.city}, PA ${customer.zip}`,
          makeToken(),
          isoAt(addDays(today, -2), 15),
          isoNow(),
        ],
      );
    });
    counts.jobs = jobs.length + 2;

    /* ------------------------- reviews, messages, feed ---------------------- */
    const paidJobs = jobs.filter((j) => j.status === 'paid');
    DEMO_REVIEWS.forEach((review, i) => {
      const job = paidJobs[i % Math.max(1, paidJobs.length)];
      if (!job) return;
      run(
        `INSERT INTO reviews (id, business_id, job_id, customer_id, rating, comment, routed_to, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id('rev'),
          businessId,
          job.id,
          job.customerId,
          review.rating,
          review.comment,
          review.rating >= 4 ? 'public' : 'private',
          isoAt(addDays(today, -4 - i * 5), 18),
        ],
      );
    });
    counts.reviews = DEMO_REVIEWS.length;

    DEMO_MESSAGES_IN.forEach((body, i) => {
      const quote = quotes[i % quotes.length];
      if (!quote) return;
      run(
        `INSERT INTO messages (id, business_id, customer_id, quote_id, direction, channel, body, automated, created_at)
         VALUES (?, ?, ?, ?, 'in', 'sms', ?, 0, ?)`,
        [id('msg'), businessId, quote.customerId, quote.id, body, isoAt(addDays(today, -i - 1), 9 + i)],
      );
    });

    // Queue the live follow-up sequence for quotes that are still open, so the
    // automations page shows real pending work rather than an empty table.
    const followUp = one<{ id: string }>(
      `SELECT id FROM automations WHERE business_id = ? AND key = 'quote_follow_up'`,
      [businessId],
    );
    quotes
      .filter((q) => q.status === 'sent' || q.status === 'viewed')
      .forEach((quote, i) => {
        [1, 3, 7].forEach((day, stage) => {
          run(
            `INSERT INTO automation_tasks (id, business_id, automation_id, kind, run_at, status, entity_type, entity_id, payload, created_at)
             VALUES (?, ?, ?, 'quote_follow_up', ?, 'pending', 'quote', ?, ?, ?)`,
            [
              id('task'),
              businessId,
              followUp?.id ?? null,
              new Date(Date.now() + (day + (i % 3)) * 86_400_000).toISOString(),
              quote.id,
              JSON.stringify({ stage: stage + 1, day, template: null }),
              isoNow(),
            ],
          );
        });
      });

    const feed: [string, string, string | null, number | null][] = [
      ['quote.accepted', 'Sarah Miller accepted a quote', 'Backyard cleanup and mulch', 62000],
      ['photo.uploaded', 'Crew A uploaded 4 job photos', 'Johnson Residence — full yard cleanup', null],
      ['payment.received', 'Bill Thompson paid invoice #1024', 'Card · Stripe test mode', 64000],
      ['lead.created', 'New lead received from the website', 'Irrigation — two zones down', null],
      ['job.complete', 'Mulch installation marked complete', 'Crew B · 9 yards hardwood', 92000],
      ['automation.follow_up', 'Follow-up 1 sent on quote #1018', 'No response after 24 hours', null],
      ['review.received', '5-star review received', 'Fair price, no surprises', null],
      ['quote.sent', 'Quote #1031 sent to Priya Raghunathan', 'Landscape design & install', 284000],
    ];
    feed.forEach(([kind, title, detail, amount], i) => {
      run(
        `INSERT INTO activity (id, business_id, kind, title, detail, entity_type, entity_id, amount, actor, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
        [
          id('act'),
          businessId,
          kind,
          title,
          detail,
          amount,
          kind.startsWith('automation') ? 'automation' : 'system',
          new Date(Date.now() - (2 + i * 7) * 60_000).toISOString(),
        ],
      );
    });
  })();

  return { businessId, email: DEMO_EMAIL, password: DEMO_PASSWORD, counts };
}

function nextWorkday(date: string): string {
  let d = date;
  let guard = 0;
  while (dayOfWeek(d) === 0 && guard++ < 7) d = addDays(d, 1);
  return d;
}
