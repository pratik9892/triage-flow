export const INTENT_LABELS = {
  wismo: 'Where is my order',
  cancel_request: 'Cancel request',
  return_exchange: 'Return / exchange',
  refund_status: 'Refund status',
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

export const SENTIMENT_META = {
  positive: { label: 'Positive', icon: '☺' },
  neutral: { label: 'Neutral', icon: '–' },
  negative: { label: 'Negative', icon: '☹' },
  angry: { label: 'Angry', icon: '⚠' },
}

export const ORDER_STATUS_LABELS = {
  placed: 'Placed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rto_initiated: 'Returning to origin (RTO)',
  returned: 'Returned',
}

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
