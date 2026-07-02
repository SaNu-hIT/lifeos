import { Global, Module } from '@nestjs/common';
import { loadAppConfig } from '../../config/app-config.js';
import { DATABASE } from './database.port.js';
import { PgDatabaseAdapter } from './pg-database.adapter.js';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: () => {
        const config = loadAppConfig();
        return new PgDatabaseAdapter(config.DATABASE_URL, {
          max: config.DB_POOL_MAX,
          idleTimeoutMillis: config.DB_POOL_IDLE_MS,
          connectionTimeoutMillis: config.DB_CONN_TIMEOUT_MS,
        });
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
