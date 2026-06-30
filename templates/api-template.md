---
title: API Endpoint Template
status: Authoritative
version: 1.0.0
type: template
---

# API Endpoint Template

> Copy this when adding a new endpoint. Ensures every endpoint follows the [10 API Standard](../docs/10_API_STANDARD.md): versioned path, standard envelopes, typed DTOs, idempotency, pagination, capability gating.

## Specification block (fill this in first)

```
Endpoint:      POST /v1/<resource>/<id>/<action>
Purpose:       <one line>
Auth:          required | public
Capability:    <domain>.<action>   (or: none)
Idempotent:    yes | no   (if no → accepts Idempotency-Key)
Request DTO:   <Name>Dto         (in @lifeos/contracts)
Response DTO:  <Name>ResultDto   (in @lifeos/contracts)
Errors:        VALIDATION_INVALID, PERMISSION_DENIED, NOT_FOUND, ...
Pagination:    keyset (limit, cursor)  | none
```

## Request / response examples

```http
POST /v1/<resource>/<id>/<action>
Authorization: Bearer <token>
Idempotency-Key: <uuid>
Content-Type: application/json

{ "field": "value" }
```
```json
// 200
{ "data": { "...": "..." }, "meta": { "requestId": "req_...", "timestamp": "..." } }
```
```json
// error
{ "error": { "code": "PERMISSION_DENIED", "message": "...", "retryable": false, "details": {}, "requestId": "req_..." } }
```

## Checklist

- [ ] Path is **URL-versioned**, resource is a **plural noun**.
- [ ] Request/response **DTOs in `@lifeos/contracts`**, validated at the edge.
- [ ] JSON is `camelCase`; dates ISO-8601 UTC; money = integer minor unit + currency.
- [ ] Returns **standard envelope**; error `code`s from the documented enum.
- [ ] Capability gate applied; RLS covers data access ([11](../docs/11_SECURITY_GUIDE.md)).
- [ ] Idempotency header honored for non-idempotent mutations.
- [ ] Keyset pagination for list endpoints.
- [ ] OpenAPI updated (generated from DTOs); backward-compatible within the major version.
- [ ] Realtime equivalent considered for live data ([10 §8](../docs/10_API_STANDARD.md)).

## Tests

- [ ] E2E: success, validation failure (400), unauthenticated (401), permission denied (403), not found (404).
- [ ] Idempotency replay test.

## Definition of Done

- [ ] Endpoint live, documented, tested; envelope + status codes conform.
- [ ] [10 API Standard](../docs/10_API_STANDARD.md) endpoint table updated if a new core route.
