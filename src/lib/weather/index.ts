import 'server-only';

/**
 * Field conditions.
 *
 * Weather genuinely moves money in this trade — a wet Thursday reschedules three
 * crews — so the panel is part of the command center. It is also the easiest
 * place in a product like this to start inventing data, so this module returns
 * `null` until a real API is configured and the panel says so plainly. Wiring a
 * provider means implementing `WeatherProvider` and nothing else changes.
 */

export interface Conditions {
  tempF: number;
  summary: string;
  rainChance: number;
  windMph: number;
  icon: 'sun' | 'cloud' | 'rain' | 'snow';
}

export interface Forecast {
  today: Conditions;
  tomorrow: Conditions;
  source: string;
}

export interface WeatherProvider {
  readonly name: string;
  readonly enabled: boolean;
  forecast(zip: string): Promise<Forecast | null>;
}

class OpenWeatherProvider implements WeatherProvider {
  readonly name = 'openweather';
  readonly enabled = true;

  constructor(private readonly apiKey: string) {}

  async forecast(zip: string): Promise<Forecast | null> {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?zip=${encodeURIComponent(
          zip,
        )},us&units=imperial&appid=${this.apiKey}`,
        { next: { revalidate: 1800 } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        list: { dt_txt: string; main: { temp: number }; wind: { speed: number }; pop: number; weather: { main: string; description: string }[] }[];
      };
      if (!data.list?.length) return null;

      const days = groupByDay(data.list);
      const [today, tomorrow] = days;
      if (!today) return null;
      return {
        today: toConditions(today),
        tomorrow: tomorrow ? toConditions(tomorrow) : toConditions(today),
        source: 'OpenWeather',
      };
    } catch {
      return null;
    }
  }
}

class UnconfiguredWeather implements WeatherProvider {
  readonly name = 'none';
  readonly enabled = false;
  async forecast(): Promise<Forecast | null> {
    return null;
  }
}

export function weatherProvider(): WeatherProvider {
  const key = process.env.OPENWEATHER_API_KEY;
  return key ? new OpenWeatherProvider(key) : new UnconfiguredWeather();
}

type Slot = { dt_txt: string; main: { temp: number }; wind: { speed: number }; pop: number; weather: { main: string; description: string }[] };

function groupByDay(list: Slot[]): Slot[][] {
  const byDay = new Map<string, Slot[]>();
  for (const slot of list) {
    const day = slot.dt_txt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), slot]);
  }
  return [...byDay.values()];
}

function toConditions(slots: Slot[]): Conditions {
  const temps = slots.map((s) => s.main.temp);
  const main = slots[Math.floor(slots.length / 2)]?.weather[0]?.main ?? 'Clear';
  return {
    tempF: Math.round(Math.max(...temps)),
    summary: slots[Math.floor(slots.length / 2)]?.weather[0]?.description ?? 'Clear',
    rainChance: Math.round(Math.max(...slots.map((s) => s.pop ?? 0)) * 100),
    windMph: Math.round(Math.max(...slots.map((s) => s.wind.speed))),
    icon: main === 'Rain' || main === 'Drizzle' ? 'rain' : main === 'Snow' ? 'snow' : main === 'Clear' ? 'sun' : 'cloud',
  };
}
