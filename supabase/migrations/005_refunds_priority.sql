-- =====================================================================
-- Migration 005: refund fields on orders, priority score on tickets
-- Run once in Supabase: SQL Editor -> paste -> Run (after 001-004)
-- =====================================================================
-- Why:
--   * The refund rules need to know whether a refund has started and
--     the date it is expected to reach the customer.
--   * Priority is now a 0-100 score (intent base +/- order facts), set by
--     the n8n "Routing rules" node. The queue sorts by this score.

-- ---------- Refund fields on orders ----------------------------------
create type refund_state as enum ('none', 'initiated');

alter table orders
  add column refund_status        refund_state not null default 'none',
  add column refund_amount        numeric(10,2) check (refund_amount >= 0),
  add column refund_expected_date date;   -- date the refund should reach the customer

-- ---------- Priority score on tickets ---------------------------------
alter table tickets
  add column priority_score smallint check (priority_score between 0 and 100);

-- Existing tickets: a score that matches their P level, so they sort correctly.
update tickets
   set priority_score = case priority when 1 then 75 when 2 then 60 when 3 then 45 when 4 then 30 else 15 end
 where priority_score is null;

create index tickets_queue_score_idx on tickets (status, priority_score desc, received_at);

-- ---------- lookup_order() also returns the refund fields -------------
-- The output columns change, so the function is dropped and recreated.
drop function if exists lookup_order(text, text);

create function lookup_order(p_order_id text, p_email text)
returns table (
  order_id             text,
  brand                text,
  items                jsonb,
  amount               numeric,
  payment_method       payment_method,
  status               order_status,
  courier              text,
  awb                  text,
  placed_at            timestamptz,
  expected_delivery    date,
  delivered_at         timestamptz,
  refund_status        refund_state,
  refund_amount        numeric,
  refund_expected_date date,
  customer_name        text,
  matched_by           text
)
language sql
stable
as $$
  -- Only returns an order that belongs to the sender's email.
  select o.id, o.brand, o.items, o.amount, o.payment_method, o.status,
         o.courier, o.awb, o.placed_at, o.expected_delivery, o.delivered_at,
         o.refund_status, o.refund_amount, o.refund_expected_date,
         c.name,
         case when nullif(p_order_id, '') is not null then 'order_id' else 'latest_order' end
  from orders o
  join customers c on c.id = o.customer_id
  where lower(c.email) = lower(trim(p_email))
    and (nullif(p_order_id, '') is null or o.id = upper(trim(p_order_id)))
  order by o.placed_at desc
  limit 1;
$$;

revoke execute on function lookup_order(text, text) from public, anon, authenticated;

-- ---------- Demo refund cases ------------------------------------------
--   ORD-10239 Arjun  prepaid, cancelled -> refund started, due in 4 days  -> auto (15)
--   ORD-10238 Meera  prepaid, RTO       -> parcel still coming back       -> auto (15)
--   ORD-10248 Meera  prepaid, returned  -> refund was due 3 days ago      -> person (80)
--   ORD-10240 Isha   COD, returned      -> back at warehouse, not started -> person (80)
-- Dates are relative to today, so this also runs every night (see below).
create or replace function refresh_demo_refunds() returns integer
language sql as $$
  with demo (id, status, refund_status, refund_amount, refund_expected_date) as (values
    ('ORD-10239', 'cancelled'::order_status,     'initiated'::refund_state, 1900::numeric, current_date + 4),
    ('ORD-10238', 'rto_initiated'::order_status, 'none'::refund_state,      null::numeric, null::date),
    ('ORD-10248', 'returned'::order_status,      'initiated'::refund_state, 1250::numeric, current_date - 3),
    ('ORD-10240', 'returned'::order_status,      'none'::refund_state,      null::numeric, null::date)
  ), u as (
    update orders o
       set status = d.status,
           refund_status = d.refund_status,
           refund_amount = d.refund_amount,
           refund_expected_date = d.refund_expected_date
      from demo d
     where o.id = d.id
    returning 1
  )
  select count(*)::int from u;
$$;

revoke execute on function refresh_demo_refunds() from public, anon, authenticated;

select refresh_demo_refunds();

-- Keep the demo dates fresh every night, right after refresh_demo_orders()
-- (00:05 IST). pg_cron was enabled in migration 004.
select cron.schedule('refresh-demo-refunds', '36 18 * * *', 'select refresh_demo_refunds()');
