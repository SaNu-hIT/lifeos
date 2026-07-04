-- 0033_finance_budgets_and_profile — per-category monthly budget caps + the
-- one-row-per-user finance profile (currency, income, savings goal) for the Finance
-- skill. Budgets are keyed by (user_id, category_name) so setting the same category
-- twice corrects the cap rather than duplicating it (idempotent upsert).

create table finance.budget_limits (
  user_id uuid not null references platform.users(id),
  category_name text not null,
  monthly_limit_minor bigint not null check (monthly_limit_minor >= 0),
  currency text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_name)
);

alter table finance.budget_limits enable row level security;
alter table finance.budget_limits force row level security;
create policy budget_limits_owner on finance.budget_limits
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on finance.budget_limits to lifeos_app;

create table finance.user_profile (
  user_id uuid primary key references platform.users(id),
  currency text not null,
  monthly_income_minor bigint check (monthly_income_minor >= 0),
  savings_goal_minor bigint check (savings_goal_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table finance.user_profile enable row level security;
alter table finance.user_profile force row level security;
create policy finance_user_profile_owner on finance.user_profile
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on finance.user_profile to lifeos_app;
