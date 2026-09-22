import Link from 'next/link';
import { requireOwner } from '@/lib/session';
import { listCustomers } from '@/lib/queries/customers';
import { getLead, leadPhotos } from '@/lib/queries/leads';
import { estimate, estimateToQuoteLines } from '@/lib/ai/estimator';
import { serviceLabel } from '@/lib/ai/classify';
import { PageHeader, Card } from '@/components/ui';
import { PhotoGrid } from '@/components/PhotoGrid';
import { QuoteBuilder } from '@/components/QuoteBuilder';
import { createQuoteAction } from '@/actions/quotes';

export const metadata = { title: 'New quote' };
export const dynamic = 'force-dynamic';

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; customer?: string }>;
}) {
  const { business, settings } = await requireOwner();
  const params = await searchParams;

  const lead = params.lead ? getLead(business.id, params.lead) : null;
  const photos = lead ? leadPhotos(lead.id) : [];
  const customers = listCustomers(business.id).map((c) => ({
    id: c.id,
    name: c.name,
    address: c.address,
  }));

  const priced = lead
    ? estimate({
        businessId: business.id,
        settings,
        serviceType: lead.service_type,
        description: lead.description,
        photoCount: photos.length,
      })
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={
          lead ? (
            <Link href={`/leads/${lead.id}`} className="hover:underline">
              Back to lead
            </Link>
          ) : (
            <Link href="/quotes" className="hover:underline">
              Quotes
            </Link>
          )
        }
        title={lead ? `Quote for ${lead.customer_name}` : 'New quote'}
        description={
          lead
            ? 'Pre-filled from the request and your rate card. Change anything before it goes out.'
            : 'Build a quote from scratch.'
        }
      />

      {lead ? (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <Card title="What they asked for" className="lg:col-span-2">
            <blockquote className="border-l-2 border-line-strong pl-3.5 text-sm leading-relaxed text-ink">
              {lead.description}
            </blockquote>
            <p className="mt-2 text-xs text-ink-faint">
              {serviceLabel(lead.service_type)} · {lead.source}
            </p>
          </Card>
          {photos.length ? (
            <Card title={`Photos (${photos.length})`}>
              <PhotoGrid photos={photos} columns={2} />
            </Card>
          ) : null}
        </div>
      ) : null}

      <QuoteBuilder
        action={createQuoteAction}
        customers={customers}
        customerId={lead?.customer_id ?? params.customer}
        leadId={lead?.id ?? null}
        title={lead ? `${serviceLabel(lead.service_type)} — ${lead.customer_address ?? lead.customer_name}` : ''}
        serviceType={lead?.service_type}
        initialLines={priced ? estimateToQuoteLines(priced) : []}
        taxRate={settings.tax_rate}
        estimateHint={
          priced
            ? { low: priced.low, high: priced.high, basis: priced.basis, confidence: priced.confidence }
            : null
        }
      />
    </div>
  );
}
