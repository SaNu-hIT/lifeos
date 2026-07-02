// Public entrypoint of the platform core for COMPOSITION ROOTS (e.g. apps/server).
// A composition root is allowed to import skills + connectors (which apps/api may not,
// per ADR-0001) and wires them into the core through these exports. apps/api itself
// never imports a composition root, so there is no dependency cycle.

export { createApp, bootstrap } from './main.js';
export { SKILL_HOST, INSTALLED_SKILLS } from './modules/skill-host/skill-host.module.js';
export { SkillHost } from './modules/skill-host/skill-host.js';
export { IdempotentDispatcher } from './shared/events/subscribers/idempotent-dispatcher.js';
export { EVENT_BUS, type EventBusPort } from './shared/events/event-bus.port.js';
export { DATABASE, type DatabasePort, type Tx, type DbContext } from './shared/database/database.port.js';
export { loadAppConfig, type AppConfig } from './config/app-config.js';
