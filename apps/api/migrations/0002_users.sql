-- 0002_users — platform.users with RLS (a user sees only their own row).
-- See docs/09_DATABASE_DESIGN.md §3.

create table platform.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  locale text not null default 'en-IN',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on platform.users
  for each row execute function platform.set_updated_at();

alter table platform.users enable row level security;
-- FORCE so even the table owner is subject to RLS (defense in depth).
alter table platform.users force row level security;

create policy users_self on platform.users
  using (id = auth.uid())
  with check (id = auth.uid());

grant select, insert, update, delete on platform.users to lifeos_app;
