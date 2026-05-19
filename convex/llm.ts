// Single place every Convex function goes through to talk to an LLM.
// Prefers Anthropic Claude if ANTHROPIC_API_KEY is set, otherwise falls
// back to the free Gemini key. Keys are read from the Convex environment
// only — never hardcoded, never committed.

// Strong model for the conversational brain / agent reasoning.
const REASONING_MODEL = 'claude-sonnet-4-6'
// Cheap model for high-volume background work (scoring/drafting many gigs).
const BULK_MODEL = 'claude-haiku-4-5-20251001'

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
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1))
    throw new Error('No JSON in response')
  }
}

type Msg = { role: 'user' | 'assistant'; content: string }

async function anthropicRaw(body: any): Promise<any> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return await res.json()
}

async function anthropicText(
  model: string,
  messages: any[],
  system: string | undefined,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const data = await anthropicRaw({
    model,
    max_tokens: maxTokens,
    temperature,
    ...(system ? { system } : {}),
    messages,
  })
  const text = (data?.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
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

// One-shot prompt (used for bulk gig scoring/drafting — cheap model).
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
      text = await anthropicText(BULK_MODEL, [{ role: 'user', content: p }], undefined, maxTokens, temperature)
    } else if (provider === 'gemini') {
      text = await gemini([{ role: 'user', parts: [{ text: prompt }] }], maxTokens, temperature, json)
    } else {
      return null
    }
    return json ? extractJson(text) : text
  } catch {
    return null
  }
}

// Multi-turn plain conversation (Gemini fallback path).
export async function callLLMChat(history: Msg[], system: string, maxTokens: number): Promise<string> {
  const provider = activeProvider()
  if (provider === 'anthropic') {
    const norm: Msg[] = []
    for (const m of history) {
      const role: 'user' | 'assistant' = m.role === 'user' ? 'user' : 'assistant'
      if (norm.length === 0 && role !== 'user') continue
      const last = norm[norm.length - 1]
      if (last && last.role === role) last.content += '\n\n' + m.content
      else norm.push({ role, content: m.content })
    }
    if (norm.length === 0) norm.push({ role: 'user', content: 'Hello' })
    return await anthropicText(REASONING_MODEL, norm, system, maxTokens, 0.8)
  }
  const contents = [
    { role: 'user', parts: [{ text: system + '\n\nRespond naturally to the conversation.' }] },
    { role: 'model', parts: [{ text: 'Got it. Ready.' }] },
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
  ]
  return await gemini(contents, maxTokens, 0.8, false)
}

export type AgentTool = {
  name: string
  description: string
  input_schema: any
}

function short(v: any, n = 220): string {
  let s = typeof v === 'string' ? v : JSON.stringify(v)
  if (s.length > n) s = s.slice(0, n) + '…'
  return s
}

// Real multi-step agent: Claude sees the tools, decides which to call
// (possibly several, in sequence), we run them and feed results back,
// and it reasons until it produces a final answer. Returns the answer
// plus a human-readable trace of its thinking/steps ("see his brain").
export async function runClaudeAgent(params: {
  system: string
  history: Msg[]
  tools: AgentTool[]
  execTool: (name: string, input: any) => Promise<any>
  maxSteps?: number
}): Promise<{ text: string; trace: string[] }> {
  const { system, history, tools, execTool, maxSteps = 6 } = params

  // Normalize history so it starts with 'user' and alternates.
  const messages: any[] = []
  for (const m of history) {
    const role = m.role === 'user' ? 'user' : 'assistant'
    if (messages.length === 0 && role !== 'user') continue
    const last = messages[messages.length - 1]
    if (last && last.role === role && typeof last.content === 'string') {
      last.content += '\n\n' + m.content
    } else {
      messages.push({ role, content: m.content })
    }
  }
  if (messages.length === 0) messages.push({ role: 'user', content: 'Hello' })

  const trace: string[] = []
  let finalText = ''

  for (let step = 0; step < maxSteps; step++) {
    const data = await anthropicRaw({
      model: REASONING_MODEL,
      max_tokens: 1400,
      temperature: 0.7,
      system,
      tools,
      messages,
    })

    const blocks: any[] = data?.content || []
    for (const b of blocks) {
      if (b.type === 'text' && b.text.trim()) trace.push('💭 ' + b.text.trim())
    }
    const toolUses = blocks.filter((b: any) => b.type === 'tool_use')

    if (data?.stop_reason !== 'tool_use' || toolUses.length === 0) {
      finalText = blocks
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('')
        .trim()
      break
    }

    messages.push({ role: 'assistant', content: blocks })
    const results: any[] = []
    for (const tu of toolUses) {
      trace.push(`→ ${tu.name}(${short(tu.input, 120)})`)
      let out: any
      try {
        out = await execTool(tu.name, tu.input || {})
      } catch (e: any) {
        out = { error: e?.message || 'tool failed' }
      }
      trace.push(`   ↳ ${short(out)}`)
      results.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: typeof out === 'string' ? out : JSON.stringify(out),
      })
    }
    messages.push({ role: 'user', content: results })
  }

  if (!finalText) finalText = 'I worked through that but ran out of steps — ask me to continue.'
  return { text: finalText, trace }
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
