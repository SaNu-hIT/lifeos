import { Global, Module } from '@nestjs/common';
import { PERMISSION_PORT, type PermissionPort, TOOL_REGISTRY } from '@lifeos/contracts';
import { loadAppConfig } from '../../config/app-config.js';
import { AUDIT_LOG, type AuditLog } from '../../shared/audit/audit-log.js';
import { SchemaValidator } from './schema-validator.js';
import { ToolRegistry } from './tool-registry.js';

@Global()
@Module({
  providers: [
    SchemaValidator,
    {
      provide: TOOL_REGISTRY,
      useFactory: (permissions: PermissionPort, audit: AuditLog, validator: SchemaValidator) =>
        new ToolRegistry(permissions, audit, validator, loadAppConfig().AUTH_JWT_SECRET),
      inject: [PERMISSION_PORT, AUDIT_LOG, SchemaValidator],
    },
  ],
  exports: [TOOL_REGISTRY],
})
export class ToolRegistryModule {}
