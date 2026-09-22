import { storageStatus } from '@/lib/deployment';

/**
 * Shown only when the deployment cannot keep what you do in it.
 *
 * A business app that quietly forgets everything on the next restart is worse
 * than no app, so this says so on every screen until a store is connected. When
 * storage is durable the banner renders nothing at all.
 */
export function StorageNotice() {
  const status = storageStatus();
  if (status.durable) return null;

  return (
    <div className="mb-4 rounded-lg border border-status-warning/30 bg-[#fdf4e3] px-4 py-3">
      <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-status-warning">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-status-warning"
        />
        Preview deployment — nothing you do here is saved
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        {status.detail}
        {status.remedy ? <span className="mt-1 block">{status.remedy}</span> : null}
      </p>
    </div>
  );
}

/** Compact variant for the field app, where vertical space is scarce. */
export function StorageNoticeCompact() {
  const status = storageStatus();
  if (status.durable) return null;

  return (
    <p className="mb-3 rounded border border-status-warning/30 bg-[#fdf4e3] px-3 py-2 text-xs text-status-warning">
      Preview deployment — changes are not saved.
    </p>
  );
}
