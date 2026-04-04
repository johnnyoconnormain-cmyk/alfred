import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const q = ctx.db.query('activityLog').order('desc')
    if (limit) return await q.take(limit)
    return await q.collect()
  },
})

export const log = mutation({
  args: {
    agentType: v.string(),
    action: v.string(),
    details: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('activityLog', {
      ...args,
      timestamp: Date.now(),
    })
  },
})

export const getRecent = query({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    return await ctx.db.query('activityLog').order('desc').take(count)
  },
})
