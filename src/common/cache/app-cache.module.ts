import { Module, Global } from '@nestjs/common';
import { CacheModule, CacheInterceptor } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { ExecutionContext, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name);

  trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const { httpAdapter } = this.httpAdapterHost;

    // Only cache GET requests
    const isGetRequest = httpAdapter.getRequestMethod(request) === 'GET';
    if (!isGetRequest) {
      return undefined;
    }

    // Generate cache key based on URL and query params only (ignore headers like Authorization)
    const url = httpAdapter.getRequestUrl(request);
    this.logger.debug(`Cache key generated: ${url}`);
    return url;
  }
}

@Global()
@Module({
    imports: [
        CacheModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const logger = new Logger('CacheModule');
                
                try {
                    const store = await redisStore({
                        socket: {
                            host: configService.get('redis.host') || 'localhost',
                            port: configService.get('redis.port') || 6379,
                        },
                        ttl: configService.get('cache.ttl') || 900, // 15 minutes in seconds
                    });

                    logger.log('Redis cache store initialized successfully');

                    return {
                        store,
                        ttl: configService.get('cache.ttl') || 900, // 15 minutes in seconds
                        isGlobal: true,
                    };
                } catch (error) {
                    logger.error('Failed to initialize Redis cache store', error);
                    throw error;
                }
            },
            inject: [ConfigService],
        }),
    ],
    providers: [HttpCacheInterceptor],
    exports: [CacheModule, HttpCacheInterceptor],
})
export class AppCacheModule { }
