import { query, mutation, action } from './_generated/server'
import { v } from 'convex/values'
import { api } from './_generated/api'
import { callLLMChat, llmConfigured, activeProvider, runClaudeAgent, type AgentTool } from './llm'

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('chatMessages').withIndex('by_timestamp').order('asc').collect()
  },
})

export const saveMessage = mutation({
  args: { role: v.string(), content: v.string(), reasoning: v.optional(v.string()) },
  handler: async (ctx, { role, content, reasoning }) => {
    return await ctx.db.insert('chatMessages', {
      role,
      content,
      ...(reasoning ? { reasoning } : {}),
      timestamp: Date.now(),
    })
  },
})

export const clearChat = mutation({
  handler: async (ctx) => {
    const messages = await ctx.db.query('chatMessages').collect()
    for (const msg of messages) await ctx.db.delete(msg._id)
  },
})

const TOOLS: AgentTool[] = [
  {
    name: 'scan_gigs',
    description: 'Search the live remote-job sources right now for new gigs, score them against the user profile, and draft proposals. Use when the user wants fresh opportunities.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_top_gigs',
    description: 'Get the highest-scoring open gigs currently waiting for the user.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'How many (default 5)' } },
    },
  },
  {
    name: 'list_gigs',
    description: 'List saved gigs, optionally filtered by status (new, proposal_sent, completed, skipped). Use to find a specific gig before drafting or logging income.',
    input_schema: {
      type: 'object',
      properties: { status: { type: 'string' } },
    },
  },
  {
    name: 'draft_proposal',
    description: 'Write or rewrite the proposal for one gig. Match by gig_query (words from its title). Optional instructions steer the rewrite (e.g. "shorter", "emphasize Shopify").',
    input_schema: {
      type: 'object',
      properties: {
        gig_query: { type: 'string' },
        instructions: { type: 'string' },
      },
    },
  },
  {
    name: 'update_profile',
    description: "Change the user's freelancer profile used for matching and proposals.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        title: { type: 'string' },
        skills: { type: 'array', items: { type: 'string' } },
        hourlyRate: { type: 'string' },
        bio: { type: 'string' },
        minMatchScore: { type: 'number' },
      },
    },
  },
  {
    name: 'get_overview',
    description: 'Get current status: profile, gig counts, top picks, agents, and financials.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'log_income',
    description: 'Record money earned from a gig (match by gig_query) and mark that gig completed.',
    input_schema: {
      type: 'object',
      properties: {
        gig_query: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['gig_query', 'amount'],
    },
  },
]

// Legacy path: simple intent routing + plain chat. Used when running on
// the Gemini fallback (no Claude key) — keeps things working, just less
// agentic than the Claude tool-use loop.
async function legacyReply(ctx: any, message: string, reply: (c: string) => Promise<any>) {
  const [agents, gigStats, fin, profile, picks, history] = await Promise.all([
    ctx.runQuery(api.agents.list),
    ctx.runQuery(api.gigs.getStats),
    ctx.runQuery(api.transactions.getFinancials),
    ctx.runQuery(api.profile.get),
    ctx.runQuery(api.gigs.topPicks, { limit: 3 }),
    ctx.runQuery(api.chat.list),
  ])
  const lower = message.toLowerCase()
  if (/\b(scan|find|search|look).*(gig|job|work)|scan now\b/.test(lower)) {
    const r = await ctx.runAction(api.gigs.scanForGigs, {})
    await reply(`Done — scanned the boards and added ${r?.added ?? 0} new gig${r?.added === 1 ? '' : 's'}. They're on the Gig Board with drafted proposals.`)
    return
  }
  if (/top|best/.test(lower) && /gig|job|pick/.test(lower)) {
    if (!picks.length) {
      await reply("Nothing open yet — say \"scan now\" and I'll pull fresh jobs.")
      return
    }
    await reply(
      'Your best picks right now:\n' +
        picks.map((g: any, i: number) => `${i + 1}. ${g.title} — ${g.matchScore}% (${g.platform})`).join('\n')
    )
    return
  }
  const system = `You are Alfred, a freelance-gig assistant for ${profile.name}. Talk like a sharp, friendly real person — natural and concise, light personality, never robotic, no forced honorifics. Be honest: you find jobs and draft proposals but don't auto-apply.
Profile: ${profile.title}; ${profile.skills.join(', ')}; ${profile.hourlyRate}.
Status: ${gigStats.total} gigs (${gigStats.new} open); revenue $${fin.totalIncome.toFixed(2)}, profit $${fin.profit.toFixed(2)}.
If the user wants an action, tell them to say e.g. "scan now". Keep replies tight.`
  const text = await callLLMChat(
    history.slice(-16).map((m: any) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    system,
    900
  )
  await reply(text || 'Got a blank response there — try again?')
}

// Alfred: a real multi-step Claude agent. He reasons, calls tools to act
// on the gig pipeline, and replies naturally. His thinking trace is saved
// so the user can watch how he worked.
export const sendMessage = action({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    await ctx.runMutation(api.chat.saveMessage, { role: 'user', content: message })

    if (!llmConfigured()) {
      await ctx.runMutation(api.chat.saveMessage, {
        role: 'assistant',
        content:
          "I'm not online yet — set ANTHROPIC_API_KEY (or GEMINI_API_KEY) in the Convex environment and I'll be able to think and act.",
      })
      return
    }

    const reply = (content: string, reasoning?: string) =>
      ctx.runMutation(api.chat.saveMessage, { role: 'assistant', content, reasoning })

    try {
      if (activeProvider() !== 'anthropic') {
        await legacyReply(ctx, message, (c) => reply(c))
        return
      }

      const [profile, gigStats, fin, history] = await Promise.all([
        ctx.runQuery(api.profile.get),
        ctx.runQuery(api.gigs.getStats),
        ctx.runQuery(api.transactions.getFinancials),
        ctx.runQuery(api.chat.list),
      ])

      const system = `You are Alfred — a genuinely smart, autonomous freelance-gig assistant working for ${profile.name}.

Voice: talk like a real, sharp person texting a colleague. Natural, warm, direct, a little dry wit. Concise. NOT a stiff butler — don't pepper every line with "boss/sir". Be honest and never overpromise.

What you can actually do, via your tools: scan live remote-job boards, score jobs against ${profile.name}'s profile, draft and rewrite tailored proposals, show top picks, update the profile, log income, and report status. You do NOT auto-apply — ${profile.name} reviews and applies; say so plainly if asked.

Be agentic: when the user wants something done, USE the tools (you can chain several — e.g. scan, then read top gigs, then draft for the best one) and then summarize what you did and what's worth their attention. For simple questions, just answer using the context below — no tool needed.

Current context:
- Profile: ${profile.title}; skills ${profile.skills.join(', ')}; rate ${profile.hourlyRate}; min match ${profile.minMatchScore}%.
- Gigs: ${gigStats.total} total, ${gigStats.new} open, ${gigStats.completed} completed.
- Money: $${fin.totalIncome.toFixed(2)} in, $${fin.profit.toFixed(2)} profit.

When you finish, give ${profile.name} a tight, useful summary — what you found, what's strong, what to do next.`

      const execTool = async (name: string, input: any): Promise<any> => {
        switch (name) {
          case 'scan_gigs': {
            const r = await ctx.runAction(api.gigs.scanForGigs, {})
            return { added: r?.added ?? 0 }
          }
          case 'list_top_gigs': {
            const picks = await ctx.runQuery(api.gigs.topPicks, { limit: Math.min(Number(input.limit) || 5, 10) })
            return picks.map((g: any) => ({ title: g.title, matchScore: g.matchScore, platform: g.platform, budget: g.budget || null }))
          }
          case 'list_gigs': {
            const gigs = await ctx.runQuery(api.gigs.list, input.status ? { status: String(input.status) } : {})
            return gigs.slice(0, 15).map((g: any) => ({ title: g.title, status: g.status, matchScore: g.matchScore, platform: g.platform }))
          }
          case 'draft_proposal': {
            const q = String(input.gig_query || '').toLowerCase().trim()
            const open = await ctx.runQuery(api.gigs.list, { status: 'new' })
            const w = q.split(' ').filter(Boolean)
            const target =
              (w.length && open.find((g: any) => w.some((x: string) => g.title.toLowerCase().includes(x)))) ||
              open.sort((a: any, b: any) => b.matchScore - a.matchScore)[0]
            if (!target) return { ok: false, error: 'No open gig found to draft for' }
            const r = await ctx.runAction(api.gigs.generateProposal, {
              id: target._id,
              instructions: input.instructions || undefined,
            })
            return r?.ok ? { ok: true, title: target.title, proposal: r.proposal } : { ok: false, error: r?.error }
          }
          case 'update_profile': {
            const cur = await ctx.runQuery(api.profile.get)
            const skills = Array.isArray(input.skills) && input.skills.length
              ? input.skills.map(String)
              : typeof input.skills === 'string' && input.skills
                ? input.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
                : cur.skills
            const next = {
              name: input.name || cur.name,
              title: input.title || cur.title,
              skills,
              hourlyRate: input.hourlyRate || cur.hourlyRate,
              bio: input.bio || cur.bio,
              minMatchScore:
                typeof input.minMatchScore === 'number' && input.minMatchScore > 0 ? input.minMatchScore : cur.minMatchScore,
            }
            await ctx.runMutation(api.profile.save, next)
            return { ok: true, profile: next }
          }
          case 'get_overview': {
            const [agents, stats, money, prof, picks] = await Promise.all([
              ctx.runQuery(api.agents.list),
              ctx.runQuery(api.gigs.getStats),
              ctx.runQuery(api.transactions.getFinancials),
              ctx.runQuery(api.profile.get),
              ctx.runQuery(api.gigs.topPicks, { limit: 5 }),
            ])
            return {
              profile: { title: prof.title, skills: prof.skills, rate: prof.hourlyRate },
              gigs: stats,
              money: { income: money.totalIncome, profit: money.profit },
              agents: agents.map((a: any) => ({ name: a.name, status: a.status })),
              topPicks: picks.map((g: any) => ({ title: g.title, matchScore: g.matchScore })),
            }
          }
          case 'log_income': {
            const q = String(input.gig_query || '').toLowerCase().trim()
            const amount = Number(input.amount)
            if (!q || !amount || amount <= 0) return { ok: false, error: 'Need a gig and a positive amount' }
            const all = await ctx.runQuery(api.gigs.list, {})
            const w = q.split(' ').filter(Boolean)
            const target = all.find((g: any) => w.some((x: string) => g.title.toLowerCase().includes(x)))
            if (!target) return { ok: false, error: 'Gig not found' }
            await ctx.runMutation(api.transactions.add, {
              type: 'income',
              amount,
              description: target.title,
              category: 'freelance',
              source: 'gig',
            })
            await ctx.runMutation(api.gigs.updateStatus, { id: target._id, status: 'completed' })
            return { ok: true, title: target.title, amount }
          }
          default:
            return { error: `Unknown tool ${name}` }
        }
      }

      const { text, trace } = await runClaudeAgent({
        system,
        history: history.slice(-16).map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
        tools: TOOLS,
        execTool,
      })

      await reply(text, trace.length ? trace.join('\n') : undefined)
    } catch (err: any) {
      const msg = String(err?.message || 'unknown error')
      const friendly = /Anthropic 4(01|03)/.test(msg)
        ? "My Claude key looks invalid — check ANTHROPIC_API_KEY on the Production deployment (it must be a current, non-revoked key)."
        : /429/.test(msg)
          ? "I'm rate-limited right now. If this keeps happening, check the Anthropic plan/billing."
          : `Something glitched on my end: ${msg}`
      await reply(friendly)
    }
  },
})
