import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { INTENT_LABELS, ORDER_STATUS_LABELS, deliveryInfo, inr, shortDay } from '../lib/format'
import { PriorityBadge, StatusBadge } from './TicketTable'

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="shrink-0 text-[var(--text-secondary)]">{label}</span>
      <span className="text-right font-medium">{children ?? '–'}</span>
    </div>
  )
}

export default function TicketDrawer({ ticket, onClose, onChanged }) {
  const [reply, setReply] = useState(ticket.draft_reply ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const order = ticket.orders
  const delivery = deliveryInfo(order)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function resolve() {
    setSaving(true)
    setError('')
    // RLS + column grants only allow agents to change status, resolved_at and draft_reply.
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), draft_reply: reply })
      .eq('id', ticket.id)
    setSaving(false)
    if (error) return setError(error.message)
    onChanged()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`Ticket ${ticket.id}`}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-lg overflow-y-auto bg-[var(--surface-1)] p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Ticket #{ticket.id} · {ticket.channel.replace('_', ' ')}</p>
            <h2 className="mt-1 text-lg font-semibold">{ticket.customer_name ?? ticket.customer_email}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{ticket.customer_email}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--surface-0)]">✕</button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={ticket.priority} score={ticket.priority_score} reason={ticket.routing_reason} />
          <StatusBadge status={ticket.status} />
        </div>

        <blockquote className="mt-4 rounded-lg border border-[var(--border)] bg-white p-3 text-sm whitespace-pre-wrap">
          {ticket.subject && <p className="mb-1 font-medium">{ticket.subject}</p>}
          {ticket.message}
        </blockquote>

        <h3 className="mt-6 text-sm font-semibold">Triage</h3>
        <div className="mt-1 divide-y divide-[var(--border)]">
          <Row label="Intent (AI)">{INTENT_LABELS[ticket.intent]}</Row>
          <Row label="AI confidence">{ticket.confidence != null ? `${Math.round(ticket.confidence * 100)}%` : null}</Row>
          <Row label="Why this priority">{ticket.routing_reason}</Row>
          {ticket.ai_failed && <Row label="Note"><span className="text-[var(--status-critical)]">AI unavailable: read the message and decide</span></Row>}
        </div>
        {ticket.ai_summary && <p className="mt-2 text-sm text-[var(--text-secondary)]">{ticket.ai_summary}</p>}

        <h3 className="mt-6 text-sm font-semibold">Order</h3>
        {order ? (
          <div className="mt-1 divide-y divide-[var(--border)]">
            <Row label="Order">{order.id} · {order.brand}</Row>
            <Row label="Status">{ORDER_STATUS_LABELS[order.status]}</Row>
            <Row label="Amount">{inr(order.amount)} · {order.payment_method === 'cod' ? 'Cash on delivery' : 'Prepaid'}</Row>
            <Row label="Courier">{order.courier ? `${order.courier} · AWB ${order.awb}` : null}</Row>
            <Row label="Expected delivery">
              {delivery?.main}
              {delivery?.tag && <span style={{ color: delivery.tone === 'late' ? 'var(--status-critical)' : 'var(--status-warning)' }}> · {delivery.tag}</span>}
            </Row>
            {order.refund_status && order.refund_status !== 'none' && (
              <Row label="Refund">
                {order.refund_amount != null ? `${inr(order.refund_amount)} · ` : ''}started
                {order.refund_expected_date ? `, due ${shortDay(order.refund_expected_date)}` : ''}
              </Row>
            )}
            <Row label="Items">{order.items.map((i) => i.name).join(', ')}</Row>
          </div>
        ) : (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">No order matched to this customer.</p>
        )}

        <h3 className="mt-6 text-sm font-semibold">
          {ticket.status === 'needs_human' ? 'Your reply' : 'Reply sent'}
        </h3>
        {ticket.status === 'needs_human' ? (
          <>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={7}
              placeholder="Write your reply to the customer…"
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm" />
            {error && <p role="alert" className="mt-2 text-sm text-[var(--status-critical)]">{error}</p>}
            <button onClick={resolve} disabled={saving}
              className="mt-3 w-full rounded-md bg-[var(--text-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Mark resolved'}
            </button>
          </>
        ) : (
          <p className="mt-2 rounded-lg border border-[var(--border)] bg-white p-3 text-sm whitespace-pre-wrap text-[var(--text-secondary)]">
            {ticket.draft_reply ?? 'No reply stored.'}
          </p>
        )}
      </aside>
    </div>
  )
}
