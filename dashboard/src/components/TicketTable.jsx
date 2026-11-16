import { INTENT_LABELS, SENTIMENT_META, STATUS_META, timeAgo } from '../lib/format'

export function StatusBadge({ status }) {
  const m = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color: m.color, borderColor: m.color }}>
      <span aria-hidden>{m.icon}</span>{m.label}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  const urgent = priority <= 1
  return (
    <span className={`inline-flex min-w-8 justify-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${urgent ? 'text-white' : 'text-[var(--text-secondary)]'}`}
      style={{ background: urgent ? 'var(--status-critical)' : 'var(--surface-0)' }}
      title={urgent ? 'Priority 1: most urgent' : `Priority ${priority}`}>
      P{priority}
    </span>
  )
}

export default function TicketTable({ tickets, onSelect, selectedId }) {
  if (!tickets.length) {
    return <p className="p-8 text-center text-sm text-[var(--text-secondary)]">No tickets here. Nice.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
          <tr>
            <th className="px-4 py-2 font-medium">Priority</th>
            <th className="px-4 py-2 font-medium">Customer</th>
            <th className="px-4 py-2 font-medium">Message</th>
            <th className="px-4 py-2 font-medium">Intent</th>
            <th className="px-4 py-2 font-medium">Sentiment</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Received</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} onClick={() => onSelect(t.id)}
              className={`cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-0)] ${selectedId === t.id ? 'bg-[var(--surface-0)]' : ''}`}>
              <td className="px-4 py-2.5"><PriorityBadge priority={t.priority} /></td>
              <td className="px-4 py-2.5">
                <p className="max-w-40 truncate font-medium" title={t.customer_email}>{t.customer_name ?? t.customer_email}</p>
                <p className="text-xs text-[var(--text-muted)]">{t.channel.replace('_', ' ')}</p>
              </td>
              <td className="max-w-xs truncate px-4 py-2.5 text-[var(--text-secondary)]" title={t.message}>{t.message}</td>
              <td className="px-4 py-2.5">{INTENT_LABELS[t.intent]}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <span aria-hidden className="mr-1">{SENTIMENT_META[t.sentiment].icon}</span>
                {SENTIMENT_META[t.sentiment].label}
              </td>
              <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
              <td className="px-4 py-2.5 whitespace-nowrap text-[var(--text-secondary)]">{timeAgo(t.received_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
