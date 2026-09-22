import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { all, mutate, one, run } from './db';
import type { Business, Settings, User } from './db/types';
import { id, token as makeToken } from './ids';
import { isoNow } from './dates';
import { isEphemeral } from './deployment';
import { sign, verify } from './signing';

const COOKIE = 'gw_session';
const SESSION_DAYS = 30;

export interface SessionContext {
  user: User;
  business: Business;
  settings: Settings;
}

export async function createSession(userId: string): Promise<string> {
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  // Where nothing is persisted, an opaque token pointing at a `sessions` row
  // would stop working the moment the next request reached a different
  // instance. A signed cookie carries the user id itself instead.
  const value = isEphemeral()
    ? sign(userId, expires.getTime())
    : makeToken();

  if (!isEphemeral()) {
    await mutate(() =>
      run('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [
        value,
        userId,
        expires.toISOString(),
        isoNow(),
      ]),
    );
  }

  const store = await cookies();
  store.set(COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
  return value;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  if (value && !isEphemeral()) await mutate(() => run('DELETE FROM sessions WHERE token = ?', [value]));
  store.delete(COOKIE);
}

/** Resolves a stored session token to its user, expiring it if it is stale. */
function sessionUserId(value: string): string | null {
  const row = one<{ user_id: string; expires_at: string }>(
    'SELECT user_id, expires_at FROM sessions WHERE token = ?',
    [value],
  );
  if (!row) return null;
  if (row.expires_at < isoNow()) {
    run('DELETE FROM sessions WHERE token = ?', [value]);
    return null;
  }
  return row.user_id;
}

/** Resolves the signed-in user, their business and its settings — or null. */
export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  if (!value) return null;

  const userId = isEphemeral() ? verify(value)?.payload ?? null : sessionUserId(value);
  if (!userId) return null;

  const user = one<User>('SELECT * FROM users WHERE id = ? AND active = 1', [userId]);
  if (!user) return null;
  const business = one<Business>('SELECT * FROM businesses WHERE id = ?', [user.business_id]);
  if (!business) return null;
  const settings = one<Settings>('SELECT * FROM settings WHERE business_id = ?', [business.id]);
  if (!settings) return null;

  return { user, business, settings };
}

/** Use in every authenticated page and server action. Redirects when signed out. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireOwner(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.user.role === 'crew') redirect('/crew');
  return session;
}

export function purgeExpiredSessions(): void {
  run('DELETE FROM sessions WHERE expires_at < ?', [isoNow()]);
}

/** Every user of a business — used by crew assignment and settings. */
export function teamMembers(businessId: string): User[] {
  return all<User>(
    'SELECT * FROM users WHERE business_id = ? AND active = 1 ORDER BY role = \'owner\' DESC, name',
    [businessId],
  );
}

export function newUserId(): string {
  return id('usr');
}
