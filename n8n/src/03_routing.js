// Node: "Routing rules"  (Code node, run once for all items)
//
// The AI only labels the message (intent, order ID, confidence). Everything
// here is plain code that reads live order data:
//
//   score = intent base + fact adjustment   (+ problem, - everything on track)
//   score below AUTO_LINE  -> automatic template reply, never in the queue
//   score AUTO_LINE or more -> a person, queue sorted by score, then oldest
//
// Tone is not used. Change a number in CONFIG, not in the rules below.

// ---------------- CONFIG: every score lives here ----------------
const AUTO_LINE = 25;

const BASE = {
  refund: 60,          // the customer's own money
  damaged: 55,         // paid, product broken, needs a decision
  cancel: 45,          // can cost shipping both ways if missed
  wismo: 15,           // information
  question: 10,        // product question / other
  anything_else: 30,   // return, complaint, payment, AI unavailable...
};

const ADJUST = {
  refund_late: +20,               // 80: expected date passed, or never started
  refund_on_schedule: -45,        // 15: expected date not passed yet
  refund_waiting_for_rto: -45,    // 15: parcel still on its way back
  cancel_not_shipped: +30,        // 75: window closes within hours
  cancel_shipped_cod: -30,        // 15: refuse the parcel, nothing paid
  cancel_cannot_stop: 0,          // 45: shipped prepaid or delivered
  wismo_delivered_not_received: +25, // 40: possible lost parcel
  wismo_late: +15,                // 30: past expected delivery date
  wismo_on_time: -5,              // 10
};

const FIXED = {
  no_matching_order: 5,  // order ID + email don't match: ask for their own
  too_vague: 5,          // AI confidence below MIN_CONFIDENCE
};

const MIN_CONFIDENCE = 0.7;
// ----------------------------------------------------------------

const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10); // India date

function toPriority(score) {
  if (score >= 70) return 1;
  if (score >= 55) return 2;
  if (score >= 40) return 3;
  if (score >= 25) return 4;
  return 5;
}

// Each rule returns { base, adjust, label, reply }.
// reply = the template key used when the score is below AUTO_LINE.
const rule = (base, adjust, label, reply = null) => ({ base, adjust, label, reply });
const fixed = (score, label, reply) => ({ fixedScore: score, label, reply });

function decide(ai, order) {
  if (ai.failed) return rule('anything_else', null, 'AI unavailable: a person reads it');
  if (ai.confidence < MIN_CONFIDENCE) return fixed(FIXED.too_vague, 'Message too vague: asked for details', 'ask_details');

  if (ai.intent === 'product_query' || ai.intent === 'other') {
    return rule('question', null, 'Question we cannot answer from data yet: sent FAQ link', 'faq');
  }

  const orderIntents = ['wismo', 'cancel_request', 'refund_status', 'damaged_or_wrong_item'];
  if (orderIntents.includes(ai.intent) && !order) {
    return fixed(FIXED.no_matching_order, 'No order matches this email: asked for their own order ID', 'ask_order_id');
  }

  switch (ai.intent) {
    case 'wismo': {
      if (order.status === 'delivered') return rule('wismo', 'wismo_delivered_not_received', 'Marked delivered but customer says not received');
      if (['cancelled', 'rto_initiated', 'returned'].includes(order.status)) {
        return rule('anything_else', null, `Order is ${order.status.replace('_', ' ')}: a person explains`);
      }
      if (order.expected_on && order.expected_on < today) return rule('wismo', 'wismo_late', 'Past expected delivery date: chase the courier');
      return rule('wismo', 'wismo_on_time', 'On time: sent status from order data', 'wismo_on_time');
    }

    case 'cancel_request': {
      // Step 1: has it shipped?  Step 2: COD or prepaid?
      if (['placed', 'packed'].includes(order.status)) return rule('cancel', 'cancel_not_shipped', 'Not shipped yet: cancel before dispatch');
      if (['shipped', 'out_for_delivery'].includes(order.status)) {
        if (order.payment_method === 'cod') return rule('cancel', 'cancel_shipped_cod', 'Shipped COD: told to refuse the parcel', 'cancel_shipped_cod');
        return rule('cancel', 'cancel_cannot_stop', 'Shipped prepaid: refuse delivery, refund after it returns');
      }
      if (order.status === 'delivered') return rule('cancel', 'cancel_cannot_stop', 'Already delivered: handle as a return');
      return rule('anything_else', null, `Order is ${order.status.replace('_', ' ')}: a person checks`);
    }

    case 'refund_status': {
      // Step 1: has a refund started?  Step 2: is the expected date passed?
      if (order.refund_status === 'initiated') {
        if (order.refund_due_on && order.refund_due_on >= today) {
          return rule('refund', 'refund_on_schedule', `Refund on schedule, due ${order.refund_due_on}`, 'refund_on_schedule');
        }
        return rule('refund', 'refund_late', `Refund past its expected date (${order.refund_due_on})`);
      }
      if (order.status === 'rto_initiated') {
        return rule('refund', 'refund_waiting_for_rto', 'Parcel still coming back: refund starts when it arrives', 'refund_waiting_for_rto');
      }
      const owed = order.status === 'returned' || (order.status === 'cancelled' && order.payment_method === 'prepaid');
      if (owed) return rule('refund', 'refund_late', 'Refund never started');
      return rule('anything_else', null, 'Refund question with no refund due: a person checks');
    }

    case 'damaged_or_wrong_item':
      return rule('damaged', null, 'Damaged or wrong item: a person approves replacement or refund');

    default: // return_exchange, complaint, payment_issue
      return rule('anything_else', null, `${ai.intent.replaceAll('_', ' ')}: a person handles it`);
  }
}

const item = $input.first();
const base = $('Merge AI result').first().json;
{
  // "Lookup order" emits an empty item when nothing matched (Always Output Data).
  const order = item.json.order_id ? item.json : null;
  const r = decide(base.ai, order);

  let score, breakdown;
  if (r.fixedScore !== undefined) {
    score = r.fixedScore;
    breakdown = `fixed ${score}`;
  } else {
    const b = BASE[r.base];
    const a = r.adjust ? ADJUST[r.adjust] : 0;
    score = Math.max(0, Math.min(100, b + a));
    breakdown = `${r.base} ${b}` + (r.adjust ? ` ${a >= 0 ? '+' : '-'} ${r.adjust} ${Math.abs(a)}` : '');
  }

  // Auto only if the score is below the line AND we have a template for it.
  const auto = score < AUTO_LINE && Boolean(r.reply);

  const decision = {
    status: auto ? 'auto_resolved' : 'needs_human',
    reply_mode: auto ? r.reply : null,
    priority_score: score,
    priority: toPriority(score),
    reason: `${r.label}. Score ${score} = ${breakdown}`,
  };
  return [{ json: { ...base, order, decision } }];
}
