import type { ChecklistItem } from '@/lib/db/types';
import { Card } from '@/components/ui';
import { relativeTime } from '@/lib/dates';
import { toggleChecklistAction } from '@/actions/jobs';

/**
 * The job checklist.
 *
 * Each box is its own form post so it works with no JavaScript at all — which
 * matters when a crew is standing in a yard with one bar of signal.
 */
export function JobChecklist({ jobId, steps }: { jobId: string; steps: ChecklistItem[] }) {
  const done = steps.filter((s) => s.done).length;

  return (
    <Card
      title="Job checklist"
      action={
        <span className="text-xs tabular text-ink-faint">
          {done} of {steps.length}
        </span>
      }
      bodyClassName=""
    >
      <ul className="divide-y divide-line">
        {steps.map((step) => (
          <li key={step.id}>
            <form action={toggleChecklistAction}>
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="itemId" value={step.id} />
              <input type="hidden" name="done" value={step.done ? 'no' : 'yes'} />
              <button
                type="submit"
                className="tap flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-paper-sunken/60 sm:px-5"
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
                    step.done ? 'border-field bg-field text-white' : 'border-line-strong bg-paper-raised'
                  }`}
                >
                  {step.done ? (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${step.done ? 'text-ink-faint line-through' : 'text-ink'}`}>
                    {step.label}
                  </span>
                  {step.done && step.done_at ? (
                    <span className="block text-2xs text-ink-faint">
                      {step.done_by ?? 'Crew'} · {relativeTime(step.done_at)}
                    </span>
                  ) : null}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </Card>
  );
}
