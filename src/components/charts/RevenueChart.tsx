'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDate, formatDateShort } from '@/lib/dates';
import { money } from '@/lib/money';

export interface Point {
  date: string;
  revenue: number;
  jobs: number;
}

/**
 * Collected revenue over time.
 *
 * One series, so no legend — the card title names what is plotted. A crosshair
 * plus tooltip carries the per-day detail rather than labelling every point, and
 * a table view sits behind the toggle so the numbers are never trapped in a
 * picture.
 */
export function RevenueChart({ points, height = 220 }: { points: Point[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);

  // The viewBox tracks the real rendered width, so axis text and markers keep
  // their intended size instead of being scaled down to nothing on a phone.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const W = width;
  const H = width < 480 ? Math.round(height * 0.85) : height;
  const padL = 52;
  const padR = 12;
  const padT = 14;
  const padB = 26;

  const { path, area, max, ticks, xs, ys } = useMemo(() => {
    const values = points.map((p) => p.revenue);
    const rawMax = Math.max(1, ...values);
    const step = niceStep(rawMax / 3);
    const maxV = Math.max(step * 3, Math.ceil(rawMax / step) * step);
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const xFor = (i: number) =>
      padL + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const yFor = (v: number) => padT + innerH - (v / maxV) * innerH;

    const xsArr = points.map((_, i) => xFor(i));
    const ysArr = points.map((p) => yFor(p.revenue));

    const d = xsArr.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ysArr[i].toFixed(1)}`).join(' ');
    const a = `${d} L${xsArr[xsArr.length - 1]?.toFixed(1) ?? padL} ${padT + innerH} L${padL} ${
      padT + innerH
    } Z`;

    return {
      path: d,
      area: a,
      max: maxV,
      ticks: [0, step, step * 2, step * 3].filter((t) => t <= maxV),
      xs: xsArr,
      ys: ysArr,
    };
  }, [points, H, W]);

  // A flat line against an axis of three identical zeros says nothing. Say it in
  // words instead until there is something to plot.
  if (!points.length || points.every((p) => p.revenue === 0)) {
    return (
      <div ref={wrapRef} className="py-10 text-center">
        <p className="text-sm text-ink-muted">No payments received in this period yet.</p>
        <p className="mt-1 text-xs text-ink-faint">
          This chart fills in as invoices are paid.
        </p>
      </div>
    );
  }

  const active = hover != null ? points[hover] : null;
  const innerH = H - padT - padB;
  const yFor = (v: number) => padT + innerH - (v / max) * innerH;

  return (
    <div ref={wrapRef}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Collected revenue per day"
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={yFor(t)}
                y2={yFor(t)}
                stroke="#e2e0d8"
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={yFor(t) + 4}
                textAnchor="end"
                className="tabular"
                fontSize="11"
                fill="#8b8e84"
              >
                {t === 0 ? '0' : compact(t)}
              </text>
            </g>
          ))}

          <path d={area} fill="#1f6b3f" opacity="0.1" />
          <path
            d={path}
            fill="none"
            stroke="#1f6b3f"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {active && hover != null ? (
            <g>
              <line
                x1={xs[hover]}
                x2={xs[hover]}
                y1={padT}
                y2={padT + innerH}
                stroke="#12130f"
                strokeWidth="1"
                opacity="0.25"
              />
              <circle cx={xs[hover]} cy={ys[hover]} r="5.5" fill="#1f6b3f" stroke="#ffffff" strokeWidth="2" />
            </g>
          ) : null}

          {/* Hit targets are full-height columns so the pointer never has to find the line. */}
          {points.map((p, i) => (
            <rect
              key={p.date}
              x={i === 0 ? padL : (xs[i - 1] + xs[i]) / 2}
              y={padT}
              width={Math.max(
                4,
                (i === points.length - 1 ? W - padR : (xs[i] + xs[i + 1]) / 2) -
                  (i === 0 ? padL : (xs[i - 1] + xs[i]) / 2),
              )}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={-1}
            />
          ))}

          {/* First and last ticks anchor inwards so neither is clipped at the edge. */}
          {xAxisLabels(points, W < 480 ? 3 : 5).map(({ i, label }, k, arr) => (
            <text
              key={label + i}
              x={xs[i]}
              y={H - 8}
              textAnchor={k === 0 ? 'start' : k === arr.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              fill="#8b8e84"
              className="tabular"
            >
              {label}
            </text>
          ))}
        </svg>

        {active ? (
          <div
            className="pointer-events-none absolute top-2 z-10 w-44 rounded border border-line bg-paper-raised p-2.5 shadow-raised"
            style={{
              left: `calc(${((xs[hover!] ?? 0) / W) * 100}% )`,
              transform: `translateX(${(xs[hover!] ?? 0) > W * 0.62 ? '-105%' : '12px'})`,
            }}
          >
            <p className="text-xs font-semibold text-ink">{formatDate(active.date, { weekday: false })}</p>
            <dl className="mt-1.5 space-y-1 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Revenue</dt>
                <dd className="tabular font-semibold text-ink">{money(active.revenue)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Jobs</dt>
                <dd className="tabular text-ink">{active.jobs}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Average</dt>
                <dd className="tabular text-ink">
                  {active.jobs ? money(Math.round(active.revenue / active.jobs)) : '—'}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="mt-2 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-ink"
      >
        {showTable ? 'Hide table' : 'View as table'}
      </button>

      {showTable ? (
        <div className="table-wrap mt-2 max-h-56 overflow-y-auto rounded border border-line">
          <table className="data-table min-w-0">
            <thead className="sticky top-0 bg-paper-raised">
              <tr>
                <th>Date</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {points
                .filter((p) => p.revenue || p.jobs)
                .reverse()
                .map((p) => (
                  <tr key={p.date}>
                    <td>{formatDate(p.date, { weekday: false })}</td>
                    <td className="tabular text-right">{money(p.revenue)}</td>
                    <td className="tabular text-right">{p.jobs}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function xAxisLabels(points: Point[], max = 5): { i: number; label: string }[] {
  if (points.length <= 1) return points.map((p, i) => ({ i, label: formatDateShort(p.date) }));
  const count = Math.min(max, points.length);
  const stride = (points.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, k) => {
    const i = Math.round(k * stride);
    return { i, label: formatDateShort(points[i].date) };
  });
}

function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
  const normalized = raw / magnitude;
  const snapped = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return snapped * magnitude;
}

function compact(cents: number): string {
  const v = cents / 100;
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return `$${Math.round(v)}`;
}
