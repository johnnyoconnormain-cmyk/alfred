import { query } from './_generated/server'
import { engineInfo } from './llm'

const SCAN_INTERVAL_HOURS = 6

// Everything the "Brain" dashboard tab needs: what engine Alfred runs
// on, his autonomous loop status, the real job sources, and live counts.
export const status = query({
  handler: async (ctx) => {
    const engine = engineInfo()
    const finder = await ctx.db
      .query('agents')
      .withIndex('by_type', (q) => q.eq('type', 'gig_finder'))
      .first()
    const gigs = await ctx.db.query('gigs').collect()

    const lastRun = finder?.lastRun ?? null
    return {
      engine,
      runsOn: 'Convex cloud (cautious-hawk-161)',
      scanIntervalHours: SCAN_INTERVAL_HOURS,
      sources: [
        { name: 'Remotive', url: 'https://remotive.com/remote-jobs/software-dev' },
        { name: 'RemoteOK', url: 'https://remoteok.com/remote-dev-jobs' },
      ],
      finder: finder
        ? {
            status: finder.status,
            lastRun,
            nextRun: lastRun ? lastRun + SCAN_INTERVAL_HOURS * 3600 * 1000 : null,
            runCount: finder.runCount,
            successCount: finder.successCount,
          }
        : null,
      gigCounts: {
        total: gigs.length,
        open: gigs.filter((g) => g.status === 'new').length,
        completed: gigs.filter((g) => g.status === 'completed').length,
      },
    }
  },
})
