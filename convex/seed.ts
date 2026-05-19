import { mutation } from './_generated/server'

export const seedAgents = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query('agents').collect()
    if (existing.length > 0) return 'Already seeded'

    const agents = [
      {
        name: 'Gig Hunter',
        type: 'gig_finder',
        status: 'idle',
        runCount: 0,
        successCount: 0,
        description: 'Scans freelancing platforms for web development gigs matching our skills. Scores and prioritizes opportunities.',
      },
      {
        name: 'Proposal Writer',
        type: 'proposal_writer',
        status: 'idle',
        runCount: 0,
        successCount: 0,
        description: 'Crafts personalized proposals for found gigs. Tailors pitch based on client needs and our portfolio.',
      },
      {
        name: 'Work Engine',
        type: 'work_engine',
        status: 'idle',
        runCount: 0,
        successCount: 0,
        description: 'Executes the actual work — builds websites, writes code, creates designs. The money maker.',
      },
      {
        name: 'Content Creator',
        type: 'content_creator',
        status: 'idle',
        runCount: 0,
        successCount: 0,
        description: 'Generates SEO content, blog posts, and social media to drive inbound leads and affiliate revenue.',
      },
      {
        name: 'Outreach Agent',
        type: 'outreach',
        status: 'idle',
        runCount: 0,
        successCount: 0,
        description: 'Manages cold outreach — finds businesses without websites and sends personalized pitches.',
      },
    ]

    for (const agent of agents) {
      await ctx.db.insert('agents', agent)
    }

    return 'Seeded 5 agents'
  },
})
