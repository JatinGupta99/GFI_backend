import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { Renewal, RenewalSchema } from './renewal.entity';

// Controllers
import { RenewalsController } from './renewals.controller';

// Services
import { RenewalQueryService } from './services/renewal-query.service';
import { RenewalSyncService } from './services/renewal-sync.service';
import { RenewalSchedulerService } from './services/renewal-scheduler.service';
import { FieldMappingService } from './services/field-mapping.service';

// Repositories
import { RenewalRepository } from './repositories/renewal.repository';

// Providers
import { MriRenewalProvider } from './providers/mri-renewal.provider';

// Processors
import { RenewalSyncProcessor } from './processors/renewal-sync.processor';

// External modules
import { PropertiesModule } from '../properties/properties.module';
import { RentRollModule } from '../rent-roll/rent-roll.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    // Scheduler for cron jobs
    ScheduleModule.forRoot(),

    // Database
    MongooseModule.forFeature([
      { name: Renewal.name, schema: RenewalSchema },
    ]),

    // Queue for background sync jobs (uses Redis)
    BullModule.registerQueue({
      name: 'renewal-sync',
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),

    // Cache - In-memory cache (Redis used for BullMQ queues)
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          ttl: 600, // 10 minutes default TTL
          max: 1000, // Maximum number of items in cache
        };
      },
    }),

    // External dependencies
    PropertiesModule,
    RentRollModule,
    MediaModule,
  ],

  controllers: [
    RenewalsController,
  ],

  providers: [
    // Core services
    RenewalQueryService,
    RenewalSyncService,
    RenewalSchedulerService,
    FieldMappingService,

    // Repository
    RenewalRepository,

    // Providers (following SOLID principles)
    MriRenewalProvider,

    // Background processors
    RenewalSyncProcessor,
  ],

  exports: [
    // Export services for use in other modules
    RenewalQueryService,
    RenewalSyncService,
    RenewalRepository,
  ],
})
export class RenewalsModule {}