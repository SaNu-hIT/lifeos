-- 0013_activities — append-only activity feed (CQRS read model, ADR-0008, docs/02 §15).
-- Fed by idempotent event projections. User-owned + RLS for reads; the projector
-- inserts in service context. No sensitive payloads.

create table surface.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  kind text not null,                    -- 'grocery.order_placed' ...
  title text not null,
  summary text,
  deep_link text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index activities_feed_idx on surface.activities (user_id, occurred_at desc, id desc);

alter table surface.activities enable row level security;
alter table surface.activities force row level security;
create policy activities_owner_read on surface.activities
  for select using (user_id = auth.uid());

-- Append + read only (projector inserts in service context).
grant select, insert on surface.activities to lifeos_app;
