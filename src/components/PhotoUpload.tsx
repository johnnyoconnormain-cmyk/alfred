'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadJobPhotosAction } from '@/actions/jobs';

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  if (!count) return null;
  return (
    <button type="submit" className="btn btn-primary btn-sm mt-2 w-full" disabled={pending}>
      {pending ? 'Uploading…' : `Upload ${count} photo${count === 1 ? '' : 's'}`}
    </button>
  );
}

/** Two buttons, both opening the camera. Anything more is a step too many in the field. */
export function PhotoUpload({ jobId }: { jobId: string }) {
  const [kind, setKind] = useState<'before' | 'after' | 'progress'>('before');
  const [count, setCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={uploadJobPhotosAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="kind" value={kind} />

      <div className="grid grid-cols-3 gap-2">
        {(['before', 'progress', 'after'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setKind(option);
              inputRef.current?.click();
            }}
            className={`tap rounded border px-2 py-2.5 text-xs font-semibold capitalize transition-colors ${
              kind === option && count
                ? 'border-field bg-field-light text-field-deep'
                : 'border-line-strong bg-paper-raised text-ink-muted hover:bg-paper-sunken'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        name="photos"
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => setCount(e.target.files?.length ?? 0)}
      />

      {count ? (
        <p className="mt-2 text-xs text-ink-muted">
          {count} file{count === 1 ? '' : 's'} selected as <span className="font-semibold">{kind}</span>.
        </p>
      ) : null}
      <Submit count={count} />
    </form>
  );
}
