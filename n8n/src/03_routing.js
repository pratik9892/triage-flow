// Node: "Routing rules"  (Code node, run once for all items)
// The guardrail layer. The LLM only *classifies*; plain, testable code
// decides what is safe to answer automatically. That keeps the risky
// decisions (refunds, angry customers, delayed orders) with people.

// Today's date in India (UTC+05:30), as YYYY-MM-DD
const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

function route(ai, order) {
  const r = { status: 'needs_human', priority: 3, reason: '', reply_mode: 'agent_draft' };

  if (ai.failed) return { ...r, priority: 2, reason: 'AI step failed: routed to a person' };
  if (ai.sentiment === 'angry') return { ...r, priority: 1, reason: 'Angry customer: route to a person' };
  if (ai.confidence < 0.7) return { ...r, reason: `Low model confidence (${ai.confidence.toFixed(2)})` };

  switch (ai.intent) {
    case 'wismo': {
      if (!order) {
        return { status: 'auto_resolved', priority: 5, reply_mode: 'ask_order_id',
          reason: 'WISMO with no matching order: asked the customer for the order ID' };
      }
      if (['cancelled', 'rto_initiated', 'returned'].includes(order.status)) {
        return { ...r, priority: 2, reason: `Order is ${order.status}: needs an agent to explain` };
      }
      const delayed = order.status !== 'delivered' && order.expected_on && order.expected_on < today;
      if (delayed) {
        return { ...r, priority: 2, reason: 'Order is past its expected delivery date: agent should chase the courier' };
      }
      if (order.status === 'delivered') {
        return { ...r, priority: 2, reason: 'Courier says delivered but customer is asking: possible lost parcel' };
      }
      return { status: 'auto_resolved', priority: 5, reply_mode: 'auto_status',
        reason: 'Routine WISMO with live order data: auto-replied' };
    }
    case 'cancel_request': {
      const beforeDispatch = order && ['placed', 'packed'].includes(order.status);
      return { ...r, priority: beforeDispatch ? 2 : 3,
        reason: beforeDispatch ? 'Cancel before dispatch: act fast to save shipping cost' : 'Cancellation needs an agent' };
    }
    case 'damaged_or_wrong_item':
    case 'payment_issue':
      return { ...r, priority: 2, reason: `Intent '${ai.intent}' involves money or replacement: agent decides` };
    case 'complaint':
      return { ...r, priority: 2, reason: 'Complaint: agent should respond personally' };
    case 'product_query':
      return { ...r, priority: 4, reason: 'No product knowledge base connected: agent checks the draft' };
    default:
      return { ...r, reason: `Intent '${ai.intent}' needs a human decision` };
  }
}

const item = $input.first();
const base = $('Merge AI result').first().json;
{
  // "Lookup order" emits an empty item when nothing matched (Always Output Data).
  const order = item.json.order_id ? item.json : null;
  const decision = route(base.ai, order);

  // High urgency can only raise priority, never lower it.
  if (base.ai.urgency === 'high') decision.priority = Math.min(decision.priority, 2);

  return [{ json: { ...base, order, decision } }];
}
