export const INTENT_LABELS = {
  wismo: 'Where is my order',
  cancel_request: 'Cancel request',
  return_exchange: 'Return / exchange',
  refund_status: 'Refund',
  damaged_or_wrong_item: 'Damaged / wrong item',
  payment_issue: 'Payment issue',
  product_query: 'Product question',
  complaint: 'Complaint',
  other: 'Other',
}

export const STATUS_META = {
  auto_resolved: { label: 'Auto-resolved', color: 'var(--status-good)', icon: '✓' },
  needs_human: { label: 'Needs human', color: 'var(--status-warning)', icon: '!' },
  resolved: { label: 'Resolved', color: 'var(--text-secondary)', icon: '✓' },
}

export const ORDER_STATUS_LABELS = {
  placed: 'Placed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rto_initiated: 'RTO (returning)',
  returned: 'Returned',
}

// Target time for a first reply, by priority level. Used for the
// "Reply due" countdown; it does not change the score.
export const REPLY_TARGET_HOURS = { 1: 1, 2: 4, 3: 8, 4: 24, 5: 48 }

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function timeAgo(iso) {
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  return rtf.format(Math.round(diffSec / 86400), 'day')
}

export function formatDuration(seconds) {
  if (seconds == null) return '–'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  return `${(seconds / 3600).toFixed(1)} h`
}

export const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export const shortDay = (isoDate) =>
  new Date(isoDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

// ---------- Dates in India time ----------
const IST_OFFSET_MS = 330 * 60_000
export const todayIST = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10)
const dateIST = (iso) => new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
const daysBetween = (from, to) => Math.round((new Date(to) - new Date(from)) / 86_400_000)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// Is the order past its expected delivery date and still not delivered?
export function isOrderLate(order) {
  if (!order?.expected_delivery) return false
  if (['delivered', 'cancelled', 'rto_initiated', 'returned'].includes(order.status)) return false
  return order.expected_delivery < todayIST()
}

// What the "Expected delivery" column shows for an order.
// tone: 'late' | 'today' | null
export function deliveryInfo(order) {
  if (!order) return null
  if (order.status === 'delivered') {
    return { main: order.delivered_at ? `Delivered ${shortDay(dateIST(order.delivered_at))}` : 'Delivered', sub: null, tone: null }
  }
  if (order.status === 'cancelled') return { main: 'Cancelled', sub: null, tone: null }
  if (order.status === 'rto_initiated') return { main: 'Coming back', sub: 'Returning to warehouse', tone: null }
  if (order.status === 'returned') return { main: 'Returned', sub: 'Back at warehouse', tone: null }
  if (!order.expected_delivery) return { main: '–', sub: null, tone: null }

  const diff = daysBetween(todayIST(), order.expected_delivery)
  const sub = ['placed', 'packed'].includes(order.status) ? 'Not shipped yet' : 'In transit'
  if (diff < 0) return { main: shortDay(order.expected_delivery), sub, tag: `${plural(-diff, 'day')} late`, tone: 'late' }
  if (diff === 0) return { main: shortDay(order.expected_delivery), sub, tag: 'Today', tone: 'today' }
  return { main: shortDay(order.expected_delivery), sub, tone: null }
}

function shortDuration(ms) {
  const m = Math.max(1, Math.round(ms / 60_000))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
  return h % 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${Math.floor(h / 24)}d`
}

// Countdown to the reply target for a ticket waiting for a person.
// tone: 'overdue' | 'soon' | null
export function replyDue(ticket, now = Date.now()) {
  if (ticket.status !== 'needs_human') return null
  const targetMs = (REPLY_TARGET_HOURS[ticket.priority] ?? 24) * 3600_000
  const left = new Date(ticket.received_at).getTime() + targetMs - now
  if (left < 0) return { label: `Overdue ${shortDuration(-left)}`, tone: 'overdue' }
  return { label: `${shortDuration(left)} left`, tone: left < targetMs / 4 ? 'soon' : null }
}

export const ordinal = (n) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${s}`
}
