-- Keep the demo orders "current": resets their dates to the same relative
-- values as seed.sql, so the live demo always has on-time, late and delivered orders.
create or replace function refresh_demo_orders() returns integer
language sql as $$
  with demo (id, placed_at, expected_delivery, delivered_at) as (values
    ('ORD-10231', now() - interval '70 hours', (now() + interval '2 days')::date, null),
    ('ORD-10232', now() - interval '50 hours', (now() + interval '0 days')::date, null),
    ('ORD-10233', now() - interval '200 hours', (now() + interval '-5 days')::date, now() - interval '120 hours'),
    ('ORD-10234', now() - interval '5 hours', (now() + interval '5 days')::date, null),
    ('ORD-10235', now() - interval '20 hours', (now() + interval '4 days')::date, null),
    ('ORD-10236', now() - interval '96 hours', (now() + interval '-1 days')::date, null),
    ('ORD-10237', now() - interval '400 hours', (now() + interval '-14 days')::date, now() - interval '300 hours'),
    ('ORD-10238', now() - interval '240 hours', (now() + interval '-6 days')::date, null),
    ('ORD-10239', now() - interval '150 hours', null, null),
    ('ORD-10240', now() - interval '600 hours', (now() + interval '-20 days')::date, now() - interval '500 hours'),
    ('ORD-10241', now() - interval '40 hours', (now() + interval '3 days')::date, null),
    ('ORD-10242', now() - interval '90 hours', (now() + interval '-2 days')::date, now() - interval '30 hours'),
    ('ORD-10243', now() - interval '2 hours', (now() + interval '6 days')::date, null),
    ('ORD-10244', now() - interval '60 hours', (now() + interval '0 days')::date, null),
    ('ORD-10245', now() - interval '160 hours', (now() + interval '-4 days')::date, now() - interval '80 hours'),
    ('ORD-10246', now() - interval '30 hours', (now() + interval '3 days')::date, null),
    ('ORD-10247', now() - interval '10 hours', (now() + interval '5 days')::date, null),
    ('ORD-10248', now() - interval '300 hours', (now() + interval '-10 days')::date, now() - interval '220 hours'),
    ('ORD-10249', now() - interval '120 hours', (now() + interval '-2 days')::date, null),
    ('ORD-10250', now() - interval '72 hours', (now() + interval '-1 days')::date, now() - interval '24 hours')
  ), u as (
    update orders o
       set placed_at = d.placed_at,
           expected_delivery = d.expected_delivery,
           delivered_at = d.delivered_at
      from demo d
     where o.id = d.id
    returning 1
  )
  select count(*)::int from u;
$$;

revoke execute on function refresh_demo_orders() from public, anon, authenticated;

select refresh_demo_orders();

-- Run it every night at 00:05 IST. If this fails, enable pg_cron under
-- Database -> Extensions, then run these two lines again.
create extension if not exists pg_cron;
select cron.schedule('refresh-demo-orders', '35 18 * * *', 'select refresh_demo_orders()');