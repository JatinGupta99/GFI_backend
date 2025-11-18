import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/utils/logger.config';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyUserModule } from './modules/company-user/company-user.module';
@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRoot(process.env.MONGO_URI || ''),
    AuthModule,
    CompanyUserModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
