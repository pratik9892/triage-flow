-- =====================================================================
-- Migration 003: Row Level Security + realtime
-- =====================================================================
-- Who touches the data:
--   * n8n connects with the Postgres connection string (the "postgres"
--     role). That role bypasses RLS, so the workflow can read orders and
--     insert tickets.
--   * The dashboard uses the public anon key in the browser. Anyone can
--     read that key from the page source, so RLS is the real security
--     boundary: anonymous visitors see nothing, and logged-in support
--     agents ("authenticated") can read data and update ticket status.

alter table customers       enable row level security;
alter table orders          enable row level security;
alter table tickets         enable row level security;
alter table workflow_errors enable row level security;

create policy "agents read customers" on customers
  for select to authenticated using (true);

create policy "agents read orders" on orders
  for select to authenticated using (true);

create policy "agents read tickets" on tickets
  for select to authenticated using (true);

create policy "agents update tickets" on tickets
  for update to authenticated using (true) with check (true);

create policy "agents read errors" on workflow_errors
  for select to authenticated using (true);

-- ---------- Explicit grants -------------------------------------------
-- Supabase projects created after 30 May 2026 (and all projects after
-- 30 Oct 2026) no longer grant new tables to the Data API automatically.
-- A grant lets a role reach a table; RLS then decides which rows it sees.
-- Start from zero so this file gives the same result on old and new projects.
revoke all on customers, orders, tickets, workflow_errors from anon, authenticated;
revoke all on v_ticket_kpis, v_tickets_by_intent, v_tickets_daily from anon, authenticated;

grant usage on schema public to authenticated;
grant select on customers, orders, tickets, workflow_errors to authenticated;
grant select on v_ticket_kpis, v_tickets_by_intent, v_tickets_daily to authenticated;

-- Agents may only change the workflow fields, not rewrite what the
-- customer said or what the AI decided.
grant update (status, resolved_at, draft_reply) on tickets to authenticated;

-- lookup_order() is for n8n only. Functions are executable by everyone by
-- default and would be callable from the browser as /rest/v1/rpc/lookup_order.
revoke execute on function lookup_order(text, text) from public, anon, authenticated;

-- Push new and updated tickets to the dashboard over websockets.
alter publication supabase_realtime add table tickets;
