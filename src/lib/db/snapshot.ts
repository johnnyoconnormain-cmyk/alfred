import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * The database snapshot.
 *
 * On a serverless host the filesystem does not survive a restart, so the
 * database lives in memory and its bytes are kept in a store. Two things make
 * that safe rather than merely convenient:
 *
 *  1. The snapshot is **private** — not reachable from a URL, only through the
 *     store's own credentials.
 *  2. Every write is **conditional on the version we last read** (`ifMatch` /
 *     ETag). If another instance saved in the meantime the write is rejected
 *     rather than silently overwriting their work, and `mutate()` re-reads and
 *     replays. That is what turns "last writer wins" into optimistic
 *     concurrency control.
 *
 * Two implementations. `blob` is the real one. `file` keeps the snapshot on
 * local disk with the same read-modify-write contract, which is what makes the
 * serverless code path testable without deploying — see `tests/snapshot.test.mjs`.
 */

const SNAPSHOT_PATH = process.env.GROUNDWORK_SNAPSHOT_PATH || 'groundwork/database.sqlite';

export class SnapshotConflict extends Error {
  constructor() {
    super('The stored database changed since it was last read.');
    this.name = 'SnapshotConflict';
  }
}

export interface Snapshot {
  data: Buffer | null;
  etag: string | null;
}

export interface SnapshotStore {
  readonly name: string;
  read(): Promise<Snapshot>;
  /** Throws `SnapshotConflict` when `expectedEtag` no longer matches what is stored. */
  write(data: Buffer, expectedEtag: string | null): Promise<string | null>;
}

/* ---------------------------------- blob ---------------------------------- */

class BlobSnapshotStore implements SnapshotStore {
  readonly name = 'Vercel Blob';

  async read(): Promise<Snapshot> {
    const { get } = await import('@vercel/blob');
    // `useCache: false` matters: a cached read could hand us a stale database
    // and the ETag to go with it, and we would then write on top of newer data.
    const result = await get(SNAPSHOT_PATH, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return { data: null, etag: null };

    const chunks: Buffer[] = [];
    for await (const chunk of streamOf(result.stream)) chunks.push(Buffer.from(chunk));
    return { data: Buffer.concat(chunks), etag: result.blob.etag ?? null };
  }

  async write(data: Buffer, expectedEtag: string | null): Promise<string | null> {
    const { put, head, BlobPreconditionFailedError } = await import('@vercel/blob');
    try {
      const result = await put(SNAPSHOT_PATH, data, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/vnd.sqlite3',
        cacheControlMaxAge: 0,
        // On the very first save there is nothing to match against; the absence
        // of a stored snapshot is itself the precondition.
        ...(expectedEtag ? { ifMatch: expectedEtag } : {}),
      });
      const etag = (result as { etag?: string }).etag;
      if (etag) return etag;
      // Older SDK responses omit the ETag; fetch it so the next write stays conditional.
      const meta = await head(SNAPSHOT_PATH).catch(() => null);
      return meta?.etag ?? null;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError) throw new SnapshotConflict();
      throw err;
    }
  }
}

/* ---------------------------------- file ---------------------------------- */

/**
 * Same contract, backed by a local file. Exists so the serverless read-modify-write
 * path — including conflict detection and replay — can be exercised on a laptop.
 */
class FileSnapshotStore implements SnapshotStore {
  readonly name = 'local snapshot file';
  private readonly file = path.join(
    process.env.GROUNDWORK_DATA_DIR || path.join(process.cwd(), '.data'),
    'snapshot.sqlite',
  );

  async read(): Promise<Snapshot> {
    if (!fs.existsSync(this.file)) return { data: null, etag: null };
    const data = fs.readFileSync(this.file);
    return { data, etag: digest(data) };
  }

  async write(data: Buffer, expectedEtag: string | null): Promise<string | null> {
    const current = fs.existsSync(this.file) ? digest(fs.readFileSync(this.file)) : null;
    if (current !== expectedEtag) throw new SnapshotConflict();

    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, data);
    fs.renameSync(temp, this.file);
    return digest(data);
  }
}

function digest(data: Buffer): string {
  return createHash('sha256').update(data).digest('base64url').slice(0, 32);
}

/* --------------------------------- wiring --------------------------------- */

let store: SnapshotStore | null = null;

export function snapshotStore(): SnapshotStore {
  if (!store) {
    store = process.env.GROUNDWORK_SNAPSHOT_DRIVER === 'file'
      ? new FileSnapshotStore()
      : new BlobSnapshotStore();
  }
  return store;
}

export function readSnapshot(): Promise<Snapshot> {
  return snapshotStore().read();
}

export function writeSnapshot(data: Buffer, expectedEtag: string | null): Promise<string | null> {
  return snapshotStore().write(data, expectedEtag);
}

/** Accepts either a web ReadableStream or a Node readable. */
async function* streamOf(stream: unknown): AsyncGenerator<Uint8Array> {
  const candidate = stream as {
    getReader?: () => ReadableStreamDefaultReader<Uint8Array>;
    [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
  };

  if (typeof candidate.getReader === 'function') {
    const reader = candidate.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) yield value;
    }
    return;
  }
  for await (const chunk of candidate as AsyncIterable<Uint8Array>) yield chunk;
}

export function snapshotPath(): string {
  return SNAPSHOT_PATH;
}
