import Link from 'next/link';
import type { PipelineStage } from '@/lib/queries/dashboard';
import { money } from '@/lib/money';

/**
 * The whole book of work in one line: how many are at each stage and what they
 * are worth. The urgent count is the number in that stage that needs a decision
 * today, which is the only thing that should pull the eye.
 */
export function PipelineBar({ stages }: { stages: PipelineStage[] }) {
  return (
    <section className="card overflow-hidden" aria-label="Pipeline">
      <div className="no-scrollbar flex overflow-x-auto">
        {stages.map((stage, i) => (
          <Link
            key={stage.key}
            href={stage.href}
            className="group relative flex min-w-[9.5rem] flex-1 flex-col gap-0.5 border-r border-line px-4 py-3.5 transition-colors last:border-r-0 hover:bg-paper-sunken/60"
          >
            <span className="flex items-center gap-1.5">
              <span className="eyebrow">{stage.label}</span>
              {stage.urgent > 0 ? (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-status-serious"
                  aria-label={`${stage.urgent} need attention`}
                />
              ) : null}
            </span>
            <span className="font-display text-2xl font-bold tabular tracking-[-0.02em] text-ink">
              {stage.count}
            </span>
            <span className="text-xs tabular text-ink-faint">
              {stage.value > 0 ? money(stage.value) : '—'}
            </span>
            {stage.urgent > 0 ? (
              <span className="mt-0.5 text-2xs font-semibold text-status-serious">
                {stage.urgent} need{stage.urgent === 1 ? 's' : ''} attention
              </span>
            ) : null}
            {i < stages.length - 1 ? (
              <span
                aria-hidden
                className="absolute -right-[7px] top-1/2 z-10 hidden -translate-y-1/2 text-line-strong sm:block"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
