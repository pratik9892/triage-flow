import { INTENT_LABELS, ORDER_STATUS_LABELS, STATUS_META, deliveryInfo, inr, ordinal, replyDue, timeAgo } from '../lib/format'

export function StatusBadge({ status }) {
  const m = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color: m.color, borderColor: m.color }}>
      <span aria-hidden>{m.icon}</span>{m.label}
    </span>
  )
}

// "P1 · 80". Hovering shows how the score was worked out.
export function PriorityBadge({ priority, score, reason }) {
  const style = priority <= 1
    ? { background: 'var(--status-critical)', color: 'white' }
    : priority === 2
      ? { color: 'var(--status-warning)', boxShadow: 'inset 0 0 0 1px var(--status-warning)' }
      : { background: 'var(--surface-0)', color: 'var(--text-secondary)' }
  return (
    <span className="inline-flex justify-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums"
      style={style} title={reason ?? `Priority ${priority}`}>
      P{priority}{score != null && <> · {score}</>}
    </span>
  )
}

function Tag({ tone, children }) {
  const color = tone === 'late' || tone === 'overdue' ? 'var(--status-critical)' : 'var(--status-warning)'
  return (
    <span className="mt-0.5 inline-block rounded px-1.5 py-px text-xs font-medium" style={{ color, boxShadow: `inset 0 0 0 1px ${color}` }}>
      {children}
    </span>
  )
}

const Sub = ({ children }) => <p className="truncate text-xs text-[var(--text-muted)]">{children}</p>

// view: the selected queue filter. The human queue shows a "Reply due"
// countdown; history views show the status and when the ticket arrived.
export default function TicketTable({ tickets, onSelect, selectedId, view, ticketCounts = {}, now }) {
  if (!tickets.length) {
    return <p className="p-8 text-center text-sm text-[var(--text-secondary)]">No tickets here. Nice.</p>
  }
  const queueView = view === 'needs_human' || view === 'late'
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-24" /><col className="w-40" /><col /><col className="w-48" /><col className="w-36" /><col className="w-32" />
        </colgroup>
        <thead className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
          <tr>
            <th className="px-4 py-2 font-medium">Priority</th>
            <th className="px-4 py-2 font-medium">Customer</th>
            <th className="px-4 py-2 font-medium">Issue</th>
            <th className="px-4 py-2 font-medium">Order</th>
            <th className="px-4 py-2 font-medium">Expected delivery</th>
            <th className="px-4 py-2 font-medium">{queueView ? 'Reply due' : 'Status'}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => {
            const o = t.orders
            const d = deliveryInfo(o)
            const due = replyDue(t, now)
            const count = ticketCounts[t.customer_email]
            return (
              <tr key={t.id} onClick={() => onSelect(t.id)}
                className={`cursor-pointer border-t border-[var(--border)] align-top hover:bg-[var(--surface-0)] ${selectedId === t.id ? 'bg-[var(--surface-0)]' : ''}`}>
                <td className="px-4 py-2.5">
                  <PriorityBadge priority={t.priority} score={t.priority_score} reason={t.routing_reason} />
                </td>
                <td className="px-4 py-2.5">
                  <p className="truncate font-medium" title={t.customer_email}>{t.customer_name ?? t.customer_email}</p>
                  <Sub>{t.channel.replace('_', ' ')}{count ? ` · ${ordinal(count)} ticket` : ''}</Sub>
                </td>
                <td className="px-4 py-2.5" title={t.message}>
                  <p className="truncate">{t.ai_summary || t.message}</p>
                  <Sub>{INTENT_LABELS[t.intent]}</Sub>
                </td>
                <td className="px-4 py-2.5">
                  {o ? (
                    <>
                      <p className="tabular-nums">{o.id}</p>
                      <Sub>{ORDER_STATUS_LABELS[o.status]} · {o.payment_method === 'cod' ? 'COD' : 'Prepaid'} {inr(o.amount)}</Sub>
                    </>
                  ) : <span className="text-[var(--text-muted)]">–</span>}
                </td>
                <td className="px-4 py-2.5">
                  {d ? (
                    <>
                      <p className="whitespace-nowrap">{d.main}</p>
                      {d.tag ? <Tag tone={d.tone}>{d.tag}</Tag> : d.sub && <Sub>{d.sub}</Sub>}
                    </>
                  ) : <span className="text-[var(--text-muted)]">–</span>}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {queueView
                    ? due && (due.tone ? <Tag tone={due.tone}>{due.label}</Tag> : <span className="text-[var(--text-secondary)]">{due.label}</span>)
                    : (
                      <>
                        <StatusBadge status={t.status} />
                        <Sub>{timeAgo(t.received_at)}</Sub>
                      </>
                    )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
