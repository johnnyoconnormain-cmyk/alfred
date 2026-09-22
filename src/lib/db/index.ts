import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_SQL } from './schema';

/**
 * Groundwork's storage driver.
 *
 * Everything above this file talks to the database through the query modules in
 * `src/lib/queries`, never to `better-sqlite3` directly. That boundary is what
 * makes the Postgres/Supabase migration a swap of this file plus those modules
 * rather than a rewrite: the schema in `schema.ts` is deliberately written in
 * portable SQL, and every tenant-owned table carries `business_id` so the same
 * filters become row-level-security policies on Postgres.
 */

const DATA_DIR = process.env.GROUNDWORK_DATA_DIR || path.join(process.cwd(), '.data');
const DB_PATH = process.env.GROUNDWORK_DB_PATH || path.join(DATA_DIR, 'groundwork.db');

declare global {
  // Next.js dev server re-evaluates modules on every hot reload; a module-local
  // variable would leak a new connection (and a new file lock) each time.
  var __groundworkDb: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA_SQL);
  return db;
}

export function getDb(): Database.Database {
  if (!global.__groundworkDb) global.__groundworkDb = open();
  return global.__groundworkDb;
}

/** Row helpers — thin wrappers so query modules read like data access, not SQL plumbing. */
export function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...(params as never[])) as T[];
}

export function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  const row = getDb().prepare(sql).get(...(params as never[]));
  return (row as T) ?? null;
}

export function run(sql: string, params: unknown[] = []): void {
  getDb().prepare(sql).run(...(params as never[]));
}

export function tx<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}

/** Next sequence number for per-business document numbering (quotes, jobs, invoices). */
export function nextNumber(table: 'quotes' | 'jobs' | 'invoices', businessId: string): number {
  const row = one<{ n: number | null }>(
    `SELECT MAX(number) AS n FROM ${table} WHERE business_id = ?`,
    [businessId],
  );
  return (row?.n ?? 1000) + 1;
}
