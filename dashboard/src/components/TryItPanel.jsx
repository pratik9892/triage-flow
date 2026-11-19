import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { INTENT_LABELS } from '../lib/format'
import { DEMO_CUSTOMERS, MAX_CUSTOM_MESSAGE, SCENARIOS } from '../lib/tryScenarios'
import { PriorityBadge, StatusBadge } from './TicketTable'

// "Try it live": send a demo ticket through the real n8n workflow and see how
// it was triaged. The request goes to our own /api/try-ticket function, which
// holds the webhook secret; the browser never sees it.
export default function TryItPanel({ onTicketCreated, onOpenTicket }) {
  const [open, setOpen] = useState(true)
  const [mode, setMode] = useState('preset') // 'preset' | 'custom'
  const [scenarioKey, setScenarioKey] = useState(SCENARIOS[0].key)
  const [customer, setCustomer] = useState(DEMO_CUSTOMERS[0].email)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const scenario = SCENARIOS.find((s) => s.key === scenarioKey)

  async function send() {
    setSending(true)
    setError('')
    setResult(null)
    const { data } = await supabase.auth.getSession()
    const body = mode === 'preset' ? { scenario: scenarioKey } : { customer_email: customer, message }
    try {
      const r = await fetch('/api/try-ticket', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify(body),
      })
      const json = await r.json().catch(() => ({ error: `Unexpected response (HTTP ${r.status})` }))
      if (!r.ok) setError(json.error ?? `Request failed (HTTP ${r.status})`)
      else {
        setResult(json)
        if (json.ticket_id) onTicketCreated?.(json.ticket_id)
      }
    } catch {
      setError('Network error. Check your connection and try again.')
    }
    setSending(false)
  }

  const customerName = (email) => DEMO_CUSTOMERS.find((c) => c.email === email)?.name ?? email
  const canSend = !sending && (mode === 'preset' || message.trim().length >= 3)

  return (
    <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-1)]">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div>
          <h2 className="font-semibold">Try it live</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Send a ticket through the real n8n workflow: AI classification, order lookup, routing rules and reply drafting.
          </p>
        </div>
        <span className="text-sm text-[var(--text-secondary)]">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="grid gap-6 border-t border-[var(--border)] p-4 lg:grid-cols-2">
          {/* Left: choose what to send */}
          <div>
            <div className="flex gap-1" role="tablist">
              {[['preset', 'Pick a scenario'], ['custom', 'Write your own']].map(([key, label]) => (
                <button key={key} role="tab" aria-selected={mode === key} onClick={() => setMode(key)}
                  className={`rounded-md px-3 py-1.5 text-sm ${mode === key
                    ? 'bg-[var(--text-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-0)]'}`}>
                  {label}
                </button>
              ))}
            </div>

            {mode === 'preset' ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SCENARIOS.map((s) => (
                    <button key={s.key} onClick={() => setScenarioKey(s.key)}
                      className={`rounded-full border px-3 py-1 text-sm ${scenarioKey === s.key
                        ? 'border-[var(--text-primary)] bg-white font-medium'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-white'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    {scenario.channel.replace('_', ' ')} · from {customerName(scenario.customer_email)}
                  </p>
                  <p className="mt-1">“{scenario.message}”</p>
                  <p className="mt-2 text-[var(--text-secondary)]"><span className="font-medium">Expected:</span> {scenario.expect}</p>
                </div>
              </>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <label className="block">
                  <span className="font-medium">Customer</span>
                  <select value={customer} onChange={(e) => setCustomer(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2">
                    {DEMO_CUSTOMERS.map((c) => (
                      <option key={c.email} value={c.email}>{c.name}: orders {c.orders}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="font-medium">Message</span>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, MAX_CUSTOM_MESSAGE))} rows={3}
                    placeholder="e.g. Where is my order ORD-10241?"
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2" />
                  <span className="text-xs text-[var(--text-muted)]">{message.length}/{MAX_CUSTOM_MESSAGE} · demo customers only, no real data</span>
                </label>
              </div>
            )}

            <button onClick={send} disabled={!canSend}
              className="mt-4 rounded-md bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {sending ? 'Running the workflow…' : 'Send ticket'}
            </button>
            {sending && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Validating → AI classifies → order lookup → routing rules → AI drafts reply → saved. Usually 5–15 seconds.
              </p>
            )}
          </div>

          {/* Right: what the workflow decided */}
          <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm">
            {!result && !error && (
              <p className="text-[var(--text-muted)]">The workflow's decision will appear here, and the ticket will show up in the queue below.</p>
            )}
            {error && <p role="alert" className="text-[var(--status-critical)]">{error}</p>}
            {result && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={result.status} />
                  {result.priority != null && <PriorityBadge priority={result.priority} />}
                  <span className="text-[var(--text-secondary)]">{INTENT_LABELS[result.intent] ?? result.intent}</span>
                  {result.sentiment && <span className="text-[var(--text-secondary)]">· {result.sentiment}</span>}
                </div>
                <p><span className="font-medium">Why:</span> {result.routing_reason}</p>
                <p><span className="font-medium">Order found:</span> {result.order_id ?? 'none (or not this customer\'s)'}</p>
                {result.reply && (
                  <div className="rounded-md bg-[var(--surface-0)] p-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Reply sent to the customer</p>
                    <p className="mt-1 whitespace-pre-wrap">{result.reply}</p>
                  </div>
                )}
                {result.ticket_id && (
                  <button onClick={() => onOpenTicket?.(result.ticket_id)}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-white">
                    Open ticket #{result.ticket_id} in the queue
                  </button>
                )}
                <p className="text-xs text-[var(--text-muted)]">
                  Ticket #{result.ticket_id} · processed in {((result.processing_ms ?? 0) / 1000).toFixed(1)} s
                  {result.remaining != null && <> · {result.remaining} live tries left this hour</>}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}