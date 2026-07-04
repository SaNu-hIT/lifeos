-- 0031_finance_transactions — schema + expense/income logging for the Finance skill
-- (docs/02 §10, ADR-0001: schema owned by the Skill, not the platform core). Money is
-- stored as integer minor units (amount_minor) to avoid float rounding, same as
-- grocery price_minor. Category names are freeform text with a normalized companion
-- key (like workout exercise names) — no separate category catalog table.

create schema if not exists finance;
grant usage on schema finance to lifeos_app;

create table finance.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  type text not null check (type in ('expense', 'income')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  category_name text not null,
  category_name_normalized text not null,
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index transactions_user_occurred_idx on finance.transactions (user_id, occurred_at desc);
create index transactions_user_category_idx on finance.transactions (user_id, category_name_normalized);

alter table finance.transactions enable row level security;
alter table finance.transactions force row level security;
create policy transactions_owner on finance.transactions
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on finance.transactions to lifeos_app;
