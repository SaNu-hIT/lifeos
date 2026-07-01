-- 0010_memory — the Memory Engine's stores (docs/02 §9, ADR-0009).
-- Embeddings are stored as jsonb float arrays for now; the pgvector column + ANN
-- index are a drop-in migration once pgvector is installed (KI-005). All tables are
-- user-owned and RLS-scoped.

create table memory.facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  scope text not null,                   -- 'grocery' | 'global' | ...
  statement text not null,
  importance smallint not null default 1,
  source text,
  expires_at timestamptz,                -- null = durable
  created_at timestamptz not null default now()
);
create index facts_user_scope_idx on memory.facts (user_id, scope);

create table memory.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  scope text not null,
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scope, key)
);
create trigger preferences_set_updated_at
  before update on memory.preferences
  for each row execute function platform.set_updated_at();

create table memory.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  conversation_id uuid,
  summary text not null,
  created_at timestamptz not null default now()
);
create index summaries_user_idx on memory.summaries (user_id, created_at desc);

create table memory.embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  owner_kind text not null,              -- 'fact' | 'summary'
  owner_id uuid not null,
  embedding jsonb not null,              -- float[] (pgvector column later)
  created_at timestamptz not null default now()
);
create index embeddings_owner_idx on memory.embeddings (owner_kind, owner_id);

-- RLS: each user sees only their own memory.
do $$
declare t text;
begin
  foreach t in array array['facts','preferences','summaries','embeddings'] loop
    execute format('alter table memory.%I enable row level security', t);
    execute format('alter table memory.%I force row level security', t);
    execute format('create policy %I_owner on memory.%I using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('grant select, insert, update, delete on memory.%I to lifeos_app', t);
  end loop;
end $$;
