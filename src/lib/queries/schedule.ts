import 'server-only';
import { all } from '../db';
import type { Crew, Settings } from '../db/types';
import {
  addDays,
  dayOfWeek,
  fromMinutes,
  minutesOfDay,
  todayIn,
} from '../dates';

export interface Slot {
  start: string; // wall-clock `YYYY-MM-DDTHH:mm`
  date: string;
  crewId: string;
  crewName: string;
}

export interface DayOffer {
  date: string;
  slots: Slot[];
}

interface BusyBlock {
  crewId: string | null;
  date: string;
  start: number;
  end: number;
}

/**
 * Availability search.
 *
 * Walks forward day by day from `from`, and for each working day and each active
 * crew finds gaps big enough for `durationMin` plus the travel buffer on either
 * side. This is deliberately a pure function of data already in the database —
 * no external calendar to fall out of sync with.
 */
export function findAvailability(
  businessId: string,
  settings: Settings,
  opts: {
    durationMin: number;
    from?: string;
    days?: number;
    maxPerDay?: number;
    maxDays?: number;
    crewId?: string | null;
  },
): DayOffer[] {
  const workDays: number[] = safeParse(settings.work_days, [1, 2, 3, 4, 5]);
  const dayStart = minutesOfDay(settings.work_start);
  const dayEnd = minutesOfDay(settings.work_end);
  const buffer = settings.travel_buffer_min;
  const duration = Math.max(30, opts.durationMin);
  const searchDays = opts.days ?? 21;
  const maxPerDay = opts.maxPerDay ?? 3;
  const maxDays = opts.maxDays ?? 5;

  const crews = all<Crew>(
    'SELECT * FROM crews WHERE business_id = ? AND active = 1 ORDER BY name',
    [businessId],
  ).filter((c) => !opts.crewId || c.id === opts.crewId);
  if (!crews.length) return [];

  const from = opts.from ?? todayIn('America/New_York');
  const until = addDays(from, searchDays);

  const busy: BusyBlock[] = all<{ crew_id: string | null; scheduled_start: string; duration_min: number }>(
    `SELECT crew_id, scheduled_start, duration_min FROM jobs
     WHERE business_id = ? AND scheduled_start IS NOT NULL
       AND substr(scheduled_start, 1, 10) BETWEEN ? AND ?
       AND status NOT IN ('cancelled')`,
    [businessId, from, until],
  ).map((row) => ({
    crewId: row.crew_id,
    date: row.scheduled_start.slice(0, 10),
    start: minutesOfDay(row.scheduled_start),
    end: minutesOfDay(row.scheduled_start) + row.duration_min,
  }));

  const timeOff = all<{ start_date: string; end_date: string; crew_id: string | null }>(
    'SELECT start_date, end_date, crew_id FROM time_off WHERE business_id = ?',
    [businessId],
  );

  const offers: DayOffer[] = [];
  for (let i = 0; i <= searchDays && offers.length < maxDays; i++) {
    const date = addDays(from, i);
    if (!workDays.includes(dayOfWeek(date))) continue;

    const slots: Slot[] = [];
    for (const crew of crews) {
      if (timeOff.some((t) => (!t.crew_id || t.crew_id === crew.id) && date >= t.start_date && date <= t.end_date)) {
        continue;
      }
      const taken = busy
        .filter((b) => b.date === date && b.crewId === crew.id)
        .sort((a, b) => a.start - b.start);

      let cursor = dayStart;
      for (const block of taken) {
        const gap = block.start - buffer - cursor;
        if (gap >= duration) pushSlots(slots, date, cursor, block.start - buffer, duration, crew);
        cursor = Math.max(cursor, block.end + buffer);
      }
      if (dayEnd - cursor >= duration) pushSlots(slots, date, cursor, dayEnd, duration, crew);
    }

    // Dedupe by time so the customer sees "9:00 AM" once, not once per crew.
    const seen = new Set<string>();
    const unique = slots
      .sort((a, b) => a.start.localeCompare(b.start))
      .filter((s) => {
        const key = s.start.slice(11);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, maxPerDay);

    if (unique.length) offers.push({ date, slots: unique });
  }
  return offers;
}

function pushSlots(
  out: Slot[],
  date: string,
  fromMin: number,
  toMin: number,
  duration: number,
  crew: Crew,
): void {
  // Offer slots on clean half-hour boundaries rather than every open minute.
  const step = 90;
  let t = Math.ceil(fromMin / 30) * 30;
  while (t + duration <= toMin) {
    out.push({ start: fromMinutes(date, t), date, crewId: crew.id, crewName: crew.name });
    t += step;
  }
}

export function listCrews(businessId: string): Crew[] {
  return all<Crew>('SELECT * FROM crews WHERE business_id = ? ORDER BY active DESC, name', [
    businessId,
  ]);
}

export interface CrewStatus {
  crew: Crew;
  state: 'working' | 'traveling' | 'available' | 'done';
  current: { title: string; customer: string; start: string; end: string } | null;
  next: { title: string; customer: string; start: string } | null;
  jobsToday: number;
  revenueToday: number;
}

/** Derived live crew state — computed from today's schedule, not a status field. */
export function crewStatuses(businessId: string, tz: string, nowWall: string): CrewStatus[] {
  const today = todayIn(tz);
  const nowMin = minutesOfDay(nowWall);
  const crews = all<Crew>('SELECT * FROM crews WHERE business_id = ? AND active = 1 ORDER BY name', [
    businessId,
  ]);
  const jobs = all<{
    crew_id: string | null;
    title: string;
    customer_name: string;
    scheduled_start: string;
    scheduled_end: string;
    amount: number;
    status: string;
  }>(
    `SELECT j.crew_id, j.title, c.name AS customer_name, j.scheduled_start, j.scheduled_end, j.amount, j.status
     FROM jobs j JOIN customers c ON c.id = j.customer_id
     WHERE j.business_id = ? AND substr(j.scheduled_start, 1, 10) = ? AND j.status != 'cancelled'
     ORDER BY j.scheduled_start`,
    [businessId, today],
  );

  return crews.map((crew) => {
    const mine = jobs.filter((j) => j.crew_id === crew.id);
    const current =
      mine.find(
        (j) =>
          j.status === 'in_progress' ||
          (minutesOfDay(j.scheduled_start) <= nowMin && minutesOfDay(j.scheduled_end) > nowMin),
      ) ?? null;
    const next = mine.find((j) => minutesOfDay(j.scheduled_start) > nowMin) ?? null;

    let state: CrewStatus['state'] = 'available';
    if (current) state = 'working';
    else if (next) state = 'traveling';
    else if (mine.length) state = 'done';

    return {
      crew,
      state,
      current: current
        ? {
            title: current.title,
            customer: current.customer_name,
            start: current.scheduled_start,
            end: current.scheduled_end,
          }
        : null,
      next: next
        ? { title: next.title, customer: next.customer_name, start: next.scheduled_start }
        : null,
      jobsToday: mine.length,
      revenueToday: mine.reduce((sum, j) => sum + j.amount, 0),
    };
  });
}

export function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
