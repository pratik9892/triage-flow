import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isOrderLate } from '../lib/format'
import KpiTiles from './KpiTiles'
import { DailyChart, IntentChart } from './Charts'
import TicketTable from './TicketTable'
import TicketDrawer from './TicketDrawer'
import TryItPanel from './TryItPanel'

const FILTERS = [
  { key: 'needs_human', label: 'Needs human' },
  { key: 'late', label: 'Late orders' },
  { key: 'all', label: 'All tickets' },
  { key: 'auto_resolved', label: 'Auto-resolved' },
  { key: 'resolved', label: 'Resolved' },
]

export default function Dashboard({ user }) {
  const [kpis, setKpis] = useState(null)
  const [byIntent, setByIntent] = useState([])
  const [daily, setDaily] = useState([])
  const [tickets, setTickets] = useState([])
  const [ticketCounts, setTicketCounts] = useState({})
  const [filter, setFilter] = useState('needs_human')
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const [live, setLive] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const reloadTimer = useRef(null)

  const load = useCallback(async () => {
    const queueView = filter === 'needs_human' || filter === 'late'
    let ticketQuery = supabase.from('tickets').select('*, orders(*)').limit(200)
    if (queueView) {
      // The human queue is worked by score (highest first), then oldest first.
      ticketQuery = ticketQuery
        .eq('status', 'needs_human')
        .order('priority_score', { ascending: false, nullsFirst: false })
        .order('received_at', { ascending: true })
    } else {
      // History views: newest first.
      ticketQuery = ticketQuery.order('received_at', { ascending: false })
      if (filter !== 'all') ticketQuery = ticketQuery.eq('status', filter)
    }

    const [k, i, d, t, c] = await Promise.all([
      supabase.from('v_ticket_kpis').select('*').single(),
      supabase.from('v_tickets_by_intent').select('*'),
      supabase.from('v_tickets_daily').select('*'),
      ticketQuery,
      // For the "2nd ticket" hint next to each customer.
      supabase.from('tickets').select('customer_email').limit(5000),
    ])
    const firstError = [k, i, d, t, c].find((r) => r.error)?.error
    if (firstError) {
      setError(firstError.message)
      return
    }
    setError('')
    setKpis(k.data)
    setByIntent(i.data)
    setDaily(d.data)
    setTickets(filter === 'late' ? t.data.filter((row) => isOrderLate(row.orders)) : t.data)
    const counts = {}
    for (const row of c.data) counts[row.customer_email] = (counts[row.customer_email] ?? 0) + 1
    setTicketCounts(counts)
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  // Keep the "Reply due" countdowns current.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // Realtime: n8n inserts a ticket -> Supabase pushes the change -> we reload.
  // Several tickets can land at once, so batch reloads into one per 500 ms.
  useEffect(() => {
    const channel = supabase
      .channel('tickets-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        clearTimeout(reloadTimer.current)
        reloadTimer.current = setTimeout(load, 500)
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => {
      clearTimeout(reloadTimer.current)
      supabase.removeChannel(channel)
    }
  }, [load])

  const selected = tickets.find((t) => t.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">TriageFlow · Support operations</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            AI-triaged tickets across email, WhatsApp, web chat and Instagram
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5" title={live ? 'Receiving live updates' : 'Not connected'}>
            <span className={`h-2 w-2 rounded-full ${live ? 'bg-[var(--status-good)]' : 'bg-[var(--text-muted)]'}`} />
            {live ? 'Live' : 'Offline'}
          </span>
          <span className="hidden sm:inline">{user.email}</span>
          <button onClick={() => supabase.auth.signOut()} className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-white">
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-[var(--status-critical)] bg-white p-3 text-sm text-[var(--status-critical)]">
          Could not load data: {error}
        </p>
      )}

      <KpiTiles kpis={kpis} />

      <TryItPanel
        onTicketCreated={() => setFilter('all')}
        onOpenTicket={(id) => { setFilter('all'); setSelectedId(id) }}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DailyChart data={daily} />
        <IntentChart data={byIntent} />
      </div>

      <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-1)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="font-semibold">Ticket queue</h2>
            {(filter === 'needs_human' || filter === 'late') && (
              <p className="text-xs text-[var(--text-muted)]">Sorted by priority score, then oldest first. Hover a priority to see why.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-1" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.key} role="tab" aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-3 py-1.5 text-sm ${filter === f.key
                  ? 'bg-[var(--text-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-0)]'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <TicketTable tickets={tickets} onSelect={setSelectedId} selectedId={selectedId}
          view={filter} ticketCounts={ticketCounts} now={now} />
      </section>

      {selected && (
        <TicketDrawer key={selected.id} ticket={selected} onClose={() => setSelectedId(null)} onChanged={load} />
      )}
    </div>
  )
}
