import { Module } from '@nestjs/common';
import { ConsoleController } from './console.controller.js';

/** Wires the read-only Developer Console endpoints. All dependencies (registries,
 *  permission, context engine) are @Global providers, so no imports are needed. */
@Module({
  controllers: [ConsoleController],
})
export class ConsoleModule {}
