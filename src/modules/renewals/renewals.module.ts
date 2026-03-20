import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { Renewal, RenewalSchema } from './renewal.entity';

// Controllers
import { RenewalsController } from './renewals.controller';

// Services
import { FieldMappingService } from './services/field-mapping.service';
import { MriBatchOptimizerService } from './services/mri-batch-optimizer.service';
import { MriCacheStrategyService } from './services/mri-cache-strategy.service';
import { MriChargesService } from './services/mri-charges.service';
import { MriDataAggregatorService } from './services/mri-data-aggregator.service';
import { MriFinancialService } from './services/mri-financial.service';
import { RenewalQueryService } from './services/renewal-query.service';
import { RenewalSchedulerService } from './services/renewal-scheduler.service';
import { RenewalSyncService } from './services/renewal-sync.service';

// Repositories
import { RenewalRepository } from './repositories/renewal.repository';

// Providers
import { MriRenewalProvider } from './providers/mri-renewal.provider';

// Processors
import { RenewalSyncProcessor } from './processors/renewal-sync.processor';

// External modules
import { LeasingModule } from '../leasing/leasing.module';
import { MediaModule } from '../media/media.module';
import { PropertiesModule } from '../properties/properties.module';
import { RentRollModule } from '../rent-roll/rent-roll.module';

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
    forwardRef(() => PropertiesModule),
    RentRollModule,
    MediaModule,
    forwardRef(() => LeasingModule),
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

    // MRI services
    MriChargesService,
    MriFinancialService,
    MriDataAggregatorService,
    MriCacheStrategyService,
    MriBatchOptimizerService,

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