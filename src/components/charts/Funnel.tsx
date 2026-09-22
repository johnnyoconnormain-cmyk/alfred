import Link from 'next/link';

export interface FunnelRow {
  key: string;
  label: string;
  count: number;
  href: string;
}

// Ordinal ramp: one hue, dark to light, no step lighter than 250 on a light surface.
const RAMP = ['#184f95', '#256abf', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef'];

/**
 * Lead funnel for the current month. Each stage links through to the records
 * behind it, so the number is a way into the work rather than a trophy.
 */
export function Funnel({ rows }: { rows: FunnelRow[] }) {
  const top = Math.max(...rows.map((r) => r.count), 1);

  return (
    <ol className="space-y-1.5">
      {rows.map((row, i) => {
        const width = Math.max(14, (row.count / top) * 100);
        const prior = i > 0 ? rows[i - 1].count : null;
        const dropped =
          prior != null && prior > 0 && row.count > 0 ? Math.round((1 - row.count / prior) * 100) : null;
        return (
          <li key={row.key}>
            <Link
              href={row.href}
              className="group flex items-center gap-3 rounded px-1 py-1 transition-colors hover:bg-paper-sunken/70"
            >
              <span className="w-20 shrink-0 text-xs font-semibold text-ink-muted">{row.label}</span>
              <span className="relative flex h-7 flex-1 items-center">
                <span
                  className="flex h-7 items-center rounded-sm px-2 text-xs font-bold tabular text-white"
                  style={{ width: `${width}%`, background: RAMP[i % RAMP.length] }}
                >
                  {row.count}
                </span>
              </span>
              {dropped != null && dropped > 0 ? (
                <span className="w-16 shrink-0 text-right text-xs tabular text-ink-faint">
                  −{dropped}%
                </span>
              ) : (
                <span className="w-16 shrink-0" />
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
