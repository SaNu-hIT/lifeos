-- 0003_outbox — transactional outbox for reliable domain events (ADR-0008).
-- Append-only from the application's perspective; the relay (phase-06) marks rows
-- published. No RLS: outbox is system-level and written in the same txn as state.

create table platform.outbox (
  id uuid primary key default gen_random_uuid(),
  aggregate text not null,
  event_type text not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  published_at timestamptz
);

create index outbox_unpublished_idx on platform.outbox (occurred_at) where published_at is null;

-- The app role may write events; it may not delete history.
grant select, insert on platform.outbox to lifeos_app;
