-- 0029_wellness_reminders — manual and auto-supply reminders. Auto-supply reminders
-- are materialized reactively (on tool call / context read), not via a background
-- scheduler — the platform has no cron/scheduled-event infrastructure today
-- (documented v1 limitation). The unique index prevents re-materializing the same
-- auto reminder (same user/item/due-date) on every read.

create table wellness.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  kind text not null check (kind in ('auto-supply', 'manual')),
  label text not null,
  due_date date not null,
  status text not null check (status in ('pending', 'dismissed', 'done')) default 'pending',
  related_supply_item text,
  created_at timestamptz not null default now()
);
create index reminders_user_status_idx on wellness.reminders (user_id, status);
create unique index reminders_auto_supply_dedupe_idx on wellness.reminders (user_id, related_supply_item, due_date)
  where kind = 'auto-supply';

alter table wellness.reminders enable row level security;
alter table wellness.reminders force row level security;
create policy reminders_owner on wellness.reminders
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on wellness.reminders to lifeos_app;
