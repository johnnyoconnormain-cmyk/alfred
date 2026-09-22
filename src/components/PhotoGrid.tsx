import type { Photo } from '@/lib/db/types';
import { formatDateShort } from '@/lib/dates';

/**
 * Job and lead imagery.
 *
 * Plain `img` rather than `next/image` on purpose: these files come from the
 * tenant's own storage driver at unknown dimensions, and the optimiser would
 * need a loader per driver. Lazy loading and explicit aspect ratios do the work
 * that matters here.
 */
export function PhotoGrid({ photos, columns = 3 }: { photos: Photo[]; columns?: 2 | 3 | 4 }) {
  if (!photos.length) return null;
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[columns];

  return (
    <ul className={`grid gap-2 ${cols}`}>
      {photos.map((photo) => (
        <li key={photo.id} className="overflow-hidden rounded border border-line bg-paper-sunken">
          <a href={photo.url} target="_blank" rel="noreferrer" className="block">
            <img
              src={photo.url}
              alt={photo.caption ?? 'Job photo'}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
            />
          </a>
          {photo.caption || photo.uploaded_by ? (
            <p className="truncate px-2 py-1 text-2xs text-ink-faint">
              {photo.caption ?? photo.uploaded_by} · {formatDateShort(photo.created_at.slice(0, 10))}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Before and after, side by side. This is the artefact the owner shows the next
 * customer, so it gets its own layout rather than being mixed into the gallery.
 */
export function BeforeAfter({ before, after }: { before: Photo[]; after: Photo[] }) {
  if (!before.length && !after.length) return null;
  const pairs = Math.max(before.length, after.length);

  return (
    <div className="space-y-3">
      {Array.from({ length: pairs }, (_, i) => {
        const b = before[i];
        const a = after[i];
        return (
          <div key={i} className="grid grid-cols-2 gap-2">
            <figure className="overflow-hidden rounded border border-line bg-paper-sunken">
              <figcaption className="border-b border-line px-2 py-1 text-2xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
                Before
              </figcaption>
              {b ? (
                <img src={b.url} alt="Before work started" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-xs text-ink-faint">
                  Not uploaded
                </div>
              )}
            </figure>
            <figure className="overflow-hidden rounded border border-line bg-paper-sunken">
              <figcaption className="border-b border-line px-2 py-1 text-2xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
                After
              </figcaption>
              {a ? (
                <img src={a.url} alt="Work completed" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-xs text-ink-faint">
                  Not uploaded
                </div>
              )}
            </figure>
          </div>
        );
      })}
    </div>
  );
}
