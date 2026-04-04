import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const q = ctx.db.query('transactions').order('desc')
    if (limit) return await q.take(limit)
    return await q.collect()
  },
})

export const add = mutation({
  args: {
    type: v.string(),
    amount: v.number(),
    description: v.string(),
    category: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('transactions', {
      ...args,
      date: Date.now(),
    })
  },
})

export const getFinancials = query({
  handler: async (ctx) => {
    const all = await ctx.db.query('transactions').collect()
    const income = all.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = all.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const profit = income - expenses

    // Revenue by category
    const byCategory = {}
    for (const t of all) {
      const key = t.category
      if (!byCategory[key]) byCategory[key] = 0
      byCategory[key] += t.type === 'income' ? t.amount : -t.amount
    }

    // Last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const recent = all.filter((t) => t.date > thirtyDaysAgo)
    const recentIncome = recent.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const recentExpenses = recent.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    return {
      totalIncome: income,
      totalExpenses: expenses,
      profit,
      byCategory,
      recentIncome,
      recentExpenses,
      recentProfit: recentIncome - recentExpenses,
      transactionCount: all.length,
    }
  },
})
