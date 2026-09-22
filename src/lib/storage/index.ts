import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { id } from '../ids';
import { hasBlobStore, hasWritableDisk } from '../deployment';

/**
 * Object storage for job and lead photos.
 *
 * Three drivers, chosen by what the environment actually offers. Photos are
 * served straight to browsers, so stored objects are public — the random suffix
 * in the path is what keeps them unguessable. The database snapshot is handled
 * separately and is private (see `db/snapshot.ts`).
 */

export interface StoredFile {
  url: string;
  bytes: number;
  contentType: string;
}

export interface StorageDriver {
  readonly name: string;
  readonly available: boolean;
  put(file: File, prefix: string): Promise<StoredFile>;
}

/** Thrown when a photo cannot be stored. Callers surface the message to the user. */
export class StorageUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageUnavailable';
  }
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif']);

function validate(file: File): void {
  if (file.size > MAX_BYTES) throw new StorageUnavailable('Photo is larger than 10 MB.');
  if (file.type && !ALLOWED.has(file.type)) {
    throw new StorageUnavailable('Only image files can be uploaded.');
  }
}

function safeName(file: File, prefix: string): { dir: string; name: string } {
  const ext = extensionFor(file.type, file.name);
  const dir = prefix.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'misc';
  return { dir, name: `${id('img')}${ext}` };
}

class LocalStorage implements StorageDriver {
  readonly name = 'local disk';
  readonly available = true;
  private readonly root = path.join(process.cwd(), 'public', 'uploads');

  async put(file: File, prefix: string): Promise<StoredFile> {
    validate(file);
    const { dir, name } = safeName(file, prefix);
    await fs.mkdir(path.join(this.root, dir), { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(this.root, dir, name), buffer);

    return {
      url: `/uploads/${dir}/${name}`,
      bytes: buffer.byteLength,
      contentType: file.type || 'image/jpeg',
    };
  }
}

class BlobStorage implements StorageDriver {
  readonly name = 'Vercel Blob';
  readonly available = true;

  async put(file: File, prefix: string): Promise<StoredFile> {
    validate(file);
    const { dir, name } = safeName(file, prefix);
    const { put } = await import('@vercel/blob');

    const result = await put(`photos/${dir}/${name}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type || 'image/jpeg',
    });
    return { url: result.url, bytes: file.size, contentType: file.type || 'image/jpeg' };
  }
}

/**
 * No disk to write to and no blob store connected. Rather than throwing an
 * unhandled error at upload time, this says exactly what is missing so the UI
 * can show it and the rest of the job still works.
 */
class UnavailableStorage implements StorageDriver {
  readonly name = 'none';
  readonly available = false;

  async put(): Promise<StoredFile> {
    throw new StorageUnavailable(
      'Photos cannot be saved on this deployment yet. Create a Blob store in your Vercel project (Storage → Create → Blob) and redeploy.',
    );
  }
}

function extensionFor(type: string, name: string): string {
  const fromName = path.extname(name || '').toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (type === 'image/png') return '.png';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/avif') return '.avif';
  return '.jpg';
}

export function storage(): StorageDriver {
  if (hasBlobStore()) return new BlobStorage();
  if (hasWritableDisk()) return new LocalStorage();
  return new UnavailableStorage();
}

export function photoStorageStatus(): { available: boolean; label: string; remedy: string | null } {
  const driver = storage();
  return {
    available: driver.available,
    label: driver.available ? driver.name : 'Not connected',
    remedy: driver.available
      ? null
      : 'Create a Blob store in your Vercel project (Storage → Create → Blob) to store job photos.',
  };
}
