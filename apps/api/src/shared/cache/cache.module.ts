import { Global, Module } from '@nestjs/common';
import { loadAppConfig } from '../../config/app-config.js';
import { CACHE } from './cache.port.js';
import { RedisCache } from './redis-cache.js';

@Global()
@Module({
  providers: [{ provide: CACHE, useFactory: () => new RedisCache(loadAppConfig().REDIS_URL) }],
  exports: [CACHE],
})
export class CacheModule {}
