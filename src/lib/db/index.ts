import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_SQL } from './schema';
import { persistenceMode } from '../deployment';
import { readSnapshot, SnapshotConflict, writeSnapshot } from './snapshot';

/**
 * Groundwork's storage driver.
 *
 * Everything above this file talks to the database through the query modules in
 * `src/lib/queries`, never to `better-sqlite3` directly. That boundary is what
 * makes the Postgres/Supabase migration a swap of this file plus those modules
 * rather than a rewrite: the schema in `schema.ts` is deliberately written in
 * portable SQL, and every tenant-owned table carries `business_id` so the same
 * filters become row-level-security policies on Postgres.
 *
 * Reads are synchronous against an open SQLite handle. **Writes go through
 * `mutate()`**, which is the one place that knows whether the resulting bytes
 * need to be pushed somewhere durable. See `deployment.ts` for the three modes.
 */

const DATA_DIR = process.env.GROUNDWORK_DATA_DIR || path.join(process.cwd(), '.data');
const DB_PATH = process.env.GROUNDWORK_DB_PATH || path.join(DATA_DIR, 'groundwork.db');

interface DbState {
  db: Database.Database;
  /** ETag of the snapshot this database was loaded from — the CAS token. */
  etag: string | null;
}

declare global {
  // Next.js re-evaluates modules on hot reload and serverless instances are
  // reused between requests; a module-local variable would leak a connection
  // (and, in blob mode, the ETag that keeps writes safe) on every reload.
  var __groundworkState: DbState | undefined;
  var __groundworkWriteQueue: Promise<unknown> | undefined;
}

function applySchema(db: Database.Database): Database.Database {
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA_SQL);
  return db;
}

function openFile(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return applySchema(db);
}

function openMemory(buffer?: Buffer): Database.Database {
  const db = buffer ? new Database(buffer) : new Database(':memory:');
  return applySchema(db);
}

/**
 * Hands over the open database.
 *
 * In `disk` mode it opens the file on first use. In `ephemeral` mode it builds
 * the demo company in memory, which needs no network and so can happen here. In
 * `blob` mode the bytes have to be fetched, which cannot happen inside a
 * synchronous getter — `bootstrap()` does it before the server takes requests.
 */
export function getDb(): Database.Database {
  if (global.__groundworkState) return global.__groundworkState.db;

  const mode = persistenceMode();
  if (mode === 'disk') {
    global.__groundworkState = { db: openFile(), etag: null };
    return global.__groundworkState.db;
  }
  if (mode === 'ephemeral') {
    global.__groundworkState = { db: openMemory(), etag: null };
    seedEphemeral();
    return global.__groundworkState.db;
  }
  throw new Error(
    'The database has not been loaded yet. In blob mode this happens in instrumentation.ts ' +
      'before the first request; something has called into the database outside that path.',
  );
}

/** Ephemeral deployments start with the demo company so the app is never blank. */
function seedEphemeral(): void {
  // Required lazily: the seed imports query modules that import this one.
  const { seedDemo } = require('../demo/seed') as typeof import('../demo/seed');
  seedDemo({ deterministic: true });
}

/* --------------------------------- reads ---------------------------------- */

export function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...(params as never[])) as T[];
}

export function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  const row = getDb().prepare(sql).get(...(params as never[]));
  return (row as T) ?? null;
}

/* --------------------------------- writes --------------------------------- */

export function run(sql: string, params: unknown[] = []): void {
  getDb().prepare(sql).run(...(params as never[]));
}

export function tx<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}

const MAX_WRITE_ATTEMPTS = 5;

/**
 * Runs a write and makes sure it survives.
 *
 * `fn` must contain **all** of the database work for one user action and no
 * external side effects, because in blob mode it may be run more than once: if
 * another instance saved while we were working, we reload their version and
 * replay `fn` on top rather than overwriting them.
 *
 * On disk the whole thing collapses to calling `fn` — SQLite has already
 * persisted by the time it returns.
 */
export async function mutate<T>(fn: () => T): Promise<T> {
  if (persistenceMode() !== 'blob') return fn();

  // Serialise writes within this instance so two requests cannot interleave
  // between their read of the snapshot and their write of it.
  const previous = global.__groundworkWriteQueue ?? Promise.resolve();
  let release!: () => void;
  global.__groundworkWriteQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);

  try {
    for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
      const state = requireState();
      const result = fn();

      const bytes = state.db.serialize();
      try {
        state.etag = await writeSnapshot(bytes, state.etag);
        return result;
      } catch (err) {
        if (!(err instanceof SnapshotConflict) || attempt === MAX_WRITE_ATTEMPTS) throw err;
        // Someone else got there first. Take their database and redo our work on it.
        await reload();
      }
    }
    throw new Error('Could not save: the database is being written to to too heavily.');
  } finally {
    release();
  }
}

function requireState(): DbState {
  getDb();
  const state = global.__groundworkState;
  if (!state) throw new Error('Database is not open.');
  return state;
}

/** Replaces the in-memory database with whatever is currently stored. */
async function reload(): Promise<void> {
  const { data, etag } = await readSnapshot();
  global.__groundworkState?.db.close();
  global.__groundworkState = { db: openMemory(data ?? undefined), etag };
}

/**
 * Loads the database before anything reads from it.
 *
 * Called from the root layout — which React finishes rendering before any page
 * below it — and explicitly at the top of each route handler, since those have
 * no layout above them. Idempotent and free after the first call, so the cost
 * on a warm instance is one property check.
 */
export async function ensureReady(): Promise<void> {
  // Prerendering the marketing pages must not depend on a network round trip to
  // the snapshot store — nothing rendered at build time reads tenant data, and a
  // transient failure there would fail the whole build.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const mode = persistenceMode();
  if (mode !== 'blob') {
    getDb();
    return;
  }
  if (global.__groundworkState) return;

  const { data, etag } = await readSnapshot();
  global.__groundworkState = { db: openMemory(data ?? undefined), etag };
}


/* -------------------------------- utilities -------------------------------- */

/** Next sequence number for per-business document numbering (quotes, jobs, invoices). */
export function nextNumber(table: 'quotes' | 'jobs' | 'invoices', businessId: string): number {
  const row = one<{ n: number | null }>(
    `SELECT MAX(number) AS n FROM ${table} WHERE business_id = ?`,
    [businessId],
  );
  return (row?.n ?? 1000) + 1;
}

export function databasePath(): string {
  return persistenceMode() === 'disk' ? DB_PATH : 'in memory';
}
