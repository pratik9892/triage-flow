// Node: "Build ticket row"  (Code node, run once for all items)
// Fills the reply template for automatic tickets and shapes the exact row
// the database expects. No AI here: templates are filled only from order
// data, so the reply never invents a date or promises anything.
// Tickets for a person get no draft; the agent writes the reply.

// Replace with the brand's real FAQ page.
const FAQ_URL = 'https://example.com/faq';

const fmtDate = (d) => (d
  ? new Date(`${String(d).slice(0, 10)}T00:00:00+05:30`)
      .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
  : null);
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function templateReply(mode, t, order) {
  const name = (t.customer_name ?? order?.customer_name ?? '').split(' ')[0] || 'there';
  const sign = `\n\nTeam ${order?.brand ?? 'Support'}`;
  const o = order;

  const T = {
    wismo_on_time: () => `Hi ${name}, your order ${o.order_id} is ${o.status.replaceAll('_', ' ')}` +
      (o.courier ? ` with ${o.courier} (tracking number ${o.awb})` : '') +
      (o.expected_on ? ` and is expected by ${fmtDate(o.expected_on)}` : '') + '.',
    cancel_shipped_cod: () => `Hi ${name}, your order ${o.order_id} has already shipped, so it can't be cancelled now. ` +
      'As it is Cash on Delivery, please refuse the parcel when it arrives. You will not be charged anything.',
    refund_on_schedule: () => `Hi ${name}, your refund` +
      (o.refund_amount ? ` of ${rupees(o.refund_amount)}` : '') +
      ` for order ${o.order_id} has been started and should reach you by ${fmtDate(o.refund_due_on)}.`,
    refund_waiting_for_rto: () => `Hi ${name}, your order ${o.order_id} is on its way back to our warehouse. ` +
      'Your refund will start as soon as it arrives, and we will confirm it with you.',
    faq: () => `Hi ${name}, thanks for your message! You'll find product details, ingredients and delivery areas at ${FAQ_URL}`,
    ask_details: () => `Hi ${name}, could you tell us a bit more about what you need help with? ` +
      'If it is about an order, please share your order ID (it looks like ORD-12345).',
    ask_order_id: () => `Hi ${name}, we couldn't find that order linked to this email. ` +
      'Could you share the order ID from your confirmation message (it looks like ORD-12345)?',
  };
  return T[mode] ? T[mode]() + sign : null;
}

// Keep in sync with the model set on the "Model: classifier" node.
const MODEL_NAME = 'llama-3.3-70b-versatile';

const ctx = $input.first().json;
{
  const { ticket: t, ai, order, decision } = ctx;

  let status = decision.status;
  let reason = decision.reason;
  const draft = status === 'auto_resolved' ? templateReply(decision.reply_mode, t, order) : null;

  // Never auto-resolve without a reply.
  if (status === 'auto_resolved' && !draft) {
    status = 'needs_human';
    reason = `Reply template missing: routed to a person. ${reason}`;
  }

  return [{
    json: {
      row: {
        external_id: t.external_id,
        channel: t.channel,
        customer_email: t.customer_email,
        customer_name: t.customer_name ?? order?.customer_name ?? null,
        subject: t.subject,
        message: t.message,
        received_at: t.received_at,
        intent: ai.intent,
        sentiment: ai.sentiment,
        urgency: ai.urgency,
        confidence: Number(ai.confidence.toFixed(2)),
        extracted_order_id: ai.order_id,
        ai_summary: ai.summary,
        order_id: order?.order_id ?? null,
        status,
        priority: decision.priority,
        priority_score: decision.priority_score,
        routing_reason: reason,
        draft_reply: draft,
        processing_ms: Date.now() - ctx.started_at,
        model: MODEL_NAME,
        ai_failed: ai.failed,
      },
    },
  }];
}
