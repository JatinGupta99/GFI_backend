import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadsRepository } from './repository/lead.repository';
import { Lead, LeadSchema } from './schema/lead.schema';
import { MailModule } from '../mail/mail.module';
import { MediaModule } from '../media/media.module';
import { CompanyUserModule } from '../company-user/company-user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    MailModule,
    MediaModule,
    CompanyUserModule,
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsRepository],
})
export class LeadsModule { }
