import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'

// ─── Icons ───
function Icon({ name, size = 18 }) {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const icons = {
    brain: <><circle cx="12" cy="12" r="10"/><path d="M12 2a7 7 0 017 7c0 3-2 5-4 6.5V18H9v-2.5C7 14 5 12 5 9a7 7 0 017-7z"/></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    dollar: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    file: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    play: <><polygon points="5 3 19 12 5 21 5 3"/></>,
    pause: <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></>,
    pen: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
  }
  return <svg {...s}>{icons[name]}</svg>
}

// ─── Stat Card ───
function StatCard({ icon, label, value, sub, color = 'text-[#D4A843]' }) {
  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 fade-in">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-[#1a1a28] ${color}`}>
          <Icon name={icon} size={20} />
        </div>
        <span className="text-[#6b6b80] text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-[#6b6b80] mt-1">{sub}</div>}
    </div>
  )
}

// ─── Agent Card ───
function AgentCard({ agent, onToggle }) {
  const statusColors = {
    running: 'bg-green-500/20 text-green-400 border-green-500/30',
    idle: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  const statusColor = statusColors[agent.status] || statusColors.idle

  const typeIcons = {
    gig_finder: 'search',
    proposal_writer: 'pen',
    work_engine: 'briefcase',
    content_creator: 'file',
    outreach: 'send',
  }

  return (
    <div className={`bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 fade-in ${agent.status === 'running' ? 'pulse-gold' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#1a1a28] text-[#D4A843]">
            <Icon name={typeIcons[agent.type] || 'brain'} size={20} />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">{agent.name}</div>
            <div className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border mt-1 ${statusColor}`}>
              {agent.status}
            </div>
          </div>
        </div>
        <button
          onClick={() => onToggle(agent)}
          className={`p-2 rounded-lg transition-colors ${
            agent.status === 'running'
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          }`}
        >
          <Icon name={agent.status === 'running' ? 'pause' : 'play'} size={16} />
        </button>
      </div>
      <p className="text-xs text-[#6b6b80] mb-3">{agent.description}</p>
      <div className="flex gap-4 text-xs text-[#6b6b80]">
        <span>Runs: {agent.runCount}</span>
        <span>Success: {agent.successCount}</span>
        {agent.lastRun && (
          <span>Last: {new Date(agent.lastRun).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  )
}

// ─── Gig Card ───
function GigCard({ gig, onAction }) {
  const statusColors = {
    new: 'bg-blue-500/20 text-blue-400',
    proposal_sent: 'bg-yellow-500/20 text-yellow-400',
    in_progress: 'bg-purple-500/20 text-purple-400',
    completed: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
    skipped: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 fade-in">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="text-white font-medium text-sm">{gig.title}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[gig.status]}`}>
              {gig.status.replace('_', ' ')}
            </span>
            <span className="text-xs text-[#6b6b80]">{gig.platform}</span>
            {gig.budget && <span className="text-xs text-green-400">{gig.budget}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <div className={`text-xs font-bold px-2 py-1 rounded ${gig.matchScore >= 80 ? 'bg-green-500/20 text-green-400' : gig.matchScore >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
            {gig.matchScore}%
          </div>
        </div>
      </div>
      <p className="text-xs text-[#6b6b80] line-clamp-2 mb-3">{gig.description}</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {gig.skills.map((s, i) => (
          <span key={i} className="text-xs bg-[#1a1a28] text-[#D4A843] px-2 py-0.5 rounded">{s}</span>
        ))}
      </div>
      {gig.status === 'new' && (
        <div className="flex gap-2">
          <button onClick={() => onAction(gig._id, 'proposal_sent')} className="flex-1 text-xs bg-[#D4A843]/20 text-[#D4A843] py-1.5 rounded-lg hover:bg-[#D4A843]/30 transition-colors">
            Draft Proposal
          </button>
          <button onClick={() => onAction(gig._id, 'skipped')} className="text-xs bg-[#1a1a28] text-[#6b6b80] px-3 py-1.5 rounded-lg hover:text-white transition-colors">
            Skip
          </button>
        </div>
      )}
      {gig.proposalDraft && (
        <div className="mt-2 p-3 bg-[#0a0a12] rounded-lg text-xs text-[#9b9bb0] max-h-32 overflow-auto">
          {gig.proposalDraft}
        </div>
      )}
    </div>
  )
}

// ─── Activity Feed ───
function ActivityFeed({ activities }) {
  if (!activities || activities.length === 0) {
    return <div className="text-[#6b6b80] text-sm text-center py-8">No activity yet. Start an agent to see logs here.</div>
  }

  const statusIcons = { success: 'check', error: 'x', info: 'activity' }
  const statusColors = { success: 'text-green-400', error: 'text-red-400', info: 'text-blue-400' }

  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div key={a._id} className="flex items-start gap-3 p-3 bg-[#0a0a12] rounded-lg fade-in">
          <div className={`mt-0.5 ${statusColors[a.status]}`}>
            <Icon name={statusIcons[a.status] || 'activity'} size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#D4A843]">{a.agentType}</span>
              <span className="text-xs text-[#6b6b80]">{a.action}</span>
            </div>
            <p className="text-xs text-[#6b6b80] mt-0.5 truncate">{a.details}</p>
          </div>
          <span className="text-xs text-[#4a4a5a] whitespace-nowrap">
            {new Date(a.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Financials Panel ───
function FinancialsPanel({ financials, transactions }) {
  if (!financials) return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0a0a12] rounded-xl p-4 text-center">
          <div className="text-xs text-[#6b6b80] mb-1">Total Income</div>
          <div className="text-xl font-bold text-green-400">${financials.totalIncome.toFixed(2)}</div>
        </div>
        <div className="bg-[#0a0a12] rounded-xl p-4 text-center">
          <div className="text-xs text-[#6b6b80] mb-1">Total Expenses</div>
          <div className="text-xl font-bold text-red-400">${financials.totalExpenses.toFixed(2)}</div>
        </div>
        <div className="bg-[#0a0a12] rounded-xl p-4 text-center">
          <div className="text-xs text-[#6b6b80] mb-1">Net Profit</div>
          <div className={`text-xl font-bold ${financials.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${financials.profit.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a12] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Self-Funding Status</h3>
        <div className="w-full bg-[#1a1a28] rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all ${financials.profit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(100, Math.max(5, (financials.totalIncome / Math.max(financials.totalExpenses, 1)) * 50))}%` }}
          />
        </div>
        <p className="text-xs text-[#6b6b80]">
          {financials.profit >= 0
            ? `Alfred is self-sustaining! Covering costs + $${financials.profit.toFixed(2)} profit`
            : `Alfred needs $${Math.abs(financials.profit).toFixed(2)} more to cover its costs`
          }
        </p>
      </div>

      {transactions && transactions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">Recent Transactions</h3>
          <div className="space-y-1">
            {transactions.slice(0, 10).map((t) => (
              <div key={t._id} className="flex items-center justify-between py-2 px-3 bg-[#0a0a12] rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <span className={t.type === 'income' ? 'text-green-400' : 'text-red-400'}>
                    {t.type === 'income' ? '+' : '-'}
                  </span>
                  <span className="text-[#9b9bb0]">{t.description}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#6b6b80]">{t.category}</span>
                  <span className={`font-medium ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    ${t.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Nav ───
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'brain' },
  { key: 'agents', label: 'Agents', icon: 'zap' },
  { key: 'gigs', label: 'Gigs', icon: 'target' },
  { key: 'financials', label: 'Financials', icon: 'dollar' },
  { key: 'activity', label: 'Activity', icon: 'activity' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

function App() {
  const [section, setSection] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Convex queries
  const agents = useQuery(api.agents.list) || []
  const gigStats = useQuery(api.gigs.getStats)
  const allGigs = useQuery(api.gigs.list, { status: undefined })
  const financials = useQuery(api.transactions.getFinancials)
  const transactions = useQuery(api.transactions.list, { limit: 20 })
  const recentActivity = useQuery(api.activity.getRecent, { count: 30 })

  // Mutations
  const toggleAgent = useMutation(api.agents.updateStatus)
  const updateGigStatus = useMutation(api.gigs.updateStatus)
  const seedAgents = useMutation(api.seed.seedAgents)
  const logActivity = useMutation(api.activity.log)

  function handleToggleAgent(agent) {
    const newStatus = agent.status === 'running' ? 'idle' : 'running'
    toggleAgent({ type: agent.type, status: newStatus })
    logActivity({
      agentType: agent.type,
      action: newStatus === 'running' ? 'Started' : 'Stopped',
      details: `${agent.name} ${newStatus === 'running' ? 'activated' : 'deactivated'}`,
      status: 'info',
    })
  }

  function handleGigAction(id, status) {
    updateGigStatus({ id, status })
  }

  // Seed agents if none exist
  if (agents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h1 className="text-2xl font-bold text-white mb-2">Alfred</h1>
          <p className="text-[#6b6b80] mb-6">Your autonomous AI agent. Ready to work.</p>
          <button
            onClick={() => seedAgents()}
            className="bg-[#D4A843] text-black font-bold px-6 py-3 rounded-xl hover:bg-[#c49a38] transition-colors"
          >
            Initialize Alfred
          </button>
        </div>
      </div>
    )
  }

  const runningAgents = agents.filter((a) => a.status === 'running').length
  const totalRuns = agents.reduce((s, a) => s + a.runCount, 0)

  const sections = {
    dashboard: (
      <div className="space-y-6 fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="zap" label="Active Agents" value={`${runningAgents}/${agents.length}`} sub="agents running" color="text-green-400" />
          <StatCard icon="target" label="Gigs Found" value={gigStats?.total || 0} sub={`${gigStats?.new || 0} new`} color="text-blue-400" />
          <StatCard icon="dollar" label="Revenue" value={`$${financials?.totalIncome?.toFixed(2) || '0.00'}`} sub="total earned" color="text-[#D4A843]" />
          <StatCard icon="trending" label="Profit" value={`$${financials?.profit?.toFixed(2) || '0.00'}`} sub="after costs" color={financials?.profit >= 0 ? 'text-green-400' : 'text-red-400'} />
        </div>

        {/* Alfred Status */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${runningAgents > 0 ? 'bg-green-500 pulse-gold' : 'bg-gray-500'}`} />
            <h2 className="text-lg font-bold text-white">Alfred Status</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {agents.map((agent) => (
              <div key={agent._id} className="flex items-center gap-2 p-2 bg-[#0a0a12] rounded-lg">
                <div className={`w-2 h-2 rounded-full ${agent.status === 'running' ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-[#9b9bb0]">{agent.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Two columns: Gig Pipeline + Activity */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-3">Gig Pipeline</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-[#0a0a12] rounded-lg p-3">
                <div className="text-lg font-bold text-blue-400">{gigStats?.new || 0}</div>
                <div className="text-xs text-[#6b6b80]">New</div>
              </div>
              <div className="bg-[#0a0a12] rounded-lg p-3">
                <div className="text-lg font-bold text-yellow-400">{gigStats?.proposalSent || 0}</div>
                <div className="text-xs text-[#6b6b80]">Proposals</div>
              </div>
              <div className="bg-[#0a0a12] rounded-lg p-3">
                <div className="text-lg font-bold text-purple-400">{gigStats?.inProgress || 0}</div>
                <div className="text-xs text-[#6b6b80]">Active</div>
              </div>
              <div className="bg-[#0a0a12] rounded-lg p-3">
                <div className="text-lg font-bold text-green-400">{gigStats?.completed || 0}</div>
                <div className="text-xs text-[#6b6b80]">Done</div>
              </div>
            </div>
          </div>

          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-3">Recent Activity</h3>
            <ActivityFeed activities={recentActivity?.slice(0, 5)} />
          </div>
        </div>
      </div>
    ),

    agents: (
      <div className="space-y-4 fade-in">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">Agent Fleet</h2>
          <div className="text-xs text-[#6b6b80]">{runningAgents} of {agents.length} active</div>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent._id} agent={agent} onToggle={handleToggleAgent} />
          ))}
        </div>
      </div>
    ),

    gigs: (
      <div className="space-y-4 fade-in">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">Gig Board</h2>
          <div className="text-xs text-[#6b6b80]">{allGigs?.length || 0} total gigs</div>
        </div>
        {(!allGigs || allGigs.length === 0) ? (
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-[#6b6b80]">No gigs found yet. Start the Gig Hunter agent to begin scanning.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {allGigs.map((gig) => (
              <GigCard key={gig._id} gig={gig} onAction={handleGigAction} />
            ))}
          </div>
        )}
      </div>
    ),

    financials: (
      <div className="space-y-4 fade-in">
        <h2 className="text-lg font-bold text-white mb-2">Financials</h2>
        <FinancialsPanel financials={financials} transactions={transactions} />
      </div>
    ),

    activity: (
      <div className="space-y-4 fade-in">
        <h2 className="text-lg font-bold text-white mb-2">Activity Log</h2>
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
          <ActivityFeed activities={recentActivity} />
        </div>
      </div>
    ),

    settings: (
      <div className="space-y-4 fade-in">
        <h2 className="text-lg font-bold text-white mb-2">Settings</h2>
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Alfred Configuration</h3>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between py-3 border-b border-[#1e1e2e]">
              <div>
                <div className="text-white">Auto-approve proposals under $50</div>
                <div className="text-xs text-[#6b6b80]">Alfred will auto-submit proposals for gigs under $50</div>
              </div>
              <div className="w-10 h-5 bg-[#1a1a28] rounded-full relative cursor-pointer">
                <div className="w-4 h-4 bg-[#6b6b80] rounded-full absolute top-0.5 left-0.5" />
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[#1e1e2e]">
              <div>
                <div className="text-white">Daily spending limit</div>
                <div className="text-xs text-[#6b6b80]">Maximum API costs per day</div>
              </div>
              <span className="text-[#D4A843] font-mono">$5.00</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[#1e1e2e]">
              <div>
                <div className="text-white">Target platforms</div>
                <div className="text-xs text-[#6b6b80]">Where Alfred looks for gigs</div>
              </div>
              <span className="text-[#6b6b80]">Fiverr, Upwork, Direct</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-white">Skills profile</div>
                <div className="text-xs text-[#6b6b80]">What Alfred advertises</div>
              </div>
              <span className="text-[#6b6b80]">React, Next.js, Tailwind, Vite</span>
            </div>
          </div>
        </div>
      </div>
    ),
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-60 bg-[#0a0a12] border-r border-[#1e1e2e] flex flex-col transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="p-5 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D4A843]/20 flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <div className="text-white font-bold text-sm">Alfred</div>
              <div className="text-[10px] text-[#6b6b80]">Autonomous Agent</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => { setSection(item.key); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                section === item.key
                  ? 'bg-[#D4A843]/15 text-[#D4A843]'
                  : 'text-[#6b6b80] hover:text-white hover:bg-[#12121a]'
              }`}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e1e2e]">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${runningAgents > 0 ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span className="text-xs text-[#6b6b80]">
              {runningAgents > 0 ? `${runningAgents} agents working` : 'All agents idle'}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-[#0a0a0f]/80 backdrop-blur-sm border-b border-[#1e1e2e] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-[#6b6b80]" onClick={() => setSidebarOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 className="text-lg font-bold text-white capitalize">{section}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6b6b80]">
            <span className="hidden sm:inline">Total runs: {totalRuns}</span>
            <div className={`px-2 py-1 rounded-full text-xs ${runningAgents > 0 ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
              {runningAgents > 0 ? 'LIVE' : 'STANDBY'}
            </div>
          </div>
        </header>

        <div className="p-6">
          {sections[section]}
        </div>
      </main>
    </div>
  )
}

export default App
