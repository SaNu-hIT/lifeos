import { Global, Module } from '@nestjs/common';
import { PERMISSION_PORT, type PermissionPort } from '@lifeos/contracts';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { HOME_ENGINE } from './domain/ports/home.port.js';
import { WidgetInstanceRepository } from './adapters/out/widget-instance.repository.js';
import { HomeEngine } from './home.engine.js';
import { HomeController } from './adapters/in/home.controller.js';

@Global()
@Module({
  controllers: [HomeController],
  providers: [
    {
      provide: WidgetInstanceRepository,
      useFactory: (db: DatabasePort) => new WidgetInstanceRepository(db),
      inject: [DATABASE],
    },
    {
      provide: HOME_ENGINE,
      useFactory: (permissions: PermissionPort, instances: WidgetInstanceRepository) =>
        new HomeEngine(permissions, instances),
      inject: [PERMISSION_PORT, WidgetInstanceRepository],
    },
  ],
  exports: [HOME_ENGINE],
})
export class HomeModule {}
