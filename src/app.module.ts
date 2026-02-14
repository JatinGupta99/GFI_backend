import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/utils/logger.config';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyUserModule } from './modules/company-user/company-user.module';
import { configuration } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { LeadsModule } from './modules/leads/leads.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { RentRollModule } from './modules/rent-roll/rent-roll.module';
import { PropertyAssetsModule } from './modules/property-assets/property-assets.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

import { PropertyManagementModule } from './modules/property-management/property-management.module';
import { LeasingModule } from './modules/leasing/leasing.module';
import { AppCacheModule } from './common/cache/app-cache.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    WinstonModule.forRootAsync({
      useFactory: (configService: ConfigService) => winstonConfig(configService),
      inject: [ConfigService],
    }),
    DatabaseModule,
    AuthModule,
    LeadsModule,
    CompanyUserModule,
    TasksModule,
    RentRollModule,
    PropertyAssetsModule,
    PropertiesModule,
    PropertyManagementModule,
    LeasingModule,
    AppCacheModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule { }
