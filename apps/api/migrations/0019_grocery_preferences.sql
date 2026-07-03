-- 0019_grocery_preferences — remembers each user's brand/pack-size choice per
-- product so grocery.compare_prices doesn't re-ask a clarification question it
-- already knows the answer to (docs/02 §10, ADR-0001: schema owned by the Skill).
-- User-owned like list_items (0018) — same RLS pattern.

create table grocery.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  product_name text not null,
  preferred_brand text not null,
  preferred_quantity integer,
  preferred_unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_name)
);
create index user_preferences_user_idx on grocery.user_preferences (user_id);

alter table grocery.user_preferences enable row level security;
alter table grocery.user_preferences force row level security;
create policy user_preferences_owner on grocery.user_preferences
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on grocery.user_preferences to lifeos_app;
