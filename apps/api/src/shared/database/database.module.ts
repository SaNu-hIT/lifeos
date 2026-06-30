import { Global, Module } from '@nestjs/common';
import { loadAppConfig } from '../../config/app-config.js';
import { DATABASE } from './database.port.js';
import { PgDatabaseAdapter } from './pg-database.adapter.js';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: () => new PgDatabaseAdapter(loadAppConfig().DATABASE_URL),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
