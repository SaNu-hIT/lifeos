import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module.js';
import { DevController } from './dev.controller.js';

/** DEV-ONLY endpoints (the controller itself refuses to run in production). Imports
 *  SubscriptionModule for SubscriptionService; AuthGuard resolves via the global
 *  IdentityModule. */
@Module({
  imports: [SubscriptionModule],
  controllers: [DevController],
})
export class DevModule {}
