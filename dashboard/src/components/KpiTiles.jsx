import { formatDuration } from '../lib/format'

function Tile({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? '–'}</p>
      {hint && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  )
}

export default function KpiTiles({ kpis }) {
  const k = kpis ?? {}
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile label="Tickets today" value={k.tickets_today} hint={`${k.total_tickets ?? '–'} in total`} />
      <Tile label="Auto-resolution rate" value={k.auto_resolution_pct != null ? `${k.auto_resolution_pct}%` : null} hint="Answered without an agent" />
      <Tile label="Open human queue" value={k.open_human_queue} hint="Waiting for an agent" />
      <Tile label="Avg auto-response" value={formatDuration(k.avg_auto_response_sec)} hint="Received → reply drafted" />
      <Tile label="Avg human resolution" value={k.avg_human_resolution_min != null ? formatDuration(k.avg_human_resolution_min * 60) : null} hint="Received → resolved" />
      <Tile label="WISMO share" value={k.wismo_pct != null ? `${k.wismo_pct}%` : null} hint="“Where is my order” tickets" />
    </div>
  )
}
