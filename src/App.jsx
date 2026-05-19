import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
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
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    terminal: <><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>,
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
function GigCard({ gig, onAction, onRegenerate, onLogIncome }) {
  const [regen, setRegen] = useState(false)
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
      {gig.proposalDraft && (
        <div className="mt-2 p-3 bg-[#0a0a12] rounded-lg text-xs text-[#9b9bb0] max-h-32 overflow-auto whitespace-pre-wrap">
          {gig.proposalDraft}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        {gig.url && (
          <a
            href={gig.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-[#D4A843]/20 text-[#D4A843] px-3 py-1.5 rounded-lg hover:bg-[#D4A843]/30 transition-colors"
          >
            Open gig ↗
          </a>
        )}
        {gig.proposalDraft && (
          <button
            onClick={() => navigator.clipboard?.writeText(gig.proposalDraft)}
            className="text-xs bg-[#1a1a28] text-[#9b9bb0] px-3 py-1.5 rounded-lg hover:text-white transition-colors"
          >
            Copy proposal
          </button>
        )}
        <button
          onClick={async () => { setRegen(true); try { await onRegenerate(gig._id) } finally { setRegen(false) } }}
          disabled={regen}
          className="text-xs bg-[#1a1a28] text-[#9b9bb0] px-3 py-1.5 rounded-lg hover:text-white transition-colors disabled:opacity-50"
        >
          {regen ? 'Writing…' : 'Regenerate'}
        </button>
        {gig.status === 'new' && (
          <>
            <button onClick={() => onAction(gig._id, 'proposal_sent')} className="text-xs bg-green-500/15 text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-500/25 transition-colors">
              Mark applied
            </button>
            <button onClick={() => onAction(gig._id, 'skipped')} className="text-xs bg-[#1a1a28] text-[#6b6b80] px-3 py-1.5 rounded-lg hover:text-white transition-colors">
              Skip
            </button>
          </>
        )}
        {gig.status !== 'completed' && (
          <button onClick={() => onLogIncome(gig)} className="text-xs bg-[#D4A843]/15 text-[#D4A843] px-3 py-1.5 rounded-lg hover:bg-[#D4A843]/25 transition-colors">
            Log income
          </button>
        )}
      </div>
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

// ─── Live Terminal ───
function LiveTerminal({ activities, agents }) {
  const scrollRef = useRef(null)
  const runningAgents = (agents || []).filter((a) => a.status === 'running')

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activities])

  const statusIcon = (status) => {
    if (status === 'success') return '✓'
    if (status === 'error') return '✗'
    return '→'
  }
  const statusColor = (status) => {
    if (status === 'success') return 'text-green-400'
    if (status === 'error') return 'text-red-400'
    return 'text-blue-400'
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">Live View</h2>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${runningAgents.length > 0 ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
            <div className={`w-2 h-2 rounded-full ${runningAgents.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            {runningAgents.length > 0 ? `${runningAgents.length} agent${runningAgents.length > 1 ? 's' : ''} active` : 'No agents running'}
          </div>
        </div>
        <span className="text-xs text-[#6b6b80] font-mono">{new Date().toLocaleTimeString()}</span>
      </div>

      {/* Active Agents Strip */}
      {runningAgents.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {runningAgents.map((a) => (
            <div key={a._id} className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">{a.name}</span>
              <span className="text-xs text-green-400/50">running</span>
            </div>
          ))}
        </div>
      )}

      {/* Terminal */}
      <div className="bg-[#08080e] border border-[#1e1e2e] rounded-xl overflow-hidden">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0c0c14] border-b border-[#1e1e2e]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-[#6b6b80] font-mono ml-2">alfred — live feed</span>
          <div className="ml-auto flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${runningAgents.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-[10px] text-[#4a4a5a] font-mono">{runningAgents.length > 0 ? 'LIVE' : 'IDLE'}</span>
          </div>
        </div>

        {/* Terminal Body */}
        <div ref={scrollRef} className="p-4 h-[500px] overflow-y-auto font-mono text-xs leading-6">
          {/* Boot message */}
          <div className="text-[#D4A843] mb-2">
            ╔══════════════════════════════════════════╗
          </div>
          <div className="text-[#D4A843]">
            ║  ALFRED v1.0 — Autonomous Agent System   ║
          </div>
          <div className="text-[#D4A843] mb-2">
            ╚══════════════════════════════════════════╝
          </div>
          <div className="text-[#6b6b80] mb-1">[system] Agents loaded: {(agents || []).length}</div>
          <div className="text-[#6b6b80] mb-1">[system] Running: {runningAgents.length} | Idle: {(agents || []).length - runningAgents.length}</div>
          <div className="text-[#6b6b80] mb-4">[system] Live feed active — watching all agent activity</div>

          {/* Activity entries */}
          {(!activities || activities.length === 0) ? (
            <div className="text-[#4a4a5a]">
              <div className="mb-1">Waiting for agent activity...</div>
              <div className="mb-1">Start an agent from the Agents panel to see live output here.</div>
              <div className="text-[#D4A843]/50 animate-pulse mt-4">█</div>
            </div>
          ) : (
            <>
              {[...activities].reverse().map((a, i) => {
                const time = new Date(a.timestamp).toLocaleTimeString()
                return (
                  <div key={a._id || i} className="flex gap-2 mb-1 hover:bg-white/[0.02] -mx-1 px-1 rounded">
                    <span className="text-[#4a4a5a] shrink-0">{time}</span>
                    <span className={`shrink-0 ${statusColor(a.status)}`}>{statusIcon(a.status)}</span>
                    <span className="text-[#D4A843] shrink-0">[{a.agentType}]</span>
                    <span className="text-[#8888a0]">{a.action}</span>
                    <span className="text-[#6b6b80] truncate">{a.details}</span>
                  </div>
                )
              })}
              <div className="text-[#D4A843]/50 animate-pulse mt-2">█</div>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#08080e] border border-[#1e1e2e] rounded-lg p-3 text-center">
          <div className="text-xs text-[#6b6b80] mb-1">Uptime</div>
          <div className="text-sm font-mono text-white">Active</div>
        </div>
        <div className="bg-[#08080e] border border-[#1e1e2e] rounded-lg p-3 text-center">
          <div className="text-xs text-[#6b6b80] mb-1">Actions Today</div>
          <div className="text-sm font-mono text-white">{activities?.length || 0}</div>
        </div>
        <div className="bg-[#08080e] border border-[#1e1e2e] rounded-lg p-3 text-center">
          <div className="text-xs text-[#6b6b80] mb-1">Errors</div>
          <div className="text-sm font-mono text-red-400">{activities?.filter((a) => a.status === 'error').length || 0}</div>
        </div>
        <div className="bg-[#08080e] border border-[#1e1e2e] rounded-lg p-3 text-center">
          <div className="text-xs text-[#6b6b80] mb-1">Success Rate</div>
          <div className="text-sm font-mono text-green-400">
            {activities?.length > 0 ? Math.round((activities.filter((a) => a.status === 'success').length / activities.length) * 100) : 0}%
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Nav ───
// ─── Chat Panel ───
function ChatPanel({ messages, onSend, onClear }) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending) return
    const msg = input.trim()
    setInput('')
    setSending(true)
    try {
      await onSend(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">Talk to Alfred</h2>
          <span className="text-xs text-[#6b6b80]">Your autonomous agent</span>
        </div>
        <button onClick={onClear} className="text-xs text-[#6b6b80] hover:text-white transition-colors px-3 py-1 bg-[#1a1a28] rounded-lg">
          Clear Chat
        </button>
      </div>

      {/* Chat Window */}
      <div className="bg-[#08080e] border border-[#1e1e2e] rounded-xl overflow-hidden flex flex-col" style={{ height: '520px' }}>
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Welcome message */}
          {(!messages || messages.length === 0) && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#D4A843]/20 flex items-center justify-center shrink-0 mt-1">
                <span className="text-sm">🤖</span>
              </div>
              <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                <p className="text-sm text-[#e2e2e8]">Good evening, boss. Alfred here, ready to work. What would you like me to do?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => { setInput('Scan for new gigs now'); }} className="text-xs bg-[#D4A843]/15 text-[#D4A843] px-3 py-1.5 rounded-lg hover:bg-[#D4A843]/25 transition-colors">
                    Scan now
                  </button>
                  <button onClick={() => { setInput('Show me my top gigs'); }} className="text-xs bg-[#D4A843]/15 text-[#D4A843] px-3 py-1.5 rounded-lg hover:bg-[#D4A843]/25 transition-colors">
                    Top gigs
                  </button>
                  <button onClick={() => { setInput('Draft a proposal for my best gig'); }} className="text-xs bg-[#D4A843]/15 text-[#D4A843] px-3 py-1.5 rounded-lg hover:bg-[#D4A843]/25 transition-colors">
                    Draft proposal
                  </button>
                </div>
              </div>
            </div>
          )}

          {messages && messages.map((msg) => (
            <div key={msg._id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-blue-500/20' : 'bg-[#D4A843]/20'}`}>
                <span className="text-sm">{msg.role === 'user' ? '👤' : '🤖'}</span>
              </div>
              <div className={`rounded-2xl px-4 py-3 max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-blue-500/20 border border-blue-500/20 rounded-tr-sm'
                  : 'bg-[#12121a] border border-[#1e1e2e] rounded-tl-sm'
              }`}>
                <p className="text-sm text-[#e2e2e8] whitespace-pre-wrap">{msg.content}</p>
                <span className="text-[10px] text-[#4a4a5a] mt-1 block">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#D4A843]/20 flex items-center justify-center shrink-0 mt-1">
                <span className="text-sm">🤖</span>
              </div>
              <div className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-[#D4A843] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-[#D4A843] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-[#D4A843] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="border-t border-[#1e1e2e] p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Talk to Alfred..."
            className="flex-1 bg-[#12121a] border border-[#1e1e2e] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#4a4a5a] outline-none focus:border-[#D4A843]/50 transition-colors"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-[#D4A843] text-black font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-[#c49a38] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Profile Settings ───
function ProfileSettings({ profile, onSave }) {
  if (!profile) {
    return <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 text-sm text-[#6b6b80]">Loading profile…</div>
  }
  return <ProfileForm profile={profile} onSave={onSave} />
}

function ProfileForm({ profile, onSave }) {
  const [form, setForm] = useState(() => ({
    name: profile.name || '',
    title: profile.title || '',
    skills: (profile.skills || []).join(', '),
    hourlyRate: profile.hourlyRate || '',
    bio: profile.bio || '',
    minMatchScore: profile.minMatchScore ?? 45,
  }))
  const [saved, setSaved] = useState(false)

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false) }

  async function submit(e) {
    e.preventDefault()
    await onSave({
      name: form.name.trim() || 'Johnny',
      title: form.title.trim(),
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      hourlyRate: form.hourlyRate.trim(),
      bio: form.bio.trim(),
      minMatchScore: Math.max(0, Math.min(100, Number(form.minMatchScore) || 0)),
    })
    setSaved(true)
  }

  const field = 'w-full bg-[#0a0a12] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D4A843]/50'

  return (
    <form onSubmit={submit} className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Your Profile</h3>
        <p className="text-xs text-[#6b6b80] mt-0.5">Alfred uses this to match gigs and write proposals as you.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#6b6b80]">Name</label>
          <input className={field} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-[#6b6b80]">Headline / title</label>
          <input className={field} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-[#6b6b80]">Skills (comma separated)</label>
        <input className={field} value={form.skills} onChange={(e) => set('skills', e.target.value)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#6b6b80]">Rate</label>
          <input className={field} value={form.hourlyRate} onChange={(e) => set('hourlyRate', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-[#6b6b80]">Min match score to keep ({form.minMatchScore}%)</label>
          <input type="range" min="0" max="100" value={form.minMatchScore} onChange={(e) => set('minMatchScore', e.target.value)} className="w-full accent-[#D4A843]" />
        </div>
      </div>
      <div>
        <label className="text-xs text-[#6b6b80]">Short bio</label>
        <textarea rows={3} className={field} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="text-sm bg-[#D4A843] text-black font-bold px-4 py-2 rounded-lg hover:bg-[#c49a38] transition-colors">
          Save profile
        </button>
        {saved && <span className="text-xs text-green-400">Saved ✓</span>}
      </div>
    </form>
  )
}

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'brain' },
  { key: 'chat', label: 'Chat', icon: 'send' },
  { key: 'live', label: 'Live View', icon: 'monitor' },
  { key: 'agents', label: 'Agents', icon: 'zap' },
  { key: 'gigs', label: 'Gigs', icon: 'target' },
  { key: 'financials', label: 'Financials', icon: 'dollar' },
  { key: 'activity', label: 'Activity', icon: 'activity' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

function App() {
  const [section, setSection] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scanning, setScanning] = useState(false)

  // Convex queries
  const agents = useQuery(api.agents.list) || []
  const gigStats = useQuery(api.gigs.getStats)
  const allGigs = useQuery(api.gigs.list, { status: undefined })
  const financials = useQuery(api.transactions.getFinancials)
  const transactions = useQuery(api.transactions.list, { limit: 20 })
  const recentActivity = useQuery(api.activity.getRecent, { count: 30 })
  const chatMessages = useQuery(api.chat.list)

  // Mutations
  const toggleAgent = useMutation(api.agents.updateStatus)
  const updateGigStatus = useMutation(api.gigs.updateStatus)
  const seedAgents = useMutation(api.seed.seedAgents)
  const logActivity = useMutation(api.activity.log)
  const sendChatMessage = useAction(api.chat.sendMessage)
  const clearChat = useMutation(api.chat.clearChat)
  const scanGigs = useAction(api.gigs.scanForGigs)
  const generateProposal = useAction(api.gigs.generateProposal)
  const profile = useQuery(api.profile.get)
  const saveProfile = useMutation(api.profile.save)
  const topPicks = useQuery(api.gigs.topPicks, { limit: 5 }) || []
  const addTransaction = useMutation(api.transactions.add)

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

  async function handleScan() {
    if (scanning) return
    setScanning(true)
    try {
      await scanGigs()
    } finally {
      setScanning(false)
    }
  }

  async function handleRegenerate(id) {
    const instructions = window.prompt('Any instructions for the rewrite? (optional — e.g. "shorter, emphasize Shopify")') || undefined
    await generateProposal({ id, instructions })
  }

  async function handleLogIncome(gig) {
    const raw = window.prompt(`Log income for "${gig.title}". Amount in USD:`)
    if (raw == null) return
    const amount = Number(String(raw).replace(/[^0-9.]/g, ''))
    if (!amount || amount <= 0) return
    await addTransaction({
      type: 'income',
      amount,
      description: gig.title,
      category: 'freelance',
      source: 'gig',
    })
    await updateGigStatus({ id: gig._id, status: 'completed' })
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

        {/* Top picks — what to look at first */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Today's Top Picks</h3>
            <button onClick={() => setSection('gigs')} className="text-xs text-[#D4A843] hover:underline">View all</button>
          </div>
          {topPicks.length === 0 ? (
            <p className="text-xs text-[#6b6b80]">No open gigs yet. Alfred scans every 6 hours, or hit “Scan now” on the Gig Board.</p>
          ) : (
            <div className="space-y-2">
              {topPicks.map((g) => (
                <div key={g._id} className="flex items-center justify-between gap-3 bg-[#0a0a12] rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{g.title}</div>
                    <div className="text-xs text-[#6b6b80]">{g.platform}{g.budget ? ` · ${g.budget}` : ''}</div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${g.matchScore >= 80 ? 'bg-green-500/20 text-green-400' : g.matchScore >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                    {g.matchScore}%
                  </div>
                </div>
              ))}
            </div>
          )}
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

    chat: (
      <ChatPanel
        messages={chatMessages}
        onSend={(msg) => sendChatMessage({ message: msg })}
        onClear={() => clearChat()}
      />
    ),

    live: (
      <LiveTerminal activities={recentActivity} agents={agents} />
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
          <div>
            <h2 className="text-lg font-bold text-white">Gig Board</h2>
            <p className="text-xs text-[#6b6b80] mt-0.5">Auto-scans real remote dev jobs every 6h and drafts proposals. You review and apply.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#6b6b80]">{allGigs?.length || 0} total</span>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="text-xs bg-[#D4A843] text-black font-bold px-3 py-1.5 rounded-lg hover:bg-[#c49a38] transition-colors disabled:opacity-50"
            >
              {scanning ? 'Scanning…' : 'Scan now'}
            </button>
          </div>
        </div>
        {(!allGigs || allGigs.length === 0) ? (
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-[#6b6b80]">No gigs yet. Alfred scans automatically every 6 hours — or hit “Scan now” to pull jobs immediately.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {allGigs.map((gig) => (
              <GigCard key={gig._id} gig={gig} onAction={handleGigAction} onRegenerate={handleRegenerate} onLogIncome={handleLogIncome} />
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
        <ProfileSettings profile={profile} onSave={saveProfile} />
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
