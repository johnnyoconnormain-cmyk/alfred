'use client';

import { useState } from 'react';

/**
 * Five stars, big enough for a thumb. The rating is what routes the response:
 * four and up gets pointed at the public profile, three and under goes straight
 * to the owner privately. Nothing is ever posted on the customer's behalf.
 */
export function StarPicker() {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  const labels = ['', 'Not good', 'Below par', 'Fine', 'Good', 'Excellent'];

  return (
    <div>
      <input type="hidden" name="rating" value={value} required />
      <div className="flex justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            aria-pressed={value === star}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(star)}
            onClick={() => setValue(star)}
            className="tap rounded p-1 text-4xl leading-none transition-transform duration-100 hover:scale-110"
          >
            <span className={star <= shown ? 'text-status-warning' : 'text-line-strong'}>★</span>
          </button>
        ))}
      </div>
      <p className="mt-2 h-5 text-center text-sm font-semibold text-ink-muted">{labels[shown] ?? ''}</p>
    </div>
  );
}
