import { Global, Module } from '@nestjs/common';
import { SKILL_REGISTRY, TOOL_REGISTRY, type ToolRegistryPort } from '@lifeos/contracts';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { SkillsRepository } from './adapters/out/skills.repository.js';
import { SkillRegistry } from './skill-registry.js';

@Global()
@Module({
  providers: [
    {
      provide: SkillsRepository,
      useFactory: (db: DatabasePort) => new SkillsRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SKILL_REGISTRY,
      useFactory: (tools: ToolRegistryPort, repo: SkillsRepository) =>
        new SkillRegistry(tools, repo),
      inject: [TOOL_REGISTRY, SkillsRepository],
    },
  ],
  exports: [SKILL_REGISTRY],
})
export class SkillRegistryModule {}
