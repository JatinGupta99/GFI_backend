import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
    imports: [
        CacheModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                ttl: configService.get('cache.ttl') || 15 * 60 * 1000,
                isGlobal: true,
                // 15 mins default
                // In a real Redis setup, we would add the store and host/port here.
                // For now, we use the default memory store but with centralized config.
            }),
            inject: [ConfigService],
        }),
    ],
    exports: [CacheModule],
})
export class AppCacheModule { }
