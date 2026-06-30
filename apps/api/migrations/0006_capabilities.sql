-- 0006_capabilities — capability taxonomy + source-agnostic grants (ADR-0006).
-- Capabilities are the single currency of access. Grants come from any source
-- (subscription, trial, admin, bundle) and may expire. The Permission Engine reads
-- these; subscriptions (phase-08) write them.

create table catalog.capabilities (
  key text primary key,                 -- '<domain>.<action>', e.g. 'grocery.order'
  domain text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table billing.capability_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  capability_key text not null references catalog.capabilities(key),
  source text not null,                 -- 'subscription' | 'trial' | 'admin' | 'bundle'
  expires_at timestamptz,               -- null = no expiry
  created_at timestamptz not null default now()
);

-- A user can hold the same capability from multiple sources; resolve by existence
-- of any non-expired grant.
create unique index capability_grants_unique on billing.capability_grants (user_id, capability_key, source);
create index capability_grants_user_idx on billing.capability_grants (user_id);

alter table billing.capability_grants enable row level security;
alter table billing.capability_grants force row level security;
-- A user may read their own grants; writes happen in service context (phase-08/admin).
create policy capability_grants_owner_read on billing.capability_grants
  for select using (user_id = auth.uid());

grant select on catalog.capabilities to lifeos_app;
grant select on billing.capability_grants to lifeos_app;
