-- 0009_connectors — persistence for the Connector Registry (docs/02 §12).
-- Records which connectors are registered per domain (no credentials — those live in
-- config, scoped per connector). Powers the Dev Console and health views.

create table catalog.connectors (
  key text primary key,
  domain text not null,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index connectors_domain_idx on catalog.connectors (domain);

create trigger connectors_set_updated_at
  before update on catalog.connectors
  for each row execute function platform.set_updated_at();

grant select on catalog.connectors to lifeos_app;
