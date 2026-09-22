import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { PLANS } from '@/lib/pricing';
import { money } from '@/lib/money';

export const metadata = { title: 'Pricing' };

const MATRIX: { feature: string; starter: boolean; pro: boolean; scale: boolean }[] = [
  { feature: 'Lead inbox and intake form', starter: true, pro: true, scale: true },
  { feature: 'Quotes and customer quote pages', starter: true, pro: true, scale: true },
  { feature: 'Scheduling and calendar', starter: true, pro: true, scale: true },
  { feature: 'Customer database', starter: true, pro: true, scale: true },
  { feature: 'Automated follow-up sequences', starter: false, pro: true, scale: true },
  { feature: 'Invoicing and card payments', starter: false, pro: true, scale: true },
  { feature: 'Crew management and field app', starter: false, pro: true, scale: true },
  { feature: 'Before/after photo documentation', starter: false, pro: true, scale: true },
  { feature: 'Business analytics', starter: false, pro: true, scale: true },
  { feature: 'Unlimited crews and users', starter: false, pro: false, scale: true },
  { feature: 'Advanced automation rules', starter: false, pro: false, scale: true },
  { feature: 'Advanced reporting and exports', starter: false, pro: false, scale: true },
  { feature: 'Priority support', starter: false, pro: false, scale: true },
];

function Tick({ on }: { on: boolean }) {
  return on ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="Included" className="mx-auto text-field">
      <path d="m3 8.5 3.2 3.2L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <span aria-label="Not included" className="text-line-strong">
      —
    </span>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
          <Wordmark />
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-ink hover:underline">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary btn-sm">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
        <h1 className="h-display">Pricing</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          One monthly price per business. Unlimited quotes, jobs and customers on every plan —
          you are never charged for doing more work.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`card card-pad flex flex-col ${plan.highlight ? 'border-field ring-1 ring-field' : ''}`}
            >
              {plan.highlight ? <p className="eyebrow text-field">Most popular</p> : null}
              <h2 className="font-display text-xl font-bold text-ink">{plan.name}</h2>
              <p className="mt-1 text-sm text-ink-muted">{plan.tagline}</p>
              <p className="mt-4">
                <span className="font-display text-4xl font-bold tracking-[-0.03em] text-ink">
                  {money(plan.monthly)}
                </span>
                <span className="text-sm text-ink-faint">/month</span>
              </p>
              <p className="mt-2 text-xs text-ink-faint">
                {plan.limits.crews === null
                  ? 'Unlimited crews and users'
                  : `Up to ${plan.limits.crews} crew${plan.limits.crews === 1 ? '' : 's'} · ${plan.limits.users} users`}
              </p>
              <Link
                href="/signup"
                className={`btn mt-5 w-full ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`}
              >
                Start free
              </Link>
            </div>
          ))}
        </div>

        <div className="card mt-8 overflow-hidden">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>What you get</th>
                  <th className="text-center">Starter</th>
                  <th className="text-center">Pro</th>
                  <th className="text-center">Scale</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.feature}>
                    <td className="text-ink">{row.feature}</td>
                    <td className="text-center">
                      <Tick on={row.starter} />
                    </td>
                    <td className="text-center">
                      <Tick on={row.pro} />
                    </td>
                    <td className="text-center">
                      <Tick on={row.scale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-sm text-ink-faint">
          Billing is not switched on. Accounts are free while the product is in build, and nothing
          is charged to a card today.
        </p>
      </main>
    </div>
  );
}
