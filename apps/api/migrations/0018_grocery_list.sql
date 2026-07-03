-- 0018_grocery_list — persistent shopping list + cross-store price cache for the
-- Grocery skill's price-comparison tool (docs/02 §10, ADR-0001: schema owned by the
-- Skill, not the platform core). list_items is user-owned and RLS-scoped like
-- conversation.messages (0011). price_cache is store data, not user data — it holds
-- the last-known-good price per (store, query) so a live scrape failure at request
-- time can still be answered from cache instead of erroring (reliability requirement).

create schema if not exists grocery;
grant usage on schema grocery to lifeos_app;

create table grocery.list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  name text not null,
  quantity integer not null default 1,
  unit text,
  created_at timestamptz not null default now()
);
create index list_items_user_idx on grocery.list_items (user_id, created_at desc);

alter table grocery.list_items enable row level security;
alter table grocery.list_items force row level security;
create policy list_items_owner on grocery.list_items
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on grocery.list_items to lifeos_app;

create table grocery.price_cache (
  store_key text not null,
  product_query text not null,
  product_name text not null,
  price_minor integer not null,
  unit text not null,
  scraped_at timestamptz not null default now(),
  primary key (store_key, product_query)
);

-- Not user-scoped (store prices aren't personal data) — no RLS, but writes are
-- confined to trusted connector code running in service context.
grant select, insert, update on grocery.price_cache to lifeos_app;
