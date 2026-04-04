import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

// Get all agents
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('agents').collect()
  },
})

// Get agent by type
export const getByType = query({
  args: { type: v.string() },
  handler: async (ctx, { type }) => {
    return await ctx.db.query('agents').withIndex('by_type', (q) => q.eq('type', type)).first()
  },
})

// Create or update agent
export const upsert = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    description: v.string(),
    status: v.optional(v.string()),
    config: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('agents').withIndex('by_type', (q) => q.eq('type', args.type)).first()
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        ...(args.status && { status: args.status }),
        ...(args.config && { config: args.config }),
      })
      return existing._id
    }
    return await ctx.db.insert('agents', {
      name: args.name,
      type: args.type,
      status: args.status || 'idle',
      runCount: 0,
      successCount: 0,
      description: args.description,
      config: args.config,
    })
  },
})

// Update agent status
export const updateStatus = mutation({
  args: {
    type: v.string(),
    status: v.string(),
  },
  handler: async (ctx, { type, status }) => {
    const agent = await ctx.db.query('agents').withIndex('by_type', (q) => q.eq('type', type)).first()
    if (agent) {
      await ctx.db.patch(agent._id, { status, lastRun: Date.now() })
    }
  },
})

// Increment run count
export const recordRun = mutation({
  args: {
    type: v.string(),
    success: v.boolean(),
  },
  handler: async (ctx, { type, success }) => {
    const agent = await ctx.db.query('agents').withIndex('by_type', (q) => q.eq('type', type)).first()
    if (agent) {
      await ctx.db.patch(agent._id, {
        runCount: agent.runCount + 1,
        successCount: agent.successCount + (success ? 1 : 0),
        lastRun: Date.now(),
      })
    }
  },
})
