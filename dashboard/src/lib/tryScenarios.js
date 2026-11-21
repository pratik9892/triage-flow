// Preset tickets for the "Try it live" panel. The server function imports this
// same file and only accepts these customers, so a visitor can never make the
// workflow look up a real person. Emails and order IDs match supabase/seed/seed.sql
// and the demo refund data in supabase/migrations/005_refunds_priority.sql.
// "expect" follows the score table in n8n/src/03_routing.js.

export const DEMO_CUSTOMERS = [
  { email: 'aarav.mehta@example.com', name: 'Aarav Mehta', orders: 'ORD-10231, ORD-10241' },
  { email: 'priya.nair@example.com', name: 'Priya Nair', orders: 'ORD-10232, ORD-10242' },
  { email: 'rohan.kulkarni@example.com', name: 'Rohan Kulkarni', orders: 'ORD-10233, ORD-10243' },
  { email: 'sneha.iyer@example.com', name: 'Sneha Iyer', orders: 'ORD-10234, ORD-10244' },
  { email: 'kabir.singh@example.com', name: 'Kabir Singh', orders: 'ORD-10235, ORD-10245' },
  { email: 'ananya.das@example.com', name: 'Ananya Das', orders: 'ORD-10236, ORD-10246' },
  { email: 'vikram.joshi@example.com', name: 'Vikram Joshi', orders: 'ORD-10237, ORD-10247' },
  { email: 'meera.patel@example.com', name: 'Meera Patel', orders: 'ORD-10238, ORD-10248' },
  { email: 'arjun.reddy@example.com', name: 'Arjun Reddy', orders: 'ORD-10239, ORD-10249' },
  { email: 'isha.kapoor@example.com', name: 'Isha Kapoor', orders: 'ORD-10240, ORD-10250' },
]

export const SCENARIOS = [
  // ---- Needs a person, highest score first ----
  {
    key: 'refund_late',
    label: 'Refund past due date',
    channel: 'email',
    customer_email: 'meera.patel@example.com',
    message: 'I returned ORD-10248 and was told the refund would come. It still has not reached me.',
    expect: 'Needs human, P1 · 80: the refund is past its expected date (refund 60 + late 20).',
  },
  {
    key: 'cancel_not_shipped',
    label: 'Cancel before shipping',
    channel: 'whatsapp',
    customer_email: 'vikram.joshi@example.com',
    message: 'Please cancel my order ORD-10247, I ordered it by mistake.',
    expect: 'Needs human, P1 · 75: not shipped yet, so it can still be stopped (cancel 45 + not shipped 30).',
  },
  {
    key: 'damaged',
    label: 'Damaged item',
    channel: 'email',
    customer_email: 'priya.nair@example.com',
    message: 'The French press in ORD-10242 arrived broken. Please help.',
    expect: 'Needs human, P2 · 55: a person approves a replacement or refund.',
  },
  {
    key: 'not_received',
    label: '"Delivered" but not received',
    channel: 'email',
    customer_email: 'rohan.kulkarni@example.com',
    message: 'Order ORD-10233 shows delivered but I have not received it. Where is it?',
    expect: 'Needs human, P3 · 40: possible lost parcel (WISMO 15 + delivered, not received 25).',
  },
  {
    key: 'wismo_late',
    label: 'Where is my order? (late)',
    channel: 'email',
    customer_email: 'ananya.das@example.com',
    message: 'Where is my order ORD-10236? It is already late.',
    expect: 'Needs human, P4 · 30: past its expected date, so an agent chases the courier.',
  },
  // ---- Answered automatically from order data (score below 25) ----
  {
    key: 'wismo_on_time',
    label: 'Where is my order? (on time)',
    channel: 'whatsapp',
    customer_email: 'aarav.mehta@example.com',
    message: 'Hi, where is my order ORD-10241? When will it arrive?',
    expect: 'Auto-resolved · 10: on time, so a template reply with courier, tracking and date.',
  },
  {
    key: 'angry',
    label: 'Angry, but order on time',
    channel: 'instagram',
    customer_email: 'kabir.singh@example.com',
    message: 'This is the WORST service!!! Third time asking about ORD-10235. Where is it?',
    expect: 'Auto-resolved · 10: tone does not change anything. The order is on time, so the customer gets the facts.',
  },
  {
    key: 'hinglish',
    label: 'Hinglish message',
    channel: 'whatsapp',
    customer_email: 'aarav.mehta@example.com',
    message: 'Bhai mera order ORD-10241 kab aayega?',
    expect: 'Auto-resolved · 10: the AI understands Hinglish; the order is on time.',
  },
  {
    key: 'refund_on_schedule',
    label: 'Refund on schedule',
    channel: 'email',
    customer_email: 'arjun.reddy@example.com',
    message: 'When will I get my refund for the cancelled order ORD-10239?',
    expect: 'Auto-resolved · 15: the refund is not due yet, so the reply gives the date (refund 60 − on schedule 45).',
  },
  {
    key: 'refund_rto',
    label: 'Refund, parcel still returning',
    channel: 'email',
    customer_email: 'meera.patel@example.com',
    message: 'Where is my refund for ORD-10238?',
    expect: 'Auto-resolved · 15: the parcel is still on its way back, so the refund has not started yet. That is normal.',
  },
  {
    key: 'cancel_shipped_cod',
    label: 'Cancel, shipped COD',
    channel: 'whatsapp',
    customer_email: 'ananya.das@example.com',
    message: 'I want to cancel ORD-10246.',
    expect: 'Auto-resolved · 15: already shipped, but COD, so the customer just refuses the parcel and pays nothing.',
  },
  {
    key: 'product_question',
    label: 'Product question',
    channel: 'web_chat',
    customer_email: 'sneha.iyer@example.com',
    message: 'Is the Vitamin C serum OK for oily skin?',
    expect: 'Auto-resolved · 10: no product data connected yet, so the reply points to the FAQ page.',
  },
  {
    key: 'someone_elses_order',
    label: "Someone else's order",
    channel: 'email',
    customer_email: 'priya.nair@example.com',
    message: 'Can you track ORD-10231 for me?',
    expect: "Auto-resolved · 5: ORD-10231 is Aarav's order, so Priya is asked for her own order ID and sees nothing of his.",
  },
]

export const MAX_CUSTOM_MESSAGE = 300
