# LifeOS — Operations Runbook

Production operations for the LifeOS platform (phase 36). Companion to
[docs/13 Deployment Guide](docs/13_DEPLOYMENT_GUIDE.md) and
[docs/11 Security Guide](docs/11_SECURITY_GUIDE.md).

## Prerequisites
- **Postgres** (managed/Supabase in prod), **Redis** (BullMQ + cache).
- Node 20+, pnpm 9. Env configured from [`apps/api/.env.example`](apps/api/.env.example) —
  the API validates env at boot and **fails fast** on anything invalid or insecure
  (e.g. the dev `AUTH_JWT_SECRET` is rejected in production).

## Build & release
```bash
pnpm install --frozen-lockfile
pnpm run check          # lint + typecheck + test + build across the workspace (the gate)
pnpm --filter @lifeos/api build
```

## Database migrations
Forward-only, tracked in `public.schema_migrations`. Run BEFORE rolling out new code
(new code tolerates the old schema for one release; migrations are additive).
```bash
pnpm --filter @lifeos/api migrate      # applies any pending migrations, in order
```
Rollback: migrations are forward-only — to revert, ship a new compensating migration.

## Start / health / readiness
```bash
pnpm --filter @lifeos/api start        # node dist/main.js
```
- **Liveness:** `GET /v1/health` → 200 when the process is up.
- **Readiness:** `GET /v1/health/ready` → 200 only when Postgres + Redis respond
  (503 otherwise). Wire your orchestrator's readiness probe here so traffic is
  withheld until dependencies are reachable.
- **Metrics:** `GET /v1/metrics` (request rates/latencies, `domain_events_total`,
  cache hit/miss). Scrape internally; do not expose publicly.

## Graceful shutdown
On `SIGTERM`/`SIGINT` Nest shutdown hooks run: the HTTP server stops accepting, the
BullMQ worker + queue close, and the Postgres pool and Redis connection drain. Give the
orchestrator a termination grace period ≥ the longest in-flight request.

## Scaling notes
- Stateless API — scale horizontally. Keep **instances × `DB_POOL_MAX`** under the
  Postgres connection limit.
- The outbox relay + event worker run in every instance; delivery is idempotent
  (dedupe ledger), so multiple instances are safe.
- Rate limiting is currently per-instance (in-memory). For a global limit, back the
  `RateLimiter` with Redis (interface already isolates this).

## Load testing
```bash
pnpm --filter @lifeos/api loadtest http://localhost:3000/v1/health 500 20
```

## Incident quick-reference
| Symptom | Check |
|---|---|
| 503 on `/v1/health/ready` | Postgres/Redis reachability; `checks` in the body |
| 429s | `RATE_LIMIT_RPM` too low, or abusive client (per userId/IP) |
| Rising `http_request_duration_ms` | DB pool exhaustion (`DB_POOL_MAX`), slow queries |
| Events not delivered | outbox relay running? worker connected to Redis? |
| Boot crash | invalid/insecure env — the validation error names the offending key |
