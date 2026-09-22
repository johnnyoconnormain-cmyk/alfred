/**
 * Exercises the serverless persistence path without deploying.
 *
 * Runs against the file-backed snapshot store, which implements the same
 * read-modify-write contract as Vercel Blob. What is under test is `mutate()`:
 * that writes are snapshotted, that a cold start reloads them, and — the part
 * that would silently lose an invoice if it were wrong — that a write racing
 * another instance is detected and replayed rather than clobbering it.
 */
import fs from 'node:fs';
import path from 'node:path';

process.env.GROUNDWORK_PERSISTENCE = 'blob';
process.env.GROUNDWORK_SNAPSHOT_DRIVER = 'file';
process.env.GROUNDWORK_DATA_DIR = path.join(process.cwd(), '.data-test');

fs.rmSync(process.env.GROUNDWORK_DATA_DIR, { recursive: true, force: true });

async function main(): Promise<void> {
  const { ensureReady, mutate, one, run, all } = await import('../src/lib/db');
  const { readSnapshot, writeSnapshot, SnapshotConflict } = await import('../src/lib/db/snapshot');
  const { isoNow } = await import('../src/lib/dates');

  const failures: string[] = [];
  function check(name: string, ok: boolean, extra = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
    if (!ok) failures.push(name);
  }

  function insertBusiness(id: string, name: string) {
    run(
      `INSERT INTO businesses (id, name, slug, trade, timezone, plan, is_demo, created_at)
       VALUES (?, ?, ?, 'landscaping', 'America/New_York', 'pro', 0, ?)`,
      [id, name, id, isoNow()],
    );
  }

  // ---------------------------------------------------- 1. write then cold start
  await ensureReady();
  await mutate(() => insertBusiness('biz_a', 'Ridgeline'));
  check('snapshot written on mutate', fs.existsSync(path.join(process.env.GROUNDWORK_DATA_DIR!, 'snapshot.sqlite')));

  // Simulate a cold start: drop the in-memory database entirely and reload.
  (globalThis as Record<string, unknown>).__groundworkState = undefined;
  await ensureReady();
  check(
    'data survives a cold start',
    one<{ name: string }>('SELECT name FROM businesses WHERE id = ?', ['biz_a'])?.name === 'Ridgeline',
  );

  // ------------------------------------------------ 2. a concurrent writer wins
  // Another instance loads the snapshot, writes to it, and saves — all without us
  // knowing. Our next write must notice and replay rather than overwrite them.
  const foreign = await readSnapshot();
  const Database = (await import('better-sqlite3')).default;
  const theirDb = new Database(foreign.data!);
  theirDb
    .prepare(
      `INSERT INTO businesses (id, name, slug, trade, timezone, plan, is_demo, created_at)
       VALUES ('biz_b', 'Cedar Hollow', 'cedar', 'landscaping', 'UTC', 'pro', 0, ?)`,
    )
    .run(isoNow());
  await writeSnapshot(theirDb.serialize(), foreign.etag);
  theirDb.close();

  // Our instance still believes it holds the current version.
  await mutate(() => insertBusiness('biz_c', 'Northgate'));

  const names = all<{ id: string }>('SELECT id FROM businesses ORDER BY id').map((r) => r.id);
  check('our write survived the race', names.includes('biz_c'), names.join(', '));
  check('their write was not clobbered', names.includes('biz_b'), names.join(', '));
  check('the original is still there', names.includes('biz_a'));

  // ---------------------------------------------- 3. the guard actually guards
  let conflicted = false;
  try {
    await writeSnapshot(Buffer.from('not a database'), 'an-etag-that-is-wrong');
  } catch (err) {
    conflicted = err instanceof SnapshotConflict;
  }
  check('a stale write is rejected', conflicted);

  // ------------------------------------------- 4. final state reloads correctly
  (globalThis as Record<string, unknown>).__groundworkState = undefined;
  await ensureReady();
  const final = all<{ id: string }>('SELECT id FROM businesses ORDER BY id').map((r) => r.id);
  check('all three survive a further cold start', final.length === 3, final.join(', '));

  fs.rmSync(process.env.GROUNDWORK_DATA_DIR!, { recursive: true, force: true });
  console.log(failures.length ? `\n${failures.length} FAILURES` : '\nAll checks passed.');
  process.exit(failures.length ? 1 : 0);

}

void main();
