---
title: Next Skills Backlog — Gmail Summarizer & WhatsApp Messenger
status: Draft (spec, not yet implemented)
version: 1.0.0
last_updated: 2026-07-04
owner: Whoever picks this up next
audience: AI agents (read before implementing) + reviewers
---

# Next Skills Backlog

> Specs for the next two Skills to build, in the same shape as [templates/skill-template.md](../templates/skill-template.md). Nothing here is implemented yet — this is the plan to implement against. Read [06 PROJECT_STATE](06_PROJECT_STATE.md) first for current platform state, and [02 Architecture §11](02_LifeOS_Platform_Architecture.md#11-tool-system) for the Tool contract (including the `followUps`/`followUpsFor` convention every new tool must consider).

Both Skills below need a platform capability that no existing Skill (Grocery/Calendar/Workout/Wellness/Finance/Meal/Habit) has needed yet: **a per-user connection to a third-party account** (Gmail OAuth, WhatsApp Business number). See [§3 Cross-cutting platform gaps](#3-cross-cutting-platform-gaps-both-skills-need) before starting either — that work is a shared prerequisite, not part of either Skill's own package.

---

## 1. Gmail Summarizer (`@lifeos/skill-gmail`)

### What it does
Reads the user's Gmail inbox (via the Gmail API, OAuth-connected) and lets the AI compose digests/summaries — "what's new in my inbox", "summarize this thread", "anything urgent from my boss today". Read-only in v1: no sending, archiving, or labeling.

### Capabilities
| Capability | Grants |
|---|---|
| `gmail.read` | List/search/summarize email metadata + bodies |

No `gmail.write` in v1 (see [§4 Future extensions](#4-future-extensions)).

### Tools
Follow the same **data-only summary tool** pattern already used by `wellness.get_history_summary` / `workout.get_history_summary` / `finance.get_summary` — the tool returns structured data, the AI composes the actual digest in its reply (ADR-0004: Skills/tools hold no AI logic).

| Tool | Capability | Notes |
|---|---|---|
| `gmail.list_recent` | `gmail.read` | `{ lookbackHours?, unreadOnly? }` → recent messages (id, from, subject, snippet, receivedAt, isUnread, labels). DATA ONLY, same pattern as `get_history_summary`. If the account isn't connected yet, return `{ connected: false }` so the Planner asks the user to connect Gmail instead of guessing. |
| `gmail.search` | `gmail.read` | `{ query, maxResults? }` — freeform Gmail search-syntax query (`from:`, `after:`, etc. — pass through to the provider, don't reinvent Gmail's query language). |
| `gmail.get_thread` | `gmail.read` | `{ threadId }` → full thread (all messages, bodies) for "summarize this thread" / "what did X say about Y". |
| `gmail.get_message` | `gmail.read` | `{ messageId }` → single message body, for a targeted "summarize the last email from X". |

`followUps` (per [02 §11](02_LifeOS_Platform_Architecture.md#11-tool-system)):
- `gmail.list_recent` → `followUpsFor`: if any unread messages look time-sensitive (has `isUnread: true` and count > 0), offer `{ label: "Search for something specific", prompt: "search my gmail for ..." }`. Keep it light — this tool is read-only, so there's no "mark done" state to react to yet.
- `gmail.get_thread` / `gmail.get_message` → no natural next step until write tools exist (v2).

### Connector
New `@lifeos/connector-gmail`, implementing a `GmailProviderPort` (`listMessages`, `searchMessages`, `getThread`, `getMessage`) over the real **Gmail API** (`https://gmail.googleapis.com/gmail/v1/...`), following the repo's dependency-free `fetch`-based HTTP convention (see [`openai-provider.ts`](../packages/ai-core/src/openai-provider.ts) for the pattern — no Google SDK dependency, direct REST calls with an injectable `fetch` for tests).

- Auth: OAuth2 authorization-code flow, `gmail.readonly` scope only (least privilege for v1).
- Token refresh: the connector must transparently refresh an expired access token using the stored refresh token before retrying a 401.

### Context / surface
- No context provider in v1 (nothing else needs to read Gmail state).
- Home widget: "Inbox" — unread count + `connected: boolean` (hides if not connected, same pattern as Wellness/Workout widgets hiding on zero history — see [`createWellnessWidgets`](../skills/wellness/src/surface.ts)).
- No activity projections or notifications in v1 (polling Gmail for push notifications needs Google Pub/Sub webhook setup — defer to v2, see below).

### Data model
None owned by this Skill in v1 — it's a stateless read-through to Gmail (no local copy of email content, for privacy/simplicity). The only persistent state is the OAuth token itself, owned by the cross-cutting integration store (§3), not by this Skill's schema.

### Definition of done
- [ ] `createGmailSkill(deps)` factory, `GmailProviderPort`, 4 tools above.
- [ ] Contract kit test (manifest/tools/capabilities) + unit tests mocking the provider port.
- [ ] `connector-gmail` passes a `runGmailProviderContractTests` kit (mirroring `runGroceryProviderContractTests`) against a fixture/mock Gmail API response set.
- [ ] "not connected yet" path returns actionable data (`{connected:false}`), never a raw provider error.
- [ ] Docs + [06 PROJECT_STATE](06_PROJECT_STATE.md) updated when done.

### Future extensions
- `gmail.write` capability: `gmail.mark_read`, `gmail.archive`, `gmail.draft_reply` (drafts only — never auto-send email, that's a different trust bar than WhatsApp's explicit-confirmation send).
- Push notifications via Gmail API watch + Pub/Sub, instead of poll-on-demand.

---

## 2. WhatsApp Messenger (`@lifeos/skill-whatsapp`)

### What it does
Sends WhatsApp messages on the user's behalf. The user types something like `tell @Raj I'll be 10 min late`, the assistant resolves `@Raj` to a saved contact, **polishes/rewrites the draft wording**, and sends it — after the user confirms the exact final text.

### ⚠️ Read this before implementing: WhatsApp's real constraints
"Send a free-text WhatsApp message to anyone, anytime" is **not** what any legitimate integration path allows:
- **Only the WhatsApp Business Platform (Cloud API)** is a sanctioned way to send automated messages from code. Automating a personal WhatsApp account via unofficial libraries (`whatsapp-web.js`, browser automation, etc.) violates WhatsApp's Terms of Service and risks the number being banned — do not build the connector that way.
- The Cloud API enforces **conversation windows**: you can send a free-form message only within 24 hours of the recipient's last message to your business number. Outside that window, only a **pre-approved message template** (submitted to Meta ahead of time) can be sent.
- This means "polished free text to anyone, any time" only works for contacts inside an open 24h session; everything else needs a template — the AI's "polish and rewrite" step still applies, but it fills a template's variable slots rather than composing fully free text.
- Document this constraint in the user-facing description so expectations are set correctly (mirrors how `meal.generate_grocery_list`'s description is explicit about what it does and doesn't do).

### Capabilities
| Capability | Grants |
|---|---|
| `contacts.read` | Search/list the user's saved contacts (shared with any future skill that needs to resolve a person by name) |
| `whatsapp.send` | Send a WhatsApp message to a resolved contact |

### The `@mention` contact-picking UX
This is **mostly a frontend feature**, not a planner/tool trick:
1. In [Chat.tsx](../apps/web/src/components/Chat.tsx), typing `@` opens an autocomplete dropdown backed by `contacts.search_contacts` (debounced, as-you-type).
2. Picking a contact from the dropdown inserts a resolved reference (e.g. `@Raj#<contactId>` rendered as `@Raj` — same pattern chat UIs like Slack/Discord use: the visible text is the name, the underlying message carries the id) so the backend never has to fuzzy-match a name against contacts at plan time.
3. The Planner still needs a fallback for prose without an explicit `@mention` (e.g. "message Raj that..." with no picker used) — in that case `whatsapp.send_message` should accept either `contactId` or a bare `contactName` and the tool resolves the name against `contacts.search_contacts` itself, erroring (or raising `ClarificationRequiredError`, the same mechanism `grocery.compare_prices` uses for ambiguous brand picks — see [tool.ts:28](../packages/contracts/src/tool/tool.ts)) if more than one contact matches.

### Tools
| Tool | Capability | Notes |
|---|---|---|
| `contacts.search_contacts` | `contacts.read` | `{ query }` → matching contacts (id, name, phone). Powers both the frontend `@` autocomplete and same-turn name resolution. |
| `contacts.list_contacts` | `contacts.read` | No args → full contact list (for a "who can I message" question). |
| `whatsapp.send_message` | `whatsapp.send` | `{ contactId?, contactName?, message }`. **`message` must already be the fully polished/rewritten final text** — composing/rewriting the draft is the Planner/LLM's job (ADR-0004: tools hold no AI logic), so by the time this tool is called, `message` is what will literally be sent. `requiresConfirmation: true` (irreversible, third-party-visible — same bar as `grocery.place_order`). Raises `ClarificationRequiredError` on an ambiguous `contactName` match. |
| `whatsapp.list_recent_chats` | `whatsapp.read` (optional, add only if useful) | Recent conversations, for context grounding ("what did I last tell Raj"). |

**Why the rewrite has to happen before the tool call, not inside it:** the Planner is the only layer allowed to touch the LLM (ADR-0004). So the flow is: user's raw ask → Planner reads it, decides "this maps to `whatsapp.send_message`", and **composes the polished message text itself** as the tool's `message` arg — the tool then just delivers exactly that string. This needs an addition to the planner system prompt (in [ai-planner.ts](../apps/api/src/modules/planner/ai-planner.ts), same file touched in the wellness follow-up fix) instructing it: *"for `whatsapp.send_message`, don't pass the user's raw wording — rewrite it into a clear, polite, complete message before calling the tool."*

**Confirmation UX gap to close first:** today `awaiting_confirmation` (see [orchestrator.ts](../apps/api/src/modules/orchestrator/orchestrator.ts)) only round-trips a `toolName` + `token` — the web UI doesn't render the pending tool's *args* back to the user. For WhatsApp this matters a lot: the user must see the **exact polished text** before approving a send, not just click a bare "confirm?". This needs a small `Chat.tsx` change to show `plan.steps[].args` (or a tool-supplied human-readable preview) in the confirmation prompt. Flag this as a shared prerequisite, not WhatsApp-specific — Grocery's `place_order` would benefit from the same treatment.

`followUps`:
- `whatsapp.send_message` → `followUpsFor`: none by default (a sent message has no natural one-tap next step); resist adding one just to have one (per [02 §11](02_LifeOS_Platform_Architecture.md#11-tool-system), a follow-up should be a real next step, not decoration).
- `contacts.search_contacts` → none (pure lookup for the frontend, not typically the last tool in a turn).

### Connector
New `@lifeos/connector-whatsapp`, implementing a `WhatsAppProviderPort` (`sendMessage`, `sendTemplateMessage`, `getConversationWindow`) over the **WhatsApp Business Cloud API** (Meta Graph API `https://graph.facebook.com/v19.0/<phone-number-id>/messages`), same dependency-free `fetch` convention as `connector-gmail` above.

### Data model
New `contacts` schema (first-party, this Skill or a small shared `@lifeos/skill-contacts` if other Skills end up needing contact lookup too — start scoped to this Skill, extract only if a second consumer appears, per the "don't build for hypothetical future requirements" rule):
- `contacts.contacts` — `id, user_id, name, phone, created_at, updated_at` (+RLS, same shape as every other per-user table in this repo, e.g. `skills/finance`'s transactions table).

### Context / surface
- No context provider needed in v1.
- No home widget (a "messages" widget with no read-access to WhatsApp's own inbox — Cloud API is send/webhook-receive only for business numbers, not a general inbox reader — would be misleading; skip it).
- Activity projection: "Sent a WhatsApp message to X" (mirrors Grocery's order-placed projection).

### Definition of done
- [ ] `createWhatsAppSkill(deps)` factory, `WhatsAppProviderPort`, tools above.
- [ ] `contacts` migration + `ContactsRepositoryPort` + Postgres adapter (RLS).
- [ ] `connector-whatsapp` passes a `runWhatsAppProviderContractTests` kit against a fixture Graph API response set (24h-window allowed vs. template-required cases both covered).
- [ ] Planner prompt updated to compose polished `message` text before calling the tool (own test in `planner.test.ts`).
- [ ] Confirmation UI shows the pending tool's args (shared web-app change, benefits Grocery too).
- [ ] Docs + [06 PROJECT_STATE](06_PROJECT_STATE.md) updated when done.

---

## 3. Cross-cutting platform gap (both Skills need): third-party account connections

Every existing Skill either has no external connector (Workout/Wellness/Finance/Meal/Habit) or uses a connector that's stateless/simulated (Grocery, Calendar). Gmail and WhatsApp are the first Skills that need a **per-user OAuth/API credential stored and refreshed** — that's new platform surface, not Skill-specific code, and should land once and be reused by both:

- A small `IntegrationTokenPort`/`PgIntegrationTokenRepository` (new schema, e.g. `platform.integration_tokens`: `user_id, provider, access_token (encrypted), refresh_token (encrypted), expires_at`), RLS-scoped like every other per-user table.
- Encryption at rest for tokens — do not store raw OAuth tokens in plaintext columns; reuse whatever secret-handling convention [11 Security Guide](11_SECURITY_GUIDE.md) already establishes, or add one if none exists yet.
- A minimal OAuth callback flow (`GET /v1/integrations/:provider/connect`, `GET /v1/integrations/:provider/callback`) — small, provider-agnostic controller; each connector supplies its own authorize-URL builder + token-exchange call.
- `gmail.list_recent`'s `{connected:false}` result (and an equivalent for WhatsApp, if the business number itself isn't the constraint but a user-level linkage is) is how a Skill reports "not connected" without special-casing it in the Planner.

Recommend building this once as its own small piece of platform work **before** starting either Skill above, the same way Phase 14 (AI Provider Abstraction) was built ahead of Memory/Context because both needed it.

---

## 4. Suggested build order

1. Integration token storage + OAuth callback flow (§3) — shared prerequisite.
2. Gmail Summarizer (read-only, lower risk, proves the OAuth path end-to-end).
3. Contacts schema + `contacts.search_contacts`/`contacts.list_contacts` tools.
4. WhatsApp Messenger (send path, higher risk — irreversible, third-party-visible, needs the confirmation-preview UI fix first).
