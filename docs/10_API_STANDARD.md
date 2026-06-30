---
title: LifeOS API Standard
status: Authoritative
version: 1.0.0
last_updated: 2026-06-30
owner: Chief Architect
audience: Engineers + AI agents
---

# 10 — API Standard

> Conventions for every HTTP and realtime interface LifeOS exposes. Consistency here is what lets the Web, Mobile, and Console clients — and AI agents — consume the platform without surprises.

Related: [02 Architecture](02_LifeOS_Platform_Architecture.md) · [03 Handbook](03_LifeOS_Engineering_Handbook.md) · [11 Security](11_SECURITY_GUIDE.md) · [api-template](../templates/api-template.md)

---

## 1. Shape & versioning

- **REST/JSON** over HTTPS for request/response; **Realtime** (Supabase Realtime / WebSocket) for streaming and live updates ([phase-29](05_IMPLEMENTATION_ROADMAP.md)).
- **URL-versioned**: `/v1/...`. Breaking changes → new major version; additive changes are backward-compatible within a version.
- **Contract version** of `@lifeos/contracts` is tracked separately in [06 PROJECT_STATE](06_PROJECT_STATE.md) and follows semver; the public API version and the contracts version move together at majors.
- Resource paths are **plural nouns**; actions that aren't CRUD are sub-resources or verbs on a resource (`POST /v1/conversations/:id/messages`).

## 2. Standard envelopes

**Success:**
```json
{
  "data": { "id": "msg_01HZ...", "role": "assistant", "content": "..." },
  "meta": { "requestId": "req_01HZ...", "timestamp": "2026-06-30T10:00:00Z" }
}
```

**Error** (mirrors `LifeOSError`, [03 §5](03_LifeOS_Engineering_Handbook.md)):
```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Missing capability: grocery.order",
    "retryable": false,
    "details": { "requiredCapability": "grocery.order" },
    "requestId": "req_01HZ..."
  }
}
```
- `code` is a stable, documented enum (clients branch on `code`, never on `message`).
- `details` is always safe to log — **no PII, no provider/LLM internals** ([11 Security](11_SECURITY_GUIDE.md)).

## 3. Status codes

| Code | Use |
|------|-----|
| 200 / 201 | OK / created |
| 202 | Accepted — async work queued (e.g. long workflow) |
| 400 | `*_INVALID` — schema/validation failure |
| 401 / 403 | unauthenticated / `PERMISSION_DENIED` |
| 404 | not found (also when RLS hides a row) |
| 409 | conflict / idempotency replay mismatch |
| 422 | semantically invalid (e.g. plan not executable) |
| 429 | rate limited (with `Retry-After`) |
| 500 / 503 | unexpected / dependency down (`retryable: true`) |

## 4. Pagination

Keyset (cursor) pagination by default for feeds/messages:
```
GET /v1/conversations/:id/messages?limit=50&cursor=eyJpZCI6...
→ { "data": [...], "meta": { "nextCursor": "eyJpZCI6..." } }
```
Offset pagination is allowed only for small, bounded admin lists.

## 5. Idempotency

- All non-idempotent mutations accept an `Idempotency-Key` header. The server stores the first result and replays it for retries within a TTL window.
- Tools declare `idempotent` ([02 §11](02_LifeOS_Platform_Architecture.md)); the Tool Registry enforces idempotency for safe retries inside the Workflow Engine.

## 6. DTO rules

- Request/response DTOs are defined in `@lifeos/contracts`, validated at the edge (class-validator/zod) — **never trust the client**.
- DTOs are **not** domain entities; adapters map between them. Internal fields never leak.
- `snake_case` is **not** used in JSON; API uses `camelCase`. (DB uses `snake_case`; mapping happens in adapters.)
- Dates are ISO-8601 UTC strings. Money is an integer minor unit + currency code, never a float.

## 7. Core endpoints (illustrative v1)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/auth/session` | exchange Supabase token → session |
| `GET` | `/v1/me` | current user + capabilities |
| `POST` | `/v1/conversations` | start a conversation |
| `POST` | `/v1/conversations/:id/messages` | send a message (drives the turn) |
| `GET` | `/v1/conversations/:id/messages` | paginated history |
| `GET` | `/v1/home` | assembled home widgets |
| `GET` | `/v1/activities` | activity feed |
| `GET` | `/v1/notifications` | notifications |
| `GET` | `/v1/skills` | enabled Skills (capability-filtered) |
| `POST` | `/v1/console/skills/:key/...` | Dev Console (gated) |

**Example — sending a message:**
```http
POST /v1/conversations/cnv_01.../messages
Authorization: Bearer <token>
Idempotency-Key: 7e1f...
Content-Type: application/json

{ "content": "We're out of coffee and milk, order the usual." }
```
```json
{
  "data": {
    "turnId": "turn_01...",
    "status": "awaiting_confirmation",
    "assistantMessage": { "content": "I built a cart for ₹420 (coffee + 2× milk). Confirm?" },
    "confirmation": { "required": true, "planId": "pl_01..." }
  },
  "meta": { "requestId": "req_01...", "timestamp": "2026-06-30T10:00:00Z" }
}
```

## 8. Realtime conventions

- Channels are scoped per user/conversation and authorized by capability.
- Streamed assistant tokens, tool-progress, activity/notification pushes use typed event envelopes: `{ "type": "assistant.delta", "data": {...} }`.
- Realtime is an *optimization* over REST — every realtime update has a REST equivalent for catch-up.

## 9. OpenAPI policy

- The REST surface is described by an **OpenAPI** document generated from contracts/DTOs (single source of truth). Clients (web/mobile/console) generate types from it.
- The OpenAPI spec is checked in CI for backward compatibility within a major version.

## 10. Rate limiting & abuse

- Per-user and per-capability rate limits (Redis token buckets). `429` + `Retry-After`.
- LLM-backed endpoints have stricter budgets; abuse and cost controls live at the gateway, not in Skills.

---

## Future Evolution

- **gRPC/internal contracts** when modules become services — the same DTO discipline, different transport.
- **GraphQL BFF** for clients if aggregation needs grow (optional, behind the gateway).
- **Webhooks** for providers/partners, signed and replay-protected.
- **API keys / OAuth** for third-party Skill developers when the marketplace opens.
