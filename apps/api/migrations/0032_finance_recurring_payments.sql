-- 0032_finance_recurring_payments — recurring bills/subscriptions for the Finance
-- skill. next_due_date is advanced reactively at read time (see skill domain/budget.ts)
-- — the platform has no scheduler (documented v1 limitation), so there is no separate
-- "charge" event; a bill simply reports its next real occurrence.

create table finance.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  label text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  category_name text not null,
  interval text not null check (interval in ('weekly', 'monthly', 'yearly')),
  next_due_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_payments_user_due_idx on finance.recurring_payments (user_id, next_due_date);

alter table finance.recurring_payments enable row level security;
alter table finance.recurring_payments force row level security;
create policy recurring_payments_owner on finance.recurring_payments
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on finance.recurring_payments to lifeos_app;
