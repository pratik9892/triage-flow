-- =====================================================================
-- Migration 002: order lookup function + KPI views
-- =====================================================================

-- ---------- Safe order lookup -----------------------------------------
-- Called by n8n. Returns at most one order, and ONLY if it belongs to the
-- email that sent the ticket. Without the email check, anyone could type
-- a guessed order ID and get another customer's address and courier
-- details back in an auto-reply.
--
-- If the customer did not mention an order ID, fall back to their most
-- recent order: in "where is my order" tickets that is nearly always the
-- one they mean.
create or replace function lookup_order(p_order_id text, p_email text)
returns table (
  order_id          text,
  brand             text,
  items             jsonb,
  amount            numeric,
  payment_method    payment_method,
  status            order_status,
  courier           text,
  awb               text,
  placed_at         timestamptz,
  expected_delivery date,
  delivered_at      timestamptz,
  customer_name     text,
  matched_by        text
)
language sql
stable
as $$
  select o.id, o.brand, o.items, o.amount, o.payment_method, o.status,
         o.courier, o.awb, o.placed_at, o.expected_delivery, o.delivered_at,
         c.name,
         case when nullif(p_order_id, '') is not null then 'order_id' else 'latest_order' end
  from orders o
  join customers c on c.id = o.customer_id
  where lower(c.email) = lower(trim(p_email))
    and (nullif(p_order_id, '') is null or o.id = upper(trim(p_order_id)))
  order by o.placed_at desc
  limit 1;
$$;

-- ---------- KPI views (read by the dashboard) --------------------------
-- security_invoker = true makes the views respect the RLS policies of the
-- person querying them, instead of the view owner's rights.

-- First response time: an auto-resolved ticket is answered when n8n
-- processes it; a human ticket counts as answered when it is resolved.
create or replace view v_ticket_kpis with (security_invoker = true) as
select
  count(*)                                                        as total_tickets,
  -- "today" means today in India (IST), not today in UTC
  count(*) filter (where (received_at at time zone 'Asia/Kolkata')::date
                         = (now() at time zone 'Asia/Kolkata')::date) as tickets_today,
  count(*) filter (where status = 'needs_human')                  as open_human_queue,
  round(100.0 * count(*) filter (where status = 'auto_resolved')
        / nullif(count(*), 0), 1)                                 as auto_resolution_pct,
  round(100.0 * count(*) filter (where intent = 'wismo')
        / nullif(count(*), 0), 1)                                 as wismo_pct,
  round(avg(extract(epoch from (processed_at - received_at)))
        filter (where status = 'auto_resolved'))::int             as avg_auto_response_sec,
  round(avg(extract(epoch from (resolved_at - received_at)) / 60)
        filter (where resolved_at is not null and status = 'resolved'))::int
                                                                  as avg_human_resolution_min,
  round(avg(processing_ms))::int                                  as avg_processing_ms,
  count(*) filter (where ai_failed)                               as ai_failures
from tickets;

create or replace view v_tickets_by_intent with (security_invoker = true) as
select intent,
       count(*)                                           as total,
       count(*) filter (where status = 'auto_resolved')   as auto_resolved,
       count(*) filter (where status <> 'auto_resolved')  as human
from tickets
group by intent
order by total desc;

create or replace view v_tickets_daily with (security_invoker = true) as
select d                                                               as day,
       count(t.id)                                                     as total,
       count(t.id) filter (where t.status = 'auto_resolved')           as auto_resolved,
       count(t.id) filter (where t.sentiment in ('negative', 'angry')) as negative
from generate_series((now() at time zone 'Asia/Kolkata')::date - 13,
                     (now() at time zone 'Asia/Kolkata')::date, interval '1 day') g(ts)
cross join lateral (select g.ts::date as d) x
left join tickets t on (t.received_at at time zone 'Asia/Kolkata')::date = x.d
group by d
order by d;
