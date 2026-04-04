import { query, mutation, action } from './_generated/server'
import { v } from 'convex/values'
import { api } from './_generated/api'

// Get chat messages
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('chatMessages').withIndex('by_timestamp').order('asc').collect()
  },
})

// Save a message
export const saveMessage = mutation({
  args: {
    role: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { role, content }) => {
    return await ctx.db.insert('chatMessages', {
      role,
      content,
      timestamp: Date.now(),
    })
  },
})

// Clear chat
export const clearChat = mutation({
  handler: async (ctx) => {
    const messages = await ctx.db.query('chatMessages').collect()
    for (const msg of messages) {
      await ctx.db.delete(msg._id)
    }
  },
})

// Send message to Alfred (calls Gemini API via Convex action)
export const sendMessage = action({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    // Save user message
    await ctx.runMutation(api.chat.saveMessage, { role: 'user', content: message })

    // Get recent chat history for context
    const history = await ctx.runQuery(api.chat.list)
    const recentMessages = history.slice(-20)

    // Get agent/gig/financial context
    const agents = await ctx.runQuery(api.agents.list)
    const gigStats = await ctx.runQuery(api.gigs.getStats)
    const financials = await ctx.runQuery(api.transactions.getFinancials)

    const systemPrompt = `You are Alfred, an autonomous AI agent built to make money for your owner Johnny. You are sharp, confident, and always focused on generating revenue.

Your current status:
- Agents: ${agents.map((a: any) => `${a.name} (${a.status})`).join(', ')}
- Gigs: ${gigStats.total} found, ${gigStats.new} new, ${gigStats.inProgress} in progress, ${gigStats.completed} completed
- Revenue: $${financials.totalIncome.toFixed(2)} income, $${financials.totalExpenses.toFixed(2)} expenses, $${financials.profit.toFixed(2)} profit

Your capabilities:
- Find freelance web development gigs on Fiverr, Upwork, and other platforms
- Write proposals tailored to each gig
- Build websites using React, Next.js, Vite, Tailwind
- Create content for SEO and social media
- Send outreach emails to potential clients
- Track all revenue and expenses

Your personality: You're like a loyal butler who's also a hustler. Professional but driven. You call Johnny "sir" or "boss" occasionally. You're always thinking about the next dollar. Keep responses concise and actionable.

When Johnny asks you to do something, tell him what you'll do and confirm. If he asks about status, give him the numbers. If he wants to chat, be friendly but always steer back to making money.`

    // Build Gemini conversation format
    const geminiContents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\nNow respond to the conversation below. Remember you ARE Alfred.' }],
      },
      {
        role: 'model',
        parts: [{ text: 'Understood. I am Alfred, ready to serve and make money. What do you need, boss?' }],
      },
      ...recentMessages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    ]

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      await ctx.runMutation(api.chat.saveMessage, {
        role: 'assistant',
        content: "I'm not fully online yet, boss. I need my API key to think independently. Add GEMINI_API_KEY to the Convex environment variables. Get one free at aistudio.google.com.",
      })
      return
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: geminiContents,
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.8,
            },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        await ctx.runMutation(api.chat.saveMessage, {
          role: 'assistant',
          content: `Hit a snag, boss. API error: ${response.status}. ${errorText.slice(0, 200)}`,
        })
        return
      }

      const data = await response.json()
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry boss, got a blank response. Let me try again."

      await ctx.runMutation(api.chat.saveMessage, { role: 'assistant', content: reply })

    } catch (err: any) {
      await ctx.runMutation(api.chat.saveMessage, {
        role: 'assistant',
        content: `Something went wrong on my end, boss. Error: ${err.message || 'Unknown error'}. I'll get it sorted.`,
      })
    }
  },
})
