---
title: Module Template
status: Authoritative
version: 1.0.0
type: template
---

# Module Template (Hexagonal)

> Copy this for any platform **module** (engine or service area). Enforces the hexagonal/DDD structure from [ADR-0003](../docs/adr/adr-0003-hexagonal-ddd.md). Dependencies point inward; the domain imports no framework.

References: [02 §4](../docs/02_LifeOS_Platform_Architecture.md) · [03 §3](../docs/03_LifeOS_Engineering_Handbook.md)

## Folder structure

```
<module>/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   └── ports/                 # interfaces the application depends on
├── application/
│   ├── commands/              # write use cases (CQRS command side)
│   ├── queries/               # read use cases (CQRS query side)
│   └── services/
├── adapters/
│   ├── in/                    # controllers / event handlers / tool entrypoints
│   └── out/                   # repositories / clients / bus / cache
├── <module>.module.ts         # NestJS DI wiring
└── test/{unit,integration}/
```

## Port + adapter pattern

```ts
// domain/ports/widget-repository.port.ts  (no framework imports)
export interface WidgetRepositoryPort {
  save(w: WidgetInstance): Promise<void>;
  listForUser(userId: string): Promise<WidgetInstance[]>;
}

// adapters/out/widget.repository.ts
@Injectable()
export class PgWidgetRepository implements WidgetRepositoryPort { /* SQL here */ }

// <module>.module.ts
@Module({
  providers: [{ provide: WidgetRepositoryPort, useClass: PgWidgetRepository }, /* services */],
})
export class WidgetModule {}
```

## Rules checklist

- [ ] No `@nestjs/*`, `pg`, `openai`, or `@supabase/*` import in `domain/`.
- [ ] Application depends on **ports**, never concretes.
- [ ] DI wires ports → adapters in `<module>.module.ts`.
- [ ] CQRS split only where it pays ([03 §8](../docs/03_LifeOS_Engineering_Handbook.md)).
- [ ] Domain events named past-tense; emitted via outbox.

## Tests

- [ ] Unit tests for domain/application with mocked ports.
- [ ] Integration tests for adapters (real PG/Redis via testcontainers).

## Definition of Done

- [ ] Module compiles, wires, and tests green at gate.
- [ ] Public surface (if any) lives in `@lifeos/contracts` and is versioned.
- [ ] Docs + [06 PROJECT_STATE](../docs/06_PROJECT_STATE.md) updated.

## Future extension points

- Promote a port to a network port for service extraction ([ADR-0001](../docs/adr/adr-0001-modular-monolith.md)).
