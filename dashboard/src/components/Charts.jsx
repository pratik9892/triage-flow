import {
  Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis,
} from 'recharts'
import { INTENT_LABELS, shortDay } from '../lib/format'

// Two series everywhere: auto-resolved (slot 1, blue) and human (slot 2, orange).
// Each keeps its colour in both charts, a legend names them, and segments are
// separated by a 2px surface-coloured stroke so stacked fills never touch.
const SERIES = [
  { key: 'auto_resolved', name: 'Auto-resolved', color: 'var(--series-auto)' },
  { key: 'human', name: 'Handled by agent', color: 'var(--series-human)' },
]

const axisProps = {
  tick: { fill: 'var(--text-secondary)', fontSize: 12 },
  axisLine: { stroke: 'var(--grid)' },
  tickLine: false,
}

function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
      <div className="mt-4 h-72">{children}</div>
    </section>
  )
}

function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-[var(--text-secondary)]">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-[var(--text-primary)] tabular-nums">{p.value}</span>
        </p>
      ))}
      <p className="mt-1 border-t border-[var(--border)] pt-1 text-[var(--text-secondary)]">
        Total: <span className="font-medium text-[var(--text-primary)]">{total}</span>
      </p>
    </div>
  )
}

const legend = (
  <Legend
    iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }}
    formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
  />
)

export function DailyChart({ data }) {
  const rows = data.map((d) => ({ day: d.day, auto_resolved: d.auto_resolved, human: d.total - d.auto_resolved }))
  return (
    <Card title="Tickets per day" subtitle="Last 14 days, India time">
        <BarChart responsive style={{ width: '100%', height: '100%' }} data={rows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="day" tickFormatter={shortDay} interval="preserveStartEnd" minTickGap={16} {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
          <Tooltip content={<ChartTooltip labelFormatter={shortDay} />} cursor={{ fill: 'var(--surface-0)' }} />
          {legend}
          {SERIES.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color}
              stroke="var(--surface-1)" strokeWidth={2} maxBarSize={28}
              radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0} />
          ))}
        </BarChart>
    </Card>
  )
}

export function IntentChart({ data }) {
  const rows = data.map((d) => ({ intent: INTENT_LABELS[d.intent] ?? d.intent, auto_resolved: d.auto_resolved, human: d.human }))
  return (
    <Card title="Tickets by intent" subtitle="What customers write in about, and who handles it">
        <BarChart responsive style={{ width: '100%', height: '100%' }} data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" allowDecimals={false} {...axisProps} />
          <YAxis type="category" dataKey="intent" width={150} {...axisProps} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-0)' }} />
          {legend}
          {SERIES.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color}
              stroke="var(--surface-1)" strokeWidth={2} maxBarSize={22}
              radius={i === SERIES.length - 1 ? [0, 4, 4, 0] : 0} />
          ))}
        </BarChart>
    </Card>
  )
}
