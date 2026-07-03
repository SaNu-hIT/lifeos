# 15 — Local Dev Runbook

How to run the full stack (composed server + web app) on a local machine for manual testing.

## Prerequisites

- Postgres running locally, with a `lifeos_dev` database created and owned by your local user.
- Redis running locally on the default port (6379).
- `pnpm install` at the repo root.

## 1. Environment

`apps/server/.env` must have (copy from `.env.example` and fill in):

```
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
DATABASE_URL=postgres://<user>@localhost:5432/lifeos_dev
REDIS_URL=redis://localhost:6379
AUTH_JWT_SECRET=<any long random string>

AI_PROVIDER=openai            # or 'local' for the deterministic dev provider (no key needed)
OPENAI_API_KEY=sk-...         # only required when AI_PROVIDER=openai
```

`apps/api/.env` needs the same DB/Redis/auth vars if you run `apps/api` standalone instead of the composed `apps/server`.

## 2. Build

```bash
pnpm run build
```

Builds all workspace packages via Turbo (api, server, web, console, skills, connectors, contracts, ai-core, etc).

## 3. Migrate

```bash
cd apps/api
DATABASE_URL="postgres://<user>@localhost:5432/lifeos_dev" node dist/shared/database/migrate-cli.js
```

Idempotent — safe to re-run. Prints `{"msg":"migrations up to date","skipped":N}` when there's nothing new.

## 4. Run the composed server (API + Skills + Connectors)

```bash
cd apps/server
node --env-file-if-exists=.env dist/main.js
```

This is the real deployable entrypoint (`apps/server/src/main.ts`) — it boots the `apps/api` platform core and installs the grocery + calendar Skills and the quick-commerce + Google Calendar connectors. Listens on `PORT` (default 3000).

If you get `EADDRINUSE` on 3000, a server from an earlier session is likely still running — check with `lsof -nP -iTCP:3000 -sTCP:LISTEN` before starting a duplicate.

Sanity check (expect `UNAUTHENTICATED`, not a connection error — that means auth middleware is live):

```bash
curl -s http://localhost:3000/v1/console/skills
```

## 5. Run the web frontend

```bash
cd apps/web
pnpm run dev
```

Vite dev server on `http://localhost:5173`, proxies `/v1` to `http://localhost:3000` (see `apps/web/vite.config.ts`) so cookies/CORS stay simple in dev.

Use the **"Sign in (dev)"** button in the header to get a dev session token — no real auth flow needed locally.

## 6. Grant capabilities so the AI can actually call tools

A freshly-minted dev user has **zero granted capabilities** (deny-by-default, ADR-0006). Until it's subscribed to a plan, the chat AI will only converse — the planner has no tools it's allowed to call and the execution log shows `0 capabilities` / `none available`. This is not a bug; it's the permission system working as designed.

Subscribe the signed-in user to the `pro` plan (grants all Grocery + Calendar capabilities — see `apps/api/migrations/0017_seed_catalog.sql`) via the dev-only endpoint, then reload:

```js
// run in the browser console on the web app (localhost:5173)
fetch('/v1/dev/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('lifeos_token') },
  body: JSON.stringify({ planKey: 'pro' }),
}).then(r => r.json()).then(console.log);
location.reload();
```

`POST /v1/dev/subscribe` is disabled when `NODE_ENV=production` (`apps/api/src/modules/dev/dev.controller.ts`) — it's a local/dev convenience only; real deployments go through billing.

## Notes

- `apps/console` is a separate admin web app (same `dev`/`build` scripts as `apps/web`) if you need it.
- `packages/ai-core` `local` provider is deterministic and needs no API key — useful when you don't want to burn OpenAI credits during manual testing.
- Full command reference: `pnpm run build|lint|typecheck|test|check` at the repo root run across all workspaces via Turbo.
