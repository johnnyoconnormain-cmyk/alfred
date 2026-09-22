import Link from 'next/link';
import type { ReactNode } from 'react';
import { money } from '@/lib/money';

/* ---------------------------------- layout --------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="h-display">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({
  title,
  action,
  children,
  className = '',
  bodyClassName = 'card-pad',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <div className="card-head">
          <h2 className="h-section">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-[0.08em] text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* --------------------------------- figures --------------------------------- */

export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  detail,
  href,
  upIsGood = true,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string | null;
  detail?: string;
  href?: string;
  upIsGood?: boolean;
}) {
  const good = delta == null ? null : (delta >= 0) === upIsGood;
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="figure mt-1.5">{value}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {delta != null ? (
          <span
            className={`text-xs font-semibold tabular ${
              good ? 'text-status-good' : 'text-status-serious'
            }`}
          >
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        ) : null}
        {deltaLabel && delta != null ? (
          <span className="text-xs text-ink-faint">{deltaLabel}</span>
        ) : null}
      </div>
      {detail ? <p className="mt-1 text-xs text-ink-faint">{detail}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="card card-pad block transition-shadow duration-150 hover:shadow-raised"
      >
        {body}
      </Link>
    );
  }
  return <div className="card card-pad">{body}</div>;
}

export function Money({ cents, className = '' }: { cents: number | null | undefined; className?: string }) {
  return <span className={`tabular ${className}`}>{money(cents)}</span>;
}

/* ---------------------------------- status --------------------------------- */

const STATUS_STYLES: Record<string, string> = {
  // leads
  new: 'badge-info',
  qualified: 'badge-info',
  quoted: 'badge-neutral',
  won: 'badge-good',
  lost: 'badge-neutral',
  // quotes
  draft: 'badge-neutral',
  sent: 'badge-info',
  viewed: 'badge-warning',
  accepted: 'badge-good',
  declined: 'badge-neutral',
  expired: 'badge-neutral',
  // jobs
  unscheduled: 'badge-serious',
  scheduled: 'badge-info',
  in_progress: 'badge-warning',
  complete: 'badge-good',
  paid: 'badge-good',
  cancelled: 'badge-neutral',
  // invoices
  void: 'badge-neutral',
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In progress',
  unscheduled: 'Needs date',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'badge-neutral';
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
  return <span className={`badge ${style}`}>{label}</span>;
}

export function Dot({ tone = 'neutral', pulse = false }: { tone?: 'good' | 'warning' | 'serious' | 'critical' | 'neutral'; pulse?: boolean }) {
  const colors: Record<string, string> = {
    good: 'bg-status-good',
    warning: 'bg-status-warning',
    serious: 'bg-status-serious',
    critical: 'bg-status-critical',
    neutral: 'bg-ink-faint',
  };
  return (
    <span
      aria-hidden
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colors[tone]} ${
        pulse ? 'animate-pulse-dot' : ''
      }`}
    />
  );
}

/* --------------------------------- helpers --------------------------------- */

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
          <dt className="shrink-0 text-ink-faint">{item.label}</dt>
          <dd className="min-w-0 text-right font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 className="h-section">{children}</h2>
      {action}
    </div>
  );
}
