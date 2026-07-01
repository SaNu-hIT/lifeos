-- 0008_skills — persistence for the Skill Registry (docs/02 §10).
-- catalog.skills records what was registered from each manifest (no handlers — a
-- serializable summary powering the Dev Console and enable/disable). user_skills is
-- the per-user on/off state.

create table catalog.skills (
  key text primary key,
  version text not null,
  contract_version text not null,
  status text not null default 'registered',
  manifest jsonb not null,               -- summary: capabilities + tool descriptors
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger skills_set_updated_at
  before update on catalog.skills
  for each row execute function platform.set_updated_at();

create table catalog.user_skills (
  user_id uuid not null references platform.users(id),
  skill_key text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_key)
);

alter table catalog.user_skills enable row level security;
alter table catalog.user_skills force row level security;
create policy user_skills_owner on catalog.user_skills
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on catalog.skills to lifeos_app;
grant select, insert, update on catalog.user_skills to lifeos_app;
