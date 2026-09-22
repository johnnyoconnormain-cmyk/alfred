import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { listReviews } from '@/lib/queries/invoices';
import { listJobs } from '@/lib/queries/jobs';
import { appUrl } from '@/lib/automations/engine';
import { Card, EmptyState, PageHeader, StatTile } from '@/components/ui';
import { CopyLink } from '@/components/CopyLink';
import { relativeTime } from '@/lib/dates';

export const metadata = { title: 'Reviews' };
export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const { business } = await requireOwner();
  const reviews = listReviews(business.id);

  const average = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '—';
  const publicCount = reviews.filter((r) => r.routed_to === 'public').length;
  const privateCount = reviews.length - publicCount;

  const paidJobs = listJobs(business.id, { status: 'paid' });
  const reviewed = new Set(reviews.map((r) => r.job_id));
  const awaiting = paidJobs.filter((job) => !reviewed.has(job.id)).slice(0, 12);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="What customers said"
        title="Reviews"
        description="Happy customers get pointed at your public profile. Unhappy ones reach you privately first — nothing is ever posted on their behalf."
      />

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <StatTile label="Average rating" value={average} detail={`${reviews.length} reviews`} />
        <StatTile label="Sent to Google" value={String(publicCount)} detail="4 stars and up" />
        <StatTile label="Private feedback" value={String(privateCount)} detail="3 stars and under" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="All reviews" bodyClassName="">
            {reviews.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                description="Review requests go out automatically a day after a job is paid."
              />
            ) : (
              <ul className="divide-y divide-line">
                {reviews.map((review) => (
                  <li key={review.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg leading-none" aria-label={`${review.rating} out of 5`}>
                        <span className="text-status-warning">{'★'.repeat(review.rating)}</span>
                        <span className="text-line-strong">{'★'.repeat(5 - review.rating)}</span>
                      </p>
                      <span className={`badge ${review.routed_to === 'public' ? 'badge-good' : 'badge-neutral'}`}>
                        {review.routed_to === 'public' ? 'Asked for a public review' : 'Kept private'}
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="mt-2 text-sm leading-relaxed text-ink">“{review.comment}”</p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-ink-faint">
                      {review.customer_name} · {relativeTime(review.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Your Google review link">
            {business.review_url ? (
              <CopyLink url={business.review_url} />
            ) : (
              <>
                <p className="text-sm text-ink-muted">
                  Not set. Add it in settings and happy customers get sent straight to it.
                </p>
                <Link href="/settings" className="btn btn-secondary btn-sm mt-2.5 w-full">
                  Add review link
                </Link>
              </>
            )}
          </Card>

          <Card title={`Ready to ask (${awaiting.length})`} bodyClassName="">
            {awaiting.length === 0 ? (
              <p className="px-4 py-5 text-sm text-ink-muted sm:px-5">
                Everybody who has paid recently has been asked.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {awaiting.map((job) => (
                  <li key={job.id} className="px-4 py-2.5 sm:px-5">
                    <p className="text-sm font-medium text-ink">{job.customer_name}</p>
                    <p className="mb-1.5 text-xs text-ink-faint">{job.title}</p>
                    <CopyLink url={`${appUrl()}/review/${job.token}`} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
