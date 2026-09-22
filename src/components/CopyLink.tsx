'use client';

import { useState } from 'react';

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-stretch gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="input min-w-0 flex-1 py-1.5 font-mono text-xs"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            setCopied(false);
          }
        }}
        className="btn btn-secondary btn-sm shrink-0"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
