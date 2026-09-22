import { randomBytes, randomUUID } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Identifier generation.
 *
 * Normally these are random. The demo seed can switch them to a deterministic
 * stream, which matters on an ephemeral deployment: the demo company is rebuilt
 * on every cold start, and if the owner's user id changed each time, a signed-in
 * visitor would be logged out the moment their next request landed on a
 * different instance. Same seed, same ids, same session.
 */

let deterministic: (() => number) | null = null;

export function withDeterministicIds<T>(seed: number, fn: () => T): T {
  let state = seed >>> 0;
  const previous = deterministic;
  deterministic = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  try {
    return fn();
  } finally {
    deterministic = previous;
  }
}

function bytes(count: number): Buffer {
  if (!deterministic) return randomBytes(count);
  const out = Buffer.alloc(count);
  for (let i = 0; i < count; i++) out[i] = Math.floor(deterministic() * 256);
  return out;
}

/** Prefixed public identifier: `job_k3m9x2...`. */
export function id(prefix: string): string {
  let out = '';
  for (const b of bytes(10)) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

/** Unguessable token for customer-facing links (quotes, invoices, reviews). */
export function token(): string {
  return bytes(18).toString('base64url');
}

export function uuid(): string {
  return randomUUID();
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'business'
  );
}
