-- 0011_conversations — conversations & messages (docs/02 §5, docs/09 §3).
-- User-owned and RLS-scoped. Messages are keyset-paginated by (created_at, id).

create table conversation.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger conversations_set_updated_at
  before update on conversation.conversations
  for each row execute function platform.set_updated_at();

create table conversation.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversation.conversations(id),
  user_id uuid not null references platform.users(id),
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content jsonb not null,
  turn_id uuid,                          -- groups a turn's messages
  created_at timestamptz not null default now()
);
create index messages_keyset_idx on conversation.messages (conversation_id, created_at desc, id desc);

do $$
declare t text;
begin
  foreach t in array array['conversations','messages'] loop
    execute format('alter table conversation.%I enable row level security', t);
    execute format('alter table conversation.%I force row level security', t);
    execute format('create policy %I_owner on conversation.%I using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('grant select, insert, update on conversation.%I to lifeos_app', t);
  end loop;
end $$;
