import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

const DEFAULTS = {
  name: 'Johnny',
  title: 'Freelance Full-Stack Web Developer',
  skills: ['React', 'Next.js', 'Vite', 'Tailwind', 'Node.js', 'TypeScript'],
  hourlyRate: '$45/hr',
  bio: 'Independent developer who ships clean, fast web apps end to end.',
  minMatchScore: 45,
}

export const get = query({
  handler: async (ctx) => {
    const row = await ctx.db.query('alfredState').withIndex('by_key', (q) => q.eq('key', 'profile')).first()
    if (!row) return DEFAULTS
    try {
      return { ...DEFAULTS, ...JSON.parse(row.value) }
    } catch {
      return DEFAULTS
    }
  },
})

export const save = mutation({
  args: {
    name: v.string(),
    title: v.string(),
    skills: v.array(v.string()),
    hourlyRate: v.string(),
    bio: v.string(),
    minMatchScore: v.number(),
  },
  handler: async (ctx, args) => {
    const value = JSON.stringify(args)
    const row = await ctx.db.query('alfredState').withIndex('by_key', (q) => q.eq('key', 'profile')).first()
    if (row) {
      await ctx.db.patch(row._id, { value })
    } else {
      await ctx.db.insert('alfredState', { key: 'profile', value })
    }
    return 'saved'
  },
})
