-- 0004_audit_logs — immutable record of sensitive actions and permission decisions.
-- See docs/09_DATABASE_DESIGN.md §3 and docs/11_SECURITY_GUIDE.md §7. Append-only;
-- carries no sensitive payloads (references + decisions only).

create table platform.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  actor text not null,
  action text not null,
  resource text,
  decision text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_user_idx on platform.audit_logs (user_id, created_at desc);

-- Append + read only; never update/delete.
grant select, insert on platform.audit_logs to lifeos_app;
