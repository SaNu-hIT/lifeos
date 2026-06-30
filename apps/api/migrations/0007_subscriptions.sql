-- 0007_subscriptions — plans → capabilities (data, not code) + user subscriptions.
-- Subscriptions NEVER reference Skills; they map to capabilities (ADR-0006). Changing
-- what a plan grants is a data change in billing.plan_capabilities.

create table billing.plans (
  key text primary key,                 -- 'free' | 'pro' | ...
  name text not null,
  created_at timestamptz not null default now()
);

create table billing.plan_capabilities (
  plan_key text not null references billing.plans(key),
  capability_key text not null references catalog.capabilities(key),
  primary key (plan_key, capability_key)
);

create table billing.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  plan_key text not null references billing.plans(key),
  status text not null default 'active',  -- 'active' | 'canceled' | 'past_due'
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)                        -- one active subscription per user (v1)
);

create trigger subscriptions_set_updated_at
  before update on billing.subscriptions
  for each row execute function platform.set_updated_at();

alter table billing.subscriptions enable row level security;
alter table billing.subscriptions force row level security;
create policy subscriptions_owner_read on billing.subscriptions
  for select using (user_id = auth.uid());

grant select on billing.plans to lifeos_app;
grant select on billing.plan_capabilities to lifeos_app;
grant select on billing.subscriptions to lifeos_app;
