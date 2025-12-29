import { Module } from '@nestjs/common';
import { CompanyUserService } from './company-user.service';
import { CompanyUserController } from './company-user.controller';
import { CompanyUserRepository } from './repository/company-user.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyUser, CompanyUserSchema } from './schema/company-user.schema';
import { AuthSharedModule } from '../auth/auth-shared.module';

@Module({
  imports: [
    AuthSharedModule,
    MongooseModule.forFeature([
      { name: CompanyUser.name, schema: CompanyUserSchema },
    ]),
  ],
  controllers: [CompanyUserController],
  providers: [CompanyUserService, CompanyUserRepository],
  exports: [CompanyUserService, CompanyUserRepository],
})
export class CompanyUserModule {}
