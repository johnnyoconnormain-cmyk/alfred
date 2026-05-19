// Single place every Convex function goes through to talk to an LLM.
// Prefers Anthropic Claude if ANTHROPIC_API_KEY is set, otherwise falls
// back to the free Gemini key. Keys are read from the Convex environment
// only — never hardcoded, never committed.

// Cheapest capable Claude model — good for high-volume scanning/drafting.
// Bump to 'claude-sonnet-4-6' for higher-quality proposals at more cost.
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

export function activeProvider(): 'anthropic' | 'gemini' | null {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  return null
}

export function llmConfigured(): boolean {
  return activeProvider() !== null
}

function extractJson(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.search(/[[{]/)
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1))
    }
    throw new Error('No JSON in response')
  }
}

type Msg = { role: 'user' | 'assistant'; content: string }

async function anthropic(messages: Msg[], system: string | undefined, maxTokens: number, temperature: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages,
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = await res.json()
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('Empty Anthropic response')
  return text
}

async function gemini(contents: any[], maxTokens: number, temperature: number, json: boolean): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')
  return text
}

// One-shot prompt. If json=true, returns parsed JSON (or null on failure).
export async function callLLM(
  prompt: string,
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<any> {
  const { json = false, maxTokens = 1024, temperature = json ? 0.3 : 0.8 } = opts
  const provider = activeProvider()
  try {
    let text: string
    if (provider === 'anthropic') {
      const p = json ? prompt + '\n\nReturn ONLY raw JSON. No markdown, no commentary.' : prompt
      text = await anthropic([{ role: 'user', content: p }], undefined, maxTokens, temperature)
    } else if (provider === 'gemini') {
      text = await gemini(
        [{ role: 'user', parts: [{ text: prompt }] }],
        maxTokens,
        temperature,
        json
      )
    } else {
      return null
    }
    return json ? extractJson(text) : text
  } catch {
    return null
  }
}

// Multi-turn conversation with a system prompt.
export async function callLLMChat(history: Msg[], system: string, maxTokens: number): Promise<string> {
  const provider = activeProvider()
  if (provider === 'anthropic') {
    // Anthropic needs messages to start with 'user' and alternate.
    const norm: Msg[] = []
    for (const m of history) {
      const role: 'user' | 'assistant' = m.role === 'user' ? 'user' : 'assistant'
      if (norm.length === 0 && role !== 'user') continue
      const last = norm[norm.length - 1]
      if (last && last.role === role) last.content += '\n\n' + m.content
      else norm.push({ role, content: m.content })
    }
    if (norm.length === 0) norm.push({ role: 'user', content: 'Hello' })
    return await anthropic(norm, system, maxTokens, 0.8)
  }
  // Gemini: fold the system prompt into the first turn.
  const contents = [
    { role: 'user', parts: [{ text: system + '\n\nRespond as Alfred to the conversation.' }] },
    { role: 'model', parts: [{ text: 'Understood, boss. Ready.' }] },
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
  ]
  return await gemini(contents, maxTokens, 0.8, false)
}

// Optional push alert. No-ops unless both env vars are set.
export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    })
  } catch {
    /* alerts are best-effort */
  }
}
