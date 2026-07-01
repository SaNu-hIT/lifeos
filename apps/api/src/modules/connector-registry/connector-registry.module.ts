import { Global, Module } from '@nestjs/common';
import { CONNECTOR_REGISTRY } from '@lifeos/contracts';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { ConnectorsRepository } from './adapters/out/connectors.repository.js';
import { ConnectorRegistry } from './connector-registry.js';

@Global()
@Module({
  providers: [
    {
      provide: ConnectorsRepository,
      useFactory: (db: DatabasePort) => new ConnectorsRepository(db),
      inject: [DATABASE],
    },
    {
      provide: CONNECTOR_REGISTRY,
      useFactory: (repo: ConnectorsRepository) => new ConnectorRegistry(repo),
      inject: [ConnectorsRepository],
    },
  ],
  exports: [CONNECTOR_REGISTRY],
})
export class ConnectorRegistryModule {}
