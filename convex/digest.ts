import { action } from './_generated/server'
import { api } from './_generated/api'

// Proactive daily pulse: Alfred summarizes the best open gigs and drops
// the summary into the activity log and the chat, so the user gets value
// without asking. Runs from convex/crons.ts.
export const dailyDigest = action({
  args: {},
  handler: async (ctx) => {
    const picks = await ctx.runQuery(api.gigs.topPicks, { limit: 5 })
    const stats = await ctx.runQuery(api.gigs.getStats)

    let summary: string
    if (!picks.length) {
      summary = `Morning${''} — no open gigs right now. ${stats.total} tracked total. I'll keep scanning every few hours.`
    } else {
      const lines = picks
        .map((g: any, i: number) => `${i + 1}. ${g.title} — ${g.matchScore}% fit (${g.platform})`)
        .join('\n')
      summary = `Daily digest: ${stats.new} open gig${stats.new === 1 ? '' : 's'}. Top picks:\n${lines}\n\nProposals are drafted and waiting in the Gig Board — review and apply when you're ready.`
    }

    await ctx.runMutation(api.activity.log, {
      agentType: 'gig_finder',
      action: 'Daily digest',
      details: `${stats.new} open, ${picks.length} highlighted`,
      status: 'info',
    })
    await ctx.runMutation(api.chat.saveMessage, { role: 'assistant', content: summary })
    return { picks: picks.length }
  },
})
