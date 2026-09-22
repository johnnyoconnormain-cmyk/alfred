import 'server-only';

/**
 * The AI boundary.
 *
 * Groundwork's rule is that intelligence shows up as a better default, never as
 * a chat window. Every call site here has a deterministic implementation that
 * works with no API key at all; a configured model only *improves* the wording.
 * If the model is unreachable or slow, the deterministic result ships — the
 * owner's workflow never blocks on inference.
 */

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  readonly enabled: boolean;
  complete(req: CompletionRequest): Promise<string | null>;
}

const TIMEOUT_MS = 8000;

class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  readonly enabled = true;

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  ) {}

  async complete(req: CompletionRequest): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: req.maxTokens ?? 400,
          system: req.system,
          messages: [{ role: 'user', content: req.prompt }],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = data.content?.find((c) => c.type === 'text')?.text;
      return text?.trim() || null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

class DisabledProvider implements AiProvider {
  readonly name = 'none';
  readonly enabled = false;
  async complete(): Promise<string | null> {
    return null;
  }
}

let cached: AiProvider | null = null;

export function aiProvider(): AiProvider {
  if (cached) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  cached = key ? new AnthropicProvider(key) : new DisabledProvider();
  return cached;
}
