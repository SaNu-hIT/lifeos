import { Module } from '@nestjs/common';
import { loadAppConfig } from '../../config/app-config.js';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { AUTH_PORT } from './domain/ports/auth.port.js';
import { USER_REPOSITORY } from './domain/ports/user-repository.port.js';
import { DevAuthAdapter } from './adapters/out/dev-auth.adapter.js';
import { PgUserRepository } from './adapters/out/user.repository.js';
import { ProvisionUserService } from './application/provision-user.service.js';
import { AuthGuard } from './adapters/in/auth.guard.js';
import { IdentityController } from './adapters/in/identity.controller.js';

@Module({
  controllers: [IdentityController],
  providers: [
    { provide: AUTH_PORT, useFactory: () => new DevAuthAdapter(loadAppConfig().AUTH_JWT_SECRET) },
    {
      provide: USER_REPOSITORY,
      useFactory: (db: DatabasePort) => new PgUserRepository(db),
      inject: [DATABASE],
    },
    ProvisionUserService,
    AuthGuard,
  ],
  exports: [AUTH_PORT],
})
export class IdentityModule {}
