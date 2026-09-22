import { createHmac, timingSafeEqual } from 'node:crypto';
import { signingSecret } from './deployment';

/**
 * Signed, self-describing tokens.
 *
 * Used for session cookies on deployments that have no durable database to keep
 * a session table in. The payload is not secret — it is a user id — but it is
 * tamper-proof, which is the property that matters.
 */

export function sign(payload: string, expiresAt: number): string {
  const body = `${payload}.${expiresAt}`;
  return `v1.${body}.${mac(body)}`;
}

export function verify(value: string): { payload: string; expiresAt: number } | null {
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;

  const [, payload, expiresRaw, signature] = parts;
  const body = `${payload}.${expiresRaw}`;
  if (!equal(signature, mac(body))) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  return { payload, expiresAt };
}

function mac(body: string): string {
  return createHmac('sha256', signingSecret()).update(body).digest('base64url');
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
