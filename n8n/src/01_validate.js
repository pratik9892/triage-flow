// Node: "Validate & normalise"  (Code node, run once for all items)
// Turns the raw webhook body into a clean ticket object, or a list of
// validation errors. Nothing downstream should have to re-check inputs.

const CHANNELS = ['email', 'whatsapp', 'web_chat', 'instagram'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_CHARS = 4000; // caps LLM cost per ticket

// Small deterministic hash (FNV-1a) so a ticket without a message_id still
// gets a stable idempotency key. Code nodes can't import 'crypto' by default.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

return $input.all().map((item) => {
  const body = item.json.body ?? {};
  const errors = [];

  const email = String(body.customer_email ?? '').trim().toLowerCase();
  const message = String(body.message ?? '').trim();
  const channel = CHANNELS.includes(body.channel) ? body.channel : 'email';

  if (!EMAIL_RE.test(email)) errors.push('customer_email is missing or invalid');
  if (message.length < 3) errors.push('message is missing or too short');

  let receivedAt = new Date(body.received_at ?? Date.now());
  if (Number.isNaN(receivedAt.getTime()) || receivedAt.getTime() > Date.now() + 60_000) {
    receivedAt = new Date(); // bad or future timestamp: trust our clock instead
  }

  // Same message delivered twice (webhook retries) -> same external_id.
  const externalId = body.message_id
    ? `${channel}:${String(body.message_id).slice(0, 200)}`
    : `${channel}:hash:${fnv1a(email + '|' + message + '|' + receivedAt.toISOString().slice(0, 16))}`;

  return {
    json: {
      valid: errors.length === 0,
      errors,
      started_at: Date.now(),
      ticket: {
        external_id: externalId,
        channel,
        customer_email: email,
        customer_name: body.customer_name ? String(body.customer_name).trim().slice(0, 120) : null,
        subject: body.subject ? String(body.subject).trim().slice(0, 200) : null,
        message: message.slice(0, MAX_MESSAGE_CHARS),
        received_at: receivedAt.toISOString(),
      },
    },
  };
});
