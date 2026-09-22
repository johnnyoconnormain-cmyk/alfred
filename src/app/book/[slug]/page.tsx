import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import type { Business, Settings } from '@/lib/db/types';
import { PublicShell } from '@/components/PublicShell';
import { IntakeForm } from '@/components/IntakeForm';
import { serviceRates } from '@/lib/queries/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = one<Business>('SELECT * FROM businesses WHERE slug = ?', [slug]);
  return { title: business ? `Request an estimate — ${business.name}` : 'Request an estimate' };
}

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const business = one<Business>('SELECT * FROM businesses WHERE slug = ?', [slug]);
  if (!business) notFound();
  const settings = one<Settings>('SELECT * FROM settings WHERE business_id = ?', [business.id]);
  const rates = serviceRates(business.id).filter((r) => r.active);

  return (
    <PublicShell
      business={business}
      footnote={settings?.service_area ? `Serving ${settings.service_area}` : undefined}
    >
      <p className="eyebrow">Free estimate</p>
      <h1 className="h-display mt-1">Tell us about your yard</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        A couple of photos and a sentence or two is plenty. You will get a price range back straight
        away, and {business.name} will confirm it before any work starts.
      </p>

      {error ? (
        <p className="mt-4 rounded border border-status-critical/25 bg-[#fbeceb] px-3 py-2 text-sm text-status-critical">
          We need your name, a phone number and a description to get started.
        </p>
      ) : null}

      <IntakeForm
        slug={slug}
        services={rates.map((rate) => ({ key: rate.service_type, label: rate.label }))}
      />
    </PublicShell>
  );
}
