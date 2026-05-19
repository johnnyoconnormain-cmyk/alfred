import { query, mutation, action } from './_generated/server'
import { v } from 'convex/values'
import { api } from './_generated/api'

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('chatMessages').withIndex('by_timestamp').order('asc').collect()
  },
})

export const saveMessage = mutation({
  args: { role: v.string(), content: v.string() },
  handler: async (ctx, { role, content }) => {
    return await ctx.db.insert('chatMessages', { role, content, timestamp: Date.now() })
  },
})

export const clearChat = mutation({
  handler: async (ctx) => {
    const messages = await ctx.db.query('chatMessages').collect()
    for (const msg of messages) await ctx.db.delete(msg._id)
  },
})

async function gemini(apiKey: string, prompt: string, json: boolean, maxTokens: number): Promise<any> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: json ? 0.2 : 0.8,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 150)}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response')
  return json ? JSON.parse(text) : text
}

// Agentic chat: Alfred understands plain-English commands and actually
// runs them (scan, draft proposals, show top gigs, edit the profile),
// then replies. Anything conversational falls through to a normal reply.
export const sendMessage = action({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    await ctx.runMutation(api.chat.saveMessage, { role: 'user', content: message })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      await ctx.runMutation(api.chat.saveMessage, {
        role: 'assistant',
        content:
          "I'm not fully online yet, boss. Add GEMINI_API_KEY to the Convex environment variables (free key at aistudio.google.com) and I'll be able to think and act.",
      })
      return
    }

    const reply = async (content: string) =>
      ctx.runMutation(api.chat.saveMessage, { role: 'assistant', content })

    try {
      // 1. Route the message to a tool (or plain chat).
      let route: any = null
      try {
        route = await gemini(
          apiKey,
          `Classify this user message into ONE action for an autonomous freelance-gig assistant.
Message: "${message}"

Actions:
- "scan": user wants to look for new gigs/jobs now
- "top_gigs": user wants to see best current gigs/opportunities
- "draft_proposal": user wants a proposal written/rewritten for a gig (query = the gig title/keywords + any instructions)
- "set_profile": user wants to change their skills/title/rate/bio/min match (fields = changed values)
- "chat": anything else (questions, conversation, status)

Return ONLY JSON: {"action":"...","query":"<text or empty>","fields":{"name":"","title":"","skills":[],"hourlyRate":"","bio":"","minMatchScore":0}}`,
          true,
          300
        )
      } catch {
        // Routing failed — treat as plain conversation rather than erroring.
        route = { action: 'chat' }
      }
      const action = String(route?.action || 'chat')

      if (action === 'scan') {
        const r = await ctx.runAction(api.gigs.scanForGigs, {})
        await reply(
          `On it, boss — scan done. Added ${r?.added ?? 0} new gig${r?.added === 1 ? '' : 's'} with drafted proposals. Check the Gig Board.`
        )
        return
      }

      if (action === 'top_gigs') {
        const picks = await ctx.runQuery(api.gigs.topPicks, { limit: 5 })
        if (!picks.length) {
          await reply('No open gigs right now, boss. I\'ll keep scanning — or say "scan now" to pull fresh ones.')
          return
        }
        const lines = picks
          .map((g: any, i: number) => `${i + 1}. ${g.title} — ${g.matchScore}% fit (${g.platform})`)
          .join('\n')
        await reply(`Here are your best picks right now, boss:\n${lines}\n\nProposals are drafted in the Gig Board — ready when you are.`)
        return
      }

      if (action === 'draft_proposal') {
        const q = String(route?.query || '').toLowerCase().trim()
        const open = await ctx.runQuery(api.gigs.list, { status: 'new' })
        const firstWord = q.split(' ')[0]
        const target =
          (firstWord && open.find((g: any) => g.title.toLowerCase().includes(firstWord))) ||
          open.sort((a: any, b: any) => b.matchScore - a.matchScore)[0]
        if (!target) {
          await reply('I don\'t have an open gig to write for yet, boss. Say "scan now" and I\'ll find some.')
          return
        }
        const r = await ctx.runAction(api.gigs.generateProposal, {
          id: target._id,
          instructions: route?.query || undefined,
        })
        if (r?.ok) {
          await reply(`Drafted a proposal for "${target.title}", boss:\n\n${r.proposal}\n\nIt's saved on the gig card — copy and apply when ready.`)
        } else {
          await reply(`Couldn't draft that one, boss: ${r?.error || 'unknown error'}. Try again in a moment.`)
        }
        return
      }

      if (action === 'set_profile') {
        const current = await ctx.runQuery(api.profile.get)
        const f = route?.fields || {}
        const skills = Array.isArray(f.skills) && f.skills.length
          ? f.skills.map(String)
          : typeof f.skills === 'string' && f.skills
            ? f.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
            : current.skills
        const next = {
          name: f.name || current.name,
          title: f.title || current.title,
          skills,
          hourlyRate: f.hourlyRate || current.hourlyRate,
          bio: f.bio || current.bio,
          minMatchScore:
            typeof f.minMatchScore === 'number' && f.minMatchScore > 0
              ? f.minMatchScore
              : current.minMatchScore,
        }
        await ctx.runMutation(api.profile.save, next)
        await reply(
          `Updated your profile, boss:\n- ${next.title}\n- Skills: ${next.skills.join(', ')}\n- Rate: ${next.hourlyRate}\n- Min match: ${next.minMatchScore}%\n\nFuture scans and proposals will use this.`
        )
        return
      }

      // 2. Plain conversation — Alfred with full context.
      const [agents, gigStats, fin, profile, picks, history] = await Promise.all([
        ctx.runQuery(api.agents.list),
        ctx.runQuery(api.gigs.getStats),
        ctx.runQuery(api.transactions.getFinancials),
        ctx.runQuery(api.profile.get),
        ctx.runQuery(api.gigs.topPicks, { limit: 3 }),
        ctx.runQuery(api.chat.list),
      ])
      const recent = history.slice(-16)

      const systemPrompt = `You are Alfred, an autonomous freelance-gig assistant working for ${profile.name}. You are sharp, loyal, concise, and honest — never overpromise. You call him "boss".

What you actually do (and can do now if asked):
- Auto-scan real remote dev jobs (Remotive + RemoteOK) every 6h and on demand ("scan now")
- Score each job against ${profile.name}'s profile and draft ready-to-send proposals
- Rewrite a proposal on request ("redo the proposal for X, make it shorter")
- Show top picks; update the profile on request
- You do NOT auto-apply (that needs his accounts) — he reviews and applies. Be honest about this.

Profile: ${profile.title}; skills ${profile.skills.join(', ')}; rate ${profile.hourlyRate}.
Status: ${gigStats.total} gigs (${gigStats.new} open), ${agents.length} agents, revenue $${fin.totalIncome.toFixed(2)}, profit $${fin.profit.toFixed(2)}.
Top open: ${picks.map((g: any) => `${g.title} (${g.matchScore}%)`).join('; ') || 'none yet'}.

Keep replies short and actionable. If he asks for something you can do, tell him to just say it (e.g. "say 'scan now'").`

      const convo = [
        { role: 'user', parts: [{ text: systemPrompt + '\n\nRespond as Alfred to the conversation.' }] },
        { role: 'model', parts: [{ text: 'Understood, boss. Ready.' }] },
        ...recent.map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
      ]
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: convo,
            generationConfig: { maxOutputTokens: 1024, temperature: 0.8 },
          }),
        }
      )
      if (!res.ok) {
        await reply(`Hit a snag, boss. API error ${res.status}.`)
        return
      }
      const data = await res.json()
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Sorry boss, got a blank response. Try again.'
      await reply(text)
    } catch (err: any) {
      await reply(`Something went wrong on my end, boss: ${err?.message || 'unknown error'}. I'll get it sorted.`)
    }
  },
})
