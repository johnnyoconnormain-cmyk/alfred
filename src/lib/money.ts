/** Money is integer cents everywhere. These are the only places it becomes a string. */

export function money(cents: number | null | undefined, opts: { cents?: boolean } = {}): string {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
}

/** Compact form for stat tiles: $8.4K, $1.2M. Falls back to plain below 10,000. */
export function moneyCompact(cents: number | null | undefined): string {
  const v = (cents ?? 0) / 100;
  if (Math.abs(v) < 10_000) return money(cents);
  return `$${(v / 1000).toFixed(v >= 1_000_000 ? 2 : 1).replace(/\.0$/, '')}${
    v >= 1_000_000 ? 'M' : 'K'
  }`.replace('1000.0K', '1M');
}

export function parseMoney(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === '') return 0;
  const n = typeof input === 'number' ? input : Number(String(input).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function pct(value: number, of: number): number {
  if (!of) return 0;
  return Math.round((value / of) * 100);
}

/** Round cents up to the nearest $5 — quotes read better without odd change. */
export function roundToNearest(cents: number, nearest = 500): number {
  return Math.round(cents / nearest) * nearest;
}
