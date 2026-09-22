/**
 * Where is this running, and what survives a restart?
 *
 * Groundwork is designed to be honest about its own storage. Three modes:
 *
 *  - `disk`      — SQLite file on a real filesystem. Local development, Docker,
 *                  a VPS, Fly, Railway. Everything persists. The default.
 *  - `blob`      — the database is held in memory and snapshotted to Vercel Blob
 *                  after every write. Serverless-safe, durable, no third-party
 *                  database account. Turned on by `BLOB_READ_WRITE_TOKEN`.
 *  - `ephemeral` — serverless with no storage configured. The demo company is
 *                  seeded fresh in memory on each cold start and nothing is kept.
 *                  Useful for a preview deployment; the UI says so plainly.
 *
 * Nothing else in the app branches on the hosting platform — it asks this module
 * what persists and behaves accordingly.
 */

export type PersistenceMode = 'disk' | 'blob' | 'ephemeral';

export function isVercel(): boolean {
  return Boolean(process.env.VERCEL);
}

export function hasBlobStore(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** True when the filesystem is read-only apart from /tmp, as on serverless hosts. */
export function hasWritableDisk(): boolean {
  if (process.env.GROUNDWORK_FORCE_DISK === '1') return true;
  return !isVercel();
}

export function persistenceMode(): PersistenceMode {
  const forced = process.env.GROUNDWORK_PERSISTENCE as PersistenceMode | undefined;
  if (forced === 'disk' || forced === 'blob' || forced === 'ephemeral') return forced;
  if (hasBlobStore()) return 'blob';
  return hasWritableDisk() ? 'disk' : 'ephemeral';
}

export function isEphemeral(): boolean {
  return persistenceMode() === 'ephemeral';
}

export interface StorageStatus {
  mode: PersistenceMode;
  durable: boolean;
  label: string;
  detail: string;
  /** What the operator should do about it, when there is something to do. */
  remedy: string | null;
}

export function storageStatus(): StorageStatus {
  const mode = persistenceMode();
  if (mode === 'blob') {
    return {
      mode,
      durable: true,
      label: 'Vercel Blob',
      detail:
        'The database is snapshotted to your Blob store after every change, with a conflicting-write check on each save.',
      remedy: null,
    };
  }
  if (mode === 'disk') {
    return {
      mode,
      durable: true,
      label: 'Local disk',
      detail: 'The database is a SQLite file on this machine.',
      remedy: null,
    };
  }
  return {
    mode,
    durable: false,
    label: 'Preview — nothing is saved',
    detail:
      'This deployment has no storage connected, so the demo company is rebuilt from scratch every time the server restarts and any changes you make are lost.',
    remedy:
      'Create a Blob store in your Vercel project (Storage → Create → Blob) and redeploy. Nothing else to configure.',
  };
}

/** Public base URL for customer-facing links. */
export function appUrlFromEnv(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return 'http://localhost:3000';
}

/**
 * Secret used to sign stateless cookies. On Vercel with no secret configured we
 * fall back to the deployment id, which is stable across every instance of the
 * same deployment — enough to keep a preview session working, and it rotates on
 * each deploy, which is the right behaviour for a throwaway environment.
 */
export function signingSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    'groundwork-local-development-secret'
  );
}
