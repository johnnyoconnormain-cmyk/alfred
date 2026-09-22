// Pure triage logic — no database, no secrets — so the service list can also be
// rendered by client components such as the quote builder.
export interface Classification {
  serviceType: string;
  urgency: 'low' | 'normal' | 'high';
  summary: string;
}

export const SERVICE_TYPES: { key: string; label: string; keywords: string[] }[] = [
  { key: 'cleanup', label: 'Yard cleanup', keywords: ['cleanup', 'clean up', 'cleaned up', 'cleaning up', 'overgrown', 'weeds', 'leaves', 'debris', 'brush', 'hauled', 'haul away', 'tidy', 'neglected', 'branches'] },
  { key: 'mulch', label: 'Mulch installation', keywords: ['mulch', 'bed', 'beds', 'bark', 'topsoil'] },
  { key: 'lawn', label: 'Lawn maintenance', keywords: ['mow', 'mowing', 'lawn', 'grass', 'weekly', 'biweekly', 'edging', 'trim'] },
  { key: 'landscaping', label: 'Landscape design & install', keywords: ['design', 'install', 'plants', 'shrubs', 'patio', 'walkway', 'hardscape', 'retaining', 'sod', 'tree'] },
  { key: 'irrigation', label: 'Irrigation', keywords: ['irrigation', 'sprinkler', 'drip', 'backflow', 'zone', 'head'] },
  { key: 'snow', label: 'Snow & ice', keywords: ['snow', 'plow', 'ice', 'salt', 'shovel'] },
];

const URGENT = ['asap', 'urgent', 'this week', 'right away', 'emergency', 'tomorrow', 'closing', 'listing', 'party', 'wedding', 'hoa', 'violation'];
const RELAXED = ['no rush', 'sometime', 'next month', 'whenever', 'spring', 'planning', 'thinking about'];

/**
 * Deterministic lead triage.
 *
 * Runs on every inbound request before anyone looks at it, so the inbox arrives
 * pre-sorted. Keyword scoring rather than a model call: it is instant, it costs
 * nothing, and it is auditable when it gets one wrong — the owner can always
 * change the service type by hand.
 */
export function classify(description: string, hintedService?: string | null): Classification {
  const text = description.toLowerCase();

  let serviceType = hintedService || '';
  if (!serviceType || !SERVICE_TYPES.some((s) => s.key === serviceType)) {
    let best = { key: 'cleanup', score: 0 };
    for (const service of SERVICE_TYPES) {
      const score = service.keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
      if (score > best.score) best = { key: service.key, score };
    }
    serviceType = best.key;
  }

  let urgency: Classification['urgency'] = 'normal';
  if (URGENT.some((w) => text.includes(w))) urgency = 'high';
  else if (RELAXED.some((w) => text.includes(w))) urgency = 'low';

  return { serviceType, urgency, summary: summarize(description) };
}

/** One-line summary for the inbox row — first clause, trimmed to a readable length. */
export function summarize(description: string, max = 120): string {
  const cleaned = description.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return `${cut.slice(0, lastStop > 40 ? lastStop : max).trim()}…`;
}

export function serviceLabel(key: string): string {
  return SERVICE_TYPES.find((s) => s.key === key)?.label ?? key.replace(/[-_]/g, ' ');
}
