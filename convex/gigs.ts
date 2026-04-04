import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

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
