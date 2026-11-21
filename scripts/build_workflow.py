"""Assemble the importable n8n workflow JSON files from n8n/src/.

Code-node logic and prompts live in separate files so they can be read,
diffed and reviewed like normal code. Re-run after editing anything in
n8n/src:  python3 scripts/build_workflow.py
"""
import json
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "n8n" / "src"
read = lambda name: (SRC / name).read_text()
uid = lambda name: str(uuid.uuid5(uuid.NAMESPACE_URL, "triageflow/" + name))

MODEL = "llama-3.3-70b-versatile"  # Groq free tier; keep in sync with 04_build_row.js
CRED_PG = {"postgres": {"id": "TfPostgres000001", "name": "Supabase Postgres"}}
CRED_LLM = {"openAiApi": {"id": "TfLlmApi00000001", "name": "LLM (OpenAI-compatible)"}}
CRED_HOOK = {"httpHeaderAuth": {"id": "TfWebhookAuth001", "name": "TriageFlow webhook secret"}}


def node(name, type_, version, pos, params, **extra):
    n = {"parameters": params, "id": uid(name), "name": name, "type": type_,
         "typeVersion": version, "position": pos}
    n.update(extra)
    return n


def code(name, pos, file):
    return node(name, "n8n-nodes-base.code", 2, pos, {"jsCode": read(file)})


def if_true(name, pos, left):
    return node(name, "n8n-nodes-base.if", 2.2, pos, {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
            "conditions": [{"id": uid(name + "/c"), "leftValue": left, "rightValue": "",
                            "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
            "combinator": "and"},
        "looseTypeValidation": True,
        "options": {}})


def respond(name, pos, body_expr, code_=200):
    return node(name, "n8n-nodes-base.respondToWebhook", 1.1, pos, {
        "respondWith": "json", "responseBody": body_expr,
        "options": {"responseCode": code_}})


def pg(name, pos, query, params_expr, **extra):
    return node(name, "n8n-nodes-base.postgres", 2.8, pos, {
        "operation": "executeQuery", "query": query,
        "options": {"queryReplacement": params_expr}}, credentials=CRED_PG, **extra)


def model(name, pos, temperature, json_mode):
    opts = {"temperature": temperature, "timeout": 30000, "maxRetries": 2}
    if json_mode:
        opts["responseFormat"] = "json_object"
    return node(name, "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.2, pos, {
        "model": {"__rl": True, "value": MODEL, "mode": "id"}, "options": opts}, credentials=CRED_LLM)


def chain(name, pos, text, system, has_parser):
    return node(name, "@n8n/n8n-nodes-langchain.chainLlm", 1.7, pos, {
        "promptType": "define", "text": text, "hasOutputParser": has_parser,
        "messages": {"messageValues": [{"type": "SystemMessagePromptTemplate", "message": system}]}},
        onError="continueRegularOutput", retryOnFail=True, maxTries=2, waitBetweenTries=2000)


CLASSIFY_TEXT = """=Classify this support message.

CHANNEL: {{ $json.ticket.channel }}
SUBJECT: {{ $json.ticket.subject ?? '(none)' }}
MESSAGE:
\"\"\"
{{ $json.ticket.message }}
\"\"\""""

INSERT_SQL = """insert into tickets (
  external_id, channel, customer_email, customer_name, subject, message, received_at,
  intent, sentiment, urgency, confidence, extracted_order_id, ai_summary,
  order_id, status, priority, routing_reason, draft_reply, processing_ms, model, ai_failed,
  priority_score)
values ($1, $2::ticket_channel, $3, $4, $5, $6, $7::timestamptz,
  $8::ticket_intent, $9::ticket_sentiment, $10::ticket_urgency, $11::numeric, $12, $13,
  $14, $15::ticket_status, $16::smallint, $17, $18, $19::int, $20, $21::boolean,
  $22::smallint)
on conflict (external_id) do nothing
returning id, status;"""

INSERT_PARAMS = ("={{ (r => [r.external_id, r.channel, r.customer_email, r.customer_name, r.subject, r.message, "
                 "r.received_at, r.intent, r.sentiment, r.urgency, r.confidence, r.extracted_order_id, r.ai_summary, "
                 "r.order_id, r.status, r.priority, r.routing_reason, r.draft_reply, r.processing_ms, r.model, "
                 "r.ai_failed, r.priority_score])($json.row) }}")

FINAL_BODY = """={{ (() => {
  const r = $('Build ticket row').first().json.row;
  const saved = Boolean($json.id);
  return JSON.stringify({
    ok: true,
    ticket_id: saved ? $json.id : null,
    duplicate: !saved,
    status: r.status,
    intent: r.intent,
    sentiment: r.sentiment,
    priority: r.priority,
    priority_score: r.priority_score,
    routing_reason: r.routing_reason,
    order_id: r.order_id,
    reply: r.status === 'auto_resolved' ? r.draft_reply : null,
    processing_ms: r.processing_ms
  });
})() }}"""

nodes = [
    node("Webhook: new ticket", "n8n-nodes-base.webhook", 2.1, [0, 300], {
        "httpMethod": "POST", "path": "support-ticket", "authentication": "headerAuth",
        "responseMode": "responseNode", "options": {}}, webhookId=uid("webhook"), credentials=CRED_HOOK),
    code("Validate & normalise", [220, 300], "01_validate.js"),
    if_true("Valid input?", [440, 300], "={{ $json.valid }}"),
    respond("Respond 400: invalid", [660, 520],
            "={{ JSON.stringify({ ok: false, errors: $json.errors }) }}", 400),
    pg("Already processed?", [660, 280],
       "select exists (select 1 from tickets where external_id = $1) as duplicate;",
       "={{ [$json.ticket.external_id] }}"),
    if_true("Duplicate?", [880, 280], "={{ $json.duplicate }}"),
    respond("Respond 200: duplicate", [1100, 80],
            "={{ JSON.stringify({ ok: true, duplicate: true, message: 'Ticket already processed' }) }}"),
    # The classifier's input item is the duplicate-check row, so its prompt
    # reads the ticket from the "Validate & normalise" node instead of $json.
    chain("AI: classify ticket", [1100, 300],
          CLASSIFY_TEXT.replace("$json.ticket", "$('Validate & normalise').first().json.ticket"),
          read("prompt_classifier_system.txt"), False),
    model("Model: classifier", [1040, 520], 0, True),
    code("Merge AI result", [1460, 300], "02_merge_ai.js"),
    pg("Lookup order", [1680, 300],
       "select l.*, l.expected_delivery::text as expected_on, l.refund_expected_date::text as refund_due_on from lookup_order($1, $2) l;",
       "={{ [$json.ai.order_id, $json.ticket.customer_email] }}", alwaysOutputData=True),
    code("Routing rules", [1900, 300], "03_routing.js"),
    code("Build ticket row", [2120, 300], "04_build_row.js"),
    pg("Save ticket", [2340, 300], INSERT_SQL, INSERT_PARAMS, alwaysOutputData=True),
    respond("Respond 200: triaged", [2560, 300], FINAL_BODY),
]

def main(src, dst, kind="main", idx=0, src_idx=0):
    return src, {"node": dst, "type": kind, "index": idx}, src_idx


links = [
    main("Webhook: new ticket", "Validate & normalise"),
    main("Validate & normalise", "Valid input?"),
    main("Valid input?", "Already processed?", src_idx=0),
    main("Valid input?", "Respond 400: invalid", src_idx=1),
    main("Already processed?", "Duplicate?"),
    main("Duplicate?", "Respond 200: duplicate", src_idx=0),
    main("Duplicate?", "AI: classify ticket", src_idx=1),
    main("Model: classifier", "AI: classify ticket", kind="ai_languageModel"),
    main("AI: classify ticket", "Merge AI result"),
    main("Merge AI result", "Lookup order"),
    main("Lookup order", "Routing rules"),
    main("Routing rules", "Build ticket row"),
    main("Build ticket row", "Save ticket"),
    main("Save ticket", "Respond 200: triaged"),
]
connections = {}
for src, target, src_idx in links:
    kind = target["type"]
    outs = connections.setdefault(src, {}).setdefault(kind, [])
    while len(outs) <= src_idx:
        outs.append([])
    outs[src_idx].append(target)

sticky = node("Note", "n8n-nodes-base.stickyNote", 1, [-40, -140], {
    "content": "## TriageFlow: AI support-ticket triage\n"
               "1. Validate input and skip duplicates (idempotency)\n"
               "2. LLM reads the message: intent, order ID, confidence, summary (the only AI step)\n"
               "3. Look up the order in Supabase (only if it belongs to the sender's email)\n"
               "4. **Plain code decides**: score = intent base +/- order facts; below 25 = auto\n"
               "5. Template reply filled from order data (no AI)\n"
               "6. Save to Supabase -> dashboard updates in real time",
    "height": 220, "width": 520, "color": 4})

workflow = {
    "name": "TriageFlow - AI support ticket triage",
    "nodes": nodes + [sticky],
    "connections": connections,
    "settings": {"executionOrder": "v1", "saveDataErrorExecution": "all", "saveDataSuccessExecution": "all"},
    "pinData": {},
    "active": False,
    "meta": {"templateCredsSetupCompleted": False},
    "tags": [],
}

error_wf = {
    "name": "TriageFlow - error logger",
    "nodes": [
        node("On workflow error", "n8n-nodes-base.errorTrigger", 1, [0, 0], {}),
        pg("Log error to Supabase", [240, 0],
           "insert into workflow_errors (workflow_name, node_name, error_message, execution_id, execution_url) "
           "values ($1, $2, $3, $4, $5);",
           "={{ [$json.workflow?.name, $json.execution?.lastNodeExecuted, "
           "($json.execution?.error?.message ?? 'unknown').slice(0, 1000), "
           "String($json.execution?.id ?? ''), $json.execution?.url ?? null] }}"),
    ],
    "connections": {"On workflow error": {"main": [[{"node": "Log error to Supabase", "type": "main", "index": 0}]]}},
    "settings": {"executionOrder": "v1"},
    "pinData": {}, "active": False, "tags": [],
}

out = ROOT / "n8n"
(out / "triageflow-workflow.json").write_text(json.dumps(workflow, indent=2) + "\n")
(out / "error-logger-workflow.json").write_text(json.dumps(error_wf, indent=2) + "\n")
print("wrote n8n/triageflow-workflow.json and n8n/error-logger-workflow.json")
