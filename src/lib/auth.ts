import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing. scrypt from Node's standard library — no dependency, and the
 * parameters below are the ones OWASP recommends for interactive logins.
 * If the deployment later moves to a managed auth provider (Supabase Auth,
 * Clerk), this module is the only thing that has to change: nothing else reads
 * `password_hash`.
 */

const KEYLEN = 64;
const COST = 16384; // N
const BLOCK_SIZE = 8; // r
const PARALLEL = 1; // p

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password.normalize('NFKC'), salt, KEYLEN, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLEL,
  });
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLEL}$${salt}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'hex');
  let derived: Buffer;
  try {
    derived = scryptSync(password.normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 200) return 'Password is too long.';
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
