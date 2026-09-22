import 'server-only';
import { all, one } from '../db';
import type { ServiceRate, Settings } from '../db/types';
import { roundToNearest } from '../money';

export interface EstimateInput {
  businessId: string;
  settings: Settings;
  serviceType: string;
  description: string;
  photoCount?: number;
  sqft?: number | null;
}

export interface Estimate {
  low: number;
  high: number;
  hours: number;
  basis: string;
  confidence: 'low' | 'medium' | 'high';
  lines: { kind: 'labor' | 'material' | 'disposal' | 'travel'; label: string; amount: number }[];
}

/**
 * Photo-informed estimate range.
 *
 * This is a pricing model, not a guess: it starts from the owner's own configured
 * rate card, adjusts hours for the size and complexity signals in the request
 * text, then widens the range according to how much it actually knows. It returns
 * a *range* and says what drove it, because nothing here can know the real price
 * before somebody stands in the yard. The owner overrides every number.
 */
export function estimate(input: EstimateInput): Estimate {
  const { settings } = input;
  const rate =
    one<ServiceRate>(
      'SELECT * FROM service_rates WHERE business_id = ? AND service_type = ? AND active = 1',
      [input.businessId, input.serviceType],
    ) ?? fallbackRate(input.businessId);

  const text = input.description.toLowerCase();
  const signals: string[] = [];

  let hours = rate?.typical_hours ?? 3;

  // Size signals — explicit square footage wins, then acreage, then adjectives.
  const sqftMatch = text.match(/(\d[\d,]{1,6})\s*(?:sq\.?\s?ft|square feet|sf)\b/);
  const acreMatch = text.match(/(\d+(?:\.\d+)?)\s*acre/);
  const sqft = input.sqft ?? (sqftMatch ? Number(sqftMatch[1].replace(/,/g, '')) : null);
  if (sqft) {
    const billable = Math.max(sqft, settings.min_sqft);
    hours = Math.max(hours, billable / 1200);
    signals.push(`${billable.toLocaleString()} sq ft`);
  } else if (acreMatch) {
    hours = Math.max(hours, Number(acreMatch[1]) * 5);
    signals.push(`${acreMatch[1]} acre lot`);
  }

  const bigWords = ['overgrown', 'neglected', 'years', 'huge', 'large', 'whole yard', 'entire', 'full yard', 'heavy'];
  const smallWords = ['small', 'quick', 'touch up', 'touch-up', 'just the', 'tiny', 'strip'];
  const haulWords = ['haul', 'debris', 'remove', 'removal', 'dump', 'branches', 'stumps', 'brush'];

  const bigHits = bigWords.filter((w) => text.includes(w));
  const smallHits = smallWords.filter((w) => text.includes(w));
  if (bigHits.length) {
    hours *= 1 + Math.min(0.6, bigHits.length * 0.2);
    signals.push('scope described as large');
  }
  if (smallHits.length) {
    hours *= 0.75;
    signals.push('scope described as small');
  }

  const crewSize = 2;
  const labor = Math.round(hours * crewSize * (rate?.per_hour || settings.hourly_rate));
  const materialBase = rate?.material_est ?? 0;
  const material = Math.round(materialBase * (1 + settings.material_markup / 100));
  const disposal = haulWords.some((w) => text.includes(w)) ? Math.round(hours * 2500) : 0;
  if (disposal) signals.push('debris haul-away');
  const travel = settings.travel_fee;

  const lines: Estimate['lines'] = [
    { kind: 'labor', label: `Labor — ${hours.toFixed(1)} hrs × ${crewSize} crew`, amount: labor },
  ];
  if (material) lines.push({ kind: 'material', label: 'Materials', amount: material });
  if (disposal) lines.push({ kind: 'disposal', label: 'Debris disposal', amount: disposal });
  if (travel) lines.push({ kind: 'travel', label: 'Travel', amount: travel });

  const mid = Math.max(
    labor + material + disposal + travel,
    rate?.min_price || settings.min_job_price,
  );

  // The less we know, the wider the range. Photos narrow it; a bare one-line
  // request widens it. This is the honest part of the feature.
  let spread = (rate?.spread_pct ?? 18) / 100;
  const photos = input.photoCount ?? 0;
  if (photos >= 3) spread *= 0.75;
  else if (photos === 0) spread *= 1.35;
  if (input.description.length < 60) spread *= 1.2;
  spread = Math.min(0.45, Math.max(0.08, spread));

  const confidence: Estimate['confidence'] =
    photos >= 3 && (sqft || acreMatch) ? 'high' : photos >= 1 || sqft ? 'medium' : 'low';

  const basisParts = [
    `${hours.toFixed(1)} crew-hours at ${((rate?.per_hour || settings.hourly_rate) / 100).toFixed(0)}/hr`,
    ...signals,
    photos ? `${photos} photo${photos === 1 ? '' : 's'} reviewed` : 'no photos provided',
  ];

  return {
    low: roundToNearest(Math.round(mid * (1 - spread))),
    high: roundToNearest(Math.round(mid * (1 + spread))),
    hours: Math.round(hours * 10) / 10,
    basis: basisParts.join(' · '),
    confidence,
    lines,
  };
}

function fallbackRate(businessId: string): ServiceRate | null {
  return all<ServiceRate>(
    'SELECT * FROM service_rates WHERE business_id = ? AND active = 1 ORDER BY label LIMIT 1',
    [businessId],
  )[0] ?? null;
}

/** Turns an estimate into starting quote lines the owner then edits. */
export function estimateToQuoteLines(est: Estimate) {
  return est.lines.map((line) => ({
    kind: line.kind,
    description: line.label,
    quantity: 1,
    unit: 'ea',
    unitPrice: line.amount,
  }));
}
