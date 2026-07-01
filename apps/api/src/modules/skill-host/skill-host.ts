import type { SkillManifest, SkillRegistryPort } from '@lifeos/contracts';
import type { SubscriberRegistry } from '../../shared/events/subscribers/subscriber-registry.js';
import type { ActivityEnginePort } from '../activity/domain/ports/activity.port.js';
import type { NotificationEnginePort } from '../notification/domain/ports/notification.port.js';
import type { HomeEnginePort } from '../home/domain/ports/home.port.js';
import type { ContextProviderRegistry } from '../context/context-provider-registry.js';

/**
 * The single seam where a Skill plugs into the whole platform (phase 22, docs/02 §10).
 * `install` registers the manifest (tools + compat + persistence via the Skill
 * Registry) and then wires every runtime contribution into its engine:
 *   activity projections → Activity Engine (phase 19)
 *   notification declarations → Notification Engine (phase 20)
 *   home widgets → Home Engine (phase 21)
 *   context providers → Context Provider Registry (phase 13)
 *   event handlers → Subscriber Registry (phase 06)
 * The core never imports a Skill; manifests are PROVIDED to the host (ADR-0001).
 */
export class SkillHost {
  constructor(
    private readonly skills: SkillRegistryPort,
    private readonly activity: ActivityEnginePort,
    private readonly notifications: NotificationEnginePort,
    private readonly home: HomeEnginePort,
    private readonly context: ContextProviderRegistry,
    private readonly subscribers: SubscriberRegistry,
  ) {}

  async install(manifest: SkillManifest): Promise<void> {
    // Compat check + tool forwarding + persistence (throws on incompatibility).
    await this.skills.register(manifest);

    for (const projection of manifest.activityProjections ?? []) {
      this.activity.registerProjection(projection);
    }
    for (const declaration of manifest.notifications ?? []) {
      this.notifications.registerDeclaration(declaration);
    }
    for (const widget of manifest.widgets ?? []) {
      this.home.registerWidget(widget);
    }
    for (const provider of manifest.contextProviders ?? []) {
      this.context.register(provider);
    }
    for (const { event, handler } of manifest.eventHandlers ?? []) {
      this.subscribers.on(event, `skill:${manifest.key}:${event}`, handler);
    }
  }

  /** Install many Skills, in order. Fail-fast: a bad manifest aborts boot. */
  async installAll(manifests: SkillManifest[]): Promise<void> {
    for (const manifest of manifests) {
      await this.install(manifest);
    }
  }
}
