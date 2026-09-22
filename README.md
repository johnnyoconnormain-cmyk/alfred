# Groundwork

**The operating system for home-service businesses.** Landscaping first.

A landscaping company with three to fifteen employees runs on phone calls, text
threads, a shared Google Calendar, a spreadsheet, QuickBooks and a pile of paper
notes. Groundwork replaces that with one system that carries a customer from
first contact to paid:

```
Lead → Quote → Follow-up → Booking → Job → Payment → Review
```

That loop works end to end. Everything else in the product exists to support it.

---

## Running it

```bash
npm install
npm run seed     # builds the demo company
npm run dev      # http://localhost:3000
```

Sign in with **mike@ridgelinelandscape.com** / **ridgeline2026**, or press
*Open the demo company* on the login page.

`npm run reset` wipes the database and rebuilds the demo from scratch.

### What the demo contains

Ridgeline Lawn & Landscape, a company mid-season in Wexford, PA: 25 customers,
40 leads across the last 90 days, 30 quotes, 30 jobs, real revenue history,
seven staff across three crews, before/after photos, outstanding invoices and a
full day of work ahead. All of it is generated from a fixed seed, so it looks
the same on every rebuild, and it is written through the same tables the live
product uses — there is no separate demo code path.

---

## What actually works

Everything below is wired to the database. No mock screens.

| Area | Behaviour |
|---|---|
| **Auth** | Cookie sessions, scrypt password hashing, owner / admin / crew roles |
| **Multi-tenancy** | Every tenant-owned row carries `business_id`; every query filters on it |
| **Intake** | Public form per business, photo upload, duplicate-customer matching |
| **Estimates** | Priced from the owner's rate card; range widens when there is less to go on |
| **Quotes** | Line-item builder, unguessable customer link, accept / question / decline |
| **Follow-ups** | Three-stage sequence stored as queued rows; cancels the moment a quote is answered |
| **Scheduling** | Availability from working hours, crew load, travel buffers and time off |
| **Jobs** | Per-job checklist, crew assignment, status machine, before/after photos |
| **Field app** | Separate mobile-first experience at `/crew` for crews |
| **Invoicing** | Raised and sent automatically on completion; Stripe Checkout or manual entry |
| **Reviews** | 4–5 stars routed to the public profile, 1–3 kept private. Nothing auto-posted |
| **Analytics** | Revenue, conversion, service mix, lead sources, top customers |
| **Command centre** | Business pulse, pipeline, attention centre, crews, funnel, opportunities |

### What is deliberately not faked

Four capabilities need credentials this repository does not ship. In each case
the abstraction is real and the UI says plainly that the thing is not connected,
rather than showing invented data:

- **Card payments** — `PaymentProvider` in `src/lib/payments`. With
  `STRIPE_SECRET_KEY` the pay button runs real Stripe Checkout in test mode.
  Without it, the customer page says card payment is not switched on and the
  owner records cash/cheque/card by hand. Either path writes one ledger.
- **Weather** — `WeatherProvider` in `src/lib/weather`. No key, no forecast, and
  the panel says so. It does not show a plausible 72°.
- **Map** — `src/components/hud/JobMap.tsx` renders today's stops as an ordered
  route per crew. With `NEXT_PUBLIC_MAPBOX_TOKEN` a tile layer drops in behind
  the same data.
- **Message delivery** — messages are recorded on the customer record and shown
  as queued. No carrier is wired, and the thread does not claim an SMS was sent.

See `.env.example` for the full list.

### Where AI is, and is not

The product is not a chatbot and has no chat window. Intelligence shows up as a
better default:

- **Lead triage** (`src/lib/ai/classify.ts`) — deterministic keyword scoring.
  Instant, free, auditable, and the owner can always override it.
- **Estimates** (`src/lib/ai/estimator.ts`) — a pricing model over the owner's
  own rate card. It returns a *range*, says what drove it, and widens when it
  knows less. Nothing here pretends to know the real price before somebody
  stands in the yard.
- **Insights** (`buildInsights` in `src/lib/queries/dashboard.ts`) — each line is
  a query with a threshold. If the data does not clear the threshold, the
  insight is not shown. There is no generated prose on that surface.
- **Message drafting** (`src/lib/ai/drafts.ts`) — the only place a model is
  called, and only to warm up a draft the owner is about to edit. Templates are
  the fallback and the source of truth for what actually sends.

---

## Architecture

```
src/
  app/
    (app)/            authenticated office UI — dashboard, leads, quotes, jobs, …
    crew/             the field app, designed for a phone
    book/ q/ pay/ review/   customer-facing pages, reached by token
    api/              stripe checkout + webhook, automation cron
  lib/
    db/               schema and the only place SQL meets the driver
    queries/          every read and write, always scoped by business_id
    automations/      event emitter + durable task queue
    ai/               triage, estimating, drafting
    payments/ storage/ weather/    provider boundaries
  components/         UI, charts, HUD panels
```

**Data.** SQLite through `better-sqlite3`, with money stored as integer cents.
The schema (`src/lib/db/schema.ts`) is written in portable SQL and every
tenant-owned table carries `business_id`, so moving to Postgres/Supabase is a
swap of `src/lib/db` plus the query modules — the same filters become row-level
security policies. Nothing above `src/lib/queries` touches the driver.

**Time.** Two kinds, deliberately different. Timestamps (`created_at`, `paid_at`)
are UTC ISO strings. Schedule values (`scheduled_start`) are naive wall-clock
strings interpreted in the business's timezone, so a 9:00 AM job is 9:00 AM to
the crew regardless of server locale and no daylight-saving change can slide it.

**Automations.** Rules are rows, not code branches. `emit()` either acts
immediately or writes a row into `automation_tasks` with a `run_at`;
`sweep()` drains the queue. That is what makes "wait three days, then follow up"
survive a restart, and what lets the owner see exactly what is queued and cancel
it. The queue drains on request, so follow-ups do not depend on a cron being up;
point a scheduler at `/api/cron/automations` if you want minute accuracy on a
quiet account.

**Charts** are hand-built SVG with real hover layers and a table view behind
every one. The categorical palette was validated for colour-vision deficiency
separation and contrast before any chart code was written.

---

## Testing

Two Playwright suites drive the real UI against a running dev server:

```bash
npm run dev
npm i --no-save playwright-core
node tests/workflow.e2e.mjs   # the full lead → paid loop
node tests/access.e2e.mjs     # roles, onboarding, tenant isolation
```

`workflow.e2e.mjs` submits the public intake form, signs in as the owner, builds
and sends a quote from the lead, accepts it as the customer, books a slot, starts
and completes the job, checks the invoice was raised, records payment, leaves a
review, and loads every page looking for errors.

`access.e2e.mjs` checks that a crew member lands in the field app and cannot
reach the office view, that signed-out visitors are redirected, that a
brand-new business is provisioned with its rate card and automations, and that
one tenant cannot see another's customers.

---

## Deploying

The app builds and runs anywhere Next.js does. One caveat worth stating plainly:
the default storage driver is SQLite on local disk, so on a serverless host
(Vercel, Netlify functions) the database does not survive between deployments or
instances. For a real deployment, either run it on a host with a persistent
volume (Fly, Railway, a VPS, Docker), or port `src/lib/db` and the query modules
to Postgres/Supabase — the schema is written for it and every tenant-owned table
already carries `business_id` for row-level security.

---

## Status

MVP. The core loop is complete and the surrounding surfaces are real. Billing is
not switched on — plans are configured in `src/lib/pricing.ts` and no card is
ever charged.
