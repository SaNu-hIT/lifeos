-- 0014_notifications — user notification inbox (CQRS read model, ADR-0008, docs/02 §15).
-- Skills DECLARE notification intents against domain events; the engine applies
-- policy (importance, quiet hours, dedupe) and delivers. In-app = this table (the
-- inbox); external channels (push/email) are attempted via channel adapters.
-- Inserted in service context (system-level); read + mark-read in user context (RLS).

create table surface.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  kind text not null,                    -- 'grocery.order_delivered' ...
  title text not null,
  body text,
  importance text not null default 'normal',  -- low | normal | high | urgent
  deep_link text,
  dedupe_key text,                       -- optional cross-event logical identity
  channels text[] not null default '{}', -- external channels the policy attempted
  read_at timestamptz,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index notifications_inbox_idx on surface.notifications (user_id, occurred_at desc, id desc);
-- One notification per logical thing per user (belt-and-suspenders beside the
-- idempotent subscriber, which already dedupes redelivery of the same event).
create unique index notifications_dedupe_idx
  on surface.notifications (user_id, dedupe_key) where dedupe_key is not null;

alter table surface.notifications enable row level security;
alter table surface.notifications force row level security;
create policy notifications_owner_read on surface.notifications
  for select using (user_id = auth.uid());
create policy notifications_owner_update on surface.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on surface.notifications to lifeos_app;
