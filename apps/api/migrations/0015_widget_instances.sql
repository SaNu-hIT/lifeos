-- 0015_widget_instances — per-user home-widget preferences (docs/02 §15, phase-21).
-- The home is ASSEMBLED at request time from Skill-contributed widgets (nothing
-- hardcoded); this table holds the user's overrides — hide, pin, reorder — so the
-- layout stays data-driven. User-owned + RLS; the user reads and writes their own.

create table surface.widget_instances (
  user_id uuid not null references platform.users(id),
  widget_key text not null,              -- 'grocery.next_delivery' ...
  hidden boolean not null default false,
  pinned boolean not null default false,
  sort_override integer,                 -- null = use the widget's base priority
  updated_at timestamptz not null default now(),
  primary key (user_id, widget_key)
);

alter table surface.widget_instances enable row level security;
alter table surface.widget_instances force row level security;
create policy widget_instances_owner_all on surface.widget_instances
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on surface.widget_instances to lifeos_app;
