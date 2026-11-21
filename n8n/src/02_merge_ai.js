// Node: "Merge AI result"  (Code node, run once for all items)
// Parses and validates the classifier's JSON, then combines it with the
// validated ticket. The AI returns only 4 fields: intent, confidence,
// order_id and summary. Tone and urgency are not used anywhere.
//
// If the LLM call failed (rate limit, timeout, invalid JSON), the ticket
// still goes through, marked ai_failed, and the routing step sends it to a
// person. No guessing.
//
// Why parse here instead of n8n's Structured Output Parser node? That node
// requires the model to wrap its answer in an extra {"output": ...} key, and
// smaller models sometimes skip it. JSON mode + validation in code works
// the same with OpenAI, Groq, Gemini or a local model.

const INTENTS = ['wismo', 'cancel_request', 'return_exchange', 'refund_status',
  'damaged_or_wrong_item', 'payment_issue', 'product_query', 'complaint', 'other'];
const ORDER_ID_RE = /\bORD[-\s]?(\d{4,})\b/i;

const normaliseOrderId = (text) => {
  const m = String(text ?? '').match(ORDER_ID_RE);
  return m ? `ORD-${m[1]}` : null;
};

function parseModelJson(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    // Accept {"output": {...}} too, in case a model wraps its answer.
    const obj = parsed && typeof parsed.output === 'object' ? parsed.output : parsed;
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

// One webhook call = one ticket = one item, so .first() is safe here.
const item = $input.first();
const base = $('Validate & normalise').first().json;
{
  // In JSON mode the chain node usually parses the JSON itself and returns
  // the fields directly; otherwise it returns the raw string in "text".
  const raw = item.json;
  const ai = raw.error ? null
    : typeof raw.text === 'string' ? parseModelJson(raw.text)
    : raw.output && typeof raw.output === 'object' ? raw.output
    : raw;
  const aiFailed = !ai || !INTENTS.includes(ai.intent);

  // Prefer the ID the model found, but fall back to a regex on the raw
  // message: a deterministic check is cheaper and never hallucinates.
  const orderId = normaliseOrderId(ai?.order_id) ?? normaliseOrderId(base.ticket.message);

  const confidence = Number(ai?.confidence);
  return [{
    json: {
      ...base,
      ai: {
        failed: aiFailed,
        error: aiFailed ? String(raw.error ?? 'Model did not return valid JSON').slice(0, 300) : null,
        intent: aiFailed ? 'other' : ai.intent,
        confidence: aiFailed ? 0 : (Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0),
        summary: aiFailed ? null : String(ai.summary ?? '').slice(0, 300),
        order_id: orderId,
        // Not used for routing or shown in the UI. Fixed values only because
        // the tickets table still has these columns.
        sentiment: 'neutral',
        urgency: 'medium',
      },
    },
  }];
}
