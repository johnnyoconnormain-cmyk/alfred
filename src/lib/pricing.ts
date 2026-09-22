/**
 * Plan configuration.
 *
 * Kept here rather than hard-coded into the marketing page so the same
 * definitions drive the pricing table, the plan badge in the app, and eventually
 * billing. Nothing charges a card today — `chargeable` stays false until real
 * billing is wired to Stripe.
 */

export interface Plan {
  key: 'starter' | 'pro' | 'scale';
  name: string;
  monthly: number; // cents
  tagline: string;
  features: string[];
  highlight?: boolean;
  limits: { crews: number | null; users: number | null };
}

export const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    monthly: 14900,
    tagline: 'For an owner-operator who wants the phone to stop being the system.',
    features: [
      'Lead inbox and intake form',
      'Quotes and customer quote pages',
      'Scheduling and calendar',
      'Customer database',
      'Unlimited quotes and jobs',
    ],
    limits: { crews: 1, users: 3 },
  },
  {
    key: 'pro',
    name: 'Pro',
    monthly: 29900,
    tagline: 'For a crew-based business that wants the follow-ups and the money handled.',
    highlight: true,
    features: [
      'Everything in Starter',
      'Automated follow-up sequences',
      'Card payments and invoicing',
      'Crew management and the field app',
      'Before/after photo documentation',
      'Business analytics',
    ],
    limits: { crews: 3, users: 15 },
  },
  {
    key: 'scale',
    name: 'Scale',
    monthly: 49900,
    tagline: 'For multiple crews, multiple services and somebody in the office full time.',
    features: [
      'Everything in Pro',
      'Unlimited crews and users',
      'Advanced automation rules',
      'Advanced reporting and exports',
      'Priority support',
    ],
    limits: { crews: null, users: null },
  },
];

export function planFor(key: string): Plan {
  return PLANS.find((plan) => plan.key === key) ?? PLANS[0];
}

/** Billing is not switched on. The app never charges anyone today. */
export const BILLING_ENABLED = false;
