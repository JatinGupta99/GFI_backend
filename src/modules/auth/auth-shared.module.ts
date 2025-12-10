import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserResetToken, UserResetTokenSchema } from './schema/user-reset-token.schema';
import { UserResetTokenRepository } from './repository/user-reset-token.repository';
import { UserTokenService } from './user-token.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    MongooseModule.forFeature([{ name: UserResetToken.name, schema: UserResetTokenSchema }]),
  ],
  providers: [UserResetTokenRepository, UserTokenService],
  exports: [UserTokenService],
})
export class AuthSharedModule { }
