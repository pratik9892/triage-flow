-- =====================================================================
-- TriageFlow: AI support-ticket triage for D2C brands
-- Migration 001: core schema
-- Run in Supabase: Dashboard -> SQL Editor -> paste -> Run
-- =====================================================================

-- ---------- Enums -----------------------------------------------------
-- Enums keep bad values out at the database level, so a model that
-- invents a label ("shipping_issue") cannot be written to the table.
create type order_status as enum (
  'placed', 'packed', 'shipped', 'out_for_delivery', 'delivered',
  'cancelled', 'rto_initiated', 'returned'
);

create type payment_method as enum ('cod', 'prepaid');

create type ticket_intent as enum (
  'wismo',            -- "where is my order"
  'cancel_request',
  'return_exchange',
  'refund_status',
  'damaged_or_wrong_item',
  'payment_issue',
  'product_query',
  'complaint',
  'other'
);

create type ticket_sentiment as enum ('positive', 'neutral', 'negative', 'angry');
create type ticket_urgency   as enum ('low', 'medium', 'high');
create type ticket_status    as enum ('auto_resolved', 'needs_human', 'resolved');
create type ticket_channel   as enum ('email', 'whatsapp', 'web_chat', 'instagram');

-- ---------- Customers & orders (the "store" data) ---------------------
create table customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  phone       text,
  city        text,
  created_at  timestamptz not null default now()
);

create table orders (
  id                 text primary key,               -- e.g. ORD-10231
  customer_id        uuid not null references customers(id),
  brand              text not null,
  items              jsonb not null default '[]',    -- [{sku, name, qty, price}]
  amount             numeric(10,2) not null check (amount >= 0),
  payment_method     payment_method not null,
  status             order_status not null,
  courier            text,
  awb                text,                           -- courier tracking number
  placed_at          timestamptz not null,
  expected_delivery  date,
  delivered_at       timestamptz
);
create index orders_customer_idx on orders (customer_id, placed_at desc);

-- ---------- Tickets (written by n8n) -----------------------------------
create table tickets (
  id                  bigint generated always as identity primary key,
  external_id         text not null unique,          -- idempotency key from the source system
  channel             ticket_channel not null default 'email',
  customer_email      text not null,
  customer_name       text,
  subject             text,
  message             text not null,
  received_at         timestamptz not null,

  -- AI classification
  intent              ticket_intent not null default 'other',
  sentiment           ticket_sentiment not null default 'neutral',
  urgency             ticket_urgency not null default 'medium',
  confidence          numeric(3,2) check (confidence between 0 and 1),
  extracted_order_id  text,
  ai_summary          text,

  -- Enrichment + routing
  order_id            text references orders(id),
  status              ticket_status not null,
  priority            smallint not null default 3 check (priority between 1 and 5), -- 1 = most urgent
  routing_reason      text not null,
  draft_reply         text,

  -- Observability
  processed_at        timestamptz not null default now(),
  processing_ms       integer,
  model               text,
  ai_failed           boolean not null default false,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index tickets_received_idx on tickets (received_at desc);
create index tickets_queue_idx    on tickets (status, priority, received_at);

-- ---------- Workflow errors (written by the n8n error workflow) --------
create table workflow_errors (
  id            bigint generated always as identity primary key,
  workflow_name text,
  node_name     text,
  error_message text,
  execution_id  text,
  execution_url text,
  occurred_at   timestamptz not null default now()
);
