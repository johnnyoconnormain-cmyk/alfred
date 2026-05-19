import { query, mutation, action } from './_generated/server'
import { v } from 'convex/values'
import { api } from './_generated/api'
import { callLLM, llmConfigured, notifyTelegram } from './llm'

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
    return await ctx.db.insert('gigs', { ...args, status: 'new', foundAt: Date.now() })
  },
})

export const updateStatus = mutation({
  args: { id: v.id('gigs'), status: v.string() },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status })
  },
})

export const saveProposal = mutation({
  args: { id: v.id('gigs'), proposal: v.string() },
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

// Highest-scoring open gigs — what the human should look at first.
export const topPicks = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const open = await ctx.db.query('gigs').withIndex('by_status', (q) => q.eq('status', 'new')).collect()
    return open.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit ?? 5)
  },
})

export const get = query({
  args: { id: v.id('gigs') },
  handler: async (ctx, { id }) => await ctx.db.get(id),
})

export const existingUrls = query({
  handler: async (ctx) => {
    const all = await ctx.db.query('gigs').collect()
    return all.map((g) => g.url).filter((u): u is string => !!u)
  },
})

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
    status: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('gigs', { ...args, foundAt: Date.now() })
  },
})

export const patchProposal = mutation({
  args: { id: v.id('gigs'), proposal: v.string() },
  handler: async (ctx, { id, proposal }) => {
    await ctx.db.patch(id, { proposalDraft: proposal })
  },
})

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type Profile = {
  name: string
  title: string
  skills: string[]
  hourlyRate: string
  bio: string
  minMatchScore: number
}

type NormalizedJob = {
  source: string
  url: string
  title: string
  company: string
  description: string
  budget?: string
  tags: string[]
}

function profileBlock(p: Profile): string {
  return `Freelancer profile:
- Name: ${p.name}
- Headline: ${p.title}
- Skills: ${p.skills.join(', ')}
- Rate: ${p.hourlyRate}
- About: ${p.bio}`
}

async function scoreAndDraft(
  p: Profile,
  job: NormalizedJob
): Promise<{ matchScore: number; skills: string[]; proposal: string } | null> {
  const parsed = await callLLM(
    `${profileBlock(p)}

A remote job was found:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description.slice(0, 1500)}

Return ONLY JSON:
{"matchScore": <0-100 fit for THIS freelancer specifically>, "skills": [<up to 5 relevant tags>], "proposal": "<first-person proposal, 120-180 words, specific to this role, references the freelancer's real skills, ready to paste into the application, no placeholders>"}`,
    { json: true, maxTokens: 800 }
  )
  if (!parsed) return null
  return {
    matchScore: Math.max(0, Math.min(100, Number(parsed.matchScore) || 0)),
    skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 5).map(String) : [],
    proposal: typeof parsed.proposal === 'string' ? parsed.proposal : '',
  }
}

async function fetchRemotive(): Promise<NormalizedJob[]> {
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs?category=software-dev&limit=25', {
      headers: { 'User-Agent': 'Alfred-Gig-Assistant' },
    })
    if (!res.ok) return []
    const data = await res.json()
    const jobs: any[] = Array.isArray(data.jobs) ? data.jobs : []
    return jobs
      .filter((j) => j.url)
      .map((j) => ({
        source: 'remotive',
        url: String(j.url),
        title: String(j.title || 'Untitled role'),
        company: String(j.company_name || 'Unknown'),
        description: stripHtml(String(j.description || '')).slice(0, 1400),
        budget: j.salary ? String(j.salary) : undefined,
        tags: Array.isArray(j.tags) ? j.tags.slice(0, 5).map(String) : [],
      }))
  } catch {
    return []
  }
}

async function fetchRemoteOk(): Promise<NormalizedJob[]> {
  try {
    const res = await fetch('https://remoteok.com/api?tags=dev', {
      headers: { 'User-Agent': 'Alfred-Gig-Assistant (contact: dashboard)' },
    })
    if (!res.ok) return []
    const data = await res.json()
    const jobs: any[] = Array.isArray(data) ? data.filter((j) => j && j.id && j.position) : []
    return jobs.slice(0, 25).map((j) => {
      const sal =
        j.salary_min && j.salary_max ? `$${j.salary_min}–$${j.salary_max}` : undefined
      return {
        source: 'remoteok',
        url: String(j.url || `https://remoteok.com/remote-jobs/${j.id}`),
        title: String(j.position || 'Untitled role'),
        company: String(j.company || 'Unknown'),
        description: stripHtml(String(j.description || '')).slice(0, 1400),
        budget: sal,
        tags: Array.isArray(j.tags) ? j.tags.slice(0, 5).map(String) : [],
      }
    })
  } catch {
    return []
  }
}

// Autonomous engine: pull real remote jobs from multiple sources, score
// each against the user's profile, draft a tailored proposal, and save.
// Low-fit jobs are auto-skipped so the board stays high-signal.
export const scanForGigs = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(api.agents.updateStatus, { type: 'gig_finder', status: 'running' })
    await ctx.runMutation(api.activity.log, {
      agentType: 'gig_finder',
      action: 'Scan started',
      details: 'Pulling remote dev jobs from Remotive + RemoteOK',
      status: 'info',
    })

    let added = 0
    let skipped = 0
    try {
      const profile = (await ctx.runQuery(api.profile.get)) as Profile
      const [a, b] = await Promise.all([fetchRemotive(), fetchRemoteOk()])
      const seen = new Set<string>(await ctx.runQuery(api.gigs.existingUrls))
      const configured = llmConfigured()

      const fresh: NormalizedJob[] = []
      for (const j of [...a, ...b]) {
        if (!seen.has(j.url)) {
          seen.add(j.url)
          fresh.push(j)
        }
      }
      // Cap AI drafting per run to stay within the free Gemini tier.
      const batch = fresh.slice(0, 8)

      for (const j of batch) {
        let matchScore = 0
        let skills = j.tags
        let proposalDraft: string | undefined
        if (configured) {
          const r = await scoreAndDraft(profile, j)
          if (r) {
            matchScore = r.matchScore
            if (r.skills.length) skills = r.skills
            proposalDraft = r.proposal
          }
        } else {
          proposalDraft =
            'Proposal drafting is offline — set ANTHROPIC_API_KEY (or GEMINI_API_KEY) in the Convex environment and the next scan writes a tailored proposal here.'
        }

        const status = configured && matchScore < profile.minMatchScore ? 'skipped' : 'new'
        if (status === 'skipped') skipped++
        else added++

        await ctx.runMutation(api.gigs.insertScanned, {
          platform: j.source,
          title: j.title,
          description: j.description.slice(0, 600),
          budget: j.budget,
          url: j.url,
          skills,
          matchScore,
          proposalDraft,
          status,
        })

        // Alert on strong matches (no-op unless Telegram env is set).
        if (status === 'new' && matchScore >= 80) {
          await notifyTelegram(
            `Alfred — strong gig (${matchScore}%): ${j.title} @ ${j.company}\n${j.url}`
          )
        }
      }

      await ctx.runMutation(api.agents.recordRun, { type: 'gig_finder', success: true })
      await ctx.runMutation(api.activity.log, {
        agentType: 'gig_finder',
        action: 'Scan complete',
        details:
          added + skipped > 0
            ? `${added} new gig${added === 1 ? '' : 's'} added, ${skipped} low-fit auto-skipped`
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

    return { added }
  },
})

// On-demand: (re)write the proposal for one gig, optionally steered by
// the user's instructions ("make it shorter", "emphasize Shopify", ...).
export const generateProposal = action({
  args: { id: v.id('gigs'), instructions: v.optional(v.string()) },
  handler: async (ctx, { id, instructions }) => {
    if (!llmConfigured()) return { ok: false, error: 'No LLM key set (ANTHROPIC_API_KEY or GEMINI_API_KEY)' }
    const gig = await ctx.runQuery(api.gigs.get, { id })
    if (!gig) return { ok: false, error: 'Gig not found' }
    const profile = (await ctx.runQuery(api.profile.get)) as Profile

    const parsed = await callLLM(
      `${profileBlock(profile)}

Write a proposal for this job:
Title: ${gig.title}
Company/Source: ${gig.platform}
Description: ${(gig.description || '').slice(0, 1500)}
${instructions ? `Extra instructions from the freelancer: ${instructions}` : ''}

Return ONLY JSON: {"proposal": "<first-person, 120-180 words, specific, ready to paste, no placeholders>"}`,
      { json: true, maxTokens: 800 }
    )
    const proposal = parsed && typeof parsed.proposal === 'string' ? parsed.proposal : null
    if (!proposal) return { ok: false, error: 'Drafting failed, try again' }
    await ctx.runMutation(api.gigs.patchProposal, { id, proposal })
    await ctx.runMutation(api.activity.log, {
      agentType: 'proposal_writer',
      action: 'Proposal drafted',
      details: `Rewrote proposal for "${gig.title}"`,
      status: 'success',
    })
    return { ok: true, proposal }
  },
})
