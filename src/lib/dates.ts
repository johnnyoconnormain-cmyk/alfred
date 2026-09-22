/**
 * Two kinds of time live in this app and they are deliberately different:
 *
 *  - **Timestamps** (`created_at`, `sent_at`, …) are full UTC ISO strings. They
 *    describe a moment and get compared across tenants.
 *  - **Schedule values** (`scheduled_start`, `preferred_date`, …) are naive
 *    wall-clock strings — `2026-09-24T09:00` — interpreted in the business's own
 *    timezone. A 9:00 AM job is 9:00 AM to the crew regardless of server locale,
 *    and no daylight-saving shift can slide it an hour.
 */

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isoNow(): string {
  return new Date().toISOString();
}

/** Current wall-clock date in a timezone, as `YYYY-MM-DD`. */
export function todayIn(tz = 'America/New_York'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}

/** Current wall-clock moment in a timezone, as `YYYY-MM-DDTHH:mm`. */
export function nowIn(tz = 'America/New_York'): string {
  const d = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => d.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Parse `YYYY-MM-DD` into a UTC-anchored Date so date math never drifts. */
export function dateOnly(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function addDays(s: string, n: number): string {
  const d = dateOnly(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMinutes(wallClock: string, minutes: number): string {
  const [date, time = '00:00'] = wallClock.split('T');
  const d = dateOnly(date);
  const [h, mi] = time.split(':').map(Number);
  d.setUTCHours(h, mi + minutes, 0, 0);
  return `${d.toISOString().slice(0, 10)}T${d.toISOString().slice(11, 16)}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((dateOnly(b).getTime() - dateOnly(a).getTime()) / 86_400_000);
}

export function dayOfWeek(s: string): number {
  return dateOnly(s).getUTCDay();
}

/** `Thursday, September 24` */
export function formatDate(s: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = {}): string {
  if (!s) return '—';
  const d = dateOnly(s);
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const withYear = opts.year ? `${base}, ${d.getUTCFullYear()}` : base;
  return opts.weekday === false ? withYear : `${DAY_NAMES[d.getUTCDay()]}, ${withYear}`;
}

/** `Sep 24` */
export function formatDateShort(s: string | null | undefined): string {
  if (!s) return '—';
  const d = dateOnly(s);
  return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}

/** `9:00 AM` from `2026-09-24T09:00` or `09:00`. */
export function formatTime(s: string | null | undefined): string {
  if (!s) return '—';
  const time = s.includes('T') ? s.split('T')[1] : s;
  const [hRaw, m = '00'] = time.split(':');
  const h = Number(hRaw);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.slice(0, 2)} ${suffix}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** `2 min ago`, `3 hours ago`, `Sep 12` — for the activity feed. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return formatDateShort(iso.slice(0, 10));
}

export function greeting(tz = 'America/New_York'): string {
  const hour = Number(nowIn(tz).slice(11, 13));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Inclusive list of `YYYY-MM-DD` between two dates. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 800) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function startOfWeek(s: string): string {
  return addDays(s, -dayOfWeek(s));
}

export function minutesOfDay(time: string): number {
  const t = time.includes('T') ? time.split('T')[1] : time;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(date: string, mins: number): string {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${date}T${h}:${m}`;
}
