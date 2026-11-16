// Node: "Merge AI result"  (Code node, run once for all items)
// Parses and validates the classifier's JSON, then combines it with the
// validated ticket. If the LLM call failed (rate limit, timeout, invalid
// JSON), the ticket still goes through, marked ai_failed, and the routing
// step sends it to a person.
//
// Why parse here instead of n8n's Structured Output Parser node? That node
// requires the model to wrap its answer in an extra {"output": ...} key, and
// smaller models sometimes skip it. JSON mode + validation in code works
// the same with OpenAI, Groq, Gemini or a local model.

const INTENTS = ['wismo', 'cancel_request', 'return_exchange', 'refund_status',
  'damaged_or_wrong_item', 'payment_issue', 'product_query', 'complaint', 'other'];
const SENTIMENTS = ['positive', 'neutral', 'negative', 'angry'];
const URGENCIES = ['low', 'medium', 'high'];
const ORDER_ID_RE = /\bORD[-\s]?(\d{4,})\b/i;

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const normaliseOrderId = (text) => {
  const m = String(text ?? '').match(ORDER_ID_RE);
  return m ? `ORD-${m[1]}` : null;
};

// One webhook call = one ticket = one item, so .first() is safe here.
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
        error: aiFailed ? String(item.json.error ?? 'Model did not return valid JSON').slice(0, 300) : null,
        intent: aiFailed ? 'other' : oneOf(ai.intent, INTENTS, 'other'),
        sentiment: aiFailed ? 'neutral' : oneOf(ai.sentiment, SENTIMENTS, 'neutral'),
        urgency: aiFailed ? 'medium' : oneOf(ai.urgency, URGENCIES, 'medium'),
        confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
        summary: aiFailed ? null : String(ai.summary ?? '').slice(0, 300),
        order_id: orderId,
      },
    },
  }];
}
