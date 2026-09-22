// Groundwork database schema. Kept as a TypeScript module (rather than a loose
// .sql file) so it is bundled with the server build and needs no runtime file read.

export const SCHEMA_SQL = `
-- Groundwork — home-service business operating system.
-- Multi-tenant: every tenant-owned row carries business_id and is always
-- filtered by it at the query layer. Money is stored in integer cents.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS businesses (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  trade         TEXT NOT NULL DEFAULT 'landscaping',
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  timezone      TEXT NOT NULL DEFAULT 'America/New_York',
  plan          TEXT NOT NULL DEFAULT 'pro',
  review_url    TEXT,
  is_demo       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'owner',   -- owner | admin | crew
  password_hash TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(lower(email));
CREATE INDEX IF NOT EXISTS users_business ON users(business_id);

CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS crews (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT 'slot1',
  lead_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS crews_business ON crews(business_id);

CREATE TABLE IF NOT EXISTS crew_members (
  crew_id       TEXT NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (crew_id, user_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  lat           REAL,
  lng           REAL,
  source        TEXT,
  notes         TEXT,
  tags          TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS customers_name ON customers(business_id, name);

CREATE TABLE IF NOT EXISTS leads (
  id             TEXT PRIMARY KEY,
  business_id    TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id    TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source         TEXT NOT NULL DEFAULT 'website',
  service_type   TEXT NOT NULL,
  description    TEXT NOT NULL,
  summary        TEXT,
  urgency        TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high
  preferred_date TEXT,
  preferred_time TEXT,
  status         TEXT NOT NULL DEFAULT 'new',      -- new | qualified | quoted | won | lost
  est_low        INTEGER,
  est_high       INTEGER,
  est_basis      TEXT,
  lost_reason    TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_business ON leads(business_id, status);
CREATE INDEX IF NOT EXISTS leads_customer ON leads(customer_id);

CREATE TABLE IF NOT EXISTS photos (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,                     -- lead | before | after | progress
  lead_id       TEXT REFERENCES leads(id) ON DELETE CASCADE,
  job_id        TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  caption       TEXT,
  uploaded_by   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_lead ON photos(lead_id);
CREATE INDEX IF NOT EXISTS photos_job ON photos(job_id, kind);

CREATE TABLE IF NOT EXISTS quotes (
  id              TEXT PRIMARY KEY,
  business_id     TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  number          INTEGER NOT NULL,
  customer_id     TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  lead_id         TEXT REFERENCES leads(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  service_type    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',   -- draft|sent|viewed|accepted|declined|expired
  subtotal        INTEGER NOT NULL DEFAULT 0,
  tax             INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  token           TEXT NOT NULL UNIQUE,
  sent_at         TEXT,
  viewed_at       TEXT,
  accepted_at     TEXT,
  declined_at     TEXT,
  expires_at      TEXT,
  follow_up_stage INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS quotes_business ON quotes(business_id, status);
CREATE INDEX IF NOT EXISTS quotes_customer ON quotes(customer_id);

CREATE TABLE IF NOT EXISTS quote_items (
  id          TEXT PRIMARY KEY,
  quote_id    TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'labor',       -- labor|material|disposal|travel|other
  description TEXT NOT NULL,
  quantity    REAL NOT NULL DEFAULT 1,
  unit        TEXT NOT NULL DEFAULT 'ea',
  unit_price  INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,
  sort        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS quote_items_quote ON quote_items(quote_id, sort);

CREATE TABLE IF NOT EXISTS jobs (
  id              TEXT PRIMARY KEY,
  business_id     TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  number          INTEGER NOT NULL,
  customer_id     TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  quote_id        TEXT REFERENCES quotes(id) ON DELETE SET NULL,
  crew_id         TEXT REFERENCES crews(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  service_type    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unscheduled', -- unscheduled|scheduled|in_progress|complete|paid|cancelled
  scheduled_start TEXT,
  scheduled_end   TEXT,
  duration_min    INTEGER NOT NULL DEFAULT 120,
  amount          INTEGER NOT NULL DEFAULT 0,
  address         TEXT,
  notes           TEXT,
  token           TEXT NOT NULL UNIQUE,
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_business ON jobs(business_id, status);
CREATE INDEX IF NOT EXISTS jobs_sched ON jobs(business_id, scheduled_start);
CREATE INDEX IF NOT EXISTS jobs_customer ON jobs(customer_id);

CREATE TABLE IF NOT EXISTS job_checklist (
  id        TEXT PRIMARY KEY,
  job_id    TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,
  done      INTEGER NOT NULL DEFAULT 0,
  done_at   TEXT,
  done_by   TEXT,
  sort      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS checklist_job ON job_checklist(job_id, sort);

CREATE TABLE IF NOT EXISTS invoices (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  number        INTEGER NOT NULL,
  job_id        TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  customer_id   TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL DEFAULT 0,
  amount_paid   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft',   -- draft|sent|paid|void
  due_date      TEXT,
  token         TEXT NOT NULL UNIQUE,
  sent_at       TEXT,
  paid_at       TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS invoices_business ON invoices(business_id, status);

CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id    TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,
  method        TEXT NOT NULL DEFAULT 'card',     -- card|cash|check|ach
  provider      TEXT NOT NULL DEFAULT 'manual',   -- manual|stripe
  provider_ref  TEXT,
  status        TEXT NOT NULL DEFAULT 'succeeded',
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS payments_business ON payments(business_id, created_at);

CREATE TABLE IF NOT EXISTS reviews (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id        TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  customer_id   TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL,
  comment       TEXT,
  routed_to     TEXT NOT NULL DEFAULT 'private',  -- public | private
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_business ON reviews(business_id, created_at);

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id   TEXT REFERENCES customers(id) ON DELETE CASCADE,
  lead_id       TEXT REFERENCES leads(id) ON DELETE SET NULL,
  quote_id      TEXT REFERENCES quotes(id) ON DELETE SET NULL,
  job_id        TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  direction     TEXT NOT NULL DEFAULT 'out',      -- in | out
  channel       TEXT NOT NULL DEFAULT 'sms',      -- sms | email | note
  body          TEXT NOT NULL,
  automated     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_customer ON messages(customer_id, created_at);
CREATE INDEX IF NOT EXISTS messages_business ON messages(business_id, created_at);

CREATE TABLE IF NOT EXISTS activity (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  title         TEXT NOT NULL,
  detail        TEXT,
  entity_type   TEXT,
  entity_id     TEXT,
  amount        INTEGER,
  actor         TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_business ON activity(business_id, created_at);

CREATE TABLE IF NOT EXISTS automations (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  trigger_event TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  config        TEXT NOT NULL DEFAULT '{}',
  run_count     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS automations_key ON automations(business_id, key);

CREATE TABLE IF NOT EXISTS automation_tasks (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  automation_id TEXT REFERENCES automations(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  run_at        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|done|cancelled|failed
  entity_type   TEXT,
  entity_id     TEXT,
  payload       TEXT NOT NULL DEFAULT '{}',
  result        TEXT,
  created_at    TEXT NOT NULL,
  ran_at        TEXT
);
CREATE INDEX IF NOT EXISTS tasks_due ON automation_tasks(status, run_at);
CREATE INDEX IF NOT EXISTS tasks_entity ON automation_tasks(entity_type, entity_id, status);

CREATE TABLE IF NOT EXISTS settings (
  business_id        TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  min_job_price      INTEGER NOT NULL DEFAULT 15000,
  hourly_rate        INTEGER NOT NULL DEFAULT 7500,
  material_markup    REAL NOT NULL DEFAULT 20,
  travel_fee         INTEGER NOT NULL DEFAULT 2500,
  min_sqft           INTEGER NOT NULL DEFAULT 200,
  tax_rate           REAL NOT NULL DEFAULT 0,
  deposit_pct        REAL NOT NULL DEFAULT 0,
  work_days          TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
  work_start         TEXT NOT NULL DEFAULT '07:00',
  work_end           TEXT NOT NULL DEFAULT '17:00',
  travel_buffer_min  INTEGER NOT NULL DEFAULT 30,
  service_area       TEXT,
  quote_valid_days   INTEGER NOT NULL DEFAULT 30,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_rates (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_type  TEXT NOT NULL,
  label         TEXT NOT NULL,
  base_price    INTEGER NOT NULL DEFAULT 0,
  per_hour      INTEGER NOT NULL DEFAULT 0,
  typical_hours REAL NOT NULL DEFAULT 2,
  material_est  INTEGER NOT NULL DEFAULT 0,
  min_price     INTEGER NOT NULL DEFAULT 0,
  spread_pct    REAL NOT NULL DEFAULT 18,
  active        INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS rates_key ON service_rates(business_id, service_type);

CREATE TABLE IF NOT EXISTS time_off (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  crew_id       TEXT REFERENCES crews(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL
);
`;
