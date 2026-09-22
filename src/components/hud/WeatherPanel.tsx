import Link from 'next/link';
import { Card } from '@/components/ui';
import { weatherProvider } from '@/lib/weather';

/**
 * Field conditions, with a deliberate empty state: if no weather API is
 * connected the panel says so rather than showing a plausible-looking 72°.
 */
export async function WeatherPanel({
  zip,
  outdoorJobsTomorrow,
}: {
  zip: string | null;
  outdoorJobsTomorrow: number;
}) {
  const provider = weatherProvider();
  const forecast = zip ? await provider.forecast(zip) : null;

  if (!forecast) {
    return (
      <Card title="Field conditions">
        <p className="text-sm text-ink-muted">
          No weather service connected, so nothing is shown here yet.
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          Set <code className="rounded-sm bg-paper-sunken px-1 py-0.5 text-2xs">OPENWEATHER_API_KEY</code> and
          the forecast plus rain warnings for scheduled outdoor work appear in this panel.
        </p>
        <Link href="/settings" className="mt-3 inline-block text-xs font-semibold text-field underline underline-offset-2">
          Connect in settings
        </Link>
      </Card>
    );
  }

  const glyph = { sun: '☀', cloud: '☁', rain: '🌧', snow: '❄' }[forecast.today.icon];
  const warn = forecast.tomorrow.rainChance >= 55 && outdoorJobsTomorrow > 0;

  return (
    <Card title="Field conditions">
      <div className="flex items-start gap-4">
        <span aria-hidden className="text-3xl leading-none">{glyph}</span>
        <div>
          <p className="figure">{forecast.today.tempF}°</p>
          <p className="text-sm capitalize text-ink-muted">{forecast.today.summary}</p>
          <p className="mt-1 text-xs tabular text-ink-faint">
            Rain {forecast.today.rainChance}% · Wind {forecast.today.windMph} mph
          </p>
        </div>
      </div>

      {warn ? (
        <div className="mt-3 rounded border border-status-warning/25 bg-[#fdf4e3] p-2.5">
          <p className="text-sm font-semibold text-status-warning">
            {forecast.tomorrow.rainChance}% rain expected tomorrow
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {outdoorJobsTomorrow} outdoor job{outdoorJobsTomorrow === 1 ? '' : 's'} may need rescheduling.
          </p>
          <Link href="/schedule" className="mt-1.5 inline-block text-xs font-semibold text-field underline underline-offset-2">
            Review tomorrow
          </Link>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-faint">
          Tomorrow {forecast.tomorrow.tempF}° · rain {forecast.tomorrow.rainChance}%. No scheduling
          risk flagged.
        </p>
      )}
      <p className="mt-3 text-2xs text-ink-faint">Source: {forecast.source}</p>
    </Card>
  );
}
