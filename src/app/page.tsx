import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { PLANS } from '@/lib/pricing';
import { money } from '@/lib/money';

export const metadata = {
  title: 'Groundwork — run your landscaping business from one place',
};

const FEATURES = [
  {
    key: 'leads',
    title: 'Every request in one inbox',
    body: 'Web forms, phone calls and referrals land in the same place, already sorted by service and urgency. Nothing sits in a text thread for three days.',
    points: ['Shareable intake form', 'Photos from the customer', 'Sorted by urgency automatically'],
  },
  {
    key: 'quotes',
    title: 'Quote from the truck',
    body: 'Photos and a description come back as a price range built from your own rate card. Adjust the lines, send it, and the customer gets a page they can accept from their phone.',
    points: ['Priced from your rates', 'Accept or ask a question', 'Turns into a job on acceptance'],
  },
  {
    key: 'followups',
    title: 'Follow-ups that actually happen',
    body: 'Day one, day three, day seven. They stop the moment the customer replies, and you can rewrite every message. Most contractors lose more work here than anywhere else.',
    points: ['Three nudges, then it stops', 'Cancels on any reply', 'Your words, not ours'],
  },
  {
    key: 'schedule',
    title: 'A calendar that knows your crews',
    body: 'Working hours, travel buffers, days off and who is already booked. When a customer accepts, they pick from times you can actually do.',
    points: ['Per-crew scheduling', 'Travel time held open', 'Customer self-booking'],
  },
  {
    key: 'crew',
    title: 'The field app your crew will use',
    body: 'Today’s jobs, directions, the customer’s number, the checklist and the camera. Big targets, no training required.',
    points: ['Checklist per job', 'Before and after photos', 'Mark complete from site'],
  },
  {
    key: 'money',
    title: 'Paid without chasing',
    body: 'Completing a job raises the invoice and sends it. Card payments settle straight back into the ledger, and what is still owed is on the front page.',
    points: ['Invoice on completion', 'Card, cash, cheque or transfer', 'Outstanding balance up front'],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Wordmark />
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="#how" className="hidden text-sm font-medium text-ink-muted hover:text-ink sm:block">
              How it works
            </Link>
            <Link href="/pricing" className="hidden text-sm font-medium text-ink-muted hover:text-ink sm:block">
              Pricing
            </Link>
            <Link href="/login" className="text-sm font-semibold text-ink hover:underline">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary btn-sm">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* ------------------------------- hero ------------------------------- */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <p className="eyebrow">Built for home-service businesses</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-6xl">
            Run your landscaping business from one place.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
            Turn leads into booked jobs, automate follow-ups, manage your crew, collect payments,
            and keep every customer in one system.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Start free
            </Link>
            <Link href="#how" className="btn btn-secondary btn-lg">
              See how it works
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-faint">
            No card required.{' '}
            <Link href="/login" className="underline underline-offset-2 hover:text-ink-muted">
              Or open the demo company
            </Link>{' '}
            and look around with real data in it.
          </p>

          <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-8 sm:grid-cols-4">
            {[
              ['Lead → paid', 'One system, start to finish'],
              ['3 follow-ups', 'Sent without you remembering'],
              ['Every photo', 'Filed against the job'],
              ['One number', 'What you are owed, right now'],
            ].map(([term, detail]) => (
              <div key={term}>
                <dt className="font-display text-lg font-bold tracking-[-0.02em] text-ink">{term}</dt>
                <dd className="mt-0.5 text-sm text-ink-muted">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------ pipeline ----------------------------- */}
      <section id="how" className="border-b border-line bg-paper-raised">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <h2 className="h-display">One path, all the way through</h2>
          <p className="mt-2 max-w-2xl text-ink-muted">
            Most contractor software covers a piece of this and hands the rest back to you. Every
            stage below is the same record moving forward — no re-typing, no second system.
          </p>

          <ol className="no-scrollbar mt-8 flex gap-3 overflow-x-auto pb-2 lg:flex-wrap lg:overflow-visible">
            {[
              ['Lead', 'Request arrives with photos'],
              ['Quote', 'Priced from your rate card'],
              ['Follow-up', 'Three nudges, then it stops'],
              ['Booking', 'Customer picks a real opening'],
              ['Job', 'Crew works the checklist'],
              ['Payment', 'Invoice raises itself'],
              ['Review', 'Asked at the right moment'],
            ].map(([stage, detail], i, arr) => (
              <li key={stage} className="flex shrink-0 items-center gap-3">
                <div className="w-44 rounded-lg border border-line bg-paper p-4">
                  <p className="eyebrow">Step {i + 1}</p>
                  <p className="mt-1 font-display text-base font-bold text-ink">{stage}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{detail}</p>
                </div>
                {i < arr.length - 1 ? (
                  <span aria-hidden className="text-line-strong">
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------ features ----------------------------- */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.key}>
                <h3 className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
                <ul className="mt-3 space-y-1.5">
                  {feature.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-ink">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-1 shrink-0 text-field">
                        <path d="m3 8.5 3.2 3.2L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- product preview -------------------------- */}
      <section className="border-b border-line bg-ink">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-paper/50">
            The command center
          </p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold leading-tight tracking-[-0.025em] text-paper sm:text-4xl">
            Understand the whole business in ten seconds.
          </h2>
          <p className="mt-3 max-w-2xl text-paper/70">
            Revenue, today’s jobs, what needs chasing and what is owed — on one screen, drawn from
            the same records the rest of the app writes to. Nothing on it is decorative.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Business pulse', 'Revenue, active jobs, open leads, quotes awaiting a reply, on-time rate'],
              ['Needs your attention', 'Unanswered quotes, unassigned jobs, unpaid invoices — each with the action that clears it'],
              ['Today', 'Every job, its crew, its value and whether somebody is on site right now'],
              ['Revenue opportunities', 'Money sitting in open quotes, unpaid invoices and dormant customers'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-paper/15 p-5">
                <p className="font-display text-base font-bold text-paper">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-paper/60">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link href="/login" className="btn btn-lg border-paper bg-paper text-ink hover:bg-paper-sunken">
              Open the demo company
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------- pricing ----------------------------- */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <h2 className="h-display">Straightforward pricing</h2>
          <p className="mt-2 text-ink-muted">One monthly price. No per-quote fees, no per-lead fees.</p>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`card card-pad flex flex-col ${plan.highlight ? 'border-field ring-1 ring-field' : ''}`}
              >
                {plan.highlight ? <p className="eyebrow text-field">Most popular</p> : null}
                <h3 className="font-display text-xl font-bold text-ink">{plan.name}</h3>
                <p className="mt-1 text-sm text-ink-muted">{plan.tagline}</p>
                <p className="mt-4">
                  <span className="font-display text-4xl font-bold tracking-[-0.03em] text-ink">
                    {money(plan.monthly)}
                  </span>
                  <span className="text-sm text-ink-faint">/month</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-ink">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-1 shrink-0 text-field">
                        <path d="m3 8.5 3.2 3.2L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`btn mt-6 w-full ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Start free
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-faint">
            Billing is not switched on yet — accounts are free while the product is in build.{' '}
            <Link href="/pricing" className="underline underline-offset-2">
              Full comparison
            </Link>
          </p>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Wordmark size="sm" />
          <nav className="flex gap-4 text-sm text-ink-muted">
            <Link href="/pricing" className="hover:text-ink">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-ink">
              Start free
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-xs text-ink-faint">
          Groundwork — the operating system for home-service businesses. Landscaping first.
        </p>
      </footer>
    </div>
  );
}
