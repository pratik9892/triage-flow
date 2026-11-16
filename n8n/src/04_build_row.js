// Node: "Build ticket row"  (Code node, run once for all items)
// Picks the reply text (LLM draft, or a safe template if the LLM failed)
// and shapes the exact row the database expects.

function fallbackReply(t, decision, order) {
  const name = t.customer_name ? t.customer_name.split(' ')[0] : 'there';
  if (decision.reply_mode === 'ask_order_id') {
    return `Hi ${name}, thanks for reaching out! We couldn't find an order linked to this email. ` +
      `Could you share your order ID (it looks like ORD-12345)? We'll check its status right away.`;
  }
  if (decision.reply_mode === 'auto_status' && order) {
    return `Hi ${name}, your order ${order.order_id} is currently ${order.status.replaceAll('_', ' ')}` +
      (order.courier ? ` with ${order.courier} (tracking number ${order.awb})` : '') +
      (order.expected_on ? `, expected by ${order.expected_on}` : '') + '. Thanks for your patience!';
  }
  return null; // agent writes it
}

// Keep in sync with the model set on the "Model: classifier" node.
const MODEL_NAME = 'llama-3.3-70b-versatile';

const item = $input.first();
const ctx = $('Routing rules').first().json;
{
  const { ticket: t, ai, order, decision } = ctx;

  const llmText = typeof item.json.text === 'string' ? item.json.text.trim() : '';
  const replyFailed = !llmText || Boolean(item.json.error);
  let draft = replyFailed ? fallbackReply(t, decision, order) : llmText;

  // Never auto-send something we could not generate safely.
  let status = decision.status;
  let reason = decision.reason;
  if (status === 'auto_resolved' && !draft) {
    status = 'needs_human';
    reason = 'Reply generation failed: routed to a person';
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
        routing_reason: reason,
        draft_reply: draft,
        processing_ms: Date.now() - ctx.started_at,
        model: MODEL_NAME,
        ai_failed: ai.failed,
      },
    },
  }];
}
