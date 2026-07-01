import { Global, Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { SKILL_REGISTRY, type SkillManifest, type SkillRegistryPort } from '@lifeos/contracts';
import { SubscriberRegistry } from '../../shared/events/subscribers/subscriber-registry.js';
import { ACTIVITY_ENGINE, type ActivityEnginePort } from '../activity/domain/ports/activity.port.js';
import {
  NOTIFICATION_ENGINE,
  type NotificationEnginePort,
} from '../notification/domain/ports/notification.port.js';
import { HOME_ENGINE, type HomeEnginePort } from '../home/domain/ports/home.port.js';
import {
  CONTEXT_PROVIDER_REGISTRY,
  ContextProviderRegistry,
} from '../context/context-provider-registry.js';
import { SkillHost } from './skill-host.js';

/** DI token for the SkillHost. */
export const SKILL_HOST = Symbol('SKILL_HOST');
/** DI token for the manifests bundled into this deployment (composition-root supplied). */
export const INSTALLED_SKILLS = Symbol('INSTALLED_SKILLS');

/** Installs all bundled Skills once the DI graph is ready (boot-time wiring). */
@Injectable()
class SkillHostInitializer implements OnModuleInit {
  constructor(
    @Inject(SKILL_HOST) private readonly host: SkillHost,
    @Inject(INSTALLED_SKILLS) private readonly manifests: SkillManifest[],
  ) {}

  async onModuleInit(): Promise<void> {
    await this.host.installAll(this.manifests);
  }
}

@Global()
@Module({
  providers: [
    // No Skills are bundled into the core by default (ADR-0001); a deployment's
    // composition root overrides this token to install its Skills.
    { provide: INSTALLED_SKILLS, useValue: [] as SkillManifest[] },
    {
      provide: SKILL_HOST,
      useFactory: (
        skills: SkillRegistryPort,
        activity: ActivityEnginePort,
        notifications: NotificationEnginePort,
        home: HomeEnginePort,
        context: ContextProviderRegistry,
        subscribers: SubscriberRegistry,
      ) => new SkillHost(skills, activity, notifications, home, context, subscribers),
      inject: [
        SKILL_REGISTRY,
        ACTIVITY_ENGINE,
        NOTIFICATION_ENGINE,
        HOME_ENGINE,
        CONTEXT_PROVIDER_REGISTRY,
        SubscriberRegistry,
      ],
    },
    SkillHostInitializer,
  ],
  exports: [SKILL_HOST],
})
export class SkillHostModule {}
