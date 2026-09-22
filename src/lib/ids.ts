import { randomBytes, randomUUID } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Prefixed, sortable-ish public identifier: `job_k3m9x2...`. */
export function id(prefix: string): string {
  const bytes = randomBytes(10);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

/** Unguessable token for customer-facing links (quotes, invoices, reviews). */
export function token(): string {
  return randomBytes(18).toString('base64url');
}

export function uuid(): string {
  return randomUUID();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'business';
}
