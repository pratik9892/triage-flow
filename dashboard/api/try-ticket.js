// Vercel serverless function: POST /api/try-ticket
//
// Lets a signed-in visitor send a demo ticket through the real n8n pipeline.
// It runs on Vercel's server, never in the browser, which is why it can hold
// the webhook secret. Guard rails, in order:
//   1. Only signed-in users (e.g. the demo account) can call it.
//   2. Only the demo customers from src/lib/tryScenarios.js are allowed, so
//      nobody can make the workflow look up a real person.
//   3. A global hourly limit protects the free LLM quota (the demo account is
//      shared by every visitor, so the limit is for everyone together).
//
// Environment variables (Vercel -> Settings -> Environment Variables):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (already set for the dashboard)
//   N8N_WEBHOOK_URL      https://<your-n8n>/webhook/support-ticket
//   N8N_WEBHOOK_SECRET   the Header Auth value (no VITE_ prefix: stays secret)
//   TRY_LIMIT_PER_HOUR   optional, default 20
import { createClient } from '@supabase/supabase-js'
import { DEMO_CUSTOMERS, MAX_CUSTOM_MESSAGE, SCENARIOS } from '../src/lib/tryScenarios.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
const LIMIT = Number(process.env.TRY_LIMIT_PER_HOUR ?? 20)

// Supabase client that acts as the signed-in visitor, so Row Level Security
// applies exactly as it does in the browser.
function clientFor(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// How many "try it" tickets were sent in the last hour (by everyone).
// Their message IDs start with "try-", so external_id looks like "email:try-...".
async function triesLastHour(db) {
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count, error } = await db
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .like('external_id', '%:try-%')
    .gte('processed_at', since)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !process.env.N8N_WEBHOOK_URL || !process.env.N8N_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Server is not configured (missing environment variables).' })
  }

  // 1. Who is calling?
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Please sign in first.' })
  const db = clientFor(token)
  const { data: auth, error: authError } = await db.auth.getUser(token)
  if (authError || !auth?.user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })

  // 2. What do they want to send?
  const body = req.body ?? {}
  let ticket
  if (body.scenario) {
    const s = SCENARIOS.find((x) => x.key === body.scenario)
    if (!s) return res.status(400).json({ error: 'Unknown scenario.' })
    ticket = { channel: s.channel, customer_email: s.customer_email, message: s.message }
  } else {
    const customer = DEMO_CUSTOMERS.find((c) => c.email === body.customer_email)
    const message = String(body.message ?? '').trim()
    if (!customer) return res.status(400).json({ error: 'Pick one of the demo customers.' })
    if (message.length < 3 || message.length > MAX_CUSTOM_MESSAGE) {
      return res.status(400).json({ error: `Message must be 3 to ${MAX_CUSTOM_MESSAGE} characters.` })
    }
    ticket = { channel: 'web_chat', customer_email: customer.email, message }
  }
  const customer = DEMO_CUSTOMERS.find((c) => c.email === ticket.customer_email)

  // 3. Quota check
  let used
  try {
    used = await triesLastHour(db)
  } catch (e) {
    return res.status(500).json({ error: `Could not check the usage limit: ${e.message}` })
  }
  if (used >= LIMIT) {
    return res.status(429).json({ error: `The live demo is limited to ${LIMIT} tickets per hour to protect the free AI quota. Please try again later.`, remaining: 0 })
  }

  // 4. Send it through the real n8n webhook
  const messageId = `try-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  try {
    const r = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET },
      body: JSON.stringify({ message_id: messageId, customer_name: customer.name, ...ticket }),
      signal: AbortSignal.timeout(50_000),
    })
    const text = await r.text()
    let result
    try { result = JSON.parse(text) } catch { result = { raw: text.slice(0, 300) } }
    if (!r.ok) {
      return res.status(502).json({ error: `The workflow returned HTTP ${r.status}. The free AI quota may be used up; try again in a minute.`, details: result })
    }
    return res.status(200).json({ ...result, remaining: Math.max(0, LIMIT - used - 1) })
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    return res.status(504).json({
      error: timedOut ? 'The workflow took more than 50 seconds. The server may be busy; try again.' : 'Could not reach the workflow server.',
    })
  }
}