import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import type { Business } from '@/lib/db/types';
import { getJobByToken } from '@/lib/queries/jobs';
import { reviewForJob } from '@/lib/queries/invoices';
import { PublicShell } from '@/components/PublicShell';
import { StarPicker } from '@/components/StarPicker';
import { submitReviewAction } from '@/actions/public';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'How did we do?' };

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const job = getJobByToken(token);
  if (!job) notFound();

  const business = one<Business>('SELECT * FROM businesses WHERE id = ?', [job.business_id]);
  if (!business) notFound();

  const existing = reviewForJob(job.id);
  const rating = done ? Number(done) : existing?.rating;

  if (rating) {
    const happy = rating >= 4;
    return (
      <PublicShell business={business}>
        <div className="card card-pad text-center">
          <p className="text-2xl" aria-hidden>
            {'★'.repeat(rating)}
            <span className="text-line-strong">{'★'.repeat(5 - rating)}</span>
          </p>
          <p className="h-display mt-3">Thank you</p>
          {happy ? (
            <>
              <p className="mt-2 text-sm text-ink-muted">
                It would mean a lot if you shared that publicly — it is how small companies like
                this one get found.
              </p>
              {business.review_url ? (
                <a
                  href={business.review_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-lg mt-4 w-full"
                >
                  Leave a Google review
                </a>
              ) : null}
              <p className="mt-3 text-2xs text-ink-faint">
                Nothing is posted for you. That link opens Google and you write it yourself.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-muted">
                Sorry we fell short. Your note went straight to {business.name} — not to a public
                page — and they will be in touch.
              </p>
              {business.phone ? (
                <a href={`tel:${business.phone}`} className="btn btn-secondary mt-4 w-full">
                  Call {business.phone}
                </a>
              ) : null}
            </>
          )}
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell business={business}>
      <p className="eyebrow">{job.title}</p>
      <h1 className="h-display mt-1">How did we do?</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {job.customer_name.split(' ')[0]}, it takes about ten seconds and it genuinely helps.
      </p>

      <form action={submitReviewAction} className="card card-pad mt-6">
        <input type="hidden" name="token" value={token} />
        <StarPicker />
        <label className="mt-5 block">
          <span className="field-label">Anything you want to add?</span>
          <textarea name="comment" rows={4} className="input" placeholder="Optional" />
        </label>
        <button type="submit" className="btn btn-primary btn-lg mt-4 w-full">
          Send feedback
        </button>
      </form>
    </PublicShell>
  );
}
