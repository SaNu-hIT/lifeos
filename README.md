# LifeOS

An **AI-first Personal Operating System** — a conversational platform that hosts unlimited **Skills** (Grocery, Calendar, Fitness, Finance, …) over a shared memory and context layer. Grocery is Skill #1, not the product.

> 📖 **Start with the engineering manual:** [`docs/00_MASTER_INDEX.md`](docs/00_MASTER_INDEX.md). It is the source of truth for architecture, standards, the phased roadmap, and the rules every human and AI contributor follows.

## Repository layout

```
apps/         api (NestJS) · web · console · mobile        (Phase 02+)
packages/     contracts · config · tsconfig · eslint-config  (+ sdks, ai-core … later)
skills/       grocery · calendar · …                        (Phase 23+)
connectors/   blinkit · zepto · instamart · …               (Phase 25+)
docs/         the engineering operating manual
implementation/  per-phase specs (phase-01 … phase-36)
prompts/      one AI-coding prompt per phase
templates/    reusable scaffolds
```

## Getting started

Requires **Node 20** and **pnpm 9** (via Corepack).

```bash
corepack enable                 # provides pnpm
pnpm install                    # install workspace deps
pnpm run check                  # lint + typecheck + test + build (the full gate)
```

Individual tasks:

```bash
pnpm run lint        # ESLint, incl. the dependency-direction guardrail
pnpm run typecheck   # tsc --noEmit across packages
pnpm run test        # vitest across packages
pnpm run build       # tsc build across packages
pnpm run format      # prettier --write
```

## Architectural guardrails (enforced)

- The **core (`apps/api`) never imports a Skill or Connector** — they register at runtime. This is enforced by an ESLint rule with a negative test in [`apps/api/test/boundaries.test.ts`](apps/api/test/boundaries.test.ts). See [ADR-0001](docs/adr/adr-0001-modular-monolith.md).
- All public interfaces live in [`@lifeos/contracts`](packages/contracts) and are versioned/frozen.
- Conventional Commits are required (`feat(scope): …`).

## Build status & next step

This repo is at **Phase 01 (Foundation & Monorepo)** complete. The live build state is tracked in [`docs/06_PROJECT_STATE.md`](docs/06_PROJECT_STATE.md). The next phase is driven by [`prompts/phase-02.md`](prompts/phase-02.md).
