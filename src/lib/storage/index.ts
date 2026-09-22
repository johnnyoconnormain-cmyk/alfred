import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { id } from '../ids';

/**
 * Object storage boundary for job and lead photos.
 *
 * The local driver writes under `public/uploads` and is what runs out of the box.
 * A hosted deployment swaps in an S3/Supabase Storage driver by implementing this
 * same interface — callers only ever see the returned public URL.
 */

export interface StoredFile {
  url: string;
  bytes: number;
  contentType: string;
}

export interface StorageDriver {
  readonly name: string;
  put(file: File, prefix: string): Promise<StoredFile>;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif']);

class LocalStorage implements StorageDriver {
  readonly name = 'local';
  private readonly root = path.join(process.cwd(), 'public', 'uploads');

  async put(file: File, prefix: string): Promise<StoredFile> {
    if (file.size > MAX_BYTES) throw new Error('Photo is larger than 10 MB.');
    if (file.type && !ALLOWED.has(file.type)) throw new Error('Only image files can be uploaded.');

    const ext = extensionFor(file.type, file.name);
    const safePrefix = prefix.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'misc';
    const dir = path.join(this.root, safePrefix);
    await fs.mkdir(dir, { recursive: true });

    const name = `${id('img')}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(dir, name), buffer);

    return {
      url: `/uploads/${safePrefix}/${name}`,
      bytes: buffer.byteLength,
      contentType: file.type || 'image/jpeg',
    };
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
  return new LocalStorage();
}
