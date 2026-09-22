import { requireOwner } from '@/lib/session';
import { crewsWithMembers, serviceRates } from '@/lib/queries/settings';
import { teamMembers } from '@/lib/session';
import { safeParse } from '@/lib/queries/schedule';
import { appUrl } from '@/lib/automations/engine';
import { Card, Field, PageHeader } from '@/components/ui';
import { CopyLink } from '@/components/CopyLink';
import { DAY_NAMES } from '@/lib/dates';
import { paymentProvider, isTestMode } from '@/lib/payments';
import { storageStatus } from '@/lib/deployment';
import { photoStorageStatus } from '@/lib/storage';
import { aiProvider } from '@/lib/ai/provider';
import { weatherProvider } from '@/lib/weather';
import {
  addCrewAction,
  addTeamMemberAction,
  updateBusinessAction,
  updatePricingAction,
  updateRateAction,
  updateScheduleSettingsAction,
} from '@/actions/settings';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { business, settings } = await requireOwner();
  const rates = serviceRates(business.id);
  const crews = crewsWithMembers(business.id);
  const team = teamMembers(business.id);
  const workDays: number[] = safeParse(settings.work_days, [1, 2, 3, 4, 5]);

  const database = storageStatus();
  const photos = photoStorageStatus();

  const integrations = [
    {
      name: 'Database storage',
      on: database.durable,
      detail: database.durable
        ? `${database.label}. ${database.detail}`
        : `${database.detail} ${database.remedy ?? ''}`,
    },
    {
      name: 'Photo storage',
      on: photos.available,
      detail: photos.available
        ? `Job and lead photos are stored in ${photos.label}.`
        : photos.remedy ?? 'Photo uploads are turned off.',
    },
    {
      name: 'Card payments (Stripe)',
      on: paymentProvider().enabled,
      detail: paymentProvider().enabled
        ? isTestMode()
          ? 'Connected in test mode.'
          : 'Connected and live.'
        : 'Set STRIPE_SECRET_KEY to let customers pay from their invoice.',
    },
    {
      name: 'Message drafting',
      on: aiProvider().enabled,
      detail: aiProvider().enabled
        ? 'A model is available to warm up drafts you then edit.'
        : 'Set ANTHROPIC_API_KEY. Everything still works without it — templates are used instead.',
    },
    {
      name: 'Weather',
      on: weatherProvider().enabled,
      detail: weatherProvider().enabled
        ? 'Forecast and rain warnings are live on your command center.'
        : 'Set OPENWEATHER_API_KEY to see conditions and reschedule warnings.',
    },
    {
      name: 'Map view',
      on: Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN),
      detail: process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        ? 'Today’s stops are plotted on a map.'
        : 'Set NEXT_PUBLIC_MAPBOX_TOKEN to plot today’s stops. Routes are listed either way.',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Configuration" title="Settings" />

      <div className="space-y-4">
        <Card title="Your intake link">
          <p className="mb-2.5 text-sm text-ink-muted">
            Put this on your website, in your Google profile and in your text signature. Everything
            submitted here lands in your lead inbox.
          </p>
          <CopyLink url={`${appUrl()}/book/${business.slug}`} />
        </Card>

        <Card title="Business">
          <form action={updateBusinessAction} className="space-y-4">
            <Field label="Business name">
              <input name="name" defaultValue={business.name} className="input" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <input name="phone" defaultValue={business.phone ?? ''} className="input" />
              </Field>
              <Field label="Email">
                <input name="email" type="email" defaultValue={business.email ?? ''} className="input" />
              </Field>
            </div>
            <Field label="Address">
              <input name="address" defaultValue={business.address ?? ''} className="input" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="City" className="sm:col-span-2">
                <input name="city" defaultValue={business.city ?? ''} className="input" />
              </Field>
              <Field label="State">
                <input name="state" maxLength={2} defaultValue={business.state ?? ''} className="input" />
              </Field>
              <Field label="ZIP" >
                <input name="zip" defaultValue={business.zip ?? ''} className="input" />
              </Field>
            </div>
            <Field label="Timezone">
              <select name="timezone" defaultValue={business.timezone} className="input">
                {[
                  'America/New_York',
                  'America/Chicago',
                  'America/Denver',
                  'America/Phoenix',
                  'America/Los_Angeles',
                ].map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace('America/', '').replace('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Google review link" hint="Where four- and five-star customers get sent.">
              <input name="reviewUrl" defaultValue={business.review_url ?? ''} className="input" />
            </Field>
            <button type="submit" className="btn btn-primary">
              Save business details
            </button>
          </form>
        </Card>

        <Card title="Pricing rules">
          <p className="mb-4 text-sm text-ink-muted">
            These drive every estimate the system produces. Nothing is priced from anywhere else.
          </p>
          <form action={updatePricingAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Minimum job price">
                <input name="minJobPrice" defaultValue={(settings.min_job_price / 100).toFixed(0)} className="input tabular" />
              </Field>
              <Field label="Hourly labor rate">
                <input name="hourlyRate" defaultValue={(settings.hourly_rate / 100).toFixed(0)} className="input tabular" />
              </Field>
              <Field label="Travel fee">
                <input name="travelFee" defaultValue={(settings.travel_fee / 100).toFixed(0)} className="input tabular" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Material markup %">
                <input name="materialMarkup" type="number" step="1" defaultValue={settings.material_markup} className="input tabular" />
              </Field>
              <Field label="Minimum sq ft">
                <input name="minSqft" type="number" defaultValue={settings.min_sqft} className="input tabular" />
              </Field>
              <Field label="Tax rate %">
                <input name="taxRate" type="number" step="0.01" defaultValue={settings.tax_rate} className="input tabular" />
              </Field>
              <Field label="Quote valid (days)">
                <input name="quoteValidDays" type="number" defaultValue={settings.quote_valid_days} className="input tabular" />
              </Field>
            </div>
            <button type="submit" className="btn btn-primary">
              Save pricing
            </button>
          </form>
        </Card>

        <Card title="Rate card" bodyClassName="">
          <p className="px-4 pt-4 text-sm text-ink-muted sm:px-5">
            Per-service pricing. The spread is how wide the estimate range comes out — tighten it for
            work you can price confidently from photos.
          </p>
          <ul className="mt-2 divide-y divide-line">
            {rates.map((rate) => (
              <li key={rate.id} className="px-4 py-3.5 sm:px-5">
                <form action={updateRateAction} className="grid grid-cols-2 gap-2 sm:grid-cols-7 sm:items-end">
                  <input type="hidden" name="serviceType" value={rate.service_type} />
                  <div className="col-span-2 sm:col-span-2">
                    <span className="field-label">Service</span>
                    <input name="label" defaultValue={rate.label} className="input py-1.5 text-sm" />
                  </div>
                  <div>
                    <span className="field-label">$/hr</span>
                    <input name="perHour" defaultValue={(rate.per_hour / 100).toFixed(0)} className="input py-1.5 text-sm tabular" />
                  </div>
                  <div>
                    <span className="field-label">Hours</span>
                    <input name="typicalHours" type="number" step="0.5" defaultValue={rate.typical_hours} className="input py-1.5 text-sm tabular" />
                  </div>
                  <div>
                    <span className="field-label">Materials</span>
                    <input name="materialEst" defaultValue={(rate.material_est / 100).toFixed(0)} className="input py-1.5 text-sm tabular" />
                  </div>
                  <div>
                    <span className="field-label">Minimum</span>
                    <input name="minPrice" defaultValue={(rate.min_price / 100).toFixed(0)} className="input py-1.5 text-sm tabular" />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <span className="field-label">Spread %</span>
                      <input name="spread" type="number" defaultValue={rate.spread_pct} className="input py-1.5 text-sm tabular" />
                    </div>
                    <input type="hidden" name="active" value={rate.active ? 'yes' : 'no'} />
                    <button type="submit" className="btn btn-secondary btn-sm shrink-0">
                      Save
                    </button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Working hours and travel">
          <form action={updateScheduleSettingsAction} className="space-y-4">
            <div>
              <span className="field-label">Working days</span>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.map((day, index) => (
                  <label
                    key={day}
                    className="flex cursor-pointer items-center gap-1.5 rounded border border-line-strong px-2.5 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="workDays"
                      value={index}
                      defaultChecked={workDays.includes(index)}
                      className="h-4 w-4 accent-[#1f6b3f]"
                    />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Day starts">
                <input name="workStart" type="time" defaultValue={settings.work_start} className="input tabular" />
              </Field>
              <Field label="Day ends">
                <input name="workEnd" type="time" defaultValue={settings.work_end} className="input tabular" />
              </Field>
              <Field label="Travel buffer (min)" hint="Held open between jobs.">
                <input name="travelBuffer" type="number" step="5" defaultValue={settings.travel_buffer_min} className="input tabular" />
              </Field>
            </div>
            <Field label="Service area">
              <input name="serviceArea" defaultValue={settings.service_area ?? ''} className="input" placeholder="Wexford, Cranberry, Sewickley — 20 mile radius" />
            </Field>
            <button type="submit" className="btn btn-primary">
              Save schedule settings
            </button>
          </form>
        </Card>

        <Card title="Crews and team">
          <ul className="mb-4 divide-y divide-line">
            {crews.map((crew) => (
              <li key={crew.id} className="py-2.5">
                <p className="text-sm font-semibold text-ink">{crew.name}</p>
                <p className="text-xs text-ink-faint">
                  {crew.members.length ? crew.members.map((m) => m.name).join(', ') : 'Nobody assigned'}
                </p>
              </li>
            ))}
          </ul>

          <form action={addCrewAction} className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <Field label="Add a crew" className="flex-1">
              <input name="name" required className="input" placeholder="Crew D" />
            </Field>
            <select name="color" className="input w-auto" defaultValue="slot1">
              <option value="slot1">Blue</option>
              <option value="slot2">Orange</option>
              <option value="slot3">Green</option>
              <option value="slot4">Yellow</option>
            </select>
            <button type="submit" className="btn btn-secondary">
              Add crew
            </button>
          </form>

          <div className="mt-6 border-t border-line pt-4">
            <p className="field-label">Team</p>
            <ul className="mb-4 divide-y divide-line">
              {team.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{member.name}</p>
                    <p className="truncate text-xs text-ink-faint">{member.email}</p>
                  </div>
                  <span className="badge badge-neutral">{member.role}</span>
                </li>
              ))}
            </ul>

            <form action={addTeamMemberAction} className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input name="name" required className="input" />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required className="input" />
              </Field>
              <Field label="Temporary password" hint="At least 8 characters.">
                <input name="password" type="text" required minLength={8} className="input" />
              </Field>
              <Field label="Role">
                <select name="role" className="input" defaultValue="crew">
                  <option value="crew">Crew — field view only</option>
                  <option value="admin">Admin — full office access</option>
                </select>
              </Field>
              <Field label="Add to crew">
                <select name="crewId" className="input" defaultValue="">
                  <option value="">No crew</option>
                  {crews.map((crew) => (
                    <option key={crew.id} value={crew.id}>
                      {crew.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end">
                <button type="submit" className="btn btn-secondary">
                  Add team member
                </button>
              </div>
            </form>
          </div>
        </Card>

        <Card title="Connections" bodyClassName="">
          <ul className="divide-y divide-line">
            {integrations.map((integration) => (
              <li key={integration.name} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    integration.on ? 'bg-status-good' : 'bg-line-strong'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{integration.name}</p>
                  <p className="text-xs text-ink-muted">{integration.detail}</p>
                </div>
                <span className={`badge ${integration.on ? 'badge-good' : 'badge-neutral'}`}>
                  {integration.on ? 'Connected' : 'Not set up'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
