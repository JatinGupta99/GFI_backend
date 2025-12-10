import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/utils/logger.config'
import { AuthModule } from './modules/auth/auth.module';
import { CompanyUserModule } from './modules/company-user/company-user.module';
import { configuration } from './common/config';
import { DatabaseModule } from './database/database.module';
@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    AuthModule,
    CompanyUserModule
  ],
})
export class AppModule {}
