import { Global, Module } from '@nestjs/common';
import { DATABASE, type DatabasePort } from '../database/database.port.js';
import { AUDIT_LOG, AuditLog } from './audit-log.js';

@Global()
@Module({
  providers: [
    { provide: AUDIT_LOG, useFactory: (db: DatabasePort) => new AuditLog(db), inject: [DATABASE] },
  ],
  exports: [AUDIT_LOG],
})
export class AuditModule {}
