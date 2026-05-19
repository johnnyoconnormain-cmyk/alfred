import { query, mutation, action } from './_generated/server'
import { v } from 'convex/values'
import { api } from './_generated/api'

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    if (status) {
      return await ctx.db.query('gigs').withIndex('by_status', (q) => q.eq('status', status)).order('desc').collect()
    }
    return await ctx.db.query('gigs').order('desc').collect()
  },
})

export const add = mutation({
  args: {
    platform: v.string(),
    title: v.string(),
    description: v.string(),
    budget: v.optional(v.string()),
    url: v.optional(v.string()),
    skills: v.array(v.string()),
    matchScore: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('gigs', {
      ...args,
      status: 'new',
      foundAt: Date.now(),
    })
  },
})

export const updateStatus = mutation({
  args: {
    id: v.id('gigs'),
    status: v.string(),
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status })
  },
})

export const saveProposal = mutation({
  args: {
    id: v.id('gigs'),
    proposal: v.string(),
  },
  handler: async (ctx, { id, proposal }) => {
    await ctx.db.patch(id, { proposalDraft: proposal, status: 'proposal_sent' })
  },
})

export const getStats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query('gigs').collect()
    return {
      total: all.length,
      new: all.filter((g) => g.status === 'new').length,
      proposalSent: all.filter((g) => g.status === 'proposal_sent').length,
      inProgress: all.filter((g) => g.status === 'in_progress').length,
      completed: all.filter((g) => g.status === 'completed').length,
    }
  },
})

// Existing gig URLs, used to skip jobs we've already saved.
export const existingUrls = query({
  handler: async (ctx) => {
    const all = await ctx.db.query('gigs').collect()
    return all.map((g) => g.url).filter((u): u is string => !!u)
  },
})

// Insert one scanned gig with its AI-scored proposal draft.
export const insertScanned = mutation({
  args: {
    platform: v.string(),
    title: v.string(),
    description: v.string(),
    budget: v.optional(v.string()),
    url: v.string(),
    skills: v.array(v.string()),
    matchScore: v.number(),
    proposalDraft: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('gigs', {
      ...args,
      status: 'new',
      foundAt: Date.now(),
    })
  },
})

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Ask Gemini to score the job and draft a ready-to-send proposal.
// Returns null if no key or the call fails (the job is still saved).
async function draftWithGemini(
  apiKey: string,
  job: { title: string; company: string; description: string }
): Promise<{ matchScore: number; skills: string[]; proposal: string } | null> {
  const prompt = `You are Alfred, a freelance web developer who builds with React, Next.js, Vite, Tailwind and Node. A remote job was found:

Title: ${job.title}
Company: ${job.company}
Description: ${job.description.slice(0, 1500)}

Return ONLY JSON with this exact shape:
{"matchScore": <0-100 how well this fits a React/full-stack web dev>, "skills": [<up to 5 relevant skill tags>], "proposal": "<a concise first-person proposal of 120-180 words, ready to paste into the application, confident and specific to this role>"}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 600,
            temperature: 0.7,
            responseMimeType: 'application/json',
          },
        }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null
    const parsed = JSON.parse(text)
    return {
      matchScore: Math.max(0, Math.min(100, Number(parsed.matchScore) || 0)),
      skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 5).map(String) : [],
      proposal: typeof parsed.proposal === 'string' ? parsed.proposal : '',
    }
  } catch {
    return null
  }
}

// Autonomous engine: pull real remote dev jobs, draft proposals, save new ones.
// Runs from convex/crons.ts on a schedule (server-side, no browser needed)
// and can also be triggered manually from the dashboard.
export const scanForGigs = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(api.agents.updateStatus, { type: 'gig_finder', status: 'running' })
    await ctx.runMutation(api.activity.log, {
      agentType: 'gig_finder',
      action: 'Scan started',
      details: 'Fetching remote web-dev jobs from Remotive',
      status: 'info',
    })

    let foundCount = 0
    try {
      const res = await fetch(
        'https://remotive.com/api/remote-jobs?category=software-dev&limit=30',
        { headers: { 'User-Agent': 'Alfred-Gig-Assistant' } }
      )
      if (!res.ok) throw new Error(`Remotive returned ${res.status}`)
      const data = await res.json()
      const jobs: any[] = Array.isArray(data.jobs) ? data.jobs : []

      const seen = new Set<string>(await ctx.runQuery(api.gigs.existingUrls))
      const apiKey = process.env.GEMINI_API_KEY

      // Cap AI drafting per run to stay within the free Gemini tier.
      const fresh = jobs.filter((j) => j.url && !seen.has(j.url)).slice(0, 6)

      for (const j of fresh) {
        const description = stripHtml(String(j.description || '')).slice(0, 1200)
        const title = String(j.title || 'Untitled role')
        const company = String(j.company_name || 'Unknown')

        let matchScore = 0
        let skills: string[] = Array.isArray(j.tags) ? j.tags.slice(0, 5).map(String) : []
        let proposalDraft: string | undefined

        if (apiKey) {
          const drafted = await draftWithGemini(apiKey, { title, company, description })
          if (drafted) {
            matchScore = drafted.matchScore
            if (drafted.skills.length) skills = drafted.skills
            proposalDraft = drafted.proposal
          }
        } else {
          proposalDraft =
            'Proposal drafting is offline — add GEMINI_API_KEY to the Convex environment (free key at aistudio.google.com) and the next scan will write a tailored proposal here.'
        }

        await ctx.runMutation(api.gigs.insertScanned, {
          platform: 'remotive',
          title,
          description: description.slice(0, 600),
          budget: j.salary ? String(j.salary) : undefined,
          url: String(j.url),
          skills,
          matchScore,
          proposalDraft,
        })
        foundCount++
      }

      await ctx.runMutation(api.agents.recordRun, { type: 'gig_finder', success: true })
      await ctx.runMutation(api.activity.log, {
        agentType: 'gig_finder',
        action: 'Scan complete',
        details:
          foundCount > 0
            ? `Added ${foundCount} new gig${foundCount === 1 ? '' : 's'}${apiKey ? ' with drafted proposals' : ' (proposals pending API key)'}`
            : 'No new gigs since last scan',
        status: 'success',
      })
    } catch (err: any) {
      await ctx.runMutation(api.agents.recordRun, { type: 'gig_finder', success: false })
      await ctx.runMutation(api.activity.log, {
        agentType: 'gig_finder',
        action: 'Scan failed',
        details: err?.message || 'Unknown error during gig scan',
        status: 'error',
      })
    } finally {
      await ctx.runMutation(api.agents.updateStatus, { type: 'gig_finder', status: 'idle' })
    }

    return { found: foundCount }
  },
})
