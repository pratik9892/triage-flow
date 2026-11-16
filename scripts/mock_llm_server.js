// A tiny OpenAI-compatible server for testing the n8n workflow offline.
// It classifies with keyword rules and writes template replies, so the whole
// pipeline can be tested without an API key or rate limits.
//
// Run:   node scripts/mock_llm_server.js          (listens on :8787)
// In n8n, point the "LLM (OpenAI-compatible)" credential's Base URL to
// http://localhost:8787/v1 with any API key.
//
// Send a message containing "SIMULATE_LLM_DOWN" to make it return HTTP 500,
// which tests the workflow's fallback path.
import http from 'node:http'

const PORT = Number(process.env.PORT ?? 8787)

function classify(text) {
  const t = text.toLowerCase()
  const has = (...w) => w.some((x) => t.includes(x))
  let intent = 'other'
  if (has('cancel')) intent = 'cancel_request'
  else if (has('damaged', 'broken', 'leak', 'wrong item')) intent = 'damaged_or_wrong_item'
  else if (has('refund')) intent = 'refund_status'
  else if (has('exchange', 'return')) intent = 'return_exchange'
  else if (has('deducted', 'charged twice', 'payment')) intent = 'payment_issue'
  else if (has('where is', 'track', 'not received', 'kab aayega', 'delivery', 'order status', 'update on my order')) intent = 'wismo'
  else if (has('worst', 'pathetic', 'consumer court')) intent = 'complaint'
  else if (has('?')) intent = 'product_query'

  const angry = has('worst', 'pathetic', '!!!', 'consumer court', 'fraud')
  const sentiment = angry ? 'angry' : has('please', 'thanks') ? 'neutral' : has('not happy', 'disappointed') ? 'negative' : 'neutral'
  const m = text.match(/ORD[-\s]?(\d{4,})/i)
  return {
    intent,
    sentiment,
    urgency: angry ? 'high' : intent === 'product_query' ? 'low' : 'medium',
    confidence: has('hmm', 'not sure') ? 0.55 : 0.9,
    order_id: m ? `ORD-${m[1]}` : null,
    summary: `Customer message classified as ${intent}.`,
  }
}

function reply(prompt) {
  const mode = prompt.match(/MODE: (\w+)/)?.[1]
  const name = prompt.match(/CUSTOMER FIRST NAME: (.+)/)?.[1]?.trim()
  const brand = prompt.match(/BRAND: (.+)/)?.[1]?.trim()
  const factsRaw = prompt.match(/ORDER FACTS: (.+)/)?.[1]
  let facts = null
  try { facts = JSON.parse(factsRaw) } catch { /* no order */ }
  const hi = `Hi ${name && name !== 'unknown' ? name : 'there'},`
  if (mode === 'auto_status' && facts) {
    return `${hi} your order ${facts.order_id} is ${facts.status.replaceAll('_', ' ')}` +
      (facts.courier ? ` with ${facts.courier} (tracking ${facts.tracking_number})` : '') +
      (facts.expected_delivery ? ` and should reach you by ${facts.expected_delivery}` : '') + `. Team ${brand}`
  }
  if (mode === 'ask_order_id') return `${hi} we couldn't find an order on this email. Could you share your order ID (like ORD-12345)? Team ${brand}`
  return `${hi} sorry about this. Our team is looking into it and will update you shortly. Team ${brand}`
}

http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const send = (code, obj) => {
      res.writeHead(code, { 'content-type': 'application/json' })
      res.end(JSON.stringify(obj))
    }
    if (req.url.endsWith('/models')) return send(200, { data: [{ id: 'mock-model', object: 'model' }] })
    if (!req.url.endsWith('/chat/completions')) return send(404, { error: { message: 'not found' } })

    const payload = JSON.parse(body || '{}')
    const system = payload.messages?.find((m) => m.role === 'system')?.content ?? ''
    const user = payload.messages?.filter((m) => m.role === 'user').map((m) => m.content).join('\n') ?? ''
    if (user.includes('SIMULATE_LLM_DOWN')) return send(500, { error: { message: 'mock outage' } })

    const isClassifier = system.includes('triage engine')
    const message = user.split('"""')[1] ?? user
    const content = isClassifier ? JSON.stringify(classify(message)) : reply(user)
    console.log(`[mock-llm] ${isClassifier ? 'classify' : 'reply'} -> ${content.slice(0, 90)}`)
    send(200, {
      id: 'chatcmpl-mock', object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: payload.model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    })
  })
}).listen(PORT, () => console.log(`mock LLM listening on http://localhost:${PORT}/v1`))
