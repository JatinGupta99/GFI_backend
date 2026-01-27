import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule { }
