-- M0: Initial schema for Recover (dunning/failed-payment recovery)
-- All tenant tables are RLS-protected so merchant A cannot see merchant B's data.

-- Enable UUID generation
create extension if not exists "pgcrypto";

----------------------------------------------------------------------
-- merchants
----------------------------------------------------------------------
create table merchants (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,          -- references auth.users(id)
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table merchants enable row level security;

create policy "merchants_own_row" on merchants
  for all using (auth_user_id = auth.uid());

----------------------------------------------------------------------
-- stripe_connections
----------------------------------------------------------------------
create table stripe_connections (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  stripe_account_id text not null,
  connection_method text not null check (connection_method in ('connect', 'restricted_key')),
  access_token_encrypted text,                -- only for Connect OAuth
  refresh_token_encrypted text,
  restricted_key_encrypted text,              -- only for restricted-key fallback
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table stripe_connections enable row level security;

create policy "stripe_connections_own" on stripe_connections
  for all using (merchant_id in (select id from merchants where auth_user_id = auth.uid()));

----------------------------------------------------------------------
-- end_customers (the merchant's subscribers whose payments fail)
----------------------------------------------------------------------
create table end_customers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  stripe_customer_id text not null,
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, stripe_customer_id)
);

alter table end_customers enable row level security;

create policy "end_customers_own" on end_customers
  for all using (merchant_id in (select id from merchants where auth_user_id = auth.uid()));

----------------------------------------------------------------------
-- failed_payments
----------------------------------------------------------------------
create table failed_payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  stripe_invoice_id text,
  stripe_charge_id text,
  end_customer_id uuid not null references end_customers(id) on delete cascade,
  amount integer not null,                    -- in smallest currency unit (cents)
  currency text not null default 'usd',
  failure_reason text,
  failed_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'recovering', 'recovered', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table failed_payments enable row level security;

create policy "failed_payments_own" on failed_payments
  for all using (merchant_id in (select id from merchants where auth_user_id = auth.uid()));

----------------------------------------------------------------------
-- sequences (reminder cadence templates)
----------------------------------------------------------------------
create table sequences (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  name text not null default 'Default',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sequences enable row level security;

create policy "sequences_own" on sequences
  for all using (merchant_id in (select id from merchants where auth_user_id = auth.uid()));

----------------------------------------------------------------------
-- sequence_steps
----------------------------------------------------------------------
create table sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences(id) on delete cascade,
  step_order integer not null,
  offset_hours integer not null,              -- hours after failure to send
  subject text not null,
  body_template text not null,
  channel text not null default 'email' check (channel in ('email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sequence_id, step_order)
);

alter table sequence_steps enable row level security;

create policy "sequence_steps_own" on sequence_steps
  for all using (sequence_id in (
    select s.id from sequences s
    join merchants m on s.merchant_id = m.id
    where m.auth_user_id = auth.uid()
  ));

----------------------------------------------------------------------
-- reminders (individual sends)
----------------------------------------------------------------------
create table reminders (
  id uuid primary key default gen_random_uuid(),
  failed_payment_id uuid not null references failed_payments(id) on delete cascade,
  step_order integer not null,
  channel text not null default 'email' check (channel in ('email')),
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table reminders enable row level security;

create policy "reminders_own" on reminders
  for all using (failed_payment_id in (
    select fp.id from failed_payments fp
    join merchants m on fp.merchant_id = m.id
    where m.auth_user_id = auth.uid()
  ));

----------------------------------------------------------------------
-- recoveries
----------------------------------------------------------------------
create table recoveries (
  id uuid primary key default gen_random_uuid(),
  failed_payment_id uuid not null references failed_payments(id) on delete cascade unique,
  recovered_at timestamptz not null default now(),
  amount_recovered integer not null,
  created_at timestamptz not null default now()
);

alter table recoveries enable row level security;

create policy "recoveries_own" on recoveries
  for all using (failed_payment_id in (
    select fp.id from failed_payments fp
    join merchants m on fp.merchant_id = m.id
    where m.auth_user_id = auth.uid()
  ));

----------------------------------------------------------------------
-- processed_stripe_events (idempotency table)
----------------------------------------------------------------------
create table processed_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- No RLS — only accessed by server-side webhook/Inngest code using service role.
