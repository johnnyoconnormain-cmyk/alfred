'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitIntakeAction } from '@/actions/public';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
      {pending ? 'Sending…' : 'Get my estimate'}
    </button>
  );
}

/**
 * Customer intake.
 *
 * Designed for a phone held in one hand: large targets, the camera one tap away,
 * and only three genuinely required fields. Everything else is optional because
 * a half-filled request the office can call about beats an abandoned form.
 */
export function IntakeForm({
  slug,
  services,
}: {
  slug: string;
  services: { key: string; label: string }[];
}) {
  const [previews, setPreviews] = useState<string[]>([]);

  return (
    <form action={submitIntakeAction} className="mt-6 space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <div className="card card-pad space-y-4">
        <label className="block">
          <span className="field-label">Your name</span>
          <input name="name" required autoComplete="name" className="input input-lg" placeholder="Sarah Miller" />
        </label>
        <label className="block">
          <span className="field-label">Mobile number</span>
          <input
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            className="input input-lg"
            placeholder="(724) 555-0148"
          />
        </label>
        <label className="block">
          <span className="field-label">Email (optional)</span>
          <input name="email" type="email" autoComplete="email" className="input input-lg" />
        </label>
        <label className="block">
          <span className="field-label">Property address</span>
          <input
            name="address"
            autoComplete="street-address"
            className="input input-lg"
            placeholder="412 Hunters Ridge Dr"
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 block">
            <span className="field-label">City</span>
            <input name="city" className="input input-lg" />
          </label>
          <label className="block">
            <span className="field-label">ZIP</span>
            <input name="zip" inputMode="numeric" className="input input-lg" />
          </label>
        </div>
      </div>

      <div className="card card-pad space-y-4">
        <label className="block">
          <span className="field-label">What do you need done?</span>
          <select name="serviceType" className="input input-lg" defaultValue="">
            <option value="">Not sure — you tell me</option>
            {services.map((service) => (
              <option key={service.key} value={service.key}>
                {service.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="field-label">Tell us about it</span>
          <textarea
            name="description"
            required
            rows={5}
            className="input input-lg"
            placeholder="Backyard got away from us this summer — weeds in all the beds along the fence and a pile of branches from the storm."
          />
        </label>

        <div>
          <span className="field-label">Photos</span>
          <label className="tap flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded border border-dashed border-line-strong bg-paper-sunken/50 px-4 py-6 text-center transition-colors hover:border-field">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="text-ink-faint">
              <path
                d="M4 8h3l1.5-2h7L17 8h3v11H4z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span className="text-sm font-semibold text-ink">Add photos of the area</span>
            <span className="text-xs text-ink-faint">
              The more we can see, the tighter the price range.
            </span>
            <input
              name="photos"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setPreviews(files.slice(0, 6).map((f) => URL.createObjectURL(f)));
              }}
            />
          </label>

          {previews.length ? (
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {previews.map((src) => (
                <li key={src} className="overflow-hidden rounded border border-line">
                  <img src={src} alt="" className="aspect-square w-full object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Preferred date</span>
            <input name="preferredDate" type="date" className="input input-lg" />
          </label>
          <label className="block">
            <span className="field-label">Time of day</span>
            <select name="preferredTime" className="input input-lg" defaultValue="">
              <option value="">Any time</option>
              <option>Morning</option>
              <option>Afternoon</option>
              <option>Flexible</option>
            </select>
          </label>
        </div>
      </div>

      <Submit />
      <p className="text-center text-xs text-ink-faint">
        No account, no card. You will get a price range back and a real person will confirm it.
      </p>
    </form>
  );
}
