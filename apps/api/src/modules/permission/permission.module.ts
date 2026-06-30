import { Global, Module } from '@nestjs/common';
import { PERMISSION_PORT } from '@lifeos/contracts';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { CACHE, type CachePort } from '../../shared/cache/cache.port.js';
import { AUDIT_LOG, type AuditLog } from '../../shared/audit/audit-log.js';
import { GrantsRepository } from './adapters/out/grants.repository.js';
import { PERMISSION_ENGINE, PgPermissionEngine } from './permission.engine.js';

@Global()
@Module({
  providers: [
    { provide: GrantsRepository, useFactory: (db: DatabasePort) => new GrantsRepository(db), inject: [DATABASE] },
    {
      provide: PERMISSION_ENGINE,
      useFactory: (grants: GrantsRepository, cache: CachePort, audit: AuditLog) =>
        new PgPermissionEngine(grants, cache, audit),
      inject: [GrantsRepository, CACHE, AUDIT_LOG],
    },
    // The public port and the concrete engine are the same instance.
    { provide: PERMISSION_PORT, useExisting: PERMISSION_ENGINE },
  ],
  exports: [PERMISSION_PORT, PERMISSION_ENGINE],
})
export class PermissionModule {}
