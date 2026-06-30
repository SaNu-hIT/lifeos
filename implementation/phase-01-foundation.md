---
title: Phase 01 — Foundation & Monorepo
status: Detailed
band: Platform
phase: 1
depends_on: []
estimate: 3–5 days
---

# Phase 01 — Foundation & Monorepo

> Build order: [05 Roadmap](../docs/05_IMPLEMENTATION_ROADMAP.md). Rules: [07 AI Agent Instructions](../docs/07_AI_AGENT_INSTRUCTIONS.md). Standards: [03 Handbook](../docs/03_LifeOS_Engineering_Handbook.md).

## 1. Overview
Establish the monorepo skeleton, toolchain, and CI that every later phase builds on. No product behavior yet — this phase makes the repo buildable, lintable, testable, and enforces the architectural boundaries from [ADR-0001](../docs/adr/adr-0001-modular-monolith.md)/[ADR-0002](../docs/adr/adr-0002-monorepo-turborepo.md) mechanically. After this phase the repo builds green with one trivial package per workspace area.

## 2. Objectives
- Initialize Turborepo + pnpm workspaces with the layout from [03 §2](../docs/03_LifeOS_Engineering_Handbook.md).
- Shared `tsconfig`, `eslint-config` (incl. dependency-direction rule), Prettier, commitlint.
- A CI pipeline: install → lint → typecheck → dep-direction check → test → build.
- Placeholder packages so the workspace graph exists: `@lifeos/contracts`, `@lifeos/config`, and an empty `apps/api`.

## 3. Requirements
- pnpm workspace + `turbo.json` task graph with caching.
- TypeScript strict mode everywhere; Node LTS pinned via `.nvmrc`/`engines`.
- ESLint with a **dependency-direction** rule: `apps/api` may not import `skills/*` or `connectors/*`; nothing imports app code; domain layers may not import frameworks (rule stub now, tightened as layers appear).
- Conventional Commits enforced (commitlint + husky or CI check).
- CI runs only **affected** packages (`turbo run ... --filter`).

## 4. Architecture
```mermaid
graph TD
    subgraph Workspace
        contracts[@lifeos/contracts] --> api[apps/api]
        config[@lifeos/config] --> api
        tsconfig[packages/tsconfig] -.-> all
        eslint[packages/eslint-config] -.-> all
    end
    CI[CI: lint→typecheck→dep-check→test→build] --> Workspace
```
The dependency-direction check is the load-bearing artifact of this phase — it is what keeps the modular monolith modular over 10 years.

## 5. Folder structure (created this phase)
```
lifeos/
├── apps/api/                 # empty NestJS placeholder (boots in phase-02)
├── packages/
│   ├── contracts/            # empty index, version 0.0.0
│   ├── config/               # typed env loader skeleton
│   ├── tsconfig/             # base.json, nest.json, next.json
│   └── eslint-config/        # index.js + dependency-direction rule
├── turbo.json
├── pnpm-workspace.yaml
├── package.json              # root scripts: dev/build/lint/test/typecheck
├── .nvmrc  .gitignore  .editorconfig  commitlint.config.cjs
└── .github/workflows/ci.yml
```

## 6. Components
| Component | Purpose |
|-----------|---------|
| `turbo.json` | task graph + remote/local cache |
| `eslint-config` | shared rules + custom dependency-direction rule |
| `tsconfig` | strict base configs per app type |
| CI workflow | gates every PR |
| `@lifeos/config` skeleton | typed env loader (filled in later phases) |

## 7. Interfaces
No public domain contracts yet. The only "interface" is the **build/lint/test contract**: `pnpm install && pnpm turbo run lint typecheck test build` must pass from a clean clone.

## 8. Diagrams
```mermaid
graph LR
    PR --> Install --> Lint --> Typecheck --> DepCheck[dep-direction] --> Test --> Build --> Green
```

## 9. Examples
`turbo.json` (illustrative):
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "lint": {}, "typecheck": {}, "test": { "dependsOn": ["^build"] }
  }
}
```

## 10. Tests
- A trivial unit test in `@lifeos/contracts` proving the test runner + coverage work.
- A CI assertion that the dependency-direction rule **fails** on a deliberately wrong import (negative test) and passes otherwise.

## 11. Acceptance Criteria
- [ ] `pnpm install` succeeds from a clean clone.
- [ ] `pnpm turbo run lint typecheck test build` is green.
- [ ] CI runs on PR and blocks merge on any failure.
- [ ] A forbidden import (`apps/api` → `skills/*`) fails lint.
- [ ] Conventional Commit enforcement active.

## 12. Definition of Done
- [ ] All Acceptance Criteria met.
- [ ] Layout matches [03 §2](../docs/03_LifeOS_Engineering_Handbook.md).
- [ ] [06 PROJECT_STATE](../docs/06_PROJECT_STATE.md) updated: phase-01 complete, next = phase-02.
- [ ] README with one-command setup.

## 13. AI Coding Prompt
See [prompts/phase-01.md](../prompts/phase-01.md). In short: read 07 + 06, scaffold the monorepo and CI exactly per this spec and [03 §2], add the dependency-direction lint rule with a negative test, do **not** implement any engine or Skill, update PROJECT_STATE.

## 14. Future Improvements
- Turborepo remote cache; partial clone for large-repo speed.
- A `lifeos new` generator wired to `templates/`.
- Mechanical "single-phase scope" and "no frozen-contract change" CI checks ([07 §9](../docs/07_AI_AGENT_INSTRUCTIONS.md)).

## 15. Known Risks
- **Boundary decay** if the dep-direction rule is weak → invest in the negative test now.
- Toolchain version drift → pin Node/pnpm, commit lockfile.

## 16. Dependencies
None (first phase).

## 17. Review Checklist
- [ ] Clean clone builds green.
- [ ] Dep-direction rule proven by negative test.
- [ ] No engine/Skill code introduced.
- [ ] PROJECT_STATE + README updated.

## Future Extension Points
The workspace graph and CI gates here are extended (never replaced) by every later phase; service extraction later adds new `apps/*` consuming the same packages.
